"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BirthdayZone } from "./BirthdayZone";
import { BrandMark } from "./BrandMark";
import { Clock } from "./Clock";
import { MessageLoop } from "./MessageLoop";
import { SubstitutionBoard } from "./SubstitutionBoard";
import { Takeover } from "./Takeover";
import { useIdlePointer } from "./useIdlePointer";
import type { BoardData } from "@/lib/types";

const POLL_MS = 30_000;
/** After this long without a successful poll, tell the room the data is old. */
const STALE_MS = 5 * 60_000;
const CACHE_KEY = "infoborden:board";

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
  previewTakeover = false,
}: {
  initial: BoardData;
  screenId: string;
  previewTakeover?: boolean;
}) {
  const [data, setData] = useState<BoardData>(initial);
  const [stale, setStale] = useState(false);
  const lastOkRef = useRef<number>(Date.now());
  const idle = useIdlePointer();

  const poll = useCallback(async () => {
    try {
      const url = previewTakeover ? "/api/board?takeover=1" : "/api/board";
      const res = await fetch(url, { cache: "no-store" });
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
  }, [previewTakeover]);

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

      <SubstitutionBoard
        substitutions={data.substitutions}
        breakAfterPeriod={data.breakAfterPeriod}
      />

      <div className="flex h-[12rem] shrink-0 gap-[1rem]">
        <MessageLoop messages={data.messages} />
        <BirthdayZone birthdays={data.birthdays} />
      </div>
    </main>
  );
}
