"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BirthdayZone } from "./BirthdayZone";
import { BrandMark } from "./BrandMark";
import { Clock } from "./Clock";
import { EventPoster } from "./EventPoster";
import { KeyPanel } from "./KeyPanel";
import { KEY_PANEL_THRESHOLD } from "./keys-shared";
import { MessageLoop } from "./MessageLoop";
import { SubstitutionBoard } from "./SubstitutionBoard";
import { Takeover } from "./Takeover";
import { useIdlePointer } from "./useIdlePointer";
import type { BoardData } from "@/lib/types";

const POLL_MS = 30_000;
/**
 * While a lot of keys are still outstanding, the key list periodically takes
 * the substitution board's place — header, messages and birthday zones stay
 * put, so the screen never stops looking like itself. Short and periodic
 * rather than standing: the substitution board is what people come here for,
 * and a student passing at any point still catches the reminder within a few
 * minutes. Once only a handful are left it drops to the messages zone instead.
 */
const INTERRUPT_EVERY_MS = 3 * 60_000;
const KEY_PANEL_FOR_MS = 20_000;
const EVENT_POSTER_FOR_MS = 25_000;

/**
 * Above this many substitutions the dashboard reflows: the board takes a
 * full-height left column and the message + birthday zones stack on the right,
 * so a busy day's rows stay readable instead of shrinking.
 */
const SUBS_WIDE_THRESHOLD = 8;
/** Rows that fit at full size once the board owns the full height. */
const WIDE_COMFORTABLE_ROWS = 9;
/** After this long without a successful poll, tell the room the data is old. */
const STALE_MS = 5 * 60_000;
const CACHE_KEY = "infoborden:board";

type Interrupt = "keys" | "event";

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

  const manyKeys = data.keys.length > KEY_PANEL_THRESHOLD;
  const event = data.events[0] ?? null;

  /*
   * One rotation drives every interruption. Two independent timers would
   * eventually fire together and fight over the screen; taking turns also
   * means adding a third kind later costs nothing.
   */
  const queue: Interrupt[] = [];
  if (manyKeys) queue.push("keys");
  if (event) queue.push("event");
  const queueKey = queue.join(",");

  useEffect(() => {
    const due = queueKey ? (queueKey.split(",") as Interrupt[]) : [];
    if (due.length === 0) {
      setShowing(null);
      return;
    }
    let turn = 0;
    let hide: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      const next = due[turn++ % due.length];
      setShowing(next);
      hide = setTimeout(
        () => setShowing(null),
        next === "keys" ? KEY_PANEL_FOR_MS : EVENT_POSTER_FOR_MS,
      );
    }, INTERRUPT_EVERY_MS);
    return () => {
      clearInterval(cycle);
      clearTimeout(hide);
    };
  }, [queueKey]);

  // Swaps into the substitution board's slot; everything else stays put.
  const showKeys =
    (showing === "keys" || forceKeyPanel) && data.keys.length > 0;
  const showEvent = (showing === "event" || forceEvent) && event !== null;

  // Past this many substitutions the top-65%-tall board gets cramped, so the
  // layout reflows to give it the full height (see the two return branches).
  // Never while the key panel is interrupting — that owns the full main area.
  const wideSubs =
    !showKeys &&
    !data.substitutionsUnavailable &&
    data.substitutions.length > SUBS_WIDE_THRESHOLD;

  const poll = useCallback(async () => {
    try {
      // Carry the page's own query through, so a preview (?takeover, ?keys)
      // survives the next poll instead of being overwritten by live data.
      const res = await fetch(`/api/board${window.location.search}`, {
        cache: "no-store",
      });
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
  }, []);

  // If the server itself failed to reach the Sheet, fall back to the last copy
  // this screen saw today rather than showing an empty board.
  useEffect(() => {
    if (initial.substitutions.length > 0) {
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

  // An admin-authored takeover outranks the key panel: it was scheduled for
  // this exact day on purpose.
  if (data.takeover) {
    return (
      <main
        className="kiosk h-screen w-screen overflow-hidden"
        data-idle={idle}
      >
        <Takeover takeover={data.takeover} />
      </main>
    );
  }

  if (showEvent && event) {
    return (
      <main
        className="kiosk h-screen w-screen overflow-hidden"
        data-idle={idle}
      >
        <EventPoster event={event} />
      </main>
    );
  }

  return (
    <main
      className="kiosk flex h-screen w-screen flex-col gap-[1rem] overflow-hidden p-[1.2rem]"
      data-idle={idle}
    >
      <header className="flex h-[4.6rem] shrink-0 items-center justify-between rounded-lg border-[0.075rem] border-line bg-surface-1 px-[1.6rem]">
        <div className="flex items-center gap-[1rem]">
          <BrandMark className="h-[2.6rem] w-auto" />
          <div className="flex flex-col justify-center leading-none">
            <span className="eyebrow text-[0.75rem]">Steinerschool Gent</span>
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
          <span className="eyebrow text-[0.75rem]">Scherm {screenId}</span>
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
            breakAfterPeriod={data.breakAfterPeriod}
            unavailable={data.substitutionsUnavailable}
            comfortableRows={WIDE_COMFORTABLE_ROWS}
          />
          <div className="flex w-[28%] shrink-0 flex-col gap-[1rem]">
            <MessageLoop
              messages={data.messages}
              keyDuties={manyKeys ? [] : data.keys}
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
          {showKeys ? (
            <KeyPanel duties={data.keys} />
          ) : (
            <SubstitutionBoard
              substitutions={data.substitutions}
              breakAfterPeriod={data.breakAfterPeriod}
              unavailable={data.substitutionsUnavailable}
            />
          )}

          <div className="flex h-[12rem] shrink-0 gap-[1rem]">
            <MessageLoop
              messages={data.messages}
              // Only once the list is short enough to read here; while it's long
              // the main-area panel carries it instead.
              keyDuties={manyKeys ? [] : data.keys}
            />
            <BirthdayZone birthdays={data.birthdays} />
          </div>
        </>
      )}
    </main>
  );
}
