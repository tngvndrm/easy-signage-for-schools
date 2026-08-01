import { directImageUrl, fetchRange, MissingTabError, normalizeText } from "./sheets";

/**
 * Global branding a sister school can set without touching code: a logo, the
 * three brand colours, and (build-time) the display font. The whole colour
 * system is derived from the three bases, so only those three are needed — every
 * tint and shade the UI uses is mixed from them.
 */
export type BrandStyle = {
  logoUrl: string | null;
  /** School name shown beside the logo; null keeps the default. */
  schoolName: string | null;
  colors: Partial<Record<"coral" | "gold" | "blue", string>>;
};

export const EMPTY_STYLE: BrandStyle = {
  logoUrl: null,
  schoolName: null,
  colors: {},
};

const STYLE_RANGE = process.env.STYLE_SHEET_RANGE ?? "Style!A1:C40";

function normalizeHex(raw: string): string | null {
  const v = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  return null;
}

/**
 * Read the Style tab. It mixes a couple of key/value rows (`Logo`, `Font`) with
 * a small colour table, so this scans rows rather than assuming a header — any
 * order works, and unknown rows are ignored.
 */
export async function readStyle(): Promise<BrandStyle> {
  let rows: string[][];
  try {
    rows = await fetchRange(STYLE_RANGE);
  } catch (error) {
    if (error instanceof MissingTabError) return EMPTY_STYLE;
    throw error;
  }

  const style: BrandStyle = { ...EMPTY_STYLE, colors: {} };
  for (const row of rows) {
    const key = normalizeText(row?.[0] ?? "");
    const value = (row?.[1] ?? "").trim();
    if (!value) continue;

    if (key === "logo") style.logoUrl = directImageUrl(value) || null;
    else if (key === "school" || key === "schoolnaam" || key === "naam") {
      style.schoolName = value;
    } else if (key === "coral" || key === "gold" || key === "blue") {
      const hex = normalizeHex(value);
      if (hex) style.colors[key] = hex;
    }
  }
  return style;
}

/**
 * CSS that overrides the brand tokens from the sheet. Only the three base
 * colours are given; the 100/300/700/900 steps are mixed toward white and black
 * so pills, chips and shades all follow. (The display font is a build-time
 * choice — see the README — not a sheet value.)
 */
export function styleOverridesCss(style: BrandStyle): string {
  const decls: string[] = [];
  for (const key of ["coral", "gold", "blue"] as const) {
    const hex = style.colors[key];
    if (!hex) continue;
    decls.push(
      `--brand-${key}-500:${hex}`,
      `--brand-${key}-100:color-mix(in srgb, ${hex} 20%, white)`,
      `--brand-${key}-300:color-mix(in srgb, ${hex} 55%, white)`,
      `--brand-${key}-700:color-mix(in srgb, ${hex} 72%, black)`,
      `--brand-${key}-900:color-mix(in srgb, ${hex} 42%, black)`,
    );
  }
  return decls.length > 0 ? `:root{${decls.join(";")}}` : "";
}
