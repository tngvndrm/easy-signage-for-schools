"use client";

import { useEffect, useState } from "react";

const IDLE_MS = 3000;

/**
 * True while the pointer has been still for a moment — the board uses it to
 * hide the cursor. Starts true so a screen that never sees a mouse (every Pi in
 * the corridor) renders without one from the first paint.
 */
export function useIdlePointer(): boolean {
  const [idle, setIdle] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };

    window.addEventListener("mousemove", wake);
    window.addEventListener("mousedown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("mousedown", wake);
    };
  }, []);

  return idle;
}
