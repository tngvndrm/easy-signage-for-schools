import {
  demoBigSlidePreview,
  demoBirthdays,
  demoEvents,
  demoKeyDuties,
  demoMessages,
  demoSubstitutions,
} from "./demo-data";
import { readBirthdays } from "./birthdays";
import { readEvents } from "./events";
import { readKeyDuties } from "./keys";
import { readMessages } from "./messages";
import { isSheetConfigured } from "./sheets";
import { readSubstitutions } from "./substitutions";
import type {
  Birthday,
  BoardData,
  BoardMessage,
  EventItem,
  KeyDuty,
  Substitution,
} from "./types";

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
  options: {
    previewTakeover?: boolean;
    keyLimit?: number;
    /** Preview another school day, e.g. to check tomorrow's entries. */
    date?: string;
    /** Preview the event poster even when no event is scheduled. */
    previewEvent?: boolean;
  } = {},
): Promise<BoardData> {
  const now = new Date();
  const date = options.date ?? todayInSchoolTz(now);

  let substitutions: Substitution[] = demoSubstitutions;
  let keys: KeyDuty[] = demoKeyDuties;
  let events: EventItem[] = demoEvents;
  let birthdays: Birthday[] = demoBirthdays;
  let messages: BoardMessage[] = demoMessages;
  let substitutionsUnavailable = false;
  const demo = !isSheetConfigured();

  if (!demo) {
    const [subs, duties, evts, bdays, msgs] = await Promise.allSettled([
      readSubstitutions(date),
      readKeyDuties(date),
      readEvents(date),
      readBirthdays(date),
      readMessages(date),
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

    if (evts.status === "fulfilled") {
      events = evts.value;
    } else {
      console.error("[board] events sheet read failed", evts.reason);
      events = [];
    }

    if (bdays.status === "fulfilled") {
      birthdays = bdays.value;
    } else {
      console.error("[board] birthday sheet read failed", bdays.reason);
      birthdays = [];
    }

    if (msgs.status === "fulfilled") {
      messages = msgs.value;
    } else {
      console.error("[board] message sheet read failed", msgs.reason);
      messages = [];
    }
  }

  // Demo only: `?keys=2` trims the list so both presentations can be reviewed
  // without waiting for the front desk to tick people off.
  if (demo && options.keyLimit !== undefined) {
    keys = keys.slice(0, Math.max(0, options.keyLimit));
  }

  // Show a sample so a layout can be reviewed before real data exists.
  if (options.previewEvent && events.length === 0) events = demoEvents;

  // Big Slides take over the whole screen, so they're pulled out of the small
  // rotation: "permanent" holds the screen, "periodic" bursts onto it.
  let permanentSlides = messages.filter((m) => m.bigSlide === "permanent");
  const periodicSlides = messages.filter((m) => m.bigSlide === "periodic");
  const rotation = messages.filter((m) => !m.bigSlide);
  if (
    options.previewTakeover &&
    permanentSlides.length === 0 &&
    periodicSlides.length === 0
  ) {
    permanentSlides = [demoBigSlidePreview];
  }

  return {
    date,
    dateLabel: dateLabel(options.date ? new Date(`${options.date}T12:00:00`) : now),
    substitutions,
    breakAfterPeriod: Number.isFinite(BREAK_AFTER_PERIOD)
      ? BREAK_AFTER_PERIOD
      : null,
    messages: rotation,
    birthdays,
    keys,
    events,
    permanentSlides,
    periodicSlides,
    fetchedAt: now.getTime(),
    demo,
    substitutionsUnavailable,
  };
}
