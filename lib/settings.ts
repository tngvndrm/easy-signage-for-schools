import {
  fetchRange,
  findHeader,
  isTicked,
  MissingTabError,
  normalizeText,
} from "./sheets";
import { ACCENTS, type Accent } from "./theme";

const SETTINGS_RANGE = process.env.SETTINGS_SHEET_RANGE ?? "Settings!A1:L30";

/**
 * Per-screen settings staff can change live from the sheet, no redeploy: a
 * friendly name, an accent colour, the times the board flips between the light
 * and dark theme, the hours it goes dark altogether, and how fast it paces
 * itself.
 */
export type ScreenSettings = {
  name: string | null;
  accent: Accent | null;
  /** Minutes-of-day the dark theme starts; null when unscheduled. */
  darkStartMin: number | null;
  /** Minutes-of-day the light theme starts; null when unscheduled. */
  lightStartMin: number | null;
  /** Minutes-of-day the screen blacks out (`Turn Off`); null when unscheduled. */
  blackoutStartMin: number | null;
  /** Minutes-of-day the board comes back (`Turn On`); null when unscheduled. */
  blackoutEndMin: number | null;
  /** Seconds each message holds the rotation; null falls back to the default. */
  messageCycleSec: number | null;
  /** Seconds between full-screen bursts; null falls back to the default. */
  fullScreenIntervalSec: number | null;
  /** Seconds a full-screen burst holds; null falls back to the default. */
  fullScreenSec: number | null;
  /** Show the standby roster on this screen — the staff room, in practice. */
  piket: boolean;
};

export const EMPTY_SETTINGS: ScreenSettings = {
  name: null,
  accent: null,
  darkStartMin: null,
  lightStartMin: null,
  blackoutStartMin: null,
  blackoutEndMin: null,
  messageCycleSec: null,
  fullScreenIntervalSec: null,
  fullScreenSec: null,
  piket: false,
};

const COLUMNS = {
  display: ["display", "scherm", "screen"],
  name: ["name", "naam"],
  accent: ["colorscheme", "kleur", "accent", "kleurenschema", "color"],
  darkStart: ["darkthemestart", "donkerthemastart", "darkstart", "donker"],
  lightStart: ["lightthemestart", "lichtthemastart", "lightstart", "licht"],
  turnOff: ["turnoff", "uit", "schermuit", "uitschakelen", "blackout", "blackoutstart"],
  turnOn: ["turnon", "aan", "schermaan", "inschakelen", "blackouteinde", "blackoutend"],
  messageCycle: ["messagecycletime", "messagecycle", "berichttijd", "mededelingstijd"],
  fullScreenInterval: ["fullscreeninterval", "volledigscherminterval", "scherminterval"],
  fullScreen: ["fullscreentime", "fullscreen", "volledigschermtijd", "schermtijd"],
  piket: ["piket", "piketrooster", "standby"],
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

/**
 * A duration in seconds. Staff may well type "20s" or "1,5"; anything that
 * isn't a positive number is treated as unset so a typo falls back to the
 * default rather than freezing or flickering the board.
 */
function parseSeconds(raw: string): number | null {
  const value = Number(raw.trim().replace(",", ".").replace(/s(ec\w*)?$/i, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
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
      blackoutStartMin: parseHm(cell(columns.turnOff)),
      blackoutEndMin: parseHm(cell(columns.turnOn)),
      messageCycleSec: parseSeconds(cell(columns.messageCycle)),
      fullScreenIntervalSec: parseSeconds(cell(columns.fullScreenInterval)),
      fullScreenSec: parseSeconds(cell(columns.fullScreen)),
      // Blank is off: a school that never adds the column gets no roster
      // anywhere, rather than one on all three screens.
      piket: isTicked(cell(columns.piket)),
    };
  }
  return out;
}
