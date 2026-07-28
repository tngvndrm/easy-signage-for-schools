import type {
  Birthday,
  BoardMessage,
  KeyDuty,
  Substitution,
  Takeover,
} from "./types";

/**
 * Stand-in for the Google Sheet + Firestore until they are wired up.
 * Modelled on the current slide deck so the layout is exercised realistically:
 * a period with two substitutions, a combined "1 & 2" block, and an
 * unsubstituted lesson.
 */
export const demoSubstitutions: Substitution[] = [
  { period: "1 & 2", periodStart: 1, periods: [1, 2], klas: "7A", absent: "Mevr. De Smet", substitute: "Dhr. Peeters", lokaal: "A12" },
  { period: "3", periodStart: 3, periods: [3], klas: "8B", absent: "Dhr. Janssens", substitute: "Mevr. Claes", lokaal: "B04" },
  { period: "4", periodStart: 4, periods: [4], klas: "9C", absent: "Mevr. Vermeulen", substitute: "", lokaal: "—" },
  { period: "5", periodStart: 5, periods: [5], klas: "7B", absent: "Dhr. Maes", substitute: "Mevr. Willems", lokaal: "A08" },
  { period: "6", periodStart: 6, periods: [6], klas: "9A", absent: "Mevr. De Smet", substitute: "Dhr. Peeters", lokaal: "C21" },
  { period: "6", periodStart: 6, periods: [6], klas: "9C", absent: "Dhr. Janssens", substitute: "Mevr. Goossens", lokaal: "C22" },
  { period: "7", periodStart: 7, periods: [7], klas: "8A", absent: "Mevr. Wouters", substitute: "Dhr. Verhoeven", lokaal: "B11" },
];

export const demoMessages: BoardMessage[] = [
  {
    id: "pickup",
    title: "Afhalen aan het secretariaat",
    body: "Lotte Verbeeck (7A), Sam De Ridder (8C) en Nour El Amrani (9B) — kom je even naar het secretariaat?",
  },
  {
    id: "reminder",
    title: "Niet vergeten",
    body: "Inschrijvingsformulier sportdag binnenbrengen vóór vrijdag 12u bij je klastitularis.",
  },
  {
    id: "event",
    title: "Donderdag 20u — Toneel",
    body: "Klas 100 speelt ‘Een Midzomernachtsdroom’ in de aula. Iedereen welkom!",
  },
];

export const demoBirthdays: Birthday[] = [
  { id: "b1", name: "Jan Janssen", klas: "7A" },
  { id: "b2", name: "Amira Haddad", klas: "8C" },
];

/**
 * A Friday partway through the morning: of 22 classes most have already
 * collected their key and been ticked off, and two stragglers from last weekend
 * still haven't handed theirs back.
 */
export const demoKeyDuties: KeyDuty[] = [
  { id: "6B-return", klas: "6B", student: "Lotte Verbeeck", action: "return", due: "2026-07-24", overdue: true },
  { id: "9A-return", klas: "9A", student: "Sam De Ridder", action: "return", due: "2026-07-24", overdue: true },
  { id: "7A-pickup", klas: "7A", student: "Jan Janssen", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "7C-pickup", klas: "7C", student: "Nour El Amrani", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "8A-pickup", klas: "8A", student: "Wout Peeters", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "8B-pickup", klas: "8B", student: "Amira Haddad", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "8C-pickup", klas: "8C", student: "Milan Claes", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "9B-pickup", klas: "9B", student: "Fien Willems", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "9C-pickup", klas: "9C", student: "Arthur Goossens", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "10A-pickup", klas: "10A", student: "Yasmine Aerts", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "10B-pickup", klas: "10B", student: "Tuur Michiels", action: "pickup", due: "2026-07-27", overdue: false },
  { id: "11A-pickup", klas: "11A", student: "Ella Segers", action: "pickup", due: "2026-07-27", overdue: false },
];

/** Flip to a Takeover object (or set ?takeover=1 on the board URL) to preview. */
export const demoTakeover: Takeover | null = null;

export const demoTakeoverPreview: Takeover = {
  id: "preview",
  title: "Fijn weekend!",
  body: "Maandag starten we om 8u40 met een gezamenlijke opening in de aula.",
};
