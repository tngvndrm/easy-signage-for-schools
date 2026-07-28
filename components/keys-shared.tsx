import type { KeyDuty } from "@/lib/types";

/**
 * Above this many outstanding duties the key list periodically takes over the
 * substitution board's area; at or below it, the list is short enough to sit in
 * the messages rotation. The board's insistence tracks how much is still
 * outstanding.
 */
export const KEY_PANEL_THRESHOLD = 6;

export function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="4.2" />
        <path d="m11 11 8.5 8.5" />
        <path d="M17 17l2-2M19.5 19.5l1.5-1.5" />
      </g>
    </svg>
  );
}

/** "Sleutels afhalen" / "terugbrengen", or both when the list is mixed. */
export function keyHeadline(duties: KeyDuty[]): string {
  const pickups = duties.some((d) => d.action === "pickup");
  const returns = duties.some((d) => d.action === "return");
  if (pickups && returns) return "Sleutels afhalen en terugbrengen";
  return returns ? "Sleutels terugbrengen" : "Sleutels afhalen";
}

export function KeyChip({
  duty,
  compact = false,
}: {
  duty: KeyDuty;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-baseline gap-[0.5rem] rounded-md border-[0.075rem] ${
        duty.overdue
          ? "border-alert bg-alert-bg"
          : "border-line bg-surface-2"
      } ${compact ? "px-[0.7rem] py-[0.35rem]" : "px-[0.9rem] py-[0.5rem]"}`}
    >
      <span
        className={`font-display font-bold ${
          duty.overdue ? "text-alert" : "text-accent"
        } ${compact ? "text-[1.15rem]" : "text-[1.4rem]"}`}
      >
        {duty.klas}
      </span>
      <span
        className={`truncate ${compact ? "text-[0.95rem]" : "text-[1.15rem]"}`}
      >
        {duty.student}
      </span>
      {duty.overdue && (
        <span
          className={`ml-auto shrink-0 font-mono uppercase tracking-[0.08em] text-alert ${
            compact ? "text-[0.6rem]" : "text-[0.7rem]"
          }`}
        >
          te laat
        </span>
      )}
    </div>
  );
}
