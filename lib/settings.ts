import { fetchRange, findHeader, MissingTabError, normalizeText } from "./sheets";
import { ACCENTS, type Accent } from "./theme";

const SETTINGS_RANGE = process.env.SETTINGS_SHEET_RANGE ?? "Settings!A1:H30";

/**
 * Per-screen settings staff can change live from the sheet, no redeploy: a
 * friendly name, an accent colour, and the times the board flips between the
 * light and dark theme. (Turn Off / Turn On are read by the separate TV-power
 * feature, not here.)
 */
export type ScreenSettings = {
  name: string | null;
  accent: Accent | null;
  /** Minutes-of-day the dark theme starts; null when unscheduled. */
  darkStartMin: number | null;
  /** Minutes-of-day the light theme starts; null when unscheduled. */
  lightStartMin: number | null;
};

export const EMPTY_SETTINGS: ScreenSettings = {
  name: null,
  accent: null,
  darkStartMin: null,
  lightStartMin: null,
};

const COLUMNS = {
  display: ["display", "scherm", "screen"],
  name: ["name", "naam"],
  accent: ["colorscheme", "kleur", "accent", "kleurenschema", "color"],
  darkStart: ["darkthemestart", "donkerthemastart", "darkstart", "donker"],
  lightStart: ["lightthemestart", "lichtthemastart", "lightstart", "licht"],
};

/** "18:00", "8:30" -> minutes since midnight; null if unparseable. */
function parseHm(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function parseAccent(raw: string): Accent | null {
  const value = normalizeText(raw);
  return (ACCENTS as readonly string[]).includes(value)
    ? (value as Accent)
    : null;
}

/**
 * Which theme applies at `nowMin`, given the two switch times. The light window
 * runs from the light start to the dark start; outside it, dark. Works whether
 * the dark window is overnight (the usual case) or mid-day.
 */
export function themeAt(
  nowMin: number,
  lightStartMin: number,
  darkStartMin: number,
): "light" | "dark" {
  if (lightStartMin < darkStartMin) {
    return nowMin >= lightStartMin && nowMin < darkStartMin ? "light" : "dark";
  }
  return nowMin >= darkStartMin && nowMin < lightStartMin ? "dark" : "light";
}

/** Read the Settings tab into a per-screen map keyed by the Display value. */
export async function readSettings(): Promise<Record<string, ScreenSettings>> {
  let rows: string[][];
  try {
    rows = await fetchRange(SETTINGS_RANGE);
  } catch (error) {
    if (error instanceof MissingTabError) return {};
    throw error;
  }
  if (rows.length < 2) return {};

  const header = findHeader(rows, COLUMNS, "display");
  if (!header) return {};
  const { columns } = header;

  const out: Record<string, ScreenSettings> = {};
  for (const row of rows.slice(header.firstDataRow)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const id = cell(columns.display);
    if (!id) continue;
    out[id] = {
      name: cell(columns.name) || null,
      accent: parseAccent(cell(columns.accent)),
      darkStartMin: parseHm(cell(columns.darkStart)),
      lightStartMin: parseHm(cell(columns.lightStart)),
    };
  }
  return out;
}
