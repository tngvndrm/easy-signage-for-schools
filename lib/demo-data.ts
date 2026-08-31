import type { ScreenSettings } from "./settings";
import type {
  Birthday,
  BoardMessage,
  EventItem,
  KeyDuty,
  SpecialOccasion,
  Substitution,
} from "./types";

/** Per-screen settings for demo mode: a name, an accent, and a dark-at-18h rule. */
const demoTiming = {
  messageCycleSec: null,
  fullScreenIntervalSec: null,
  fullScreenSec: null,
};

export const demoSettings: Record<string, ScreenSettings> = {
  "1": { name: "Inkomhal", accent: "coral", darkStartMin: 18 * 60, lightStartMin: 8 * 60 + 30, ...demoTiming },
  "2": { name: "Blok B", accent: "gold", darkStartMin: null, lightStartMin: null, ...demoTiming },
  "3": { name: "Leraarskamer", accent: "blue", darkStartMin: null, lightStartMin: null, ...demoTiming },
};

/**
 * Stand-in for the Google Sheet + Firestore until they are wired up.
 * Modelled on the current slide deck so the layout is exercised realistically:
 * a period with two substitutions, a combined "1 & 2" block, and an
 * unsubstituted lesson.
 */
export const demoSubstitutions: Substitution[] = [
  { period: "1 & 2", periodStart: 1, periods: [1, 2], klas: "7A", absent: "Mevr. De Smet", substitute: "Dhr. Peeters", lokaal: "A12" , content: "Vervangtaak" },
  { period: "3", periodStart: 3, periods: [3], klas: "8B", absent: "Dhr. Janssens", substitute: "Mevr. Claes", lokaal: "B04" , content: "Toets" },
  { period: "4", periodStart: 4, periods: [4], klas: "9C", absent: "Mevr. Vermeulen", substitute: "", lokaal: "—" , content: "Zelfstudie" },
  { period: "5", periodStart: 5, periods: [5], klas: "7B", absent: "Dhr. Maes", substitute: "Mevr. Willems", lokaal: "A08" , content: "" },
  { period: "6", periodStart: 6, periods: [6], klas: "9A", absent: "Mevr. De Smet", substitute: "Dhr. Peeters", lokaal: "C21" , content: "Spel" },
  { period: "6", periodStart: 6, periods: [6], klas: "9C", absent: "Dhr. Janssens", substitute: "Mevr. Goossens", lokaal: "C22" , content: "Zelfstudie" },
  { period: "7", periodStart: 7, periods: [7], klas: "8A", absent: "Mevr. Wouters", substitute: "Dhr. Verhoeven", lokaal: "B11" , content: "Studie" },
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
  {
    id: "fundraiser",
    title: "Wafelverkoop 6A",
    body: "Steun de bosklassen — vrijdag aan de schoolpoort, €1 per wafel.",
    imageUrl: "/demo-fundraiser.svg",
    cover: true,
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

/**
 * A play in its announcement window. The poster is a local placeholder so the
 * layout can be checked without a Drive link; real ones come from the sheet.
 */
export const demoEvents: EventItem[] = [
  {
    id: "demo-play",
    klas: "Klas 100",
    title: "Een Midzomernachtsdroom",
    synopsis:
      "Vier geliefden, een groep amateurtoneelspelers en een bos vol elfen — Shakespeare's zomerkomedie, gespeeld door onze eigen klas 100. Kaarten aan het onthaal.",
    date: "2026-09-17",
    whenLabel: "Donderdag 17 september · 20u00",
    posterUrl: "/demo-poster.svg",
  },
];

/** Shown when `?occasion=1` is in the URL, to preview the special occasion board. */
export const demoSpecialOccasion: SpecialOccasion = {
  eventDate: "2026-08-03",
  eventDateLabel: "Maandag 3 augustus 2026",
  title: "Sportdag",
  entries: [
    {
      timeFrom: "08:00",
      timeTo: "09:30",
      timeFromMinutes: 8 * 60,
      timeToMinutes: 9 * 60 + 30,
      activity: "Opening",
      location: "Aula",
    },
    {
      timeFrom: "09:30",
      timeTo: "11:00",
      timeFromMinutes: 9 * 60 + 30,
      timeToMinutes: 11 * 60,
      activity: "100m loop",
      location: "Sportveld",
    },
    {
      timeFrom: "11:00",
      timeTo: "11:15",
      timeFromMinutes: 11 * 60,
      timeToMinutes: 11 * 60 + 15,
      activity: "Pauze",
      location: "Cafetaria",
    },
    {
      timeFrom: "11:15",
      timeTo: "12:30",
      timeFromMinutes: 11 * 60 + 15,
      timeToMinutes: 12 * 60 + 30,
      activity: "Estafette",
      info: "Groepen A–D",
      location: "Sportveld",
    },
    {
      timeFrom: "12:30",
      timeTo: "13:30",
      timeFromMinutes: 12 * 60 + 30,
      timeToMinutes: 13 * 60 + 30,
      activity: "Lunch & vrij spel",
      info: "Meegebracht",
      location: "Terras",
    },
    {
      timeFrom: "13:30",
      timeTo: "15:00",
      timeFromMinutes: 13 * 60 + 30,
      timeToMinutes: 15 * 60,
      activity: "Slotsprint & prijsuitreiking",
      location: "Sportveld",
    },
  ],
};

/** Shown full-screen by `?takeover=1`, to preview the Big Slide layout. */
export const demoBigSlidePreview: BoardMessage = {
  id: "preview-bigslide",
  title: "Fijn weekend!",
  body: "Maandag starten we om 8u40 met een gezamenlijke opening in de aula.",
};
