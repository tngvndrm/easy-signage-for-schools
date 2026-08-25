import { formatHm } from "@/lib/blackout";

/**
 * Standby: the screen the board shows outside school hours.
 *
 * As close to off as we can get without touching the TV's power — the Pi draws
 * its own power from that TV's USB port, so genuinely cutting it would take the
 * board down with it. True black rather than the dark theme's `--bg`, which is
 * a warm near-black meant to be read against.
 *
 * The one thing it does show is a line saying which screen this is and when it
 * comes back. A wall that goes completely blank at six is indistinguishable
 * from a wall whose Pi has died, and the caretaker who checks is the person
 * least equipped to tell — so the screen says which it is, dimly enough to be
 * invisible from down the corridor and legible standing in front of it.
 */
export function Blackout({
  wakesAtMin,
  screenName,
  screenId,
}: {
  /** Minutes-of-day the board returns, for the "terug om" line. */
  wakesAtMin: number | null;
  screenName: string | null;
  screenId: string;
}) {
  return (
    <main
      className="kiosk flex h-screen w-screen items-center justify-center overflow-hidden bg-black"
      data-idle="true"
    >
      <p className="animate-standby-drift font-mono text-[0.7rem] uppercase tracking-[0.14em] text-white/[0.09]">
        {screenName ?? `Scherm ${screenId}`}
        {wakesAtMin !== null && ` · terug om ${formatHm(wakesAtMin)}`}
      </p>
    </main>
  );
}
