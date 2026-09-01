import { fetchRange, MissingTabError, normalizeText } from "./sheets";
import type { PiketBlock, PiketRoster } from "./types";

const PIKET_RANGE = process.env.PIKET_SHEET_RANGE ?? "Piket!A1:H60";

/**
 * The standing standby roster: who is on call per lesson block, per weekday.
 *
 * Unlike every other tab this one carries no dates — it's one week that holds
 * all year — so nothing here filters by day; the board picks today's column out
 * of the grid itself.
 *
 * The sheet is read in the shape staff already keep it: weekdays across the
 * top, lesson blocks down the side, and the two or three names to call in
 * order underneath each other. That grid is pasted from the roster they
 * maintain anyway, merged `Lesuur` cells and all — a merged cell hands its
 * value to the API on its first row only, which is exactly the "blank means
 * same as above" the block builder below expects.
 */
const DAYS: { label: string; aliases: string[] }[] = [
  { label: "Maandag", aliases: ["maandag", "monday", "mon", "ma"] },
  { label: "Dinsdag", aliases: ["dinsdag", "tuesday", "tue", "di"] },
  { label: "Woensdag", aliases: ["woensdag", "wednesday", "wed", "wo"] },
  { label: "Donderdag", aliases: ["donderdag", "thursday", "thu", "do"] },
  { label: "Vrijdag", aliases: ["vrijdag", "friday", "fri", "vr"] },
];

/** A cell holding only a slash or a dash means "nobody", not a name. */
const isBlank = (value: string) => /^[\s/.\-–—]*$/.test(value);

/**
 * Which lesson periods a block label covers. "3e LESUUR" is period 3, "1-2" or
 * "1 & 2" both periods. A label with no number at all — "PERIODE", the morning
 * main lesson — is resolved against its neighbours by `fillLeadingBlock`.
 */
function periodsOf(label: string): number[] {
  const range = label.match(/(\d+)\s*(?:[-–—&+]|en|tot)\s*(\d+)/i);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (to >= from && to - from < 12) {
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    }
  }
  const single = label.match(/\d+/);
  return single ? [Number(single[0])] : [];
}

/**
 * The named block above the first numbered one covers the periods before it —
 * "PERIODE" sitting above "3e LESUUR" is periods 1 and 2. Only done for a
 * single leading block: with two of them there's no way to tell where one ends
 * and the next starts, and a wrong guess would put the "now" marker on the
 * wrong row, which is worse than no marker at all.
 */
function fillLeadingBlock(blocks: PiketBlock[]): void {
  const firstNumbered = blocks.findIndex((b) => b.periods.length > 0);
  if (firstNumbered !== 1) return;
  const start = blocks[firstNumbered].periods[0];
  if (start <= 1) return;
  blocks[0].periods = Array.from({ length: start - 1 }, (_, i) => i + 1);
}

/** Locate the weekday header row, and which column each day sits in. */
function findDayHeader(
  rows: string[][],
): { row: number; dayColumns: number[]; labels: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const dayColumns = DAYS.map((day) =>
      rows[i].findIndex((cell) =>
        day.aliases.includes(normalizeText(cell ?? "")),
      ),
    );
    // Two is enough to be sure this is the header and not a stray word: a
    // roster missing a day (a school that closes on Wednesday) still reads.
    if (dayColumns.filter((c) => c >= 0).length >= 2) {
      const labels = DAYS.map((day, d) => {
        const cell = (rows[i][dayColumns[d]] ?? "").trim();
        if (!cell) return day.label;
        return cell.charAt(0) + cell.slice(1).toLowerCase();
      });
      return { row: i, dayColumns, labels };
    }
  }
  return null;
}

/**
 * The title and version staff write above the grid — "PIKETROOSTER 2026-2027"
 * and "Versie 25/08/2026". Worth carrying to the wall: it's how the staff room
 * tells at a glance that the board is showing the roster that's up to date.
 */
function readCaption(rows: string[][]): { title: string | null; version: string | null } {
  let title: string | null = null;
  let version: string | null = null;
  for (const row of rows) {
    for (const raw of row) {
      const value = (raw ?? "").replace(/\s+/g, " ").trim();
      if (!value) continue;
      const versie = value.match(/versie\s*:?\s*(.+)/i);
      if (versie) version ??= versie[1].trim();
      else title ??= value;
    }
  }
  return { title, version };
}

/**
 * Read the roster, or null when the tab is absent or empty — the panel then
 * stays off the board rather than showing an empty grid.
 */
export async function readPiket(): Promise<PiketRoster | null> {
  let rows: string[][];
  try {
    rows = await fetchRange(PIKET_RANGE);
  } catch (error) {
    if (error instanceof MissingTabError) return null;
    throw error;
  }
  if (rows.length < 2) return null;

  const header = findDayHeader(rows);
  if (!header) return null;

  // Whatever sits left of the weekday columns holds the block labels.
  const labelColumn = Math.max(0, Math.min(...header.dayColumns.filter((c) => c >= 0)) - 1);

  const blocks: PiketBlock[] = [];
  let current: PiketBlock | null = null;

  for (const row of rows.slice(header.row + 1)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const label = cell(labelColumn);
    const names = header.dayColumns.map((c) => {
      const value = cell(c);
      return isBlank(value) ? "" : value.replace(/\s+/g, " ");
    });

    // A spacer row between blocks carries neither, and adds nothing.
    if (!label && names.every((n) => !n)) continue;

    // A new label opens a block; a blank one continues the block above. Both
    // shapes occur in the wild — merged cells give the label once, an unmerged
    // sheet repeats it on every row — and repeating it must not split the
    // block into one per name.
    if (!current || (label && label !== current.label)) {
      current = { label, periods: periodsOf(label), days: [[], [], [], [], []] };
      blocks.push(current);
    }
    names.forEach((name, d) => {
      if (name) current!.days[d].push(name);
    });
  }

  const filled = blocks.filter((b) => b.days.some((d) => d.length > 0));
  if (filled.length === 0) return null;
  fillLeadingBlock(filled);

  return {
    ...readCaption(rows.slice(0, header.row)),
    dayLabels: header.labels,
    blocks: filled,
  };
}
