import {
  fetchRange,
  findHeader,
  MissingTabError,
  normalizeDate,
  normalizeText,
  parseClock,
  withinWindow,
} from "./sheets";
import type { SpecialOccasion, SpecialOccasionEntry } from "./types";

const SHEET_RANGE =
  process.env.SPECIAL_OCCASIONS_RANGE ?? "Speciale Gelegenheden!A1:M400";
const TIMEZONE = process.env.TIMEZONE ?? "Europe/Brussels";
const LOCALE = process.env.LOCALE ?? "nl-BE";

function parseBigSlide(raw: string): "periodic" | "permanent" | undefined {
  const value = normalizeText(raw);
  if (["permanent", "vast", "altijd", "blijvend"].includes(value))
    return "permanent";
  if (["yes", "ja", "x", "true", "waar", "periodiek", "aan"].includes(value))
    return "periodic";
  return undefined;
}

function formatEventDate(iso: string): string {
  try {
    const label = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${iso}T12:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return iso;
  }
}

const COLUMNS = {
  eventDate: ["datum", "date", "evenementdatum"],
  title: ["titel", "title"],
  // Bare "Weergave" too: it's what a column headed "Weergave Startdatum"
  // shortens to in practice, and left unmatched the start bound silently
  // disappears rather than failing loudly.
  displayFrom: [
    "weergavestartdatum",
    "weergavestart",
    "weergave",
    "toonvanaf",
    "toonvan",
    "vanaf",
  ],
  displayTo: ["weergaveeinddatum", "toontot", "totenmet", "toontotenmet"],
  // Never a bare "Startuur"/"Einduur": `timeFrom`/`timeTo` below are the clock
  // times of the programme rows themselves, and the two must not match each
  // other's header. "Weergave Startuur" gates the board; "Tijd van" is 09:30
  // 100m loop.
  displayFromTime: [
    "weergavestartuur",
    "weergavestarttijd",
    "toonvanaftijd",
    "toonvantijd",
    "toonvanafuur",
  ],
  displayToTime: [
    "weergaveeinduur",
    "weergaveeindtijd",
    "toontottijd",
    "toontotuur",
    "toontijdtot",
  ],
  bigSlide: ["bigslide", "grootscherm", "volledigscherm", "takeover"],
  timeFrom: ["tijdvan", "tijdvanaf", "begintijd", "start"],
  timeTo: ["tijdtot", "tijdtotenmet", "eindtijd", "einde"],
  activity: ["activiteit", "vak", "subject", "activity"],
  supervisor: ["begeleider", "leerkracht", "teacher", "supervisor"],
  info: ["info", "opmerking", "note", "toelichting"],
  location: ["locatie", "lokaal", "location", "room"],
};

type Bound = { date: string | null; minutes: number | null };

type OccasionGroup = {
  eventDate: string;
  title: string;
  bigSlide: "periodic" | "permanent" | undefined;
  /**
   * The show-window, taken from the row that opened the group and never
   * revised. An occasion is one board made of many programme rows, so it goes
   * up and comes down as a whole: letting each row carry its own window meant a
   * continuation row with a wider one could put the board up early, whatever
   * the first row said.
   */
  from: Bound;
  until: Bound;
  entries: SpecialOccasionEntry[];
};

/**
 * The occasion boards active now, split by how they take the screen.
 *
 * `Weergave Startdatum`/`Einddatum` bound the days; the optional `Weergave
 * Startuur`/`Einduur` sharpen their own boundary day into a moment, so a
 * sports-day board can go up at 07:45 rather than at midnight. `nowMinutes` is
 * null when another school day is being previewed, where those hours don't
 * apply.
 */
