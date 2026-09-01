import { periodSpan, slotAt, upcomingPeriod, type Slot } from "@/lib/schedule";
import type { PiketRoster } from "@/lib/types";

/** Monday = 0, matching `PiketRoster.days`. Null outside the school week. */
export function weekdayIndex(isoDate: string): number | null {
  // Midday, so no timezone can push the date onto a neighbouring day.
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  return day >= 1 && day <= 5 ? day - 1 : null;
}

/**
 * The roster column the board is pointing at, Monday = 0.
 *
 * `?now=wed+12:45` moves the marker to another weekday, and the column follows
 * it rather than staying on the real today, so a preview stays coherent;
 * otherwise it's the day the board is showing, which `?date=` can move too.
 */
export function piketColumn(
  boardDate: string,
  overrideDay: number | null,
): number | null {
  if (overrideDay === null) return weekdayIndex(boardDate);
  return overrideDay >= 1 && overrideDay <= 5 ? overrideDay - 1 : null;
}

/** One block's turn on standby, seen from a particular moment in the day. */
export type PiketTurn = {
  /** "Nu", "Straks" or "Daarna" — where this turn sits from here. */
  when: string;
  /** The block label, as the sheet writes it. */
  label: string;
  /** Who to call, in the sheet's order: the first name, then the fallbacks. */
  names: string[];
  /** 0–1 through the turn, or null for one that hasn't started. */
  progress: number | null;
};

/**
 * Who is on standby now, and who takes over next.
 *
 * The full roster answers "when am I on this week"; this answers the other
 * question the staff room asks — "who do I call, and for how much longer" —
 * which is the one worth carrying on the dashboard between the roster's turns
 * on screen.
 *
 * Between lessons, and before the first bell, nothing is running: then both
 * turns are ones still to come, and they say so rather than pointing at a
 * person whose hour is over. Blocks nobody covers today (a Wednesday
 * afternoon) are skipped rather than shown empty, and once the last lesson of
 * the day has started there is nothing left to show at all.
 */
export function piketTurns(
  roster: PiketRoster,
  schedule: Slot[],
  /** The roster column to read, Monday = 0 — see `piketColumn`. */
  column: number,
  /** School-clock minutes since midnight. */
  minutes: number,
  limit = 2,
): PiketTurn[] {
  // `Slot#day` counts from Sunday; the roster's columns from Monday.
  const day = column + 1;
  const slot = slotAt(schedule, { day, minutes });
  const period =
    slot?.kind === "lesson"
      ? slot.period
      : upcomingPeriod(schedule, { day, minutes });
  if (period === null) return [];

  const from = roster.blocks.findIndex((b) => b.periods.includes(period));
  if (from < 0) return [];

  // A block with nobody in it is skipped, and the turns after it keep their
  // own names: the one after a live block is still "straks", never "nu".
  const live = slot?.kind === "lesson";
  const labels = live ? ["Nu", "Straks", "Daarna"] : ["Straks", "Daarna"];

  const turns: PiketTurn[] = [];
  for (let i = from; i < roster.blocks.length && turns.length < limit; i++) {
    const block = roster.blocks[i];
    const names = block.days[column] ?? [];
    if (names.length === 0) continue;

    const rank = i - from;
    // The bar runs over the whole block, not the lesson inside it: what the
    // staff room is waiting for is the handover, which is where the block ends.
    const span =
      live && rank === 0 ? periodSpan(schedule, block.periods, day) : null;

    turns.push({
      when: labels[Math.min(rank, labels.length - 1)],
      label: block.label,
      names,
      progress: span
        ? Math.min(1, Math.max(0, (minutes - span.start) / (span.end - span.start)))
        : null,
    });
  }
  return turns;
}
