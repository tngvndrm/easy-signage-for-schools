"use client";

import { Clock } from "./Clock";
import { piketColumn } from "./piket-shared";
import { useCurrentSlot, useOverrideDay } from "./useCurrentSlot";
import type { Slot } from "@/lib/schedule";
import type { PiketRoster } from "@/lib/types";

/** Label column, then the five weekdays sharing what's left. */
const COLUMNS = "9em repeat(5, minmax(0, 1fr))";

/** Block rows that fit at full size; beyond that the grid scales down as one. */
const COMFORTABLE_BLOCKS = 7;

/**
 * The lesson a break runs into. During the middagpauze the staff room is at its
 * fullest and no period is live, which is exactly when the row people want to
 * read is the one that starts next.
 */
function nextLessonPeriod(schedule: Slot[], after: Slot): number | null {
  for (const slot of schedule) {
    if (slot.kind === "lesson" && slot.start >= after.end) return slot.period;
  }
  return null;
}

function blockScale(count: number): number {
  return count <= COMFORTABLE_BLOCKS ? 1 : COMFORTABLE_BLOCKS / count;
}

/**
 * The standby roster, as one week.
 *
 * Two questions are asked of this board and they want different things: "who do
 * I call for the hour that's running" wants one cell, "when am I on this week"
 * wants the whole grid. So it shows the grid, and lets the moment do the
 * pointing — today's column is raised out of the week, the running lesson block
 * is marked with the accent the substitution board uses for the same purpose,
 * and their intersection is the cell that answers the first question.
 *
 * The roster itself is standing: the same week all year, so nothing here is
 * dated and nothing rolls over. That's also why the sheet's own version line is
 * on the wall — the one thing that can silently go stale is which version is up.
 */
export function PiketPanel({
  roster,
  schedule,
  boardDate,
  fullscreen = false,
}: {
  roster: PiketRoster;
  schedule: Slot[];
  /** The day the board is showing — `?date=` moves it, so the column follows. */
  boardDate: string;
  /** Filling the screen on its own, rather than sitting in the dashboard. */
  fullscreen?: boolean;
}) {
  const slot = useCurrentSlot(schedule);
  const overrideDay = useOverrideDay();

  const today = piketColumn(boardDate, overrideDay);

  const livePeriod = slot?.kind === "lesson" ? slot.period : null;
  const nextPeriod =
    slot?.kind === "break" ? nextLessonPeriod(schedule, slot) : null;

  const { blocks } = roster;
  const scale = blockScale(blocks.length);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 py-[1.2rem]">
      <div className="flex shrink-0 items-baseline justify-between px-[1.8rem] pb-[0.9rem]">
        <div className="flex items-baseline gap-[1rem]">
          <h2 className="font-display text-[2rem] font-bold leading-none">
            Piketrooster
          </h2>
          {roster.version && (
            <span className="text-[1rem] font-bold text-muted">
              Versie {roster.version}
            </span>
          )}
        </div>
        {fullscreen && <Clock />}
      </div>

      <div
        className="grid min-h-0 flex-1 px-[1.1rem]"
        // Everything below is sized in em off this, so a roster with more
        // blocks shrinks as one piece instead of overflowing.
        style={{
          fontSize: `${scale}rem`,
          gridTemplateColumns: COLUMNS,
          gridTemplateRows: `auto repeat(${blocks.length}, minmax(0, 1fr))`,
        }}
      >
        <span />
        {roster.dayLabels.map((label, day) => (
          <span
            key={label}
            // The heading needs no card of its own — the cards below already
            // draw the column, and a second surface up here only competed
            // with them.
            className={`eyebrow px-[0.6em] pb-[0.4em] text-[0.85em] ${
              day === today ? "font-bold text-accent" : ""
            }`}
          >
            {label}
          </span>
        ))}

        {blocks.map((block, index) => {
          const now = livePeriod !== null && block.periods.includes(livePeriod);
          const next =
            nextPeriod !== null && block.periods.includes(nextPeriod);

          return (
            <div key={`${block.label}-${index}`} className="contents">
              <div className="flex flex-col justify-center px-[0.6em] py-[0.2em]">
                <span
                  className={`truncate-tight font-display text-[1.15em] font-bold ${
                    now || next ? "text-accent" : "text-muted"
                  }`}
                >
                  {block.label}
                </span>
                {now && slot && (
                  // The same bar the substitution board draws under the live
                  // period: which row is running, and how far into it we are.
                  <span className="mt-[0.3em] block h-[0.18em] w-[85%] overflow-hidden rounded-full bg-accent/25">
                    <span
                      className="block h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                      style={{ width: `${Math.round(slot.progress * 100)}%` }}
                    />
                  </span>
                )}
                {next && (
                  <span className="eyebrow pt-[0.15em] text-[0.7em] text-accent">
                    straks
                  </span>
                )}
              </div>

              {block.days.map((names, day) => {
                const isToday = day === today;
                // Nothing is today on a weekend, and then no column deserves to
                // be the quiet one — the whole week reads at full weight.
                const raised = isToday || today === null;
                /*
                 * Today's column is a stack of cards, one per lesson block,
                 * rather than one unbroken band. The other days are grouped by
                 * the white space between blocks, and a column that fills that
                 * space is a column whose blocks run together — which is the
                 * one place the reader is least able to afford it.
                 *
                 * The cell that answers "who do I call right now" is the one
                 * where today meets the running block, so only that one is
                 * filled. Over the break it is merely outlined: the hour it
                 * belongs to hasn't started, and the staff room is reading
                 * ahead rather than acting.
                 */
                const band = isToday
                  ? now
                    ? "my-[0.2em] rounded-md bg-accent/15 outline outline-[0.07em] -outline-offset-[0.07em] outline-accent dark:bg-accent/35"
                    : next
                      ? "my-[0.2em] rounded-md bg-surface-2 outline outline-[0.07em] -outline-offset-[0.07em] outline-accent/40"
                      : "my-[0.2em] rounded-md bg-surface-2"
                  : "";

                return (
                  <div
                    key={day}
                    className={`flex flex-col justify-center gap-[0.1em] overflow-hidden px-[0.6em] py-[0.25em] ${band}`}
                  >
                    {names.length === 0 ? (
                      <span className="text-[1.1em] font-light leading-tight text-muted/50">
                        —
                      </span>
                    ) : (
                      names.map((name, i) => (
                        <span
                          key={`${name}-${i}`}
                          // One type size across the whole week. Weight, colour
                          // and the card behind it are what raise today — size
                          // as well would cost the block its breathing room,
                          // and with it the grouping that makes the grid
                          // readable in the first place.
                          className={`truncate-tight text-[1.15em] ${
                            raised ? "font-bold" : "font-light text-muted"
                          // Accent on a pale tint in light; on the much
                          // stronger dark fill the names go back to plain text,
                          // which is where the contrast is.
                          } ${now && raised ? "text-accent dark:text-text" : ""}`}
                        >
                          {name}
                        </span>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
