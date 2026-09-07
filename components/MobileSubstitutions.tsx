"use client";

import { breakLines, type Slot } from "@/lib/schedule";
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
      groups.push({ period: row.period, periodStart: row.periodStart, rows: [row] });
    }
  }
  return groups;
}

/** Same rule as the wall board: a short task reads as a category, so a pill. */
function isShortTask(content: string): boolean {
  return content.length <= 16 && !/\s\S+\s/.test(content.trim());
}

/** The accent period badge, carrying a fill bar while its lesson is running. */
function PeriodBadge({ label, progress }: { label: string; progress: number | null }) {
  const live = progress !== null;
  return (
    <span
      className={`relative inline-flex min-w-[2.4rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-md px-[0.5rem] py-[0.35rem] font-display text-[1.35rem] font-bold leading-none ${
        live ? "bg-accent text-accent-contrast" : "bg-accent/12 text-accent"
      }`}
    >
      {label}
      {live && (
        <span className="absolute inset-x-[0.3rem] bottom-[0.22rem] h-[0.16rem] overflow-hidden rounded-full bg-black/25">
          <span
            className="block h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      )}
    </span>
  );
}

/**
 * The substitution list, stacked for a phone. Each lesson is a card — period
 * badge, class and room on one line, then who is out and who covers — instead
 * of the wall board's five-column grid, which a portrait screen can't hold.
 * The "now" period stays highlighted, and the pauze dividers still fall between
 * the blocks so the shape of the day survives the reflow.
 */
export function MobileSubstitutions({
  substitutions,
  schedule,
  unavailable = false,
}: {
  substitutions: Substitution[];
  schedule: Slot[];
  unavailable?: boolean;
}) {
  const groups = groupByPeriod(substitutions);
  const slot = useCurrentSlot(schedule);
  const livePeriod = slot?.kind === "lesson" ? slot.period : null;
  const lines = breakLines(schedule);

  return (
    <section className="rounded-lg border-[0.075rem] border-line bg-surface-1 p-[1.1rem]">
      <div className="mb-[0.9rem] flex items-baseline justify-between gap-[0.6rem]">
        <h2 className="font-display text-[1.5rem] font-bold leading-none">
          Vervangingen vandaag
        </h2>
        <span className="shrink-0 text-[0.85rem] font-bold text-muted">
          {substitutions.length} {substitutions.length === 1 ? "les" : "lessen"}
        </span>
      </div>

      {unavailable ? (
        <div className="flex flex-col items-center gap-[0.4rem] py-[1.5rem] text-center">
          <p className="font-display text-[1.4rem] font-bold text-alert">
            Rooster tijdelijk niet beschikbaar
          </p>
          <p className="text-[0.95rem] text-muted">
            De vervangingen konden niet opgehaald worden — vraag na aan het onthaal.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-[0.4rem] py-[1.5rem] text-center">
          <p className="font-display text-[1.5rem] font-bold text-accent">
            Geen vervangingen vandaag
          </p>
          <p className="text-[0.95rem] text-muted">Alle lessen gaan gewoon door.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[0.6rem]">
          {groups.map((group, index) => {
            const prevStart = groups[index - 1]?.periodStart ?? 0;
            const dividers =
              index === 0
                ? []
                : lines.filter(
                    (l) => group.periodStart > l.afterPeriod && prevStart <= l.afterPeriod,
                  );
            const isNow =
              livePeriod !== null && group.rows[0].periods.includes(livePeriod);
            const nowBreak = (afterPeriod: number) =>
              slot?.kind === "break" && slot.afterPeriod === afterPeriod;

            return (
              <div key={`${group.period}-${index}`} className="flex flex-col gap-[0.6rem]">
                {dividers.map((l) => {
                  const now = nowBreak(l.afterPeriod);
                  return (
                    <div
                      key={`${l.label}-${l.afterPeriod}`}
                      className="flex items-center gap-[0.7rem] py-[0.1rem]"
                    >
                      <span
                        className={`h-0 flex-1 border-t-[0.1rem] border-dashed ${
                          now ? "border-accent" : "border-line"
                        }`}
                      />
                      <span
                        className={`eyebrow text-[0.7rem] ${now ? "font-bold text-accent" : ""}`}
                      >
                        {l.label}
                      </span>
                      <span
                        className={`h-0 flex-1 border-t-[0.1rem] border-dashed ${
                          now ? "border-accent" : "border-line"
                        }`}
                      />
                    </div>
                  );
                })}

                <div
                  className={`rounded-md border-[0.075rem] p-[0.85rem] ${
                    isNow ? "border-accent/40 bg-accent/5" : "border-line bg-surface-2"
                  }`}
                >
                  <div className="flex items-start gap-[0.75rem]">
                    <PeriodBadge
                      label={group.period}
                      progress={isNow && slot?.kind === "lesson" ? slot.progress : null}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-[0.7rem]">
                      {group.rows.map((row, rowIndex) => (
                        <div
                          key={`${row.klas}-${rowIndex}`}
                          className={
                            rowIndex > 0 ? "border-t-[0.075rem] border-line pt-[0.7rem]" : ""
                          }
                        >
                          <div className="flex items-baseline justify-between gap-[0.6rem]">
                            <span className="font-display text-[1.35rem] font-bold leading-none">
                              {row.klas}
                            </span>
                            <span className="shrink-0 text-right font-display text-[1.15rem] font-bold text-accent">
                              {row.lokaal || "—"}
                            </span>
                          </div>

                          <div className="mt-[0.4rem] flex flex-col gap-[0.2rem] text-[0.95rem] leading-snug">
                            <div className="flex gap-[0.4rem]">
                              <span className="shrink-0 text-muted">Afwezig</span>
                              <span className="min-w-0 font-light text-muted">
                                {row.absent}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline gap-x-[0.5rem] gap-y-[0.2rem]">
                              <span className="shrink-0 text-muted">Vervanging</span>
                              {row.substitute ? (
                                <span className="font-bold">{row.substitute}</span>
                              ) : (
                                <span className="inline-block rounded-sm bg-accent/15 px-[0.45rem] py-[0.1rem] text-[0.85rem] font-bold text-accent">
                                  Info volgt
                                </span>
                              )}
                              {row.content &&
                                (isShortTask(row.content) ? (
                                  <span className="inline-block rounded-sm bg-accent/15 px-[0.5rem] py-[0.15rem] text-[0.85rem] text-accent">
                                    {row.content}
                                  </span>
                                ) : (
                                  <span className="font-light text-muted">{row.content}</span>
                                ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
