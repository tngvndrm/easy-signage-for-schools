"use client";

import { piketColumn, piketTurns } from "./piket-shared";
import { useOverrideDay, useSchoolMoment } from "./useCurrentSlot";
import type { Slot } from "@/lib/schedule";
import type { PiketRoster } from "@/lib/types";

/** Type size of a name line, in rem: the running turn, then the one after. */
const LIVE_REM = 1.25;
const NEXT_REM = 1.1;

/**
 * Characters a name line holds at full size. Past that it scales down as one
 * line rather than cutting the last name off — the third name is the one you
 * reach for when the first two don't answer, so it's the last thing the card
 * can afford to lose.
 */
const COMFORTABLE_CHARS = 22;
/** How far a line may shrink before it truncates instead. */
const MIN_SCALE = 0.75;

function lineScale(names: string[]): number {
  const chars = names.join(" · ").length;
  if (chars <= COMFORTABLE_CHARS) return 1;
  return Math.max(MIN_SCALE, COMFORTABLE_CHARS / chars);
}

/**
 * Who is on standby right now, and who takes over next.
 *
 * The full roster gets the screen every few minutes; this is the part of it
 * that shouldn't have to be waited for. A sudden absence is exactly the moment
 * nobody wants to stand in front of a board waiting for the right slide, so the
 * one line that answers "who do I call" stays on the dashboard all day, beside
 * the notices and the birthdays.
 *
 * It shows what the moment makes true and nothing more: the running block in
 * the accent with a bar draining towards the handover, the one after it plain
 * underneath. Between lessons nothing is running, and then both lines are
 * upcoming ones — better than pointing at someone whose hour is over.
 */
export function PiketNow({
  roster,
  schedule,
  boardDate,
  // Positional sizing is set by the parent, as with the birthday card: a fixed
  // width in the dashboard row, full width when the busy-day layout stacks it.
  // Narrower than its neighbours — two names and a block label is all it holds,
  // and every point it doesn't take is a point the notices keep.
  className = "w-[21%] shrink-0",
}: {
  roster: PiketRoster;
  schedule: Slot[];
  /** The day the board is showing — `?date=` moves it, so the column follows. */
  boardDate: string;
  className?: string;
}) {
  const moment = useSchoolMoment();
  const overrideDay = useOverrideDay();

  const column = piketColumn(boardDate, overrideDay);
  // Nothing to point at outside the school week, and nothing until the clock
  // has been read — the first client render has to match the server's.
  const turns =
    column === null || moment === null
      ? []
      : piketTurns(roster, schedule, column, moment.minutes);

  // Out of hours the card leaves the row rather than standing empty, the same
  // way the birthday card does on a day with no birthdays.
  if (turns.length === 0) return null;

  return (
    // The transparent border matches its neighbours', so all three cards' content
    // boxes start at the same y and their labels sit on one line.
    <section
      className={`relative flex flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 p-[1.4rem] ${className}`}
    >
      {/* HEADER_ROW keeps this label on the same line as "Mededelingen". */}
      <div className="mb-[0.6rem] flex h-[1.7rem] shrink-0 items-center">
        <span className="eyebrow text-[0.8rem]">Piket</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[0.55rem]">
        {turns.map((turn) => {
          const live = turn.progress !== null;

          return (
            <div key={`${turn.when}-${turn.label}`} className="min-w-0">
              {/* One size for the whole line, so "nu" and the block it names
                  read as a single caption; the running one is set bold. */}
              <div
                className={`flex items-baseline gap-[0.45rem] text-[0.75rem] ${
                  live ? "font-bold" : ""
                }`}
              >
                <span className={`eyebrow text-[1em] ${live ? "text-accent" : ""}`}>
                  {turn.when}
                </span>
                <span className="truncate-tight min-w-0 text-muted">
                  {turn.label}
                </span>
              </div>

              {/* Every name at one weight and size, in the sheet's own order.
                  The order already says who to try first; setting the first
                  name larger said it a second time, and turned a row of
                  colleagues into a hierarchy the roster doesn't have. */}
              <div
                className={`truncate-tight font-display ${
                  live ? "font-bold text-accent" : ""
                }`}
                // The dot between names is sized in em, so the whole line
                // shrinks as one piece.
                style={{
                  fontSize: `${(live ? LIVE_REM : NEXT_REM) * lineScale(turn.names)}rem`,
                }}
              >
                {turn.names.map((name, i) => (
                  <span key={`${name}-${i}`}>
                    {i > 0 && (
                      <span
                        className={`px-[0.3rem] text-[0.75em] ${
                          live ? "text-accent/45" : "text-muted/70"
                        }`}
                      >
                        ·
                      </span>
                    )}
                    {name}
                  </span>
                ))}
              </div>

              {live && (
                // The same bar the substitution board and the roster draw under
                // a running period, here spanning the whole block: how long
                // this name is still the one to call.
                <span className="mt-[0.25rem] block h-[0.16rem] w-full overflow-hidden rounded-full bg-accent/25">
                  <span
                    className="block h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                    style={{ width: `${Math.round(turn.progress! * 100)}%` }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
