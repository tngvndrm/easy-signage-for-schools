import { fetchRange, findHeader, MissingTabError, normalizeDate } from "./sheets";
import type { Birthday } from "./types";

const BIRTHDAYS_RANGE =
  process.env.BIRTHDAYS_SHEET_RANGE ?? "Verjaardagen!A1:F1000";

/**
 * One row per student for the whole school, imported once and topped up by hand
 * through the year. Names are split first/last so "Jan" and "Janssen" sort and
 * import cleanly; the board joins them back together.
 */
const COLUMNS = {
  voornaam: ["voornaam", "firstname", "first"],
  naam: ["naam", "achternaam", "familienaam", "lastname", "surname"],
  klas: ["klas", "class", "groep"],
  datum: ["datum", "date", "verjaardag", "geboortedatum", "birthdate"],
};

/**
 * Students whose birthday is today.
 *
 * The stored date carries a birth year, but a birthday recurs every year — so
 * only the month and day are compared against today. The whole-school list can
 * therefore sit in the sheet untouched and the right names surface on the right
 * mornings on their own.
 */
export async function readBirthdays(today: string): Promise<Birthday[]> {
  let rows: string[][];
  try {
    rows = await fetchRange(BIRTHDAYS_RANGE);
  } catch (error) {
    // No Verjaardagen tab yet — the rest of the board carries on without it.
    if (error instanceof MissingTabError) return [];
    throw error;
  }
  if (rows.length < 2) return [];

  const header = findHeader(rows, COLUMNS, "datum");
  if (!header) {
    throw new Error("Birthday sheet has no 'Datum' column — check the header.");
  }
  const { columns } = header;

  const todayMonthDay = today.slice(5); // "mm-dd"
  const out: Birthday[] = [];

  for (const [index, row] of rows.slice(header.firstDataRow).entries()) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const iso = normalizeDate(cell(columns.datum));
    if (!iso || iso.slice(5) !== todayMonthDay) continue;

    const klas = cell(columns.klas);
    const name = [cell(columns.voornaam), cell(columns.naam)]
      .filter(Boolean)
      .join(" ");
    // Neither is an empty row. A class on its own is a real birthday read by a
    // deployment whose range stops short of the name columns — see
    // lib/privacy.ts — and the card counts those instead of naming them.
    if (!name && !klas) continue;

    out.push({
      // Never built from the name: ids travel in the payload, so a name in one
      // would outlive the redaction that empties the field. The row index keeps
      // two classmates with the same birthday apart.
      id: `${iso.slice(5)}-${klas}-${index}`,
      name,
      klas,
    });
  }

  return out.sort(
    (a, b) => a.name.localeCompare(b.name) || a.klas.localeCompare(b.klas),
  );
}
