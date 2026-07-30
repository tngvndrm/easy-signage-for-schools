import {
  fetchRange,
  findHeader,
  normalizeDate,
  normalizeText,
} from "./sheets";
import type { Substitution } from "./types";

const SHEET_RANGE = process.env.SHEET_RANGE ?? "Vervangingen!A1:H400";

/**
 * Header names we accept. Keeping several aliases per column means staff can
 * rename a header slightly without the board going blank.
 */
const COLUMNS = {
  datum: ["datum", "date"],
  period: ["lesuur", "uur", "period"],
  klas: ["klas", "class", "groep"],
  absent: ["afwezigeleerkracht", "afwezige", "leerkracht", "absent"],
  substitute: ["vervanging", "vervanger", "substitute"],
  lokaal: ["lokaal", "klaslokaal", "room"],
  content: ["inhoud", "taak", "opdracht", "content", "task"],
};

/**
 * Staff write "nvt", "-" or "/" to mean "no task worth showing". Treat those as
 * empty so the board doesn't render a meaningless subline under the substitute.
 */
function contentOrBlank(raw: string): string {
  return ["nvt", "nvt.", "na", "geen", ""].includes(normalizeText(raw))
    ? ""
    : raw;
}

type ParsedPeriod = { label: string; start: number; all: number[] };

/** "1-2", "1 & 2", "1 en 2" -> { label: "1 & 2", all: [1, 2] }. */
function parsePeriod(raw: string): ParsedPeriod | null {
  const value = raw.trim();
  if (!value) return null;
  const numbers = value.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  const all = numbers.map(Number);
  // "1-2" means the block covers 1 through 2, not just its endpoints.
  const spans = /[-–—]/.test(value) && all.length === 2;
  const covered = spans
    ? Array.from({ length: all[1] - all[0] + 1 }, (_, i) => all[0] + i)
    : all;

  return {
    label: covered.length > 1 ? covered.join(" & ") : String(covered[0]),
    start: covered[0],
    all: covered,
  };
}

/**
 * Read the sheet and return today's rows, sorted by period.
 *
 * Blank `Lesuur` cells inherit the previous row's period, so a sheet that still
 * uses merged cells for a multi-row period keeps working.
 */
export async function readSubstitutions(today: string): Promise<Substitution[]> {
  const rows = await fetchRange(SHEET_RANGE);
  if (rows.length < 2) return [];

  const header = findHeader(rows, COLUMNS, "period");
  if (!header) {
    throw new Error("Sheet has no 'Lesuur' column — check the header row.");
  }
  const { columns } = header;

  const out: Substitution[] = [];
  let lastPeriod: ParsedPeriod | null = null;
  let lastDate: string | null = null;

  for (const row of rows.slice(header.firstDataRow)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const date: string | null = normalizeDate(cell(columns.datum)) ?? lastDate;
    if (date) lastDate = date;

    const period: ParsedPeriod | null =
      parsePeriod(cell(columns.period)) ?? lastPeriod;
    if (period) lastPeriod = period;

    // A "pauze" row is a visual separator in the sheet; the board draws its own.
    if (normalizeText(row.join("")) === "pauze") continue;

    const klas = cell(columns.klas);
    const absent = cell(columns.absent);
    if (!klas && !absent) continue;
    if (columns.datum >= 0 && date !== today) continue;
    if (!period) continue;

    out.push({
      period: period.label,
      periodStart: period.start,
      periods: period.all,
      klas,
      absent,
      substitute: cell(columns.substitute),
      lokaal: cell(columns.lokaal),
      content: contentOrBlank(cell(columns.content)),
    });
  }

  return out.sort(
    (a, b) => a.periodStart - b.periodStart || a.klas.localeCompare(b.klas),
  );
}
