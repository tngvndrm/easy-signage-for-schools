"use client";

import { useEffect, useState } from "react";

/**
 * Transport for the board's interruption rotation — the message zone's skip
 * arrows, one level up. Step through the full-screen items, hold one on screen,
 * or drop straight back to the dashboard.
 *
 * It exists for the teacher who opens a screen URL at their desk. The rotation
 * is paced for a corridor — three minutes between interruptions, twenty seconds
 * each — so from a chair you either sit out a pace that isn't for you, or never
 * see the slide you opened the page to check.
 *
 * None of it reaches the wall. It renders only where a mouse exists, and fades
 * with the cursor after three still seconds, so the Pis in the corridor and a
 * touch panel show the board exactly as before — and, being absent rather than
 * merely invisible there, a stray tap in the corner can't skip anything either.
 */

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[0.95rem] w-[0.95rem]" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PREV = "M15 5l-7 7 7 7";
const NEXT = "M9 5l7 7-7 7";
const PAUSE = "M9 5v14M15 5v14";
const PLAY = "M8 5l11 7-11 7z";

export function BoardControls({
  turns,
  index,
  home = false,
  paused,
  idle,
  tone = "accent",
  onPrev,
  onNext,
  onJump,
  onTogglePause,
}: {
  /** Screens in the ring — a dot each. */
  turns: number;
  /** Which of them is on screen. */
  index: number;
  /** Whether the ring opens on the dashboard, so dot one can say so. */
  home?: boolean;
  paused: boolean;
  /** Pointer has been still for a moment — the cluster fades with the cursor. */
  idle: boolean;
  /** `light` over artwork or the brand colour, `accent` on the page background. */
  tone?: "accent" | "light";
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
  onTogglePause: () => void;
}) {
  // Held past the idle timeout while the cursor rests on the cluster itself,
  // so the buttons don't fade out from under a hand about to click one.
  const [hovering, setHovering] = useState(false);
  // A wall panel has no hover and a touch panel has no cursor to follow, so
  // there is nothing for this to attach to on either. Read after mount: the
  // server can't know, and a first paint without it is the kiosk's own case.
  const [mouse, setMouse] = useState(false);

  useEffect(() => {
    setMouse(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  if (!mouse) return null;

  const visible = !idle || hovering;
  const light = tone === "light";

  const button = `flex h-[1.5rem] w-[1.5rem] items-center justify-center rounded-full transition-[color,opacity] ${
    light ? "hover:text-white" : "hover:text-accent"
  }`;

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`absolute bottom-[0.7rem] left-1/2 z-10 flex -translate-x-1/2 items-center gap-[0.5rem] rounded-full border-[0.075rem] px-[0.7rem] py-[0.35rem] transition-opacity duration-200 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      } ${
        light
          ? "border-white/25 bg-black/60 text-white/70"
          : "border-line bg-surface-1 text-muted shadow-[0_0.1rem_0.7rem_rgba(0,0,0,0.15)]"
      }`}
    >
      <button
        type="button"
        onClick={onPrev}
        aria-label="Vorige onderbreking"
        title="Vorige onderbreking"
        className={button}
      >
        <Glyph d={PREV} />
      </button>

      <div className="flex items-center gap-[0.35rem]">
        {Array.from({ length: turns }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={home && i === 0 ? "Het bord" : `Onderbreking ${home ? i : i + 1}`}
            title={home && i === 0 ? "Het bord" : `Onderbreking ${home ? i : i + 1}`}
            aria-current={i === index}
            className={`h-[0.35rem] rounded-full transition-all duration-500 ${
              i === index
                ? `w-[1.7rem] ${light ? "bg-white" : "bg-accent"}`
                : `w-[0.35rem] ${light ? "bg-white/40" : "bg-line"}`
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        aria-label="Volgende onderbreking"
        title="Volgende onderbreking"
        className={button}
      >
        <Glyph d={NEXT} />
      </button>

      <span className="eyebrow pl-[0.1rem] text-[0.7rem] text-current">
        {index + 1} van {turns}
      </span>

      <span className={`h-[0.9rem] w-px ${light ? "bg-white/25" : "bg-line"}`} />

      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? "Rotatie hervatten" : "Rotatie pauzeren"}
        title={paused ? "Rotatie hervatten" : "Rotatie pauzeren"}
        aria-pressed={paused}
        className={button}
      >
        <Glyph d={paused ? PLAY : PAUSE} />
      </button>
    </div>
  );
}
