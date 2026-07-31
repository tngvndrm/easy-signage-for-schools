import {
  directImageUrl,
  fetchRange,
  findHeader,
  isTicked,
  MissingTabError,
  normalizeDate,
  normalizeText,
} from "./sheets";
import type { BoardMessage } from "./types";

/** The "Big Slide" select: blank / "Yes" (periodic) / "Permanent". */
function parseBigSlide(raw: string): "periodic" | "permanent" | undefined {
  const value = normalizeText(raw);
  if (["permanent", "vast", "altijd", "blijvend"].includes(value)) {
    return "permanent";
  }
  if (["yes", "ja", "x", "true", "waar", "periodiek", "aan"].includes(value)) {
    return "periodic";
  }
  return undefined;
}

const MESSAGES_RANGE = process.env.MESSAGES_SHEET_RANGE ?? "Mededelingen!A1:H200";

/**
 * The rotating notices — pickup calls, reminders, fundraiser posters. Each has
 * an optional show-window so an item puts itself up and takes itself down, and
 * a "Volledig beeld" tick that turns its image into full-bleed artwork instead
 * of a side thumbnail.
 */
const COLUMNS = {
  titel: ["titel", "title", "kop"],
  tekst: ["tekst", "bericht", "body", "inhoud", "text"],
  van: ["van", "vanaf", "start", "toonvanaf"],
  tot: ["tot", "totenmet", "einde", "end"],
  afbeelding: ["afbeelding", "beeld", "artwork", "image", "poster"],
  cover: ["volledigbeeld", "volledig", "cover", "fullbleed", "grootbeeld"],
  bigSlide: ["bigslide", "grootscherm", "volledigscherm", "takeover", "overname"],
};

/**
 * Messages whose show-window covers today, in sheet order.
 *
 * `Van`/`Tot` are both optional: a blank `Van` means "from now", a blank `Tot`
 * means "until removed". An item with neither is always shown. This is what
 * lets staff queue a fundraiser weeks ahead and never come back to clear it.
 */
export async function readMessages(today: string): Promise<BoardMessage[]> {
  let rows: string[][];
  try {
    rows = await fetchRange(MESSAGES_RANGE);
  } catch (error) {
    // No Mededelingen tab yet — the board simply shows no messages.
    if (error instanceof MissingTabError) return [];
    throw error;
  }
  if (rows.length < 2) return [];

  const header = findHeader(rows, COLUMNS, "titel");
  if (!header) return [];
  const { columns } = header;

  const out: BoardMessage[] = [];

  for (const [i, row] of rows.slice(header.firstDataRow).entries()) {
    const cell = (c: number) => (c >= 0 ? (row[c] ?? "").trim() : "");

    const title = cell(columns.titel);
    const body = cell(columns.tekst);
    if (!title && !body) continue;

    const from = normalizeDate(cell(columns.van));
    const until = normalizeDate(cell(columns.tot));
    if (from && today < from) continue;
    if (until && today > until) continue;

    const imageUrl = directImageUrl(cell(columns.afbeelding));
    const bigSlide = parseBigSlide(cell(columns.bigSlide));

    out.push({
      id: `msg-${i}-${title}`,
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
      // Full-bleed only makes sense with an image behind the text.
      cover: !!imageUrl && isTicked(cell(columns.cover)),
      ...(bigSlide ? { bigSlide } : {}),
    });
  }

  return out;
}
