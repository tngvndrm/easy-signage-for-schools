"use client";

import { useEffect, useState } from "react";

/**
 * True while someone has moved a pointer here recently.
 *
 * Standby is for the corridor, not for the teacher who opens the same URL from
 * home at nine in the evening. A wall panel in a cage has no mouse, so nothing
 * ever fires this and it sleeps as scheduled; a laptop fires it constantly and
 * keeps the board up. That's the whole distinction, and it costs no setting.
 *
 * Movement is the signal rather than the mere presence of a pointing device.
 * A Pi with a mouse left plugged into it after a maintenance visit reports a
 * fine pointer forever but never moves it, so presence would quietly retire
 * that screen's standby with nothing on the wall to say so.
 *
 * The first `mousemove` only establishes a position; it takes a second one, at
 * different coordinates, to count as movement. Compositors warp the cursor once
 * on startup, and a screen that woke itself for five minutes after every 3am
 * reboot would be a mystery worth nobody's time. A click is unambiguous and
 * wakes on its own.
 */
export function usePointerWake(graceMs: number): boolean {
  // Starts asleep so the server render and the first client render agree, and
  // so a kiosk that never sees a mouse is never briefly awake on boot.
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let last: { x: number; y: number } | null = null;

    const wake = () => {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), graceMs);
    };

    const onMove = (event: MouseEvent) => {
      const moved =
        last !== null && (event.clientX !== last.x || event.clientY !== last.y);
      last = { x: event.clientX, y: event.clientY };
      if (moved) wake();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", wake);
    };
  }, [graceMs]);

  return awake;
}
