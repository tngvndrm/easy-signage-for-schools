import {
  demoBirthdays,
  demoKeyDuties,
  demoMessages,
  demoSubstitutions,
  demoTakeover,
  demoTakeoverPreview,
} from "./demo-data";
import { readKeyDuties } from "./keys";
import { isSheetConfigured } from "./sheets";
import { readSubstitutions } from "./substitutions";
import type { BoardData, KeyDuty, Substitution } from "./types";

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
 * The sheet is the only source that can fail on us, so a read error falls back
 * to an empty list rather than taking the whole board down — the other zones
 * keep working, and the client keeps showing its cached copy until the next
 * successful poll. The two tabs fail independently: a broken key sheet must not
 * cost us the substitution board.
 */
export async function getBoardData(
  options: { previewTakeover?: boolean; keyLimit?: number } = {},
): Promise<BoardData> {
  const now = new Date();
  const date = todayInSchoolTz(now);

  let substitutions: Substitution[] = demoSubstitutions;
  let keys: KeyDuty[] = demoKeyDuties;
  let substitutionsUnavailable = false;
  const demo = !isSheetConfigured();

  if (!demo) {
    const [subs, duties] = await Promise.allSettled([
      readSubstitutions(date),
      readKeyDuties(date),
    ]);

    if (subs.status === "fulfilled") {
      substitutions = subs.value;
    } else {
      console.error("[board] substitution sheet read failed", subs.reason);
      substitutions = [];
      substitutionsUnavailable = true;
    }

    if (duties.status === "fulfilled") {
      keys = duties.value;
    } else {
      console.error("[board] key sheet read failed", duties.reason);
      keys = [];
    }
  }

  // Demo only: `?keys=2` trims the list so both presentations can be reviewed
  // without waiting for the front desk to tick people off.
  if (demo && options.keyLimit !== undefined) {
    keys = keys.slice(0, Math.max(0, options.keyLimit));
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
    keys,
    takeover: options.previewTakeover ? demoTakeoverPreview : demoTakeover,
    fetchedAt: now.getTime(),
    demo,
    substitutionsUnavailable,
  };
}
