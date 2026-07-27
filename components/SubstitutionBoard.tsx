"use client";

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

const COLUMNS = "6.5rem 7rem 1.35fr 1.35fr 8rem";

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
    <span className="relative inline-flex min-w-[2.9rem] flex-col items-center overflow-hidden rounded-sm bg-accent px-[0.65rem] pb-[0.55rem] pt-[0.3rem] font-display text-[2.1rem] font-bold leading-none text-accent-contrast">
      {label}
      <span className="absolute inset-x-[0.4rem] bottom-[0.22rem] h-[0.2rem] rounded-full bg-black/25">
        <span
          className="block h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </span>
    </span>
  );
}

export function SubstitutionBoard({
  substitutions,
  breakAfterPeriod,
}: {
  substitutions: Substitution[];
  breakAfterPeriod: number | null;
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

      {groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[0.5rem] text-center">
          <p className="font-display text-[2.4rem] font-bold text-accent">
            Geen vervangingen vandaag
          </p>
          <p className="text-[1.1rem] text-muted">
            Alle lessen gaan gewoon door.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-[0.7rem]">
          {groups.map((group, index) => {
            const showPauze =
              breakAfterPeriod !== null &&
              group.periodStart > breakAfterPeriod &&
              (groups[index - 1]?.periodStart ?? 0) <= breakAfterPeriod;

            const isNow =
              livePeriod !== null && group.rows[0].periods.includes(livePeriod);

            return (
              <div key={`${group.period}-${index}`} className="contents">
                {showPauze && (
                  <PauzeDivider
                    label={
                      slot?.kind === "break" &&
                      slot.afterPeriod === breakAfterPeriod
                        ? slot.label
                        : "pauze"
                    }
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
                      <span className="font-display text-[2.1rem] font-bold leading-none text-accent">
                        {rowIndex !== 0 ? null : isNow && slot ? (
                          <NowPeriod
                            label={group.period}
                            progress={slot.progress}
                          />
                        ) : (
                          group.period
                        )}
                      </span>
                      <span className="font-display text-[1.75rem] font-bold leading-none">
                        {row.klas}
                      </span>
                      <span className="truncate text-[1.5rem] font-light leading-none text-muted">
                        {row.absent}
                      </span>
                      <span className="truncate text-[1.55rem] font-bold leading-none">
                        {row.substitute ? (
                          row.substitute
                        ) : (
                          <span className="inline-block rounded-sm bg-alert-bg px-[0.7rem] py-[0.3rem] text-[1.2rem] font-bold text-alert">
                            Geen les
                          </span>
                        )}
                      </span>
                      <span className="text-right font-display text-[1.65rem] font-bold leading-none text-calm">
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
