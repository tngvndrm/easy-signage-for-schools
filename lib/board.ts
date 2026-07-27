import {
  demoBirthdays,
  demoMessages,
  demoSubstitutions,
  demoTakeover,
  demoTakeoverPreview,
} from "./demo-data";
import { isSheetConfigured, readSubstitutions } from "./sheets";
import type { BoardData, Substitution } from "./types";

const TIMEZONE = process.env.TIMEZONE ?? "Europe/Brussels";
const LOCALE = process.env.LOCALE ?? "nl-BE";
const BREAK_AFTER_PERIOD = Number(process.env.BREAK_AFTER_PERIOD ?? "4");

/** yyyy-mm-dd in the school's timezone, not the server's. */
export function todayInSchoolTz(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dateLabel(now = new Date()): string {
  const label = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Assemble the board payload.
 *
 * The Sheet is the only source that can fail on us, so a read error falls back
 * to an empty substitution list rather than taking the whole board down — the
 * messages and birthday zones keep working, and the client keeps showing its
 * cached copy until the next successful poll.
 */
export async function getBoardData(
  options: { previewTakeover?: boolean } = {},
): Promise<BoardData> {
  const now = new Date();
  const date = todayInSchoolTz(now);

  let substitutions: Substitution[] = demoSubstitutions;
  let demo = true;

  if (isSheetConfigured()) {
    demo = false;
    try {
      substitutions = await readSubstitutions(date);
    } catch (error) {
      console.error("[board] sheet read failed", error);
      substitutions = [];
    }
  }

  return {
    date,
    dateLabel: dateLabel(now),
    substitutions,
    breakAfterPeriod: Number.isFinite(BREAK_AFTER_PERIOD)
      ? BREAK_AFTER_PERIOD
      : null,
    // TODO: replace with Firestore collections once the admin UI lands.
    messages: demoMessages,
    birthdays: demoBirthdays,
    takeover: options.previewTakeover ? demoTakeoverPreview : demoTakeover,
    fetchedAt: now.getTime(),
    demo,
  };
}
