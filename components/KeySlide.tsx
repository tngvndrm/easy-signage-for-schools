import type { KeyDuty } from "@/lib/types";
import { KeyChip, KeyIcon } from "./keys-shared";

function Group({
  title,
  duties,
}: {
  title: string;
  duties: KeyDuty[];
}) {
  if (duties.length === 0) return null;

  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-baseline gap-[0.6rem] pb-[0.6rem]">
        <h2 className="font-display text-[1.7rem] font-bold leading-none">
          {title}
        </h2>
        <span className="eyebrow text-[0.8rem]">{duties.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-[0.6rem]">
        {duties.map((duty) => (
          <KeyChip key={duty.id} duty={duty} />
        ))}
      </div>
    </section>
  );
}

/**
 * The full-screen slide, shown in short bursts while a lot is still
 * outstanding. Everyone's class is on screen at once so a student can find
 * their own row in a glance rather than waiting for a rotation to come round.
 */
export function KeySlide({
  duties,
  dateLabel,
}: {
  duties: KeyDuty[];
  dateLabel: string;
}) {
  // Group by what the student has to do — an overdue pickup is still a pickup,
  // so lateness is a badge on the chip, never a group of its own. Whichever
  // list has late entries leads, since that's the one being nagged about.
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

  return (
    <div className="animate-fade-up flex h-full w-full flex-col gap-[1.4rem] p-[2rem]">
      <header className="flex shrink-0 items-center gap-[1rem]">
        <KeyIcon className="h-[2.8rem] w-[2.8rem] shrink-0 text-accent" />
        <h1 className="font-display text-[2.6rem] font-bold leading-none">
          Sleutels klaslokalen
        </h1>
        <span className="eyebrow ml-auto text-[0.9rem]">{dateLabel}</span>
      </header>

      {/* Centred: a nearly-finished list shouldn't hug the top of the screen. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[1.6rem]">
        {groups.map((group) => (
          <Group key={group.title} title={group.title} duties={group.duties} />
        ))}
      </div>

      <p className="shrink-0 text-[1.05rem] text-muted">
        Aan het onthaal. Zodra het onthaal je klas afvinkt, verdwijnt ze hier.
      </p>
    </div>
  );
}
