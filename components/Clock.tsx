"use client";

import { useEffect, useState } from "react";

const TIMEZONE = "Europe/Brussels";

const formatter = new Intl.DateTimeFormat("nl-BE", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

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
