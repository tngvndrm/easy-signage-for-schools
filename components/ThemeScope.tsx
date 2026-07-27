import type { Accent, Theme } from "@/lib/theme";

/**
 * Re-declares the theme tokens on a wrapper element so a single screen can be
 * flipped with `?theme=dark` without touching the deployment-wide default.
 * The tokens are plain CSS variables, so everything inside inherits them.
 */
export function ThemeScope({
  theme,
  accent,
  children,
}: {
  theme: Theme;
  accent: Accent;
  children: React.ReactNode;
}) {
  return (
    <div data-theme={theme} data-accent={accent} className="bg-bg text-text">
      {children}
    </div>
  );
}
