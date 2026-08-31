"use client";

import { useEffect, useState } from "react";
import { blackoutAt } from "@/lib/blackout";
import { parseTimeOverride, schoolTime } from "@/lib/schedule";
import { usePointerWake } from "./usePointerWake";
import type { BlackoutWindow } from "@/lib/types";

/** A minute's precision is all a standby window needs; this is well inside it. */
const TICK_MS = 15_000;

/**
 * How long pointer movement keeps the board up past its standby hours.
 *
 * Long enough to read a full substitution board without touching the mouse, and
 * generous because being wrong in this direction costs nothing: the screen it
 * keeps lit is the reader's own laptop, never the wall. Too short would blank
 * the board mid-sentence and teach people to jiggle the mouse while they read.
 */
const POINTER_GRACE_MS = 5 * 60_000;

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
 * Pointer movement overrides the schedule: see `usePointerWake`. The forced
 * previews below deliberately don't honour it, since a standby screen you can't
 * look at without dismissing isn't much of a preview.
 *
 * `?blackout=1` holds standby on and `?blackout=0` holds it off, so the screen
 * can be reviewed from a desk at either end of the day. `?now=20:15` reaches
 * this too, the same way it moves the lesson marker.
 */
export function useBlackout(blackout: BlackoutWindow | null): boolean {
  // Seeded with the server's verdict so a kiosk rebooting at 3am comes up black
  // instead of flashing the whole board at an empty hall for a frame.
  const [scheduled, setScheduled] = useState(blackout?.active ?? false);
  const [forced, setForced] = useState<boolean | null>(null);
  const pointerAwake = usePointerWake(POINTER_GRACE_MS);

  // Depended on as numbers, not as the object: the poll hands over a fresh
  // payload every 30 seconds, and an object dependency would tear down and
  // rebuild the tick each time for a window that almost never changes.
  const startMin = blackout?.startMin ?? null;
  const endMin = blackout?.endMin ?? null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const force = params.get("blackout");
    if (force === "1" || force === "0") {
      setForced(force === "1");
      return;
    }
    setForced(null);

    if (startMin === null || endMin === null) {
      setScheduled(false);
      return;
    }

    const frozen = parseTimeOverride(params.get("now") ?? "");
    if (frozen) {
      setScheduled(blackoutAt(frozen.minutes, startMin, endMin));
      return;
    }

    const tick = () =>
      setScheduled(blackoutAt(schoolTime().minutes, startMin, endMin));
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [startMin, endMin]);

  if (forced !== null) return forced;
  return scheduled && !pointerAwake;
}
