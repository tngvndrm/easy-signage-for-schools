/** Shape of everything the board needs, in one payload. */

import type { Slot } from "./schedule";
import type { BrandStyle } from "./style";

export type Substitution = {
  /** Display label for the period, e.g. "3" or "1 & 2". */
  period: string;
  /** Sort key: the first period number in the block. */
  periodStart: number;
  /** Every period the block covers — `[1, 2]` for "1 & 2". */
  periods: number[];
  klas: string;
  absent: string;
  /** Empty string means "not filled in yet" — rendered as an "Info volgt" chip. */
  substitute: string;
  lokaal: string;
  /** Optional task the class works on, e.g. "Zelfstudie". Empty when unset. */
  content: string;
};

export type BoardMessage = {
  id: string;
  title: string;
  body: string;
  /** Optional banner image (Cloud Storage URL). */
  imageUrl?: string;
  /**
   * Full-bleed artwork: the image fills the whole card and the text sits over
   * it on a scrim, instead of the image being a side thumbnail. For fundraiser
   * posters and the like.
   */
  cover?: boolean;
  /**
   * Take over the whole screen, replacing the dashboard. `"periodic"` shows it
   * full-screen in short bursts every few minutes (the board stays visible
   * between); `"permanent"` holds it full-screen for the message's whole window
   * — for welcome-back / holiday messages where nothing else matters. Distinct
   * from `cover`, which only restyles the in-rotation card.
   */
  bigSlide?: "periodic" | "permanent";
  /** Seconds this item stays on screen in the rotation. */
  durationSec?: number;
};

export type Birthday = {
  id: string;
  name: string;
  klas: string;
};

export type KeyDuty = {
  id: string;
  klas: string;
  student: string;
  /** Collecting the key for the weekend, or bringing it back. */
  action: "pickup" | "return";
  /** ISO date the duty falls on. */
  due: string;
  /** Date has passed and the front desk hasn't ticked it off. */
  overdue: boolean;
};

export type SpecialOccasionEntry = {
  /** Display string e.g. "09:30". */
  timeFrom: string;
  /** Display string e.g. "11:00". Absent for open-ended items. */
  timeTo?: string;
  /** Minutes since midnight — used by the current-time indicator. */
  timeFromMinutes: number;
  timeToMinutes?: number;
  activity: string;
  supervisor: string;
  info?: string;
  location?: string;
};

export type SpecialOccasion = {
  /** ISO yyyy-mm-dd of the event itself. */
  eventDate: string;
  /** Human-readable date, pre-formatted server-side. */
  eventDateLabel: string;
  title: string;
  entries: SpecialOccasionEntry[];
};

export type EventItem = {
  id: string;
  /** The class performing, e.g. "Klas 100". */
  klas: string;
  title: string;
  synopsis: string;
  /** ISO date of the event itself. */
  date: string;
  /** Pre-formatted "Donderdag 17 september · 20u00", built server-side. */
  whenLabel: string;
  /** Direct image URL — Drive share links are rewritten by the reader. */
  posterUrl: string;
};

export type BoardTiming = {
  /** Seconds each message holds the rotation, unless the item overrides it. */
  messageCycleSec: number;
  /** Seconds between full-screen bursts (keys, event, Big Slide, occasion). */
  fullScreenIntervalSec: number;
  /** Seconds one full-screen burst stays up before the dashboard returns. */
  fullScreenSec: number;
};

export type BoardData = {
  /** ISO date (Europe/Brussels) the substitution rows belong to. */
  date: string;
  /** Human date line, pre-formatted server-side so all screens agree. */
  dateLabel: string;
  /** Resolved theme + accent for this screen (query > sheet > env). */
  appearance: { theme: "light" | "dark"; accent: "coral" | "gold" | "blue" };
  /** Friendly screen name from the Settings tab, or null to show "Scherm N". */
  screenName: string | null;
  /** How fast this screen paces itself, in seconds (Settings tab, with defaults). */
  timing: BoardTiming;
  /** Global branding (logo, colours, font) from the Style tab. */
  style: BrandStyle;
  substitutions: Substitution[];
  /** The day's timetable — drives the "now" marker and the pauze dividers. */
  schedule: Slot[];
  messages: BoardMessage[];
  birthdays: Birthday[];
  /** Outstanding classroom-key duties, late ones first. */
  keys: KeyDuty[];
  /** Events currently within their announcement window, soonest first. */
  events: EventItem[];
  /** In-window "Permanent" Big Slides — held full-screen over the dashboard. */
  permanentSlides: BoardMessage[];
  /** In-window "Yes" Big Slides — shown full-screen in periodic bursts. */
  periodicSlides: BoardMessage[];
  /** Special occasion boards active today — no BigSlide, replace SubstitutionBoard. */
  specialOccasions: SpecialOccasion[];
  /** Permanent special occasions — always in the main area for their window. */
  permanentSpecialOccasions: SpecialOccasion[];
  /** Periodic special occasions — appear in the main area in interrupt bursts. */
  periodicSpecialOccasions: SpecialOccasion[];
  /** Server timestamp (ms) of this payload; used for the staleness indicator. */
  fetchedAt: number;
  /** True when the payload came from mock data, not a real Sheet. */
  demo: boolean;
  /**
   * The substitution sheet couldn't be read. Distinct from "no substitutions
   * today" — an empty board must never be able to mean a broken one.
   */
  substitutionsUnavailable: boolean;
};
