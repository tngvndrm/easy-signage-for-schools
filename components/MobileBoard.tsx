"use client";

import { BirthdayZone } from "./BirthdayZone";
import { Clock } from "./Clock";
import { KeyChip, KeyIcon, keyHeadline } from "./keys-shared";
import { LogoMark } from "./LogoMark";
import { MobileSubstitutions } from "./MobileSubstitutions";
import { PiketNow } from "./PiketNow";
import type {
  BoardData,
  BoardMessage,
  EventItem,
  SpecialOccasion,
} from "@/lib/types";

/** A quiet small-caps section label between the stacked cards. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow px-[0.2rem] text-[0.75rem]">{children}</h2>;
}

function MessageCard({ message }: { message: BoardMessage }) {
  return (
    <article className="overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1">
      {message.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.imageUrl}
          alt=""
          className="max-h-[14rem] w-full object-cover"
        />
      )}
      <div className="p-[1.1rem]">
        <h3 className="font-display text-[1.25rem] font-bold leading-tight text-accent">
          {message.title}
        </h3>
        {message.body && (
          <p className="pt-[0.35rem] text-[1rem] leading-snug">{message.body}</p>
        )}
      </div>
    </article>
  );
}

/**
 * A Big Slide message. On the wall it takes over the screen; here it is a card
 * like the rest, just flagged with an accent edge so it still reads as the
 * announcement the day was built around.
 */
function BigSlideCard({ message }: { message: BoardMessage }) {
  return (
    <article className="overflow-hidden rounded-lg border-[0.075rem] border-l-[0.25rem] border-line border-l-accent bg-surface-1">
      {message.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.imageUrl}
          alt=""
          className="max-h-[16rem] w-full object-cover"
        />
      )}
      <div className="p-[1.1rem]">
        <h3 className="font-display text-[1.5rem] font-bold leading-tight text-accent">
          {message.title}
        </h3>
        {message.body && (
          <p className="pt-[0.4rem] text-[1.05rem] leading-snug">{message.body}</p>
        )}
      </div>
    </article>
  );
}

function EventCard({ event }: { event: EventItem }) {
  return (
    <article className="overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1">
      {event.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.posterUrl}
          alt=""
          className="max-h-[20rem] w-full object-contain bg-surface-2"
        />
      )}
      <div className="p-[1.1rem]">
        {event.klas && <span className="eyebrow text-[0.7rem]">{event.klas} speelt</span>}
        <h3 className="pt-[0.2rem] font-display text-[1.5rem] font-bold leading-tight text-accent">
          {event.title}
        </h3>
        <p className="pt-[0.3rem] font-display text-[1.05rem] font-bold leading-snug">
          {event.whenLabel}
        </p>
        {event.synopsis && (
          <p className="pt-[0.35rem] text-[0.95rem] leading-snug text-muted">
            {event.synopsis}
          </p>
        )}
      </div>
    </article>
  );
}

