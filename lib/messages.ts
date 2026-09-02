import {
  directImageUrl,
  fetchRange,
  findHeader,
  isTicked,
  MissingTabError,
  normalizeDate,
  normalizeText,
  parseClock,
  withinWindow,
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

const MESSAGES_RANGE = process.env.MESSAGES_SHEET_RANGE ?? "Mededelingen!A1:K200";

/**
 * The rotating notices — pickup calls, reminders, fundraiser posters. Each has
 * an optional show-window so an item puts itself up and takes itself down, and
 * a "Volledig beeld" tick that turns its image into full-bleed artwork instead
 * of a side thumbnail.
 */
const COLUMNS = {
  titel: ["titel", "title", "kop"],
  tekst: ["tekst", "bericht", "body", "inhoud", "text"],
  // Bare "Weergave" too: it's what a column headed "Weergave Startdatum"
  // shortens to in practice, and left unmatched the start bound silently
  // disappears rather than failing loudly.
  van: [
    "weergavestartdatum",
    "weergavestart",
    "weergave",
    "van",
    "vanaf",
    "start",
    "toonvanaf",
  ],
  tot: ["weergaveeinddatum", "tot", "totenmet", "einde", "end"],
  vanTijd: [
    "weergavestartuur",
    "weergavestarttijd",
    "vantijd",
    "vanaftijd",
    "starttijd",
    "beginuur",
    "vanuur",
  ],
  totTijd: [
    "weergaveeinduur",
    "weergaveeindtijd",
    "tottijd",
    "eindtijd",
    "einduur",
    "totuur",
  ],
  afbeelding: ["afbeelding", "beeld", "artwork", "image", "poster"],
  cover: ["volledigbeeld", "volledig", "cover", "fullbleed", "grootbeeld"],
  bigSlide: ["bigslide", "grootscherm", "volledigscherm", "takeover", "overname"],
  // "Enkel op bord": keep this notice off a deployment that runs `reduced`.
  // Free text can name a pupil and no filter can see that, so this is where
  // staff say so themselves. Blank means "show everywhere".
  boardOnly: [
    "enkelopbord",
    "alleenopbord",
    "enkelbord",
    "nietthuis",
    "bordonly",
    "boardonly",
  ],
};

/**
 * Messages whose show-window covers now, in sheet order.
 *
 * The weergave dates are both optional: a blank start means "from now", a blank
 * end means "until removed". An item with neither is always shown. This is what
 * lets staff queue a fundraiser weeks ahead and never come back to clear it.
 *
 * `Weergave Startuur`/`Einduur` are optional too, and sharpen their own
 * boundary day into a moment — see `withinWindow`. `nowMinutes` is null when
 * another day is being previewed, where the hours don't apply.
 */
export async function readMessages(
  today: string,
  nowMinutes: number | null,
): Promise<BoardMessage[]> {
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

    const from = {
      date: normalizeDate(cell(columns.van)),
      minutes: parseClock(cell(columns.vanTijd)),
    };
    const until = {
      date: normalizeDate(cell(columns.tot)),
      minutes: parseClock(cell(columns.totTijd)),
    };
    if (!withinWindow(today, nowMinutes, from, until)) continue;

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
      ...(isTicked(cell(columns.boardOnly)) ? { boardOnly: true } : {}),
    });
  }

  return out;
}
