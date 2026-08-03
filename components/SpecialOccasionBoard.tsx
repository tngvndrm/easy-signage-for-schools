"use client";

import { useEffect, useState } from "react";
import { parseTimeOverride } from "@/lib/schedule";
import type { SpecialOccasion } from "@/lib/types";

const TICK_MS = 10_000;
const MIN_SCALE = 0.55;

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function rowScale(rowCount: number, comfortable: number): number {
  if (rowCount <= comfortable) return 1;
  return Math.max(MIN_SCALE, comfortable / rowCount);
}

// Tijd column: show "HH:MM – HH:MM" or just "HH:MM"; a NowTime pill replaces
// this for the currently-running entry.
const COLUMNS = "minmax(9.5rem, 13rem) 1.6fr 1.3fr 1.2fr minmax(7rem, 11rem)";

function NowTime({ timeFrom, progress }: { timeFrom: string; progress: number }) {
  return (
    <span className="relative inline-flex min-w-[5em] flex-col items-center overflow-hidden rounded-sm bg-accent px-[0.3em] pb-[0.32em] pt-[0.14em] font-bold leading-none text-accent-contrast">
      Nu · {timeFrom}
      <span className="absolute inset-x-[0.2em] bottom-[0.11em] h-[0.1em] rounded-full bg-black/25">
        <span
          className="block h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </span>
    </span>
  );
}

function HeaderRow() {
  return (
    <div
      className="grid items-center gap-x-[1rem] px-[1.8rem] pb-[0.6rem] text-[0.8rem]"
      style={{ gridTemplateColumns: COLUMNS }}
    >
      <span className="eyebrow">Tijd</span>
      <span className="eyebrow">Activiteit</span>
      <span className="eyebrow">Begeleider</span>
      <span className="eyebrow">Info</span>
      <span className="eyebrow text-right">Locatie</span>
    </div>
  );
}

export function SpecialOccasionBoard({
  occasion,
  comfortableRows = 7,
}: {
  occasion: SpecialOccasion;
  comfortableRows?: number;
}) {
  const [nowIndex, setNowIndex] = useState(-1);
  const [nowProgress, setNowProgress] = useState(0);

  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("now");
    const frozen = override ? parseTimeOverride(override) : null;

    const tick = (minutesNow: number) => {
      let found = -1;
      let progress = 0;
      for (let i = 0; i < occasion.entries.length; i++) {
        const e = occasion.entries[i];
        if (minutesNow < e.timeFromMinutes) continue;
        if (e.timeToMinutes !== undefined && minutesNow >= e.timeToMinutes) continue;
        found = i;
        const duration =
          e.timeToMinutes !== undefined
            ? e.timeToMinutes - e.timeFromMinutes
            : 0;
        progress = duration > 0 ? (minutesNow - e.timeFromMinutes) / duration : 0;
        break;
      }
      setNowIndex(found);
      setNowProgress(progress);
    };

    if (frozen) {
      tick(frozen.minutes);
      return;
    }

    tick(nowMinutes());
    const timer = setInterval(() => tick(nowMinutes()), TICK_MS);
    return () => clearInterval(timer);
  }, [occasion.entries]);

  const { entries } = occasion;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 py-[1.2rem]">
      <div className="flex shrink-0 items-baseline justify-between px-[1.8rem] pb-[0.9rem]">
        <h2 className="font-display text-[2rem] font-bold leading-none">
          {occasion.title}
        </h2>
        <span className="text-[1rem] font-bold text-muted">
          {occasion.eventDateLabel}
        </span>
      </div>

      <HeaderRow />

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[0.5rem] text-center">
          <p className="font-display text-[2.2rem] font-bold text-muted">
            Geen activiteiten ingepland
          </p>
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col px-[0.7rem]"
          style={{
            fontSize: `${rowScale(entries.length, comfortableRows)}rem`,
          }}
        >
          {entries.map((entry, index) => {
            const isNow = index === nowIndex;
            return (
              <div
                key={`${entry.timeFrom}-${index}`}
                className={`grid flex-1 items-center gap-x-[1rem] px-[1.1rem] ${
                  index % 2 === 1 ? "rounded-md bg-surface-2" : ""
                }`}
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span className="font-display text-[1.5em] font-bold leading-none text-accent">
                  {isNow ? (
                    <NowTime
                      timeFrom={entry.timeFrom}
                      progress={nowProgress}
                    />
                  ) : (
                    <>
                      {entry.timeFrom}
                      {entry.timeTo && (
                        <span className="text-[0.7em] font-normal text-muted">
                          {" – "}
                          {entry.timeTo}
                        </span>
                      )}
                    </>
                  )}
                </span>
                <span className="font-display text-[1.75em] font-bold leading-none">
                  {entry.activity}
                </span>
                <span className="truncate text-[1.5em] font-light leading-none text-muted">
                  {entry.supervisor}
                </span>
                <span className="truncate text-[1.3em] leading-none text-muted">
                  {entry.info}
                </span>
                <span className="truncate text-right font-display text-[1.65em] font-bold leading-none text-accent">
                  {entry.location || "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
