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

/**
 * Is a show-window open right now?
 *
 * The dates bound whole days. An optional `HH:MM` sharpens its own boundary day
 * into a moment, so a notice can go up at 10:00 and come down at 11:30 instead
 * of occupying the screen from midnight. A time only gates the day its date
 * names — a window running 05/09 10:00 → 07/09 11:30 covers all of the 6th. A
 * time with no date beside it applies to today, which also means it re-applies
 * each day until an end date closes the window.
 *
 * `nowMinutes` is null when another school day is being previewed (`?date=`),
 * where there's no meaningful clock: the window then counts as open all day, so
 * checking tomorrow's entries doesn't hide half of them.
 */
export function withinWindow(
  today: string,
  nowMinutes: number | null,
  from: { date: string | null; minutes: number | null },
  until: { date: string | null; minutes: number | null },
): boolean {
  if (from.date && today < from.date) return false;
  if (until.date && today > until.date) return false;
  if (nowMinutes === null) return true;

  const onFromDay = !from.date || today === from.date;
  if (from.minutes !== null && onFromDay && nowMinutes < from.minutes) {
    return false;
  }
  const onUntilDay = !until.date || today === until.date;
  // Exclusive: an end hour of 11:30 means it's gone by 11:30, not at 11:31.
  if (until.minutes !== null && onUntilDay && nowMinutes >= until.minutes) {
    return false;
  }
  return true;
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
  } catch (error) {
    // A batch fails as a whole. When that's because one named tab doesn't
    // exist, isolated reads separate the good ranges from the absent one, so a
    // single missing tab can't blank every other zone.
    //
    // Any other failure — a 429, a 500, no route to Google — would fail nine
    // more times over, and those retries are what turn a momentary rate-limit
    // into a standing one: at one batch plus nine fallbacks per refresh, the
    // retries alone hold the account at its read quota and nothing ever gets
    // back under it. Fail the batch as a batch instead.
    if (!(error instanceof MissingTabError)) {
      batch.forEach((b) => b.reject(error));
      return;
    }
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
 * Queue a range for the next flush. Calls made in the same tick share one
 * `values:batchGet`, so a board load that misses the cache below costs a single
 * Sheets request rather than one per tab.
 */
function queueRead(range: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    queue.push({ range, resolve, reject });
    if (!flushing) {
      flushing = true;
      queueMicrotask(flushQueue);
    }
  });
}

/**
 * How long a range's rows may be reused.
 *
 * Every open board polls `/api/board` every 30s, and each poll used to become
 * its own Sheets read: three wall screens cost six reads a minute, and every
 * colleague who opens the board on their PC adds two more. The read quota is 60
 * a minute for the whole service account, so at roughly thirty simultaneous
 * viewers the *wall* screens start failing too — the board would lose the
 * people it exists for to the people merely looking at it.
 *
 * A TTL takes the audience out of that sum: reads settle at 60/TTL a minute no
 * matter how many are watching. The price is freshness — a sheet edit reaches a
 * screen up to TTL later than it used to, on top of that screen's own poll.
 *
 * Ten seconds buys most of that for very little: six reads a minute is a tenth
 * of the quota, and the delay it adds stays well under the 30s poll each screen
 * already waits out, so the cache never becomes the slow part of a staff edit
 * reaching the wall.
 */
const TTL_MS = 10_000;

/**
 * How long a failing range may keep serving the last rows it read successfully.
 *
 * Most Sheets failures are seconds long — a rate-limit, a dropped connection,
 * a blip at Google. Propagating those immediately puts "Rooster tijdelijk niet
 * beschikbaar" on a wall in front of a corridor of students over something that
 * has already fixed itself, and a board that cries wolf gets ignored on the day
 * it's right. Inside this window the last good rows keep showing instead.
 *
 * Measured from the last *successful* read, not the last attempt, so repeated
 * failures can't extend it: once the data is a minute old the board says so.
 * The client has its own, longer guard — after five minutes without a poll it
 * shows "Geen verbinding" (BoardShell's STALE_MS).
 */
const STALE_GRACE_MS = 60_000;

/**
 * How long to take "this tab doesn't exist" for an answer.
 *
 * An absent tab is a supported, stable state — the feature stays dormant until
 * someone adds it — so re-asking every refresh is not diligence, it's waste,
 * and expensive waste: Sheets rejects a *whole* batch when one range names a
 * tab that isn't there, which sends the flush above down its per-range
 * fallback. One dormant feature therefore costs ten requests per refresh
 * instead of one, and at a screen's polling rate that alone is enough to hold
 * a school at its read quota all day.
 *
 * Remembering the absence for a while keeps the range out of the batch, so the
 * other tabs go back to costing one request between them. Long enough to stop
 * paying for it; short enough that a tab added mid-morning starts showing up
 * without anyone restarting the server.
 */
const MISSING_TAB_TTL_MS = 10 * 60_000;

type Entry = {
  rows: Promise<string[][]>;
  storedAt: number;
  /** The last rows this range read successfully, and when — see the grace above. */
  lastGood?: { rows: string[][]; at: number };
  /** Set once this range has been confirmed to name a tab that doesn't exist. */
  missingTab?: boolean;
};

/**
 * Rows are cached as the in-flight promise rather than the resolved rows, so
 * readers arriving *during* a fetch wait on that request instead of starting
 * their own. That single-flight behaviour is what holds under load: the
 * microtask queue above only coalesces reads within one board load, and thirty
 * viewers are thirty separate loads landing at thirty different moments.
 *
 * Timed from when the read starts rather than when it lands, so a slow response
 * shortens the entry's life instead of extending its staleness.
 */
const cache = new Map<string, Entry>();

/**
 * Read a range, reusing a recent read of the same range when there is one.
 *
 * Failures are cached like successes: during an outage every poll would
 * otherwise retry, and a stampede of retries against an API already refusing us
 * is how a blip becomes an hour. The cost is that recovery from a transient
 * error waits out the TTL as well.
 */
export function fetchRange(range: string): Promise<string[][]> {
  const previous = cache.get(range);
  if (previous) {
    const ttl = previous.missingTab ? MISSING_TAB_TTL_MS : TTL_MS;
    if (Date.now() - previous.storedAt < ttl) return previous.rows;
  }

  // Carried across the refresh so a failure can still fall back on it.
  const lastGood = previous?.lastGood;

  const entry: Entry = { rows: undefined!, storedAt: Date.now(), lastGood };
  entry.rows = queueRead(range).then(
    (rows) => {
      entry.lastGood = { rows, at: Date.now() };
      return rows;
    },
    (error: unknown) => {
      if (lastGood && Date.now() - lastGood.at < STALE_GRACE_MS) {
        return lastGood.rows;
      }
      // Only once the grace is spent, so a tab deleted mid-day isn't written
      // off while the board is still legitimately showing its last rows.
      if (error instanceof MissingTabError) entry.missingTab = true;
      throw error;
    },
  );

  cache.set(range, entry);
  // Every caller receives this rejection through the copy it awaited; this
  // handler exists only so Node doesn't also count the stored copy as unhandled.
  entry.rows.catch(() => {});
  return entry.rows;
}
