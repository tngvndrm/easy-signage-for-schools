import {
  fetchRange,
  findHeader,
  MissingTabError,
  normalizeDate,
  normalizeText,
  parseClock,
} from "./sheets";
import type { SpecialOccasion, SpecialOccasionEntry } from "./types";

const SHEET_RANGE =
  process.env.SPECIAL_OCCASIONS_RANGE ?? "Speciale Gelegenheden!A1:K400";
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
  displayFrom: ["toonvanaf", "toonvan", "vanaf"],
  displayTo: ["toontot", "totenmet", "toontotenmet"],
  bigSlide: ["bigslide", "grootscherm", "volledigscherm", "takeover"],
  timeFrom: ["tijdvan", "tijdvanaf", "begintijd", "start"],
  timeTo: ["tijdtot", "tijdtotenmet", "eindtijd", "einde"],
  activity: ["activiteit", "vak", "subject", "activity"],
  supervisor: ["begeleider", "leerkracht", "teacher", "supervisor"],
  info: ["info", "opmerking", "note", "toelichting"],
  location: ["locatie", "lokaal", "location", "room"],
};

type OccasionGroup = {
  eventDate: string;
  title: string;
  bigSlide: "periodic" | "permanent" | undefined;
  entries: SpecialOccasionEntry[];
};

export async function readSpecialOccasions(today: string): Promise<{
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
  let lastBigSlide: "periodic" | "permanent" | undefined = undefined;
  let lastBigSlideExplicit = false;

  for (const row of rows.slice(header.firstDataRow)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const rawDate = cell(columns.eventDate);
    const rawTitle = cell(columns.title);
    const rawFrom = cell(columns.displayFrom);
    const rawTo = cell(columns.displayTo);
    const rawBigSlide = cell(columns.bigSlide);

    const eventDate: string | null = normalizeDate(rawDate) ?? lastEventDate;
    const title: string | null = rawTitle || lastTitle;
    const key = eventDate && title ? `${eventDate}|${title}` : null;
    const sameGroup = key !== null && key === lastKey;

    const displayFrom: string | null =
      normalizeDate(rawFrom) ?? (sameGroup ? lastDisplayFrom : null);
    const displayTo: string | null =
      normalizeDate(rawTo) ?? (sameGroup ? lastDisplayTo : null);
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
    if (rawBigSlide) {
      lastBigSlide = bigSlide;
      lastBigSlideExplicit = true;
    } else if (!sameGroup) {
      lastBigSlide = undefined;
      lastBigSlideExplicit = false;
    }

    if (!key || !eventDate || !title) continue;

    // Skip rows whose display window doesn't cover today.
    if (displayFrom && today < displayFrom) continue;
    if (displayTo && today > displayTo) continue;

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
      groups.set(key, { eventDate, title, bigSlide, entries: [] });
      order.push(key);
    }
    groups.get(key)!.entries.push(entry);
  }

  const regular: SpecialOccasion[] = [];
  const periodic: SpecialOccasion[] = [];
  const permanent: SpecialOccasion[] = [];

  for (const key of order) {
    const g = groups.get(key)!;
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
