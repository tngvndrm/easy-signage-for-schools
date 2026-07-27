"use client";

import { useCallback, useEffect, useState } from "react";
import type { BoardMessage } from "@/lib/types";

const DEFAULT_DURATION_SEC = 12;

function SkipButton({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        direction === "next" ? "Volgende mededeling" : "Vorige mededeling"
      }
      className="pointer-events-none flex h-[1.3rem] w-[1.3rem] items-center justify-center rounded-sm text-muted opacity-0 transition-opacity duration-200 hover:text-accent group-hover:pointer-events-auto group-hover:opacity-100"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[0.9rem] w-[0.9rem]"
        aria-hidden
      >
        <path
          d={direction === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function MessageLoop({ messages }: { messages: BoardMessage[] }) {
  const [index, setIndex] = useState(0);
  // Bumped on every interaction so the dwell timer restarts from full.
  const [restart, setRestart] = useState(0);

  // Re-clamp when the admin removes an item while the loop is running.
  const count = messages.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const current = messages[safeIndex];
  const interactive = count > 1;

  const go = useCallback((next: number) => {
    setIndex(next);
    setRestart((r) => r + 1);
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const seconds = current?.durationSec ?? DEFAULT_DURATION_SEC;
    const timer = setTimeout(() => setIndex((i) => i + 1), seconds * 1000);
    return () => clearTimeout(timer);
  }, [current, interactive, safeIndex, restart]);

  // Arrow keys for anyone reading the board at their desk. The kiosk has no
  // keyboard, so this costs it nothing.
  useEffect(() => {
    if (!interactive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(safeIndex + 1);
      if (event.key === "ArrowLeft") go(safeIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, interactive, safeIndex]);

  if (!current) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center rounded-lg border-[0.075rem] border-line bg-surface-1">
        <p className="text-[1.2rem] text-muted">Geen mededelingen</p>
      </section>
    );
  }

  return (
    <section className="group relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 p-[1.4rem]">
      {/* HEADER_ROW: fixed height so the birthday card's label lines up. */}
      <div className="mb-[0.6rem] flex h-[1.7rem] shrink-0 items-center justify-between">
        <span className="eyebrow text-[0.8rem]">Mededelingen</span>

        {interactive && (
          /*
           * Skip controls live up here rather than over the message, so they
           * can never sit on top of the words. They reserve their space
           * always and only fade in on hover — nothing in a corridor hovers,
           * so the wall screens show dots and a counter exactly as before,
           * and nothing shifts when a cursor arrives.
           */
          <div className="flex items-center gap-[0.5rem]">
            <SkipButton direction="prev" onClick={() => go(safeIndex - 1)} />
            <div className="flex items-center gap-[0.35rem]">
              {messages.map((message, i) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Mededeling ${i + 1}`}
                  aria-current={i === safeIndex}
                  className={`h-[0.35rem] rounded-full transition-all duration-500 ${
                    i === safeIndex
                      ? "w-[1.7rem] bg-accent"
                      : "w-[0.35rem] bg-line"
                  }`}
                />
              ))}
            </div>
            <SkipButton direction="next" onClick={() => go(safeIndex + 1)} />
            <span className="eyebrow pl-[0.2rem] text-[0.75rem]">
              {safeIndex + 1} van {count}
            </span>
          </div>
        )}
      </div>

      <div
        key={current.id}
        className="animate-fade-up flex min-h-0 flex-1 items-center gap-[1.2rem]"
      >
        {current.imageUrl && (
          // Plain <img>: the banner comes from Cloud Storage and the kiosk needs
          // no optimisation pipeline for a single image on screen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt=""
            className="h-full w-auto max-w-[38%] rounded-md object-cover"
          />
        )}
        <div className="min-w-0">
          <h3 className="font-display text-[1.7rem] font-bold leading-tight text-accent">
            {current.title}
          </h3>
          <p className="pt-[0.3rem] text-[1.4rem] leading-[1.3]">
            {current.body}
          </p>
        </div>
      </div>

    </section>
  );
}
