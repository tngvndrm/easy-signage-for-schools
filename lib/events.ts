import { fetchRange, findHeader, MissingTabError, normalizeDate } from "./sheets";
import type { EventItem } from "./types";

const EVENTS_RANGE = process.env.EVENTS_SHEET_RANGE ?? "Evenementen!A1:H100";
const LOCALE = process.env.LOCALE ?? "nl-BE";
const TIMEZONE = process.env.TIMEZONE ?? "Europe/Brussels";

/** How long before the event it starts appearing, when no date is given. */
const DEFAULT_LEAD_DAYS = 14;

const COLUMNS = {
  datum: ["datum", "date"],
  tijd: ["tijd", "uur", "time"],
  vanaf: ["toonvanaf", "vanaf", "showfrom"],
  klas: ["klas", "class", "groep"],
  titel: ["titel", "title", "voorstelling"],
  synopsis: ["synopsis", "omschrijving", "beschrijving", "tekst"],
  poster: ["poster", "afbeelding", "artwork", "beeld", "image"],
};

const DRIVE_ID = /(?:\/file\/d\/|[?&]id=)([\w-]{20,})/;

/**
 * Staff paste whatever Drive gives them from the Share button, which is a
 * viewer page rather than an image. Rewrite it to a form a browser can render
 * directly; anything that isn't a Drive link is passed through untouched.
 *
 * The file still has to be shared "anyone with the link" — the board's browser
 * is anonymous, and doesn't carry the service account's access.
 */
export function directImageUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const match = value.match(DRIVE_ID);
  if (!match) return value;
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
}

function addDays(iso: string, days: number): string {
  // Noon avoids any chance of a DST shift moving the date.
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function whenLabel(iso: string, time: string): string {
  const label = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${iso}T12:00:00Z`));
  const capped = label.charAt(0).toUpperCase() + label.slice(1);
  return time ? `${capped} · ${time}` : capped;
}

/**
 * Events whose announcement window covers today, soonest first.
 *
 * The window runs from `Toon vanaf` (or two weeks out) to the event date
 * inclusive, so an announcement puts itself up and takes itself down — nobody
 * has to remember to clear last month's play off the screens.
 */
export async function readEvents(today: string): Promise<EventItem[]> {
  let rows: string[][];
  try {
    rows = await fetchRange(EVENTS_RANGE);
  } catch (error) {
    if (error instanceof MissingTabError) return [];
    throw error;
  }
  if (rows.length < 2) return [];

  const header = findHeader(rows, COLUMNS, "titel");
  if (!header) return [];
  const { columns } = header;

  const out: EventItem[] = [];

  for (const row of rows.slice(header.firstDataRow)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const title = cell(columns.titel);
    const date = normalizeDate(cell(columns.datum));
    if (!title || !date) continue;

    const from =
      normalizeDate(cell(columns.vanaf)) ?? addDays(date, -DEFAULT_LEAD_DAYS);
    if (today < from || today > date) continue;

    out.push({
      id: `${date}-${title}`,
      klas: cell(columns.klas),
      title,
      synopsis: cell(columns.synopsis),
      date,
      whenLabel: whenLabel(date, cell(columns.tijd)),
      posterUrl: directImageUrl(cell(columns.poster)),
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}
