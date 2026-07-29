import type { EventItem } from "@/lib/types";

/**
 * Full-screen event announcement: the poster carries the screen, with the
 * class, title, synopsis and when-and-where set beside it. Portrait artwork
 * gets the full height of the display, which is the whole point of giving this
 * its own screen rather than a panel.
 */
export function EventPoster({ event }: { event: EventItem }) {
  return (
    <div className="animate-fade-up flex h-full w-full items-stretch gap-[2.5rem] p-[2rem]">
      {event.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.posterUrl}
          alt=""
          // Portrait posters fill the height; a landscape one is capped at half
          // the width so the text never gets squeezed off the screen.
          className="h-full w-auto max-w-[50%] shrink-0 rounded-lg object-contain"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[1.1rem]">
        {event.klas && (
          <span className="eyebrow text-[1rem]">{event.klas} speelt</span>
        )}

        <h1 className="font-display text-[4rem] font-bold leading-[1.05] text-accent">
          {event.title}
        </h1>

        <p className="font-display text-[1.7rem] font-bold leading-tight">
          {event.whenLabel}
        </p>

        {event.synopsis && (
          <p className="max-w-[34rem] text-[1.4rem] leading-[1.4] text-muted">
            {event.synopsis}
          </p>
        )}
      </div>
    </div>
  );
}
