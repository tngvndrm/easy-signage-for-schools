import {
  fetchRange,
  findHeader,
  isTicked,
  MissingTabError,
  normalizeDate,
} from "./sheets";
import type { KeyDuty } from "./types";

const KEYS_RANGE = process.env.KEYS_SHEET_RANGE ?? "Sleutels!A1:F200";

/**
 * One row per class per weekend: who has the key, when they collect it and when
 * they bring it back, with a tick-off column for each leg. That mirrors how the
 * front desk already works — two ticks per row rather than two separate rows —
 * and the explicit dates handle the weeks that don't follow the usual
 * Friday-out, Monday-back rhythm without any special cases here.
 */
const COLUMNS = {
  klas: ["klas", "class", "groep"],
  student: ["leerling", "student", "naam", "name"],
  pickupDate: ["ophalen", "afhalen", "datumophalen", "datumafhalen", "pickup"],
  pickupDone: ["opgehaald", "afgehaald", "pickupdone"],
  returnDate: ["terugbrengen", "terug", "datumterug", "datumterugbrengen"],
  returnDone: ["teruggebracht", "returndone"],
};

/**
 * Outstanding key duties for today.
 *
 * A duty appears once its date has arrived and disappears the moment the front
 * desk ticks it off — so the board empties itself as they work through the
 * list, and whoever is left is exactly who still needs telling. Dates already
 * past and still unticked are the ones worth nagging about, and are flagged
 * `overdue`; anything dated in the future stays off the board entirely.
 */
export async function readKeyDuties(today: string): Promise<KeyDuty[]> {
  let rows: string[][];
  try {
    rows = await fetchRange(KEYS_RANGE);
  } catch (error) {
    // No Sleutels tab yet — the rest of the board carries on without it.
    if (error instanceof MissingTabError) return [];
    throw error;
  }
  if (rows.length < 2) return [];

  const header = findHeader(rows, COLUMNS, "klas");
  if (!header) {
    throw new Error("Key sheet has no 'Klas' column — check the header row.");
  }
  const { columns } = header;

  const out: KeyDuty[] = [];

  for (const row of rows.slice(header.firstDataRow)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const klas = cell(columns.klas);
    if (!klas) continue;
    const student = cell(columns.student);

    const legs = [
      {
        action: "pickup" as const,
        date: normalizeDate(cell(columns.pickupDate)),
        done: isTicked(cell(columns.pickupDone)),
      },
      {
        action: "return" as const,
        date: normalizeDate(cell(columns.returnDate)),
        done: isTicked(cell(columns.returnDone)),
      },
    ];

    for (const leg of legs) {
      if (!leg.date || leg.done) continue;
      if (leg.date > today) continue;
      out.push({
        id: `${klas}-${leg.action}`,
        klas,
        student,
        action: leg.action,
        due: leg.date,
        overdue: leg.date < today,
      });
    }
  }

  // Late first — those are the ones the board is actually nagging about.
  return out.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.due.localeCompare(b.due) ||
      a.klas.localeCompare(b.klas),
  );
}
