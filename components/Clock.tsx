"use client";

import { useEffect, useState } from "react";

const TIMEZONE = "Europe/Brussels";

// Built at module load, but never allowed to throw: a Chromium without the full
// timezone database raises on an explicit `timeZone`, and an uncaught throw here
// would take the whole board's hydration down with it. The kiosk's own clock is
// already set to this zone, so local time is the correct fallback.
const formatter = (() => {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat("nl-BE", { timeZone: TIMEZONE, ...opts });
  } catch {
    return new Intl.DateTimeFormat("nl-BE", opts);
  }
})();

export function Clock() {
  // Render nothing on the server: the Pi's clock is the one that matters, and
  // an SSR value would only flash a stale time before hydration corrects it.
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(formatter.format(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="font-display text-[2.3rem] font-bold leading-none tabular-nums">
      {time ?? "--:--"}
    </span>
  );
}
