import type { SpecialOccasionEntry } from "./types";

/**
 * How long the final entry stays live when it has no end time: the programme
 * has to stop marking "Nu" somewhere, and the sheet doesn't say where.
 */
const OPEN_END_MINUTES = 60;

/**
 * Where the "Nu" marker sits in a special occasion's programme: one slot per
 * entry, 0–1 through the entry while it runs and null while it doesn't.
 *
 * `Tijd tot` is optional, and in practice often left blank — an entry without
 * one runs until the next entry starts, and the last one for OPEN_END_MINUTES.
 * Without that fallback an open-ended entry matched every moment after it
 * began, so the marker stuck to the first row of the day and never moved.
 *
 * Rows sharing a start time are parallel groups, not successors, so they can't
 * end each other and are all marked at once; the same goes for entries whose
 * given times genuinely overlap. What's running is what's running.
 */
export function programmeProgress(
  entries: SpecialOccasionEntry[],
  minutes: number,
): (number | null)[] {
  const starts = [...new Set(entries.map((e) => e.timeFromMinutes))].sort(
    (a, b) => a - b,
  );

  return entries.map((entry) => {
    const start = entry.timeFromMinutes;
    // A "Tijd tot" at or before "Tijd van" is a typo, not an end: fall back
    // rather than leaving the row unmarkable for the whole day.
    const given =
      entry.timeToMinutes !== undefined && entry.timeToMinutes > start
        ? entry.timeToMinutes
        : undefined;
    const end = given ?? starts.find((s) => s > start) ?? start + OPEN_END_MINUTES;

    if (minutes < start || minutes >= end) return null;
    return (minutes - start) / (end - start);
  });
}
