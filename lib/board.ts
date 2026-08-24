import {
  demoBigSlidePreview,
  demoBirthdays,
  demoEvents,
  demoKeyDuties,
  demoMessages,
  demoSettings,
  demoSpecialOccasion,
  demoSubstitutions,
} from "./demo-data";
import { readBirthdays } from "./birthdays";
import { readEvents } from "./events";
import { readKeyDuties } from "./keys";
import { readMessages } from "./messages";
import { readSchedule } from "./rooster";
import { DEFAULT_SCHEDULE, type Slot } from "./schedule";
import {
  EMPTY_SETTINGS,
  readSettings,
  type ScreenSettings,
  themeAt,
} from "./settings";
import { isSheetConfigured } from "./sheets";
import { EMPTY_STYLE, readStyle, type BrandStyle } from "./style";
import { readSpecialOccasions } from "./specialOccasions";
import { readSubstitutions } from "./substitutions";
import { type Accent } from "./theme";
import type {
  Birthday,
  BoardData,
  BoardMessage,
  BoardTiming,
  EventItem,
  KeyDuty,
  SpecialOccasion,
  Substitution,
} from "./types";

const TIMEZONE = process.env.TIMEZONE ?? "Europe/Brussels";
const LOCALE = process.env.LOCALE ?? "nl-BE";
const ENV_THEME = process.env.THEME === "dark" ? "dark" : "light";
const ENV_ACCENT = ["coral", "gold", "blue"].includes(process.env.ACCENT ?? "")
  ? (process.env.ACCENT as Accent)
  : "coral";

/** Pace used when the Settings tab leaves the timing columns blank. */
const DEFAULT_TIMING: BoardTiming = {
  messageCycleSec: 12,
  fullScreenIntervalSec: 180,
  fullScreenSec: 20,
};

/** yyyy-mm-dd in the school's timezone, not the server's. */
export function todayInSchoolTz(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Minutes since midnight in the school's timezone. */
function minutesInSchoolTz(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
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
    /** Preview the special occasion board even when none is scheduled. */
    previewOccasion?: boolean;
    /** Which screen (1/2/3) — selects its row in the Settings tab. */
    screenId?: string;
    /** Query overrides that beat the sheet: ?theme=, ?accent=. */
    themeOverride?: "light" | "dark";
    accentOverride?: Accent;
  } = {},
): Promise<BoardData> {
  const now = new Date();
  const date = options.date ?? todayInSchoolTz(now);
  // Show-windows can carry an `HH:MM`, which only means something against a
  // real clock. Previewing another school day has none, so those readers get
  // null and treat the previewed day as open all day.
  const nowMinutes =
    date === todayInSchoolTz(now) ? minutesInSchoolTz(now) : null;

  let substitutions: Substitution[] = demoSubstitutions;
  let keys: KeyDuty[] = demoKeyDuties;
  let events: EventItem[] = demoEvents;
  let birthdays: Birthday[] = demoBirthdays;
  let messages: BoardMessage[] = demoMessages;
  let settings: Record<string, ScreenSettings> = demoSettings;
  let schedule: Slot[] = DEFAULT_SCHEDULE;
  let style: BrandStyle = EMPTY_STYLE;
  let substitutionsUnavailable = false;
  let specialOccasions: SpecialOccasion[] = [];
  let periodicSpecialOccasions: SpecialOccasion[] = [];
  let permanentSpecialOccasions: SpecialOccasion[] = [];
  const demo = !isSheetConfigured();

  if (!demo) {
    const [subs, duties, evts, bdays, msgs, sets, sched, sty, occasions] =
      await Promise.allSettled([
        readSubstitutions(date),
        readKeyDuties(date),
        readEvents(date),
        readBirthdays(date),
        readMessages(date, nowMinutes),
        readSettings(),
        readSchedule(),
        readStyle(),
        readSpecialOccasions(date, nowMinutes),
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

    // Settings failing must not blank the board — fall back to env defaults.
    settings = sets.status === "fulfilled" ? sets.value : {};
    if (sets.status === "rejected") {
      console.error("[board] settings sheet read failed", sets.reason);
    }

    // No Schedule tab (or a failed read) → the built-in default timetable.
    if (sched.status === "fulfilled" && sched.value) {
      schedule = sched.value;
    } else if (sched.status === "rejected") {
      console.error("[board] schedule sheet read failed", sched.reason);
    }

    // Style failing just falls back to the built-in Steinerschool branding.
    style = sty.status === "fulfilled" ? sty.value : EMPTY_STYLE;
    if (sty.status === "rejected") {
      console.error("[board] style sheet read failed", sty.reason);
    }

    if (occasions.status === "fulfilled") {
      specialOccasions = occasions.value.regular;
      periodicSpecialOccasions = occasions.value.periodic;
      permanentSpecialOccasions = occasions.value.permanent;
    } else {
      console.error("[board] special occasions sheet read failed", occasions.reason);
    }
  }

  // Resolve this screen's appearance: query override > sheet setting > env.
  const set = (options.screenId && settings[options.screenId]) || EMPTY_SETTINGS;
  const accent = options.accentOverride ?? set.accent ?? ENV_ACCENT;
  let theme: "light" | "dark";
  if (options.themeOverride) {
    theme = options.themeOverride;
  } else if (set.darkStartMin !== null && set.lightStartMin !== null) {
    theme = themeAt(minutesInSchoolTz(now), set.lightStartMin, set.darkStartMin);
  } else {
    theme = ENV_THEME;
  }

  // Demo only: `?keys=2` trims the list so both presentations can be reviewed
  // without waiting for the front desk to tick people off.
  if (demo && options.keyLimit !== undefined) {
    keys = keys.slice(0, Math.max(0, options.keyLimit));
  }

  // Show a sample so a layout can be reviewed before real data exists.
  if (options.previewEvent && events.length === 0) events = demoEvents;
  if (options.previewOccasion && specialOccasions.length === 0 && periodicSpecialOccasions.length === 0 && permanentSpecialOccasions.length === 0) {
    specialOccasions = [demoSpecialOccasion];
  }

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
    appearance: { theme, accent },
    screenName: set.name,
    timing: {
      messageCycleSec: set.messageCycleSec ?? DEFAULT_TIMING.messageCycleSec,
      fullScreenIntervalSec:
        set.fullScreenIntervalSec ?? DEFAULT_TIMING.fullScreenIntervalSec,
      fullScreenSec: set.fullScreenSec ?? DEFAULT_TIMING.fullScreenSec,
    },
    style,
    substitutions,
    schedule,
    messages: rotation,
    birthdays,
    keys,
    events,
    permanentSlides,
    periodicSlides,
    specialOccasions,
    periodicSpecialOccasions,
    permanentSpecialOccasions,
    fetchedAt: now.getTime(),
    demo,
    substitutionsUnavailable,
  };
}
