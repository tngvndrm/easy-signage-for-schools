"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BigSlide, bigSlideTone } from "./BigSlide";
import { BirthdayZone } from "./BirthdayZone";
import { BurstProgress } from "./BurstProgress";
import { LogoMark } from "./LogoMark";
import { Clock } from "./Clock";
import { CycleTrack } from "./CycleTrack";
import { EventPoster } from "./EventPoster";
import { KeyPanel } from "./KeyPanel";
import { KEY_PANEL_THRESHOLD } from "./keys-shared";
import { MessageLoop } from "./MessageLoop";
import { SpecialOccasionBoard } from "./SpecialOccasionBoard";
import { SubstitutionBoard } from "./SubstitutionBoard";
import { useIdlePointer } from "./useIdlePointer";
import type { BoardData } from "@/lib/types";

const POLL_MS = 30_000;

/**
 * Above this many substitutions the dashboard reflows: the board takes a
 * full-height left column and the message + birthday zones stack on the right,
 * so a busy day's rows stay readable instead of shrinking.
 */
const SUBS_WIDE_THRESHOLD = 8;
/** Rows that fit at full size once the board owns the full height. */
const WIDE_COMFORTABLE_ROWS = 9;
/** Rows that fit at full size on a full-screen special occasion (no chrome). */
const FULLSCREEN_COMFORTABLE_ROWS = 11;
/** After this long without a successful poll, tell the room the data is old. */
const STALE_MS = 5 * 60_000;
const CACHE_KEY = "infoborden:board";

type Interrupt = "keys" | "event" | "bigslide" | "specialoccasion";

function readCache(): BoardData | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as BoardData) : null;
  } catch {
    return null;
  }
}

function writeCache(data: BoardData) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or a full quota — the board works fine without the cache.
  }
}