function OccasionCard({ occasion }: { occasion: SpecialOccasion }) {
  return (
    <article className="rounded-lg border-[0.075rem] border-line bg-surface-1 p-[1.1rem]">
      <span className="eyebrow text-[0.7rem]">{occasion.eventDateLabel}</span>
      <h3 className="pt-[0.2rem] font-display text-[1.4rem] font-bold leading-tight text-accent">
        {occasion.title}
      </h3>
      {occasion.entries.length > 0 && (
        <ul className="mt-[0.7rem] flex flex-col gap-[0.55rem]">
          {occasion.entries.map((entry, i) => (
            <li key={i} className="flex gap-[0.7rem] text-[0.95rem] leading-snug">
              <span className="w-[4.5rem] shrink-0 font-mono text-[0.85rem] font-bold tabular-nums text-muted">
                {entry.timeFrom}
                {entry.timeTo ? `–${entry.timeTo}` : ""}
              </span>
              <span className="min-w-0">
                <span className="font-bold">{entry.activity}</span>
                {entry.location && (
                  <span className="text-muted"> · {entry.location}</span>
                )}
                {entry.info && (
                  <span className="block text-[0.85rem] text-muted">{entry.info}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * The board as a teacher reads it from home, on a phone.
 *
 * Same payload as the wall, laid out down the screen instead of across it, and
 * with the wall's timed full-screen takeovers unrolled into sections you scroll
 * past rather than wait out — a phone in the hand has a reader, not a corridor
 * of passers-by. Standby is ignored here for the same reason: someone opening
 * this in the evening wants the board, not a dark hall's night screen.
 */
export function MobileBoard({
  data,
  screenId,
  stale,
}: {
  data: BoardData;
  screenId: string;
  stale: boolean;
}) {
  const bigSlides = [...data.permanentSlides, ...data.periodicSlides];
  const occasions = [
    ...data.specialOccasions,
    ...data.permanentSpecialOccasions,
    ...data.periodicSpecialOccasions,
  ];
  const hasKeys = data.keys.length > 0;

  return (
    <main
      className="mobile-board min-h-screen bg-bg text-text"
      data-theme={data.appearance.theme}
      data-accent={data.appearance.accent}
    >
      <header className="sticky top-0 z-10 border-b-[0.075rem] border-line bg-bg/95 px-[1.1rem] py-[0.9rem] backdrop-blur">
        <div className="flex items-center justify-between gap-[0.8rem]">
          <div className="flex min-w-0 items-center gap-[0.7rem]">
            <LogoMark logoUrl={data.style.logoUrl} className="h-[2rem] w-auto shrink-0" />
            <span className="eyebrow truncate text-[0.7rem]">
              {data.style.schoolName ?? "Steinerschool Gent"}
            </span>
          </div>
          <span className="shrink-0 font-display text-[1.5rem] font-bold leading-none tabular-nums">
            <Clock />
          </span>
        </div>
        <div className="mt-[0.5rem] flex items-end justify-between gap-[0.6rem]">
          <span className="font-display text-[1.35rem] font-bold leading-tight">
            {data.dateLabel}
          </span>
          <div className="flex shrink-0 items-center gap-[0.4rem]">
            {data.demo && (
              <span className="rounded-sm bg-surface-2 px-[0.5rem] py-[0.2rem] font-mono text-[0.6rem] uppercase tracking-[0.06em] text-muted">
                Demo
              </span>
            )}
            {stale && (
              <span className="animate-pulse-soft rounded-sm bg-alert-bg px-[0.5rem] py-[0.2rem] font-mono text-[0.6rem] uppercase tracking-[0.06em] text-alert">
                Geen verbinding
              </span>
            )}
            <span className="eyebrow text-[0.65rem]">
              {data.screenName ?? `Scherm ${screenId}`}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-[1.1rem] px-[1.1rem] py-[1.1rem]">
        {bigSlides.length > 0 && (
          <section className="flex flex-col gap-[0.6rem]">
            {bigSlides.map((slide) => (
              <BigSlideCard key={slide.id} message={slide} />
            ))}
          </section>
        )}

        {occasions.length > 0 && (
          <section className="flex flex-col gap-[0.6rem]">
            {occasions.map((occasion, i) => (
              <OccasionCard key={`${occasion.title}-${i}`} occasion={occasion} />
            ))}
          </section>
        )}

        <MobileSubstitutions
          substitutions={data.substitutions}
          schedule={data.schedule}
          unavailable={data.substitutionsUnavailable}
        />

        {data.events.length > 0 && (
          <section className="flex flex-col gap-[0.6rem]">
            <SectionLabel>Evenementen</SectionLabel>
            {data.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </section>
        )}

        {data.messages.length > 0 && (
          <section className="flex flex-col gap-[0.6rem]">
            <SectionLabel>Mededelingen</SectionLabel>
            {data.messages.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))}
          </section>
        )}

        {hasKeys && (
          <section className="flex flex-col gap-[0.6rem]">
            <SectionLabel>Sleutels</SectionLabel>
            <div className="rounded-lg border-[0.075rem] border-line bg-surface-1 p-[1.1rem]">
              <h3 className="mb-[0.7rem] flex items-center gap-[0.5rem] font-display text-[1.2rem] font-bold leading-tight text-accent">
                <KeyIcon className="h-[1.3rem] w-[1.3rem] shrink-0" />
                {keyHeadline(data.keys)}
              </h3>
              <div className="flex flex-wrap gap-[0.5rem]">
                {data.keys.map((duty) => (
                  <KeyChip key={duty.id} duty={duty} compact />
                ))}
              </div>
            </div>
          </section>
        )}

        {data.piket && (
          <section className="flex flex-col gap-[0.6rem]">
            <PiketNow
              roster={data.piket}
              schedule={data.schedule}
              boardDate={data.date}
              className="w-full"
            />
          </section>
        )}

        <BirthdayZone birthdays={data.birthdays} className="w-full" />
      </div>
    </main>
  );
}
