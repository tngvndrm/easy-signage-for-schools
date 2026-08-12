import { BUILD } from "@/lib/build";

/**
 * The build this screen is running, in the bottom corner of every layout —
 * legible if you walk up to the panel, invisible from across the corridor.
 *
 * It exists for the ten minutes after a deploy when the question is "did this
 * screen get the new code, or am I looking at last week's?", and there is no
 * keyboard attached to the Pi to ask any other way. Which is also why it's off
 * on an ordinary day — see showBuildStamp in lib/build.ts.
 *
 * Rendered beside the board rather than inside it, so it survives a full-screen
 * takeover, and positioned to clear the bottom hairline (CycleTrack /
 * BurstProgress) rather than sitting on it.
 */
export function BuildStamp() {
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed bottom-[0.35rem] right-[0.5rem] select-none font-mono text-[0.55rem] leading-none text-muted/50"
    >
      {BUILD}
    </span>
  );
}
