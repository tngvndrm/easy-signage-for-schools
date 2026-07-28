import { GoogleAuth } from "google-auth-library";

/**
 * Shared read-only client for the school's spreadsheet. Each tab gets its own
 * reader module (substitutions, keys); this holds only what they have in
 * common — auth, fetching a range, and the forgiving header/date parsing that
 * keeps a staff-maintained sheet from breaking the board.
 */

const SHEET_ID = process.env.SHEET_ID ?? "";

export function isSheetConfigured(): boolean {
  return SHEET_ID.length > 0;
}

/** Lowercase, strip accents and anything that isn't a letter. */
export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/**
 * Sheets hands back whatever the cell is formatted as. Reduce the common
 * European variants to yyyy-mm-dd so dates can be compared as strings.
 */
export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const dmy = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/**
 * Locate each column by any of its accepted header names. Returns -1 for
 * columns the sheet doesn't have, so callers can decide what's optional.
 */
export function mapColumns<K extends string>(
  header: string[],
  aliases: Record<K, string[]>,
): Record<K, number> {
  const found = {} as Record<K, number>;
  for (const key of Object.keys(aliases) as K[]) {
    found[key] = header.findIndex((cell) =>
      aliases[key].includes(normalizeText(cell ?? "")),
    );
  }
  return found;
}

/** A tick-off cell: anything but empty or an explicit "no" counts as done. */
export function isTicked(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return !["nee", "no", "false", "n"].includes(normalizeText(value));
}

// One auth client for the process; creating one per request re-does discovery.
let auth: GoogleAuth | null = null;

export async function fetchRange(range: string): Promise<string[][]> {
  auth ??= new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}` +
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { values?: string[][] };
  return json.values ?? [];
}
