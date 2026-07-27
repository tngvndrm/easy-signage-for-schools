import type { Substitution } from "@/lib/types";

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

function PauzeDivider() {
  return (
    <div className="flex shrink-0 items-center gap-[1rem] px-[1.8rem] py-[0.4rem]">
      <span className="h-0 flex-1 border-t-[0.1rem] border-dashed border-line" />
      <span className="eyebrow text-[0.8rem]">pauze</span>
      <span className="h-0 flex-1 border-t-[0.1rem] border-dashed border-line" />
    </div>
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

            return (
              <div key={`${group.period}-${index}`} className="contents">
                {showPauze && <PauzeDivider />}
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
                        {rowIndex === 0 ? group.period : ""}
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
