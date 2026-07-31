import {
  fetchRange,
  findHeader,
  isTicked,
  MissingTabError,
  parseClock,
} from "./sheets";
import type { Slot } from "./schedule";

const SCHEDULE_RANGE = process.env.SCHEDULE_SHEET_RANGE ?? "Schedule!A1:E50";

/**
 * The school timetable, so another school with different bells (or extra break
 * lines) is a sheet edit, not a code change. One row per slot, in time order:
 * `Lesuur` holds a period number for a lesson or a break name for a break, and
 * `Toon pauzelijn` ticks whether that break draws a divider on the board.
 */
const COLUMNS = {
  lesuur: ["lesuur", "uur", "period", "les"],
  start: ["starttijd", "start", "begin", "van"],
  end: ["eindtijd", "einde", "eind", "tot", "end"],
  line: ["toonpauzelijn", "pauzelijn", "lijn", "line", "toonlijn"],
};

/**
 * Read the schedule tab into slots, or null when it's absent/empty (the caller
 * then uses the built-in default). A break's `afterPeriod` is the last lesson
 * period above it in the list, so the divider lands in the right place.
 */
export async function readSchedule(): Promise<Slot[] | null> {
  let rows: string[][];
  try {
    rows = await fetchRange(SCHEDULE_RANGE);
  } catch (error) {
    if (error instanceof MissingTabError) return null;
    throw error;
  }
  if (rows.length < 2) return null;

  const header = findHeader(rows, COLUMNS, "lesuur");
  if (!header) return null;
  const { columns } = header;

  const out: Slot[] = [];
  let lastPeriod = 0;

  for (const row of rows.slice(header.firstDataRow)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const label = cell(columns.lesuur);
    const start = parseClock(cell(columns.start));
    const end = parseClock(cell(columns.end));
    if (!label || start === null || end === null) continue;

    if (/^\d+$/.test(label)) {
      const period = Number(label);
      out.push({ kind: "lesson", period, start, end });
      lastPeriod = period;
    } else {
      out.push({
        kind: "break",
        label,
        afterPeriod: lastPeriod,
        start,
        end,
        line: isTicked(cell(columns.line)),
      });
    }
  }

  return out.length > 0 ? out : null;
}
