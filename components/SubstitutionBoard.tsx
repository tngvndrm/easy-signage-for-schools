"use client";

import { breakLabelAfter } from "@/lib/schedule";
import type { Substitution } from "@/lib/types";
import { useCurrentSlot } from "./useCurrentSlot";

type Group = { period: string; periodStart: number; rows: Substitution[] };

function groupByPeriod(rows: Substitution[]): Group[] {
  const groups: Group[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.period === row.period) {
      last.rows.push(row);
    } else {
      groups.push({
        period: row.period,
        periodStart: row.periodStart,
        rows: [row],
      });
    }
  }
  return groups;
}

// Lokaal sizes to its content within bounds: real room names run from "A12"
// to "Lokaal van 7A", and a fixed width either wraps the long ones or wastes
// space on the short ones.
const COLUMNS = "6.5rem 7rem 1.3fr 1.3fr minmax(8rem, 13rem)";

/**
 * A short task like "Zelfstudie" or "Toets" reads as a category, so it gets a
 * pill. Anything longer is a free-form instruction and stays plain text, where
 * a pill would just look like a cramped label.
 */
function isShortTask(content: string): boolean {
  return content.length <= 16 && !/\s\S+\s/.test(content.trim());
}

function HeaderRow() {
  return (
    <div
      className="grid items-center gap-x-[1rem] px-[1.8rem] pb-[0.6rem] text-[0.8rem]"
      style={{ gridTemplateColumns: COLUMNS }}
    >
      <span className="eyebrow">Lesuur</span>
      <span className="eyebrow">Klas</span>
      <span className="eyebrow">Afwezig</span>
      <span className="eyebrow">Vervanging</span>
      <span className="eyebrow text-right">Lokaal</span>
    </div>
  );
}

function PauzeDivider({ label, now }: { label: string; now: boolean }) {
  const line = now ? "border-accent" : "border-line";
  return (
    <div className="flex shrink-0 items-center gap-[1rem] px-[1.8rem] py-[0.4rem]">
      <span className={`h-0 flex-1 border-t-[0.1rem] border-dashed ${line}`} />
      <span
        className={`eyebrow text-[0.8rem] ${now ? "font-bold text-accent" : ""}`}
      >
        {label}
      </span>
      <span className={`h-0 flex-1 border-t-[0.1rem] border-dashed ${line}`} />
    </div>
  );
}

/**
 * The period number of the lesson happening right now: filled with the accent
 * and carrying a bar that fills as the lesson runs, so a glance at the board
 * tells you both which row is live and how far into it we are.
 */
function NowPeriod({ label, progress }: { label: string; progress: number }) {
  return (
    // Sized by the cell it sits in — it must not re-apply the row's em scale.
    <span className="relative inline-flex min-w-[1.5em] flex-col items-center overflow-hidden rounded-sm bg-accent px-[0.3em] pb-[0.32em] pt-[0.14em] font-bold leading-none text-accent-contrast">
      {label}
      <span className="absolute inset-x-[0.2em] bottom-[0.11em] h-[0.1em] rounded-full bg-black/25">
        <span
          className="block h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </span>
    </span>
  );
}

const MIN_SCALE = 0.55;

/**
 * `comfortable` rows fit at full size; beyond that the rows shrink together
 * rather than colliding — a board nobody can read is worse than one in smaller
 * type, and busy days are the ones people most need to read. The comfortable
 * count is higher in the busy-day layout, where the board owns the full height.
 */
function rowScale(rowCount: number, comfortable: number): number {
  if (rowCount <= comfortable) return 1;
  return Math.max(MIN_SCALE, comfortable / rowCount);
}

