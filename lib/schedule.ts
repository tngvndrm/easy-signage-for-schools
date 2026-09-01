/**
 * The school day, in minutes since midnight (Europe/Brussels).
 *
 * The schedule can come from the sheet's `Rooster` tab; the table below is the
 * fallback used when that tab is absent. Monday to Friday run the full day;
 * Wednesday stops after `SHORT_DAY_LAST_PERIOD`, so its afternoon slots — and
 * the break that would precede them — are dropped. Outside these windows the
 * board shows no "now" marker: before the first bell, after the last, weekends.
 */

const TIMEZONE = "Europe/Brussels";

/** Wednesday ends after this period. */
const SHORT_DAY_LAST_PERIOD = 4;
/** 0 = Sunday, 3 = Wednesday — matches Date#getDay conventions. */
const SHORT_DAY = 3;

const hm = (hours: number, minutes: number) => hours * 60 + minutes;

export type Slot =
  | { kind: "lesson"; period: number; start: number; end: number }
  | {
      kind: "break";
      label: string;
      /** The lesson period this break follows. */
      afterPeriod: number;
      start: number;
      end: number;
      /** Draw a divider line for this break on the substitution board. */
      line: boolean;
    };

/** Fallback schedule when there's no `Rooster` tab (Steinerschool Gent). */
export const DEFAULT_SCHEDULE: Slot[] = [
  { kind: "lesson", period: 1, start: hm(8, 50), end: hm(9, 40) },
  { kind: "lesson", period: 2, start: hm(9, 40), end: hm(10, 30) },
  { kind: "break", label: "kleine pauze", afterPeriod: 2, start: hm(10, 30), end: hm(10, 50), line: false },
  { kind: "lesson", period: 3, start: hm(10, 50), end: hm(11, 40) },
  { kind: "lesson", period: 4, start: hm(11, 40), end: hm(12, 30) },
  { kind: "break", label: "middagpauze", afterPeriod: 4, start: hm(12, 30), end: hm(13, 20), line: true },
  { kind: "lesson", period: 5, start: hm(13, 20), end: hm(14, 10) },
  { kind: "lesson", period: 6, start: hm(14, 10), end: hm(15, 0) },
  { kind: "break", label: "kleine pauze", afterPeriod: 6, start: hm(15, 0), end: hm(15, 10), line: false },
  { kind: "lesson", period: 7, start: hm(15, 10), end: hm(16, 0) },
  { kind: "lesson", period: 8, start: hm(16, 0), end: hm(16, 50) },
];

export type NowSlot = Slot & {
  /** 0–1, how far through the slot we are. */
  progress: number;
};

/** The breaks that want a divider line, in schedule order. */
export function breakLines(schedule: Slot[]): { afterPeriod: number; label: string }[] {
  return schedule.flatMap((s) =>
    s.kind === "break" && s.line
      ? [{ afterPeriod: s.afterPeriod, label: s.label }]
      : [],
  );
}

// Never allowed to throw at module load: this runs client-side (via the lesson
// marker), and a Chromium without the full timezone database raises on an
// explicit `timeZone`. An uncaught throw here would crash the board's
// hydration. The device clock is already in this zone, so local time is the
// correct fallback.
const parts = (() => {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, ...opts });
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts);
  }
})();

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Read the school's wall clock, not the server's. */
export function schoolTime(now: Date = new Date()): { day: number; minutes: number } {
  const found: Record<string, string> = {};
  for (const part of parts.formatToParts(now)) found[part.type] = part.value;

  // "24" is midnight in some ICU builds.
  const hours = Number(found.hour) % 24;
  return {
    day: WEEKDAY_INDEX[found.weekday] ?? -1,
    minutes: hours * 60 + Number(found.minute) + Number(found.second) / 60,
  };
}

function runsOn(slot: Slot, day: number): boolean {
  if (day < 1 || day > 5) return false;
  if (day !== SHORT_DAY) return true;
  return slot.kind === "lesson"
    ? slot.period <= SHORT_DAY_LAST_PERIOD
    : slot.afterPeriod < SHORT_DAY_LAST_PERIOD;
}

/** The lesson or break covering a given point in the week. */
export function slotAt(
  schedule: Slot[],
  at: { day: number; minutes: number },
): NowSlot | null {
  for (const slot of schedule) {
    if (at.minutes < slot.start || at.minutes >= slot.end) continue;
    if (!runsOn(slot, at.day)) return null;
    return {
      ...slot,
      progress: (at.minutes - slot.start) / (slot.end - slot.start),
    };
  }
  return null;
}

/**
 * The first lesson period still to come on this day, or null once the last one
 * has started. Days the school runs short are respected, so a Wednesday
 * afternoon has nothing coming rather than the periods the table would list.
 */
export function upcomingPeriod(
  schedule: Slot[],
  at: { day: number; minutes: number },
): number | null {
  for (const slot of schedule) {
    if (slot.kind !== "lesson" || !runsOn(slot, at.day)) continue;
    if (slot.start >= at.minutes) return slot.period;
  }
  return null;
}

/**
 * The window a run of lesson periods occupies, from the start of the first to
 * the end of the last — the span a standby block is on for. Null when none of
 * the periods run on this day.
 */
export function periodSpan(
  schedule: Slot[],
  periods: number[],
  day: number,
): { start: number; end: number } | null {
  let start = Infinity;
  let end = -Infinity;
  for (const slot of schedule) {
    if (slot.kind !== "lesson" || !runsOn(slot, day)) continue;
    if (!periods.includes(slot.period)) continue;
    start = Math.min(start, slot.start);
    end = Math.max(end, slot.end);
  }
  return end > start ? { start, end } : null;
}

/** The lesson or break happening right now, or null outside school hours. */
export function currentSlot(
  schedule: Slot[],
  now: Date = new Date(),
): NowSlot | null {
  return slotAt(schedule, schoolTime(now));
}

/**
 * Parse a `?now=` preview override, e.g. `10:15` or `wed 12:45`. Lets you check
 * how the board will look at any point in the day without waiting for it.
 */
export function parseTimeOverride(value: string): {
  day: number;
  minutes: number;
} | null {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(?:(sun|mon|tue|wed|thu|fri|sat)\s+)?(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, weekday, hours, minutes] = match;
  const day = weekday
    ? WEEKDAY_INDEX[weekday[0].toUpperCase() + weekday.slice(1)]
    : schoolTime(new Date()).day;

  return { day, minutes: Number(hours) * 60 + Number(minutes) };
}
