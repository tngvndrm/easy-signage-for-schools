import type { KeyDuty } from "@/lib/types";
import { KeyChip, KeyIcon } from "./keys-shared";

function Group({ title, duties }: { title: string; duties: KeyDuty[] }) {
  if (duties.length === 0) return null;

  return (
    <section className="flex shrink-0 flex-col">
      <div className="flex items-baseline gap-[0.6rem] pb-[0.5rem]">
        <h3 className="font-display text-[1.5rem] font-bold leading-none">
          {title}
        </h3>
        <span className="eyebrow text-[0.75rem]">{duties.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-[0.5rem]">
        {duties.map((duty) => (
          <KeyChip key={duty.id} duty={duty} />
        ))}
      </div>
    </section>
  );
}

/**
 * Takes the substitution board's place for a short spell while keys are
 * outstanding, leaving the header, messages and birthday zones untouched. The
 * screen stays recognisably the same board — only its main region changes —
 * rather than cutting away to an unrelated full-screen slide.
 */
export function KeyPanel({ duties }: { duties: KeyDuty[] }) {
  // Grouped by what the student has to do — an overdue pickup is still a
  // pickup, so lateness is a badge, never a group. Whichever list has late
  // entries leads, since that's the one being nagged about.
  const groups = [
    {
      title: "Sleutel terugbrengen",
      duties: duties.filter((d) => d.action === "return"),
    },
    {
      title: "Sleutel afhalen",
      duties: duties.filter((d) => d.action === "pickup"),
    },
  ].sort(
    (a, b) =>
      Number(b.duties.some((d) => d.overdue)) -
      Number(a.duties.some((d) => d.overdue)),
  );

  const late = duties.filter((d) => d.overdue).length;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[0.075rem] border-line bg-surface-1 py-[1.2rem]">
      <div className="flex shrink-0 items-baseline justify-between px-[1.8rem] pb-[0.9rem]">
        <h2 className="flex items-center gap-[0.6rem] font-display text-[2rem] font-bold leading-none">
          <KeyIcon className="h-[1.8rem] w-[1.8rem] shrink-0 text-accent" />
          Sleutels klaslokalen
        </h2>
        <span className="flex items-baseline gap-[0.9rem] text-[1rem] font-bold">
          {late > 0 && <span className="text-alert">{late} te laat</span>}
          <span className="text-muted">
            {duties.length} {duties.length === 1 ? "sleutel" : "sleutels"}
          </span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[1.2rem] px-[1.8rem]">
        {groups.map((group) => (
          <Group key={group.title} title={group.title} duties={group.duties} />
        ))}
      </div>

      <p className="shrink-0 px-[1.8rem] pt-[0.9rem] text-[1rem] text-muted">
        Aan het onthaal. Zodra het onthaal je klas afvinkt, verdwijnt ze hier.
      </p>
    </section>
  );
}
