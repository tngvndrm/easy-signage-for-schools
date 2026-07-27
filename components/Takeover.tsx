import type { Takeover as TakeoverData } from "@/lib/types";

export function Takeover({ takeover }: { takeover: TakeoverData }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-accent-hover">
      <span className="blob bg-accent" />
      <div className="animate-fade-up relative flex flex-col items-center gap-[1.6rem] px-[6rem] text-center">
        {takeover.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={takeover.imageUrl}
            alt=""
            className="max-h-[22rem] w-auto rounded-lg object-contain"
          />
        )}
        <h1 className="font-display text-[5.5rem] font-bold leading-[1.05] text-white">
          {takeover.title}
        </h1>
        {takeover.body && (
          <p className="max-w-[40rem] text-[2rem] leading-[1.35] text-white/90">
            {takeover.body}
          </p>
        )}
      </div>
    </div>
  );
}
