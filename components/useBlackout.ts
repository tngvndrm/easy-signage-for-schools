"use client";

import { useEffect, useState } from "react";
import { blackoutAt } from "@/lib/blackout";
import { parseTimeOverride, schoolTime } from "@/lib/schedule";
import type { BlackoutWindow } from "@/lib/types";

/** A minute's precision is all a standby window needs; this is well inside it. */
const TICK_MS = 15_000;

/**
 * Whether the screen should be showing its standby black, judged here on the
 * Pi's own clock rather than server-side with the theme.
 *
 * That split is deliberate. The theme is cosmetic, so being wrong until the
 * next successful poll costs nothing; standby is not. If the host or the
 * network goes down during the afternoon, a server-side verdict would freeze at
 * "awake" and leave a lit board in an empty building all night — the one
 * failure the feature exists to prevent. The window rides along in the payload
 * and the cache, so a screen that has heard nothing since lunch still puts
 * itself to bed at six and wakes at half eight.
 *
 * `?blackout=1` holds standby on and `?blackout=0` holds it off, so the screen
 * can be reviewed from a desk at either end of the day. `?now=20:15` reaches
 * this too, the same way it moves the lesson marker.
 */
export function useBlackout(blackout: BlackoutWindow | null): boolean {
  // Seeded with the server's verdict so a kiosk rebooting at 3am comes up black
  // instead of flashing the whole board at an empty hall for a frame.
  const [dark, setDark] = useState(blackout?.active ?? false);

  // Depended on as numbers, not as the object: the poll hands over a fresh
  // payload every 30 seconds, and an object dependency would tear down and
  // rebuild the tick each time for a window that almost never changes.
  const startMin = blackout?.startMin ?? null;
  const endMin = blackout?.endMin ?? null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("blackout");
    if (forced === "1" || forced === "0") {
      setDark(forced === "1");
      return;
    }

    if (startMin === null || endMin === null) {
      setDark(false);
      return;
    }

    const frozen = parseTimeOverride(params.get("now") ?? "");
    if (frozen) {
      setDark(blackoutAt(frozen.minutes, startMin, endMin));
      return;
    }

    const tick = () => setDark(blackoutAt(schoolTime().minutes, startMin, endMin));
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [startMin, endMin]);

  return dark;
}