export async function readSpecialOccasions(
  today: string,
  nowMinutes: number | null,
): Promise<{
  regular: SpecialOccasion[];
  periodic: SpecialOccasion[];
  permanent: SpecialOccasion[];
}> {
  const empty = { regular: [], periodic: [], permanent: [] };

  let rows: string[][];
  try {
    rows = await fetchRange(SHEET_RANGE);
  } catch (error) {
    if (error instanceof MissingTabError) return empty;
    throw error;
  }
  if (rows.length < 2) return empty;

  const header = findHeader(rows, COLUMNS, "title");
  if (!header) return empty;
  const { columns } = header;

  // Accumulated groups, keyed by "eventDate|title" so rows with the same pair
  // collapse into one occasion regardless of whether they repeat or inherit.
  const groups = new Map<string, OccasionGroup>();
  const order: string[] = [];

  // Inherited state: blank cells carry the previous row's values — but only
  // within one occasion. A row that starts a new date/title pair starts fresh,
  // so a new occasion can't silently inherit the previous one's display window
  // or Big Slide mode (blank means "always show" / "no takeover", as in the
  // Mededelingen tab).
  let lastKey: string | null = null;
  let lastEventDate: string | null = null;
  let lastTitle: string | null = null;
  let lastDisplayFrom: string | null = null;
  let lastDisplayTo: string | null = null;
  let lastDisplayFromMin: number | null = null;
  let lastDisplayToMin: number | null = null;
  let lastBigSlide: "periodic" | "permanent" | undefined = undefined;
  let lastBigSlideExplicit = false;

  for (const row of rows.slice(header.firstDataRow)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const rawDate = cell(columns.eventDate);
    const rawTitle = cell(columns.title);
    const rawFrom = cell(columns.displayFrom);
    const rawTo = cell(columns.displayTo);
    const rawFromTime = cell(columns.displayFromTime);
    const rawToTime = cell(columns.displayToTime);
    const rawBigSlide = cell(columns.bigSlide);

    const eventDate: string | null = normalizeDate(rawDate) ?? lastEventDate;
    const title: string | null = rawTitle || lastTitle;
    const key = eventDate && title ? `${eventDate}|${title}` : null;
    const sameGroup = key !== null && key === lastKey;

    const displayFrom: string | null =
      normalizeDate(rawFrom) ?? (sameGroup ? lastDisplayFrom : null);
    const displayTo: string | null =
      normalizeDate(rawTo) ?? (sameGroup ? lastDisplayTo : null);
    const displayFromMin: number | null =
      parseClock(rawFromTime) ?? (sameGroup ? lastDisplayFromMin : null);
    const displayToMin: number | null =
      parseClock(rawToTime) ?? (sameGroup ? lastDisplayToMin : null);
    const bigSlide: "periodic" | "permanent" | undefined = rawBigSlide
      ? parseBigSlide(rawBigSlide)
      : sameGroup && lastBigSlideExplicit
        ? lastBigSlide
        : undefined;

    if (eventDate) lastEventDate = eventDate;
    if (title) lastTitle = title;
    if (key) lastKey = key;
    lastDisplayFrom = displayFrom;
    lastDisplayTo = displayTo;
    lastDisplayFromMin = displayFromMin;
    lastDisplayToMin = displayToMin;
    if (rawBigSlide) {
      lastBigSlide = bigSlide;
      lastBigSlideExplicit = true;
    } else if (!sameGroup) {
      lastBigSlide = undefined;
      lastBigSlideExplicit = false;
    }

    if (!key || !eventDate || !title) continue;

    const rawTimeFrom = cell(columns.timeFrom);
    const rawTimeTo = cell(columns.timeTo);
    const activity = cell(columns.activity);
    const supervisor = cell(columns.supervisor);
    const info = cell(columns.info);
    const location = cell(columns.location);

    if (!rawTimeFrom && !activity) continue;

    const timeFromMinutes = parseClock(rawTimeFrom) ?? 0;
    const timeToMinutesVal = rawTimeTo ? (parseClock(rawTimeTo) ?? undefined) : undefined;

    const entry: SpecialOccasionEntry = {
      timeFrom: rawTimeFrom,
      ...(rawTimeTo ? { timeTo: rawTimeTo } : {}),
      timeFromMinutes,
      ...(timeToMinutesVal !== undefined ? { timeToMinutes: timeToMinutesVal } : {}),
      activity,
      supervisor,
      ...(info ? { info } : {}),
      ...(location ? { location } : {}),
    };

    if (!groups.has(key)) {
      groups.set(key, {
        eventDate,
        title,
        bigSlide,
        from: { date: displayFrom, minutes: displayFromMin },
        until: { date: displayTo, minutes: displayToMin },
        entries: [],
      });
      order.push(key);
    }
    groups.get(key)!.entries.push(entry);
  }

  const regular: SpecialOccasion[] = [];
  const periodic: SpecialOccasion[] = [];
  const permanent: SpecialOccasion[] = [];

  for (const key of order) {
    const g = groups.get(key)!;
    // Decided once, for the whole occasion — see OccasionGroup.from.
    if (!withinWindow(today, nowMinutes, g.from, g.until)) continue;
    const occ: SpecialOccasion = {
      eventDate: g.eventDate,
      eventDateLabel: formatEventDate(g.eventDate),
      title: g.title,
      entries: g.entries,
    };
    if (g.bigSlide === "permanent") permanent.push(occ);
    else if (g.bigSlide === "periodic") periodic.push(occ);
    else regular.push(occ);
  }

  return { regular, periodic, permanent };
}
