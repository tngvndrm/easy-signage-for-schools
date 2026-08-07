"use client";

import { useCallback, useEffect, useState } from "react";
import type { BoardMessage, KeyDuty } from "@/lib/types";
import { KeyChip, KeyIcon, keyHeadline } from "./keys-shared";

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

type Slide =
  | { kind: "message"; id: string; message: BoardMessage }
  | { kind: "keys"; id: string };

export function MessageLoop({
  messages,
  keyDuties = [],
  durationSec = DEFAULT_DURATION_SEC,
  tall = false,
}: {
  messages: BoardMessage[];
  /** Only passed once the list is short enough for this zone; see BoardShell. */
  keyDuties?: KeyDuty[];
  /** Seconds per card, from the Settings tab; a message may override its own. */
  durationSec?: number;
  /** Narrow, full-height card (busy-day right column) — lay images out on top. */
  tall?: boolean;
}) {
  const [index, setIndex] = useState(0);
  // Bumped on every interaction so the dwell timer restarts from full.
  const [restart, setRestart] = useState(0);

  // The key reminder is just another card in the rotation, so it inherits the
  // dwell timer, the dots and the "2 van 4" counter for free.
  const slides: Slide[] = [
    ...messages.map(
      (message): Slide => ({ kind: "message", id: message.id, message }),
    ),
    ...(keyDuties.length > 0
      ? [{ kind: "keys", id: "keys" } satisfies Slide]
      : []),
  ];

  // Re-clamp when the admin removes an item while the loop is running.
  const count = slides.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const current = slides[safeIndex];
  const interactive = count > 1;

  const go = useCallback((next: number) => {
    setIndex(next);
    setRestart((r) => r + 1);
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const seconds =
      (current?.kind === "message" ? current.message.durationSec : undefined) ??
      durationSec;
    const timer = setTimeout(() => setIndex((i) => i + 1), seconds * 1000);
    return () => clearTimeout(timer);
  }, [current, durationSec, interactive, safeIndex, restart]);

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

  const message = current.kind === "message" ? current.message : null;
  // Full-bleed artwork mode: image fills the card, text and header sit over it.
  const cover = !!(message?.cover && message.imageUrl);
  // A non-cover image: a side thumbnail normally, stacked on top in the tall card.
  const topImage = !!(message?.imageUrl && !cover && tall);
  // A card has finite room; an over-long message is clamped with an ellipsis
  // rather than breaking the layout. How much fits depends on the card's shape.
  const bodyClamp = topImage
    ? "line-clamp-[8]"
    : tall
      ? "line-clamp-[14]"
      : "line-clamp-4";
  // Header sits over artwork in cover mode; give it a scrim-proof shadow.
  const coverText = cover
    ? "text-white [text-shadow:0_0.08rem_0.25rem_rgba(0,0,0,0.7)]"
    : "";

  return (
    <section
      className={`group relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] ${
        cover ? "border-transparent" : "border-line bg-surface-1"
      }`}
    >
      {cover && message && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.imageUrl}
            alt=""
            className="animate-fade-up absolute inset-0 h-full w-full object-cover"
          />
          {/* Scrim: a strong band top and bottom so the header row and the
              words stay legible over any artwork, clearest through the middle. */}
          <div className="absolute inset-x-0 top-0 h-[5rem] bg-gradient-to-b from-black/85 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/85 to-transparent" />
        </>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col p-[1.4rem]">
        {/* HEADER_ROW: fixed height so the birthday card's label lines up. */}
        <div className="mb-[0.6rem] flex h-[1.7rem] shrink-0 items-center justify-between">
          <span className={`eyebrow text-[0.8rem] ${coverText}`}>
            Mededelingen
          </span>

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
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Mededeling ${i + 1}`}
                    aria-current={i === safeIndex}
                    className={`h-[0.35rem] rounded-full transition-all duration-500 ${
                      i === safeIndex
                        ? cover
                          ? "w-[1.7rem] bg-white"
                          : "w-[1.7rem] bg-accent"
                        : cover
                          ? "w-[0.35rem] bg-white/40"
                          : "w-[0.35rem] bg-line"
                    }`}
                  />
                ))}
              </div>
              <SkipButton direction="next" onClick={() => go(safeIndex + 1)} />
              <span className={`eyebrow pl-[0.2rem] text-[0.75rem] ${coverText}`}>
                {safeIndex + 1} van {count}
              </span>
            </div>
          )}
        </div>

        <div
          key={current.id}
          className={`animate-fade-up flex min-h-0 flex-1 gap-[1.2rem] ${
            cover
              ? "items-end"
              : topImage
                ? "flex-col"
                : "items-center"
          }`}
        >
          {current.kind === "keys" ? (
            <div className="flex min-w-0 flex-1 flex-col gap-[0.5rem]">
              <h3 className="flex items-center gap-[0.5rem] font-display text-[1.55rem] font-bold leading-tight text-accent">
                <KeyIcon className="h-[1.5rem] w-[1.5rem] shrink-0" />
                {keyHeadline(keyDuties)}
              </h3>
              <div className="flex flex-wrap gap-[0.5rem]">
                {keyDuties.map((duty) => (
                  <KeyChip key={duty.id} duty={duty} compact />
                ))}
              </div>
            </div>
          ) : cover && message ? (
            <div className="min-w-0">
              <h3 className="line-clamp-2 font-display text-[1.8rem] font-bold leading-tight text-white">
                {message.title}
              </h3>
              <p className="line-clamp-4 pt-[0.3rem] text-[1.4rem] leading-[1.3] text-white/95">
                {message.body}
              </p>
            </div>
          ) : (
            message && (
              <>
                {message.imageUrl && (
                  // Plain <img>: the banner comes from Cloud Storage and the
                  // kiosk needs no optimisation pipeline for one image on screen.
                  // In the tall card it caps its height and spans the width on
                  // top; in the wide card it's a side thumbnail.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.imageUrl}
                    alt=""
                    className={
                      topImage
                        ? "max-h-[42%] w-full shrink-0 rounded-md object-cover"
                        : "h-full w-auto max-w-[38%] rounded-md object-cover"
                    }
                  />
                )}
                <div className="min-h-0 min-w-0">
                  <h3 className="line-clamp-2 font-display text-[1.7rem] font-bold leading-tight text-accent">
                    {message.title}
                  </h3>
                  <p className={`${bodyClamp} pt-[0.3rem] text-[1.4rem] leading-[1.3]`}>
                    {message.body}
                  </p>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </section>
  );
}
