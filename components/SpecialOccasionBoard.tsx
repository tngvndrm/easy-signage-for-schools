"use client";

import { useEffect, useState } from "react";
import { parseTimeOverride, schoolTime } from "@/lib/schedule";
import type { SpecialOccasion, SpecialOccasionEntry } from "@/lib/types";
import { Clock } from "./Clock";

const TICK_MS = 10_000;
const MIN_SCALE = 0.55;

// The school's wall clock, like every other now-marker — not the viewing
// device's, which may sit in another timezone when previewing from a desk.
function nowMinutes(): number {
  return schoolTime().minutes;
}

function rowScale(rowCount: number, comfortable: number): number {
  if (rowCount <= comfortable) return 1;
  return Math.max(MIN_SCALE, comfortable / rowCount);
}

// Tijd column: show "HH:MM – HH:MM" or just "HH:MM"; a NowTime pill replaces
// this for the currently-running entry. Activiteit takes the whole middle —
// activity names are the long text on this board, and Info rides along inside
// that cell as a pill rather than claiming a column that's mostly empty.
const COLUMNS = "minmax(9.5rem, 13rem) 1fr minmax(7rem, 11rem)";

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
      <span className="eyebrow text-right">Locatie</span>
    </div>
  );
}

/** A break in the day — rendered as a dashed divider, like the substitutions board. */
function isPause(activity: string): boolean {
  const a = activity.toLowerCase();
  return a.includes("pauze") || a.includes("speeltijd");
}

function PauzeDivider({
  entry,
  now,
}: {
  entry: SpecialOccasionEntry;
  now: boolean;
}) {
  const line = now ? "border-accent" : "border-line";
  const time = entry.timeTo
    ? `${entry.timeFrom} – ${entry.timeTo}`
    : entry.timeFrom;
  const label = [entry.activity, time].filter(Boolean).join(" · ");
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

export function SpecialOccasionBoard({
  occasion,
  boardDate,
  comfortableRows = 7,
  fullscreen = false,
}: {
  occasion: SpecialOccasion;
  /** The date the board is showing (school tz, ISO). The "Nu" indicator only
   * runs when it matches the occasion's own date — a schedule published days
   * ahead shows the plan without pretending it's live. */
  boardDate: string;
  comfortableRows?: number;
  /** Full-screen (Permanent / Yes): the global header is gone, so the board
   * carries the date at header size and shows the clock. */
  fullscreen?: boolean;
}) {
  const [nowIndex, setNowIndex] = useState(-1);
  const [nowProgress, setNowProgress] = useState(0);

  useEffect(() => {
    // A schedule shown ahead of its day: no live row, just the plan.
    if (occasion.eventDate !== boardDate) {
      setNowIndex(-1);
      return;
    }

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
  }, [occasion.entries, occasion.eventDate, boardDate]);

  const { entries } = occasion;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 py-[1.2rem]">
      <div className="flex shrink-0 items-baseline justify-between px-[1.8rem] pb-[0.9rem]">
        <div className="flex items-baseline gap-[1rem]">
          <h2 className="font-display text-[2rem] font-bold leading-none">
            {occasion.title}
          </h2>
          <span
            className={
              fullscreen
                ? "font-display text-[1.9rem] font-bold leading-none text-muted"
                : "text-[1rem] font-bold text-muted"
            }
          >
            {occasion.eventDateLabel}
          </span>
        </div>
        {fullscreen && <Clock />}
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
          {(() => {
            // Pauses render as dividers, so stripe only the data rows — a
            // divider between two rows must not throw off the alternating bg.
            let rowIndex = -1;
            return entries.map((entry, index) => {
              const isNow = index === nowIndex;
              if (isPause(entry.activity)) {
                return (
                  <PauzeDivider
                    key={`pauze-${entry.timeFrom}-${index}`}
                    entry={entry}
                    now={isNow}
                  />
                );
              }
              rowIndex += 1;
              return (
              <div
                key={`${entry.timeFrom}-${index}`}
                className={`grid flex-1 items-center gap-x-[1rem] px-[1.1rem] ${
                  rowIndex % 2 === 1 ? "rounded-md bg-surface-2" : ""
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
                <div className="flex min-w-0 items-baseline gap-[0.6em]">
                  <span className="truncate-tight font-display text-[1.75em] font-bold">
                    {entry.activity}
                  </span>
                  {entry.info && (
                    <span className="min-w-0 max-w-[45%] truncate-tight rounded-sm bg-accent/15 px-[0.6em] py-[0.26em] text-[1.15em] font-normal text-accent">
                      {entry.info}
                    </span>
                  )}
                </div>
                <span className="truncate-tight text-right font-display text-[1.65em] font-bold text-accent">
                  {entry.location || "—"}
                </span>
              </div>
              );
            });
          })()}
        </div>
      )}
    </section>
  );
}