export function BoardShell({
  initial,
  screenId,
  forceKeyPanel = false,
  forceEvent = false,
}: {
  initial: BoardData;
  screenId: string;
  /** Preview: hold the key panel on screen instead of cycling it. */
  forceKeyPanel?: boolean;
  /** Preview: hold the event poster on screen instead of cycling it. */
  forceEvent?: boolean;
}) {
  const [data, setData] = useState<BoardData>(initial);
  const [stale, setStale] = useState(false);
  const lastOkRef = useRef<number>(Date.now());
  const idle = useIdlePointer();
  const [showing, setShowing] = useState<Interrupt | null>(null);
  const [cycleAnchor, setCycleAnchor] = useState<number | null>(null);
  const [permIndex, setPermIndex] = useState(0);
  // Start at -1: each burst pre-increments, so the first burst shows item 0
  // rather than skipping straight to item 1.
  const [periodicIndex, setPeriodicIndex] = useState(-1);
  const [periodicOccasionIndex, setPeriodicOccasionIndex] = useState(-1);

  const manyKeys = data.keys.length > KEY_PANEL_THRESHOLD;
  const event = data.events[0] ?? null;

  // Pace comes from the Settings tab, so staff can retune the board live.
  const fullScreenMs = data.timing.fullScreenSec * 1000;
  const interruptEveryMs = data.timing.fullScreenIntervalSec * 1000;

  // Theme + accent are resolved server-side per screen (Settings tab); applied
  // on the root of every layout so the whole screen — including a takeover —
  // themes together. Refreshed by the poll, so a sheet change lands within 30s.
  const root = {
    "data-theme": data.appearance.theme,
    "data-accent": data.appearance.accent,
    "data-idle": idle,
  } as const;

  // Permanent Big Slides hold the whole screen; if several, they cycle.
  const permanentSlides = data.permanentSlides;
  const permanentSlide = permanentSlides.length
    ? permanentSlides[permIndex % permanentSlides.length]
    : null;
  const periodicSlides = data.periodicSlides;

  useEffect(() => {
    if (permanentSlides.length < 2) return;
    const timer = setInterval(() => setPermIndex((i) => i + 1), fullScreenMs);
    return () => clearInterval(timer);
  }, [permanentSlides.length, fullScreenMs]);

  /*
   * One rotation drives every interruption. Two independent timers would
   * eventually fire together and fight over the screen; taking turns also
   * means adding a third kind later costs nothing.
   *
   * While a lot of keys are still outstanding, the key list takes the
   * substitution board's place here too — short and periodic rather than
   * standing, since the substitution board is what people come for, and a
   * student passing at any point still catches the reminder within a few
   * minutes. Once only a handful are left it drops to the messages zone.
   */
  const queue: Interrupt[] = [];
  if (manyKeys) queue.push("keys");
  if (event) queue.push("event");
  if (periodicSlides.length) queue.push("bigslide");
  if (data.periodicSpecialOccasions.length) queue.push("specialoccasion");
  const queueKey = queue.join(",");

  /*
   * Turns in one full lap — what CycleTrack counts out along the bottom edge.
   * Each turn shows one kind's *next* item, so seeing every distinct item takes
   * a turn per kind times the largest kind: two Big Slides and two occasions
   * come round as slide, occasion, slide, occasion — four turns, not two.
   */
  const kindCounts: Record<Interrupt, number> = {
    keys: 1,
    event: 1,
    bigslide: periodicSlides.length,
    specialoccasion: data.periodicSpecialOccasions.length,
  };
  const cycleTurns = queue.length
    ? queue.length * Math.max(...queue.map((kind) => kindCounts[kind]))
    : 0;

  useEffect(() => {
    const due = queueKey ? (queueKey.split(",") as Interrupt[]) : [];
    // Re-arming (a kind appeared or vanished, or the pace changed) also clears
    // any burst still up: its hide timer dies with the old effect, and without
    // this the burst would hold the screen until the next interval tick.
    setShowing(null);
    if (due.length === 0) {
      setCycleAnchor(null);
      return;
    }
    // The lap the bottom hairline draws starts here, with this interval.
    setCycleAnchor(Date.now());
    let turn = 0;
    let hide: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      // With Full Screen Time ≥ the interval the previous burst's hide timer
      // would fire into the new burst and cut it short — supersede it instead.
      clearTimeout(hide);
      const next = due[turn++ % due.length];
      setShowing(next);
      // Advance through the periodic slides so each burst shows the next one.
      if (next === "bigslide") setPeriodicIndex((i) => i + 1);
      if (next === "specialoccasion") setPeriodicOccasionIndex((i) => i + 1);
      hide = setTimeout(() => setShowing(null), fullScreenMs);
    }, interruptEveryMs);
    return () => {
      clearInterval(cycle);
      clearTimeout(hide);
    };
  }, [queueKey, fullScreenMs, interruptEveryMs]);

  // Swaps into the substitution board's slot; everything else stays put.
  const showKeys =
    (showing === "keys" || forceKeyPanel) && data.keys.length > 0;
  const showEvent = (showing === "event" || forceEvent) && event !== null;
  const periodicSlide =
    showing === "bigslide" && periodicSlides.length > 0
      ? periodicSlides[periodicIndex % periodicSlides.length]
      : null;

  // Special occasions follow the same three-way logic as Big Slide messages.
  // "Permanent" holds the whole screen for its window; "Yes" bursts full-screen
  // on its turn in the rotation; "No" replaces the substitution board inline,
  // keeping the header and message strip. ?occasion=1 previews the inline form,
  // which is where the demo occasion lands.
  const permanentOccasion = data.permanentSpecialOccasions[0] ?? null;
  const periodicOccasion =
    data.periodicSpecialOccasions.length > 0 && showing === "specialoccasion"
      ? data.periodicSpecialOccasions[
          periodicOccasionIndex % data.periodicSpecialOccasions.length
        ]
      : null;
  const inlineOccasion = data.specialOccasions[0] ?? null;

  // Past this many substitutions the top-65%-tall board gets cramped, so the
  // layout reflows to give it the full height (see the two return branches).
  // Never while the key panel or an inline occasion is in the main area.
  const wideSubs =
    !showKeys &&
    !inlineOccasion &&
    !data.substitutionsUnavailable &&
    data.substitutions.length > SUBS_WIDE_THRESHOLD;

  const poll = useCallback(async () => {
    try {
      // Carry the page's own query through (so a preview survives the poll) and
      // add the screen id, so the poll gets this screen's settings/appearance.
      const params = new URLSearchParams(window.location.search);
      params.set("screen", screenId);
      const res = await fetch(`/api/board?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as BoardData;
      setData(next);
      writeCache(next);
      lastOkRef.current = Date.now();
      setStale(false);
    } catch {
      // Keep the last good render on screen; only flag how old it is.
      setStale(Date.now() - lastOkRef.current > STALE_MS);
    }
  }, [screenId]);

  // If the server itself failed to reach the Sheet, fall back to the last copy
  // this screen saw today rather than showing an empty board. Keyed on the
  // explicit failure flag, not on an empty list — a genuinely quiet day must
  // not resurrect rows that were deleted from the sheet earlier today.
  useEffect(() => {
    if (!initial.substitutionsUnavailable) {
      writeCache(initial);
      return;
    }
    const cached = readCache();
    if (cached && cached.date === initial.date && cached.substitutions.length) {
      setData(cached);
      setStale(true);
    }
  }, [initial]);

  useEffect(() => {
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // A "Permanent" Big Slide holds the whole screen for its window — it outranks
  // everything, since it was set for exactly these days on purpose.
  if (permanentSlide) {
    return (
      <main
        className="kiosk h-screen w-screen overflow-hidden bg-bg text-text"
        {...root}
      >
        <BigSlide message={permanentSlide} />
      </main>
    );
  }

  // A "Permanent" special occasion owns the whole screen for its window — the
  // day's schedule is the point, so the header and message strip step aside.
  if (permanentOccasion) {
    return (
      <main
        className="kiosk flex h-screen w-screen flex-col overflow-hidden bg-bg p-[1.2rem] text-text"
        {...root}
      >
        <SpecialOccasionBoard
          occasion={permanentOccasion}
          boardDate={data.date}
          comfortableRows={FULLSCREEN_COMFORTABLE_ROWS}
          fullscreen
        />
      </main>
    );
  }

  // A "Yes" Big Slide bursts full-screen on its turn in the rotation.
  if (periodicSlide) {
    return (
      <main
        className="kiosk relative h-screen w-screen overflow-hidden bg-bg text-text"
        {...root}
      >
        <BigSlide message={periodicSlide} />
        <BurstProgress
          seconds={data.timing.fullScreenSec}
          tone={bigSlideTone(periodicSlide)}
        />
      </main>
    );
  }

  // A "Yes" special occasion bursts full-screen on its turn in the rotation.
  if (periodicOccasion) {
    return (
      <main
        className="kiosk relative flex h-screen w-screen flex-col overflow-hidden bg-bg p-[1.2rem] text-text"
        {...root}
      >
        <SpecialOccasionBoard
          occasion={periodicOccasion}
          boardDate={data.date}
          comfortableRows={FULLSCREEN_COMFORTABLE_ROWS}
          fullscreen
        />
        <BurstProgress seconds={data.timing.fullScreenSec} />
      </main>
    );
  }

  if (showEvent && event) {
    return (
      <main
        className="kiosk relative h-screen w-screen overflow-hidden bg-bg text-text"
        {...root}
      >
        <EventPoster event={event} />
        {/* Not under `forceEvent`: the preview holds the poster indefinitely. */}
        {showing === "event" && (
          <BurstProgress seconds={data.timing.fullScreenSec} />
        )}
      </main>
    );
  }

  return (
    <main
      className="kiosk relative flex h-screen w-screen flex-col gap-[1rem] overflow-hidden bg-bg p-[1.2rem] text-text"
      {...root}
    >
      <header className="flex h-[4.6rem] shrink-0 items-center justify-between rounded-lg border-[0.075rem] border-line bg-surface-1 px-[1.6rem]">
        <div className="flex items-center gap-[1rem]">
          <LogoMark
            logoUrl={data.style.logoUrl}
            className="h-[2.6rem] w-auto"
          />
          <div className="flex flex-col justify-center leading-none">
            <span className="eyebrow text-[0.75rem]">
              {data.style.schoolName ?? "Steinerschool Gent"}
            </span>
            <span className="font-display text-[1.9rem] font-bold leading-tight">
              {data.dateLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[1.1rem]">
          {data.demo && (
            <span className="rounded-sm bg-surface-2 px-[0.8rem] py-[0.3rem] font-mono text-[0.75rem] uppercase tracking-[0.08em] text-muted">
              Demo-data
            </span>
          )}
          {stale && (
            <span className="animate-pulse-soft rounded-sm bg-alert-bg px-[0.8rem] py-[0.3rem] font-mono text-[0.75rem] uppercase tracking-[0.08em] text-alert">
              Geen verbinding
            </span>
          )}
          <span className="eyebrow text-[0.75rem]">
            {data.screenName ?? `Scherm ${screenId}`}
          </span>
          <Clock />
        </div>
      </header>

      {wideSubs ? (
        /*
         * Busy day: the board takes a full-height left column so its rows stay
         * large instead of shrinking, and the message and birthday zones stack
         * in a column on the right.
         */
        <div className="flex min-h-0 flex-1 gap-[1rem]">
          <SubstitutionBoard
            substitutions={data.substitutions}
            schedule={data.schedule}
            unavailable={data.substitutionsUnavailable}
            comfortableRows={WIDE_COMFORTABLE_ROWS}
          />
          <div className="flex w-[28%] shrink-0 flex-col gap-[1rem]">
            <MessageLoop
              messages={data.messages}
              keyDuties={manyKeys ? [] : data.keys}
              durationSec={data.timing.messageCycleSec}
              tall
            />
            <BirthdayZone
              birthdays={data.birthdays}
              className="w-full shrink-0"
            />
          </div>
        </div>
      ) : (
        <>
          {inlineOccasion ? (
            <SpecialOccasionBoard occasion={inlineOccasion} boardDate={data.date} />
          ) : showKeys ? (
            <KeyPanel duties={data.keys} />
          ) : (
            <SubstitutionBoard
              substitutions={data.substitutions}
              schedule={data.schedule}
              unavailable={data.substitutionsUnavailable}
            />
          )}

          <div className="flex h-[12rem] shrink-0 gap-[1rem]">
            <MessageLoop
              messages={data.messages}
              // Only once the list is short enough to read here; while it's long
              // the main-area panel carries it instead.
              keyDuties={manyKeys ? [] : data.keys}
              durationSec={data.timing.messageCycleSec}
            />
            <BirthdayZone birthdays={data.birthdays} />
          </div>
        </>
      )}

      {/* Nothing interrupts this screen — no cycle to draw. */}
      {cycleTurns > 0 && cycleAnchor !== null && (
        <CycleTrack
          turns={cycleTurns}
          periodSec={cycleTurns * data.timing.fullScreenIntervalSec}
          anchor={cycleAnchor}
        />
      )}
    </main>
  );
}
