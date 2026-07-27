"use client";

import { useEffect, useState } from "react";
import {
  currentSlot,
  parseTimeOverride,
  slotAt,
  type NowSlot,
} from "@/lib/schedule";

/** Often enough for a smooth progress bar, cheap enough to run all day. */
const TICK_MS = 10_000;

/**
 * Which lesson or break is happening right now, from the Pi's own clock.
 *
 * Starts as null so the server render and the first client render agree; the
 * marker appears a tick later rather than flashing the wrong period.
 *
 * `?now=10:15` (optionally `?now=wed+12:45`) freezes it at another moment, so
 * the board can be checked at any point of the day from a desk.
 */
export function useCurrentSlot(): NowSlot | null {
  const [slot, setSlot] = useState<NowSlot | null>(null);

  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("now");
    const frozen = override ? parseTimeOverride(override) : null;
    if (frozen) {
      setSlot(slotAt(frozen));
      return;
    }

    const tick = () => setSlot(currentSlot());
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return slot;
}
