"use client";

import { useMemo } from "react";

/**
 * A hairline along the bottom edge of the dashboard showing where the screen is
 * in its interruption cycle: a dot for each full-screen item still to come, and
 * a line creeping across one whole lap.
 *
 * The problem it solves is knowing whether to wait. The full-screen items cycle,
 * and from the dashboard there's no way to tell whether one more thing is coming
 * or six — so a student either walks off before the slide they needed, or waits
 * for a lap that already finished. The dot count answers "how many different
 * screens are there", the line answers "how far along am I".
 *
 * Sibling of BurstProgress, which occupies the same edge during a takeover.
 */
export function CycleTrack({
  turns,
  periodSec,
  anchor,
}: {
  /** Interruptions in one full lap — one dot each, bar the last (see below). */
  turns: number;
  /** Seconds for a whole lap. */
  periodSec: number;
  /** Epoch ms the rotation was last armed; the lap is phased against it. */
  anchor: number;
}) {
  /*
   * Phase the loop onto the rotation's own clock with a negative delay, so the
   * line sits in the right place the moment it mounts. It has to: the 30-second
   * poll can re-render this at any point in a lap, and the rotation's timer
   * keeps running regardless. A negative delay also means one infinite CSS
   * animation does the whole job — no per-frame timer on three Pis.
   */
  const style = useMemo(() => {
    const offsetSec = (((Date.now() - anchor) % (periodSec * 1000)) / 1000).toFixed(2);
    return {
      animationDuration: `${periodSec}s`,
      animationDelay: `-${offsetSec}s`,
    };
  }, [anchor, periodSec]);

  /*
   * The last turn of the lap lands exactly as the line completes, so it needs no
   * dot of its own — the dots mark the interruptions *inside* the lap, and the
   * line reaching the end is the final one. A single-item cycle gets no dots at
   * all, which is right: there's nothing to count, only time to show.
   */
  const dots = Array.from({ length: turns - 1 }, (_, i) => (i + 1) / turns);

  return (
    <div
      aria-hidden
      className="edge-hairline pointer-events-none absolute inset-x-0 bottom-0 bg-line/70"
    >
      <div
        className="animate-creep h-full origin-left bg-accent/60"
        style={style}
      />
      {dots.map((at) => (
        <span
          key={at}
          className="edge-hairline-dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted"
          style={{ left: `${at * 100}%` }}
        />
      ))}
    </div>
  );
}
