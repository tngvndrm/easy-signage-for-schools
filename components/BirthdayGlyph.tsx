"use client";

import { useEffect, useState } from "react";

/**
 * Party glyphs for the birthday card, drawn rather than typed.
 *
 * Emoji would be one character each, but a Raspberry Pi OS Lite image usually
 * has no colour-emoji font installed — 🎂 would land on the wall as a tofu box,
 * and nobody testing on a laptop would ever see it. These also let the marks sit
 * in the brand's own line weight instead of Apple's or Google's.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ACCENT = "var(--brand-coral-300)";

function Cake() {
  return (
    <>
      <path {...STROKE} d="M4 20h16" />
      <path {...STROKE} d="M5 20v-6h14v6" />
      <path {...STROKE} d="M5 14.5c1.4 1.4 2.8 1.4 4.2 0s2.8-1.4 4.2 0 2.8 1.4 4.2 0" />
      <path {...STROKE} d="M8.5 14V10M12 14V9.5M15.5 14V10" />
      <circle cx="8.5" cy="8.4" r="1.2" fill={ACCENT} />
      <circle cx="12" cy="7.9" r="1.2" fill={ACCENT} />
      <circle cx="15.5" cy="8.4" r="1.2" fill={ACCENT} />
    </>
  );
}

function CakeSlice() {
  // Seen from above, so its curved edge reads as a slice rather than as a
  // second triangle competing with the party hat.
  return (
    <>
      <path {...STROKE} d="M6 18.5V7.5A11 11 0 0 1 17 18.5z" />
      <path {...STROKE} d="M6 13.8a4.7 4.7 0 0 1 4.7 4.7" />
      <circle cx="12.4" cy="12.4" r="1.3" fill={ACCENT} />
    </>
  );
}

function PartyHat() {
  return (
    <>
      <path {...STROKE} d="M12 5.5 18 19H6z" />
      <path {...STROKE} d="M9 15.5h6M10.3 11.5h3.4" />
      <circle cx="12" cy="3.6" r="1.7" fill={ACCENT} />
    </>
  );
}

function Fireworks() {
  return (
    <>
      <path
        {...STROKE}
        d="M12 3v3.4M12 17.6V21M3 12h3.4M17.6 12H21M5.6 5.6l2.4 2.4M16 16l2.4 2.4M18.4 5.6 16 8M8 16l-2.4 2.4"
      />
      <circle cx="12" cy="12" r="2.1" fill={ACCENT} />
    </>
  );
}

function Balloon() {
  return (
    <>
      <ellipse {...STROKE} cx="12" cy="9.3" rx="5.2" ry="6.2" />
      <path {...STROKE} d="m12 15.5-1.1 1.9h2.2z" />
      <path {...STROKE} d="M12 17.4c1.6 1.2-1.6 2.1 0 3.3" />
      <circle cx="9.9" cy="7.4" r="1.1" fill={ACCENT} />
    </>
  );
}

const GLYPHS = [Cake, PartyHat, Fireworks, CakeSlice, Balloon];

/** Long enough to register as a detail, not a flicker. */
const SWAP_MS = 9000;

export function BirthdayGlyph({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => i + 1), SWAP_MS);
    return () => clearInterval(timer);
  }, []);

  const step = index % GLYPHS.length;
  const Glyph = GLYPHS[step];

  return (
    <svg
      key={step}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-fade-up ${className ?? ""}`}
      aria-hidden
    >
      <Glyph />
    </svg>
  );
}
