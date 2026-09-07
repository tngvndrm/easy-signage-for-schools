"use client";

import { useSyncExternalStore } from "react";

/**
 * When a viewer gets the phone layout instead of the kiosk board.
 *
 * The kiosk is a fixed 16:9 wall display — everything is sized off the viewport
 * height and laid out for landscape. A teacher opening the cloud board on a
 * phone (see docs/deploy-cloud.md) has neither: a portrait screen a few hundred
 * pixels wide. This query catches exactly that audience — phones — and nothing
 * that runs a real board: a portrait phone by its width, a phone turned
 * landscape by its short height. A tablet, a laptop and a 1080p wall panel all
 * fall through to the kiosk layout.
 *
 * Kept in sync by hand with the matching block in app/globals.css, which flips
 * the root font size and lets the page scroll for the same viewers.
 */
export const MOBILE_MEDIA_QUERY = "(max-width: 640px), (max-height: 480px)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * True on a phone-sized viewport. Server-renders and first-paints as `false`,
 * so the markup matches the server (the kiosk board) and then swaps to the
 * phone layout once mounted — a client concern the server can't know, since the
 * viewport isn't in the request.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_MEDIA_QUERY).matches,
    () => false,
  );
}
