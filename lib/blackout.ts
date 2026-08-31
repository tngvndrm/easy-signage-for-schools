/**
 * Standby-window arithmetic, kept apart from `settings.ts` on purpose.
 *
 * The screen decides for itself, minute by minute, whether it should be dark,
 * so this runs in the browser — and `settings.ts` reaches the Sheets client and
 * its Node-only dependencies, which a client bundle can't take. Same split as
 * `schedule.ts`, which the lesson marker uses from the same side of the wire.
 */

/**
 * Is a screen inside its blacked-out window at `nowMin`?
 *
 * The usual shape runs overnight — off at 18:00, back at 08:30 — so the window
 * wraps past midnight; a daytime window (off 12:00, on 13:00) reads the same
 * way. Two identical times describe a window of zero length rather than one
 * that never ends: a board the sheet can't turn back on is the one outcome
 * worth ruling out, since nobody would know where to look.
 */
export function blackoutAt(
  nowMin: number,
  startMin: number,
  endMin: number,
): boolean {
  if (startMin === endMin) return false;
  return startMin < endMin
    ? nowMin >= startMin && nowMin < endMin
    : nowMin >= startMin || nowMin < endMin;
}

/** Minutes-of-day back to the "08:30" staff typed, for the standby screen. */
export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
