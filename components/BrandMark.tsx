/**
 * The three-colour facet mark from the style guide. Swap in the school's real
 * logo file here when there's an SVG of it — nothing else references it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="8 8 54 62"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <polygon
        points="30,10 55,20 45,45 60,60 30,68 15,55 10,30"
        fill="var(--brand-coral-500)"
      />
      <polygon
        points="30,10 45,45 15,55 10,30"
        fill="var(--brand-gold-500)"
        opacity="0.85"
      />
      <polygon
        points="10,30 15,55 30,68"
        fill="var(--brand-blue-500)"
        opacity="0.85"
      />
    </svg>
  );
}
