/** Shape of everything the board needs, in one payload. */

export type Substitution = {
  /** Display label for the period, e.g. "3" or "1 & 2". */
  period: string;
  /** Sort key: the first period number in the block. */
  periodStart: number;
  /** Every period the block covers — `[1, 2]` for "1 & 2". */
  periods: number[];
  klas: string;
  absent: string;
  /** Empty string means "no substitute" — rendered as a "geen les" chip. */
  substitute: string;
  lokaal: string;
};

export type BoardMessage = {
  id: string;
  title: string;
  body: string;
  /** Optional banner image (Cloud Storage URL). */
  imageUrl?: string;
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

export type Takeover = {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
};

export type BoardData = {
  /** ISO date (Europe/Brussels) the substitution rows belong to. */
  date: string;
  /** Human date line, pre-formatted server-side so all screens agree. */
  dateLabel: string;
  substitutions: Substitution[];
  /** Period number after which the "pauze" divider is drawn. */
  breakAfterPeriod: number | null;
  messages: BoardMessage[];
  birthdays: Birthday[];
  /** Outstanding classroom-key duties, late ones first. */
  keys: KeyDuty[];
  /** Non-null => board renders full-screen takeover instead of the dashboard. */
  takeover: Takeover | null;
  /** Server timestamp (ms) of this payload; used for the staleness indicator. */
  fetchedAt: number;
  /** True when the payload came from mock data, not a real Sheet. */
  demo: boolean;
};
