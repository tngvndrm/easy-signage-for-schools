"use client";

import { useEffect, useState } from "react";
import type { BoardMessage } from "@/lib/types";

const DEFAULT_DURATION_SEC = 12;

export function MessageLoop({ messages }: { messages: BoardMessage[] }) {
  const [index, setIndex] = useState(0);

  // Re-clamp when the admin removes an item while the loop is running.
  const safeIndex = messages.length > 0 ? index % messages.length : 0;
  const current = messages[safeIndex];

  useEffect(() => {
    if (messages.length < 2) return;
    const seconds = current?.durationSec ?? DEFAULT_DURATION_SEC;
    const timer = setTimeout(() => setIndex((i) => i + 1), seconds * 1000);
    return () => clearTimeout(timer);
  }, [current, messages.length, safeIndex]);

  if (!current) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center rounded-lg border-[0.075rem] border-line bg-surface-1">
        <p className="text-[1.2rem] text-muted">Geen mededelingen</p>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 p-[1.4rem]">
      <div className="flex shrink-0 items-center justify-between pb-[0.6rem]">
        <span className="eyebrow text-[0.8rem]">Mededelingen</span>
        <div className="flex items-center gap-[0.35rem]">
          {messages.map((message, i) => (
            <span
              key={message.id}
              className={`h-[0.35rem] transition-all duration-500 ${
                i === safeIndex
                  ? "w-[1.7rem] rounded-full bg-accent"
                  : "w-[0.35rem] rounded-full bg-line"
              }`}
            />
          ))}
        </div>
      </div>

      <div
        key={current.id}
        className="animate-fade-up flex min-h-0 flex-1 items-center gap-[1.2rem]"
      >
        {current.imageUrl && (
          // Plain <img>: the banner comes from Cloud Storage and the kiosk needs
          // no optimisation pipeline for a single image on screen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt=""
            className="h-full w-auto max-w-[38%] rounded-md object-cover"
          />
        )}
        <div className="min-w-0">
          <h3 className="font-display text-[1.7rem] font-bold leading-tight text-accent">
            {current.title}
          </h3>
          <p className="pt-[0.3rem] text-[1.4rem] leading-[1.3]">
            {current.body}
          </p>
        </div>
      </div>
    </section>
  );
}