export function SubstitutionBoard({
  substitutions,
  breakAfterPeriod,
  unavailable = false,
  comfortableRows = 7,
}: {
  substitutions: Substitution[];
  breakAfterPeriod: number | null;
  /** The sheet couldn't be read — say so rather than implying a quiet day. */
  unavailable?: boolean;
  /** Rows that fit at full size before the table scales down. */
  comfortableRows?: number;
}) {
  const groups = groupByPeriod(substitutions);
  const slot = useCurrentSlot();
  const livePeriod = slot?.kind === "lesson" ? slot.period : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 py-[1.2rem]">
      <div className="flex shrink-0 items-baseline justify-between px-[1.8rem] pb-[0.9rem]">
        <h2 className="font-display text-[2rem] font-bold leading-none">
          Vervangingen vandaag
        </h2>
        <span className="text-[1rem] font-bold text-muted">
          {substitutions.length} {substitutions.length === 1 ? "les" : "lessen"}
        </span>
      </div>

      <HeaderRow />

      {unavailable ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[0.5rem] text-center">
          <p className="font-display text-[2.2rem] font-bold text-alert">
            Rooster tijdelijk niet beschikbaar
          </p>
          <p className="text-[1.1rem] text-muted">
            De vervangingen konden niet opgehaald worden — vraag na aan het
            onthaal.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[0.5rem] text-center">
          <p className="font-display text-[2.4rem] font-bold text-accent">
            Geen vervangingen vandaag
          </p>
          <p className="text-[1.1rem] text-muted">
            Alle lessen gaan gewoon door.
          </p>
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col px-[0.7rem]"
          // Row type is sized in em off this, so a busy day scales down as one.
          style={{
            fontSize: `${rowScale(substitutions.length, comfortableRows)}rem`,
          }}
        >
          {groups.map((group, index) => {
            const showPauze =
              breakAfterPeriod !== null &&
              group.periodStart > breakAfterPeriod &&
              (groups[index - 1]?.periodStart ?? 0) <= breakAfterPeriod;

            const isNow =
              livePeriod !== null && group.rows[0].periods.includes(livePeriod);

            return (
              <div key={`${group.period}-${index}`} className="contents">
                {showPauze && breakAfterPeriod !== null && (
                  <PauzeDivider
                    // Always name the actual break (e.g. "middagpauze"), not
                    // just while it's live.
                    label={breakLabelAfter(breakAfterPeriod) ?? "pauze"}
                    now={
                      slot?.kind === "break" &&
                      slot.afterPeriod === breakAfterPeriod
                    }
                  />
                )}
                <div
                  className={`flex min-h-0 flex-1 flex-col justify-center ${
                    index % 2 === 1 ? "rounded-md bg-surface-2" : ""
                  }`}
                  style={{ flexGrow: group.rows.length }}
                >
                  {group.rows.map((row, rowIndex) => (
                    <div
                      key={`${row.klas}-${rowIndex}`}
                      className="grid flex-1 items-center gap-x-[1rem] px-[1.1rem]"
                      style={{ gridTemplateColumns: COLUMNS }}
                    >
                      <span className="font-display text-[2.1em] font-bold leading-none text-accent">
                        {rowIndex !== 0 ? null : isNow && slot ? (
                          <NowPeriod
                            label={group.period}
                            progress={slot.progress}
                          />
                        ) : (
                          group.period
                        )}
                      </span>
                      <span className="font-display text-[1.75em] font-bold leading-none">
                        {row.klas}
                      </span>
                      <span className="truncate text-[1.5em] font-light leading-none text-muted">
                        {row.absent}
                      </span>
                      <div className="flex min-w-0 items-baseline gap-[0.6em]">
                        <span className="shrink-0 text-[1.55em] font-bold leading-none">
                          {row.substitute ? (
                            row.substitute
                          ) : (
                            <span className="inline-block rounded-sm bg-accent/15 px-[0.45em] py-[0.2em] text-[0.78em] font-bold text-accent">
                              Info volgt
                            </span>
                          )}
                        </span>
                        {row.content &&
                          (isShortTask(row.content) ? (
                            <span className="shrink-0 rounded-sm bg-accent/15 px-[0.6em] py-[0.26em] text-[0.98em] font-normal leading-none text-accent">
                              {row.content}
                            </span>
                          ) : (
                            <span className="truncate text-[0.95em] font-light leading-none text-muted">
                              {row.content}
                            </span>
                          ))}
                      </div>
                      <span className="truncate text-right font-display text-[1.65em] font-bold leading-none text-accent">
                        {row.lokaal || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
