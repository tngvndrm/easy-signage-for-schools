/**
 * A hairline along the bottom edge of a full-screen burst, draining over the
 * screen's `Full Screen Time`.
 *
 * A takeover hides the substitution board, which is what most people walked
 * over to read. Without this there's no way to tell a five-second interruption
 * from a screen that has stuck — so someone glances, sees the line is nearly
 * gone, and waits instead of leaving. Deliberately not shown for *permanent*
 * slides and occasions: those hold all day, and a bar there would promise a
 * return that never comes.
 *
 * Pure CSS: the duration is the only thing that varies, so this costs the Pi a
 * compositor-driven animation rather than a per-frame timer on three screens.
 */
export function BurstProgress({
  seconds,
  tone = "accent",
}: {
  seconds: number;
  /** `light` over artwork or the brand colour, `accent` on the page background. */
  tone?: "accent" | "light";
}) {
  return (
    <div
      aria-hidden
      className={`edge-hairline pointer-events-none absolute inset-x-0 bottom-0 ${
        tone === "light" ? "bg-white/25" : "bg-line"
      }`}
    >
      <div
        className={`animate-drain h-full origin-left ${
          tone === "light" ? "bg-white/90" : "bg-accent"
        }`}
        style={{ animationDuration: `${seconds}s` }}
      />
    </div>
  );
}
