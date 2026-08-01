"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

/**
 * The header logo: the school's own image from the Style tab, or the built-in
 * facet mark. A logo URL that fails to load — the usual cause being a Drive file
 * that isn't shared "anyone with the link" — falls back to the mark rather than
 * leaving an empty gap.
 */
export function LogoMark({
  logoUrl,
  className,
}: {
  logoUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  // A new logo URL deserves a fresh attempt.
  useEffect(() => setFailed(false), [logoUrl]);

  if (!logoUrl || failed) return <BrandMark className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      className={`${className ?? ""} max-w-[16rem] object-contain`}
      onError={() => setFailed(true)}
    />
  );
}
