import type { Birthday } from "@/lib/types";

/**
 * Styled as the guide's "feature card": a solid brand colour with the off-kilter
 * blob bleeding out of the corner. Gold rather than the accent, so the zone
 * stays recognisable whichever accent the deployment runs.
 */
export function BirthdayZone({ birthdays }: { birthdays: Birthday[] }) {
  if (birthdays.length === 0) return null;

  return (
    <section className="relative flex w-[27%] shrink-0 flex-col justify-center gap-[0.4rem] overflow-hidden rounded-lg bg-[var(--brand-gold-700)] p-[1.4rem]">
      <span className="blob bg-gold" />
      <div className="relative">
        <span className="font-mono text-[0.8rem] uppercase tracking-[0.08em] text-white/75">
          Jarig vandaag
        </span>
        <ul className="pt-[0.4rem]">
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
      </div>
    </section>
  );
}
