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

/**
 * Find the header row rather than assuming it's the first one. Staff sheets
 * grow a title line, a blank spacer or a note above the table sooner or later,
 * and none of that should blank the board. Returns the column map plus the
 * index the data starts at.
 */
export function findHeader<K extends string>(
  rows: string[][],
  aliases: Record<K, string[]>,
  // NoInfer: the key set comes from `aliases`, not from this argument.
  required: NoInfer<K>,
  searchDepth = 10,
): { columns: Record<K, number>; firstDataRow: number } | null {
  for (let i = 0; i < Math.min(rows.length, searchDepth); i++) {
    const columns = mapColumns(rows[i], aliases);
    if (columns[required] >= 0) return { columns, firstDataRow: i + 1 };
  }
  return null;
}

/** The tab named in a range doesn't exist (yet). */
export class MissingTabError extends Error {}

/** "18:00", "8:30" -> minutes since midnight; null if unparseable. */
export function parseClock(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** A tick-off cell: anything but empty or an explicit "no" counts as done. */
export function isTicked(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return !["nee", "no", "false", "n"].includes(normalizeText(value));
}

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

// One auth client for the process; creating one per request re-does discovery.
let auth: GoogleAuth | null = null;

async function authHeader(): Promise<{ Authorization: string }> {
  auth ??= new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return { Authorization: `Bearer ${token.token}` };
}

const API = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}`;

/** Turn a non-OK Sheets response into the right error, reusing the range name. */
async function sheetsError(res: Response, range: string): Promise<Error> {
  const body = await res.text();
  // A tab that hasn't been created yet is a normal state, not a fault: the
  // feature simply stays dormant until someone adds the tab.
  if (res.status === 400 && /Unable to parse range/i.test(body)) {
    return new MissingTabError(`No such tab or range: ${range}`);
  }
  return new Error(`Sheets API ${res.status}: ${body}`);
}

/** Read one range on its own — the batch fallback, and the single-range path. */
async function fetchSingle(range: string): Promise<string[][]> {
  const url = `${API}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: await authHeader(), cache: "no-store" });
  if (!res.ok) throw await sheetsError(res, range);
  const json = (await res.json()) as { values?: string[][] };
  return json.values ?? [];
}

/**
 * Read several ranges in a single request. The Sheets read quota is per user
 * per minute (60), and every board load reads a tab per feature; batching keeps
 * a screenful to one request instead of one-per-tab. `valueRanges` come back in
 * request order, so results map by index.
 */
async function fetchBatch(ranges: string[]): Promise<string[][][]> {
  const query = ranges
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join("&");
  const url = `${API}/values:batchGet?${query}&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: await authHeader(), cache: "no-store" });
  // A single missing tab 400s the whole batch; the caller falls back per-range.
  if (!res.ok) throw await sheetsError(res, ranges.join(", "));
  const json = (await res.json()) as {
    valueRanges?: { values?: string[][] }[];
  };
  const valueRanges = json.valueRanges ?? [];
  return ranges.map((_, i) => valueRanges[i]?.values ?? []);
}

// Ranges asked for within the same tick are coalesced into one batchGet. A
// board load fires every reader synchronously (Promise.allSettled over the
// range list), so they all land in one queue before the microtask flush.
type Pending = {
  range: string;
  resolve: (rows: string[][]) => void;
  reject: (error: unknown) => void;
};
let queue: Pending[] = [];
let flushing = false;

async function flushQueue(): Promise<void> {
  const batch = queue;
  queue = [];
  flushing = false;

  // One range in flight — a batch of one is just a single read.
  if (batch.length === 1) {
    try {
      batch[0].resolve(await fetchSingle(batch[0].range));
    } catch (error) {
      batch[0].reject(error);
    }
    return;
  }

  try {
    const results = await fetchBatch(batch.map((b) => b.range));
    batch.forEach((b, i) => b.resolve(results[i]));
  } catch {
    // The batch failed as a whole (usually one absent tab). Fall back to
    // isolated reads so a single missing tab can't blank every other zone —
    // each range then succeeds or throws its own MissingTabError.
    await Promise.all(
      batch.map(async (b) => {
        try {
          b.resolve(await fetchSingle(b.range));
        } catch (error) {
          b.reject(error);
        }
      }),
    );
  }
}

/**
 * Read a range. Calls made in the same tick share one `values:batchGet`, so a
 * whole board load costs a single Sheets request rather than one per tab.
 */
export function fetchRange(range: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    queue.push({ range, resolve, reject });
    if (!flushing) {
      flushing = true;
      queueMicrotask(flushQueue);
    }
  });
}
