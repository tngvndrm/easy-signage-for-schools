import { BirthdayGlyph } from "./BirthdayGlyph";
import type { Birthday } from "@/lib/types";

/**
 * Styled as the guide's "feature card": a solid brand colour with the off-kilter
 * blob bleeding out of the corner. Gold rather than the accent, so the zone
 * stays recognisable whichever accent the deployment runs.
 */
export function BirthdayZone({
  birthdays,
  // Positional sizing is set by the parent: a fixed-width card beside the
  // message loop in the wide dashboard, or a full-width card stacked below it
  // in the busy-day layout.
  className = "w-[27%] shrink-0",
}: {
  birthdays: Birthday[];
  className?: string;
}) {
  if (birthdays.length === 0) return null;

  return (
    // The transparent border matches the message card's, so both cards' content
    // boxes start at the same y and their labels sit on one line.
    <section
      className={`relative flex flex-col overflow-hidden rounded-lg border-[0.075rem] border-transparent bg-[var(--brand-gold-700)] p-[1.4rem] ${className}`}
    >
      <span className="blob bg-gold" />
      {/* HEADER_ROW keeps this label on the same line as "Mededelingen". */}
      <div className="relative mb-[0.6rem] flex h-[1.7rem] shrink-0 items-center gap-[0.5rem] font-mono text-[0.8rem] uppercase tracking-[0.08em] text-white/75">
        Jarig vandaag
        <BirthdayGlyph className="h-[1.7rem] w-[1.7rem] shrink-0 text-white" />
      </div>
      <ul className="relative flex min-h-0 flex-1 flex-col justify-center">
        {birthdays.map((birthday) => (
          <li key={birthday.id} className="leading-tight">
            <span className="font-display text-[1.55rem] font-bold text-white">
              {birthday.name}
            </span>
            <span className="pl-[0.5rem] text-[1.1rem] text-white/80">
              {birthday.klas}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
