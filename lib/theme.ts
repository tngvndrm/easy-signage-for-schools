/**
 * Theme is a setting, not a media query — a kiosk has no user to prefer
 * anything. Resolution order: URL query (handy for testing a single screen)
 * then environment, then the brand default.
 */

export const THEMES = ["light", "dark"] as const;
export const ACCENTS = ["coral", "gold", "blue"] as const;

export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];

function pick<T extends string>(
  allowed: readonly T[],
  ...candidates: (string | string[] | undefined)[]
): T | null {
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    if (value && (allowed as readonly string[]).includes(value)) {
      return value as T;
    }
  }
  return null;
}

export function resolveTheme(
  searchParams: Record<string, string | string[] | undefined> = {},
): { theme: Theme; accent: Accent } {
  return {
    theme: pick(THEMES, searchParams.theme, process.env.THEME) ?? "light",
    accent: pick(ACCENTS, searchParams.accent, process.env.ACCENT) ?? "coral",
  };
}
