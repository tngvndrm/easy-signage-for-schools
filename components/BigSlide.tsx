import type { BoardMessage } from "@/lib/types";

/**
 * A "Big Slide" message shown full-screen, replacing the dashboard. Three
 * treatments from what the row carries:
 *   - Volledig beeld + image → the artwork fills the screen, text on a scrim.
 *   - image, no tick        → poster layout, artwork beside the text.
 *   - no image              → centred text on the brand colour.
 */
/**
 * Which BurstProgress tone reads on this slide — the poster treatment sits on
 * the page background, the other two on artwork or the brand colour. Kept
 * beside the three returns below so it's updated along with them.
 */
export function bigSlideTone(message: BoardMessage): "accent" | "light" {
  return message.imageUrl && !message.cover ? "accent" : "light";
}

export function BigSlide({ message }: { message: BoardMessage }) {
  const shadow = "[text-shadow:0_0.1rem_0.4rem_rgba(0,0,0,0.6)]";

  if (message.cover && message.imageUrl) {
    return (
      <div className="animate-fade-up relative h-full w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />
        <div className="relative flex h-full w-full flex-col justify-end gap-[1.2rem] p-[4rem]">
          <h1
            className={`font-display text-[5rem] font-bold leading-[1.05] text-white ${shadow}`}
          >
            {message.title}
          </h1>
          {message.body && (
            <p
              className={`max-w-[48rem] text-[2.2rem] leading-[1.3] text-white/95 ${shadow}`}
            >
              {message.body}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (message.imageUrl) {
    return (
      <div className="animate-fade-up flex h-full w-full items-stretch gap-[2.5rem] bg-bg p-[3rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.imageUrl}
          alt=""
          className="h-full w-auto max-w-[52%] shrink-0 rounded-lg object-contain"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[1.2rem]">
          <h1 className="font-display text-[4rem] font-bold leading-[1.05] text-accent">
            {message.title}
          </h1>
          {message.body && (
            <p className="max-w-[36rem] text-[1.9rem] leading-[1.35]">
              {message.body}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Centred reads well for a short line or two; a long paragraph doesn't, so
  // past a threshold it left-aligns (title included) and steps the type down.
  const long = (message.body?.length ?? 0) > 170;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-accent-hover">
      <span className="blob bg-accent" />
      <div
        className={`animate-fade-up relative flex flex-col gap-[1.4rem] px-[6rem] ${
          long ? "max-w-[62rem] items-start text-left" : "items-center text-center"
        }`}
      >
        <h1
          className={`font-display font-bold leading-[1.05] text-white ${
            long ? "text-[3.8rem]" : "text-[5.5rem]"
          }`}
        >
          {message.title}
        </h1>
        {message.body && (
          <p
            className={`leading-[1.4] text-white/90 ${
              long ? "text-[1.9rem]" : "max-w-[42rem] text-[2rem]"
            }`}
          >
            {message.body}
          </p>
        )}
      </div>
    </div>
  );
}
