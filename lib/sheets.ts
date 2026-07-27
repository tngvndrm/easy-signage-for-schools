import { GoogleAuth } from "google-auth-library";
import type { Substitution } from "./types";

const SHEET_ID = process.env.SHEET_ID ?? "";
const SHEET_RANGE = process.env.SHEET_RANGE ?? "Vervangingen!A1:F400";

/**
 * Header names we accept, lowercased and stripped of accents/spaces.
 * Keeping several aliases per column means staff can rename a header slightly
 * without the board going blank.
 */
const COLUMN_ALIASES: Record<keyof ColumnMap, string[]> = {
  datum: ["datum", "date"],
  period: ["lesuur", "uur", "period"],
  klas: ["klas", "class", "groep"],
  absent: ["afwezigeleerkracht", "afwezige", "leerkracht", "absent"],
  substitute: ["vervanging", "vervanger", "substitute"],
  lokaal: ["lokaal", "klaslokaal", "room"],
};

type ColumnMap = {
  datum: number;
  period: number;
  klas: number;
  absent: number;
  substitute: number;
  lokaal: number;
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

function mapColumns(header: string[]): ColumnMap {
  const found = {} as ColumnMap;
  for (const key of Object.keys(COLUMN_ALIASES) as (keyof ColumnMap)[]) {
    const aliases = COLUMN_ALIASES[key];
    const idx = header.findIndex((h) => aliases.includes(normalize(h ?? "")));
    found[key] = idx;
  }
  return found;
}

/** "1-2", "1 & 2", "1 en 2" -> { label: "1 & 2", start: 1 }. */
function parsePeriod(raw: string): { label: string; start: number } | null {
  const value = raw.trim();
  if (!value) return null;
  const numbers = value.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const label = numbers.length > 1 ? numbers.join(" & ") : numbers[0];
  return { label, start: Number(numbers[0]) };
}

/**
 * Sheets hands back whatever the cell is formatted as. Reduce the common
 * European variants to yyyy-mm-dd so we can compare against "today".
 */
function normalizeDate(raw: string): string | null {
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

export function isSheetConfigured(): boolean {
  return SHEET_ID.length > 0;
}

async function fetchRows(): Promise<string[][]> {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}` +
    `/values/${encodeURIComponent(SHEET_RANGE)}?valueRenderOption=FORMATTED_VALUE`;

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

/**
 * Read the sheet and return today's rows, sorted by period.
 *
 * Blank `Lesuur` cells inherit the previous row's period, so a sheet that still
 * uses merged cells for a multi-row period keeps working.
 */
export async function readSubstitutions(today: string): Promise<Substitution[]> {
  const rows = await fetchRows();
  if (rows.length < 2) return [];

  const columns = mapColumns(rows[0]);
  if (columns.period < 0) {
    throw new Error("Sheet has no 'Lesuur' column — check the header row.");
  }

  const out: Substitution[] = [];
  let lastPeriod: { label: string; start: number } | null = null;
  let lastDate: string | null = null;

  for (const row of rows.slice(1)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const date: string | null = normalizeDate(cell(columns.datum)) ?? lastDate;
    if (date) lastDate = date;

    const period: { label: string; start: number } | null =
      parsePeriod(cell(columns.period)) ?? lastPeriod;
    if (period) lastPeriod = period;

    // A "pauze" row is a visual separator in the sheet; the board draws its own.
    if (normalize(row.join("")) === "pauze") continue;

    const klas = cell(columns.klas);
    const absent = cell(columns.absent);
    if (!klas && !absent) continue;
    if (columns.datum >= 0 && date !== today) continue;
    if (!period) continue;

    out.push({
      period: period.label,
      periodStart: period.start,
      klas,
      absent,
      substitute: cell(columns.substitute),
      lokaal: cell(columns.lokaal),
    });
  }

  return out.sort(
    (a, b) => a.periodStart - b.periodStart || a.klas.localeCompare(b.klas),
  );
}
