"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BigSlide, bigSlideTone } from "./BigSlide";
import { BirthdayZone } from "./BirthdayZone";
import { Blackout } from "./Blackout";
import { BoardControls } from "./BoardControls";
import { BurstProgress } from "./BurstProgress";
import { LogoMark } from "./LogoMark";
import { Clock } from "./Clock";
import { CycleTrack } from "./CycleTrack";
import { EventPoster } from "./EventPoster";
import { KeyPanel } from "./KeyPanel";
import { KEY_PANEL_THRESHOLD } from "./keys-shared";
import { MessageLoop } from "./MessageLoop";
import { SpecialOccasionBoard } from "./SpecialOccasionBoard";
import { SubstitutionBoard } from "./SubstitutionBoard";
import { useBlackout } from "./useBlackout";
import { useIdlePointer } from "./useIdlePointer";
import { BUILD } from "@/lib/build";
import type { BoardData, BoardMessage, SpecialOccasion } from "@/lib/types";

const POLL_MS = 30_000;

/**
 * Above this many substitutions the dashboard reflows: the board takes a
 * full-height left column and the message + birthday zones stack on the right,
 * so a busy day's rows stay readable instead of shrinking.
 */
const SUBS_WIDE_THRESHOLD = 8;
/** Rows that fit at full size once the board owns the full height. */
const WIDE_COMFORTABLE_ROWS = 9;
/** Rows that fit at full size on a full-screen special occasion (no chrome). */
const FULLSCREEN_COMFORTABLE_ROWS = 11;
/** After this long without a successful poll, tell the room the data is old. */
const STALE_MS = 5 * 60_000;
const CACHE_KEY = "infoborden:board";
/** Which server state this tab has already reloaded for — see useBuildReload. */
const RELOADED_KEY = "infoborden:reloaded-for";

type Interrupt = "keys" | "event" | "bigslide" | "specialoccasion";

/** One turn of the full-screen "Permanent" rotation — see `permanentItems`. */
type PermanentItem =
  | { kind: "slide"; slide: BoardMessage }
  | { kind: "occasion"; occasion: SpecialOccasion };

/** Modulo that wraps negatives forward — the rotation can be stepped back. */
const mod = (n: number, m: number) => ((n % m) + m) % m;

function readCache(): BoardData | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as BoardData) : null;
  } catch {
    return null;
  }
}

/**
 * Pick up a new deploy without anyone walking to the display Pis.
 *
 * A kiosk loads the board once and stays on it for months: the poll refreshes
 * *data*, so an update on the host reaches the screens' markup and JavaScript
 * never. This closes that gap — when what the server reports stops matching
 * what this page was rendered from, the screen reloads itself.
 *
 * "What it was rendered from" is the build *and* whether the build stamp was
 * showing, since that's server-rendered too: without it here, switching the
 * stamp off would leave it on the wall until something else happened to reload
 * the screen.
 *
 * It waits for a quiet moment (no full-screen burst) so nobody watches a
 * message vanish mid-sentence, and it reloads at most once per distinct server
 * state, so a mismatch that a reload can't fix — a proxy serving cached markup,
 * say — leaves a working board on the wall instead of a screen flashing every
 * 30 seconds forever.
 */
function useBuildReload(serverState: string, ownState: string, quiet: boolean) {
  useEffect(() => {
    if (!serverState || serverState === ownState || !quiet) return;
    try {
      if (window.sessionStorage.getItem(RELOADED_KEY) === serverState) return;
      window.sessionStorage.setItem(RELOADED_KEY, serverState);
    } catch {
      // No session storage, so no loop guard. Still reload: a screen running
      // stale code is the certain problem, the loop only a possible one.
    }
    window.location.reload();
  }, [serverState, ownState, quiet]);
}

/** The two server-rendered things a screen can fall behind on. */
const stateKey = (build: string, stampVisible: boolean) =>
  `${build}|${stampVisible ? "stamp" : "nostamp"}`;

function writeCache(data: BoardData) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or a full quota — the board works fine without the cache.
  }
}

export function BoardShell({
  initial,
  screenId,
  forceKeyPanel = false,
  forceEvent = false,
}: {
  initial: BoardData;
  screenId: string;
  /** Preview: hold the key panel on screen instead of cycling it. */
  forceKeyPanel?: boolean;
  /** Preview: hold the event poster on screen instead of cycling it. */
  forceEvent?: boolean;
}) {
  const [data, setData] = useState<BoardData>(initial);
  const [stale, setStale] = useState(false);
  // Tracked apart from `data` because the cache below can restore a payload
  // from an older build, and a build this screen read off its own disk says
  // nothing about what the host is serving now.
  const [serverState, setServerState] = useState(
    stateKey(initial.build, initial.buildStampVisible),
  );
  const lastOkRef = useRef<number>(Date.now());
  const idle = useIdlePointer();
  const blackedOut = useBlackout(data.blackout);
  const [showing, setShowing] = useState<Interrupt | null>(null);
  // Bursts begun since the rotation was armed; -1 before the first one. Which
  // item a kind is up to is derived from it below rather than counted per kind,
  // which is what lets the controls step backwards: turn - 1 is the item that
  // just played, every time.
  const [turn, setTurn] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [cycleAnchor, setCycleAnchor] = useState<number | null>(null);
  const [permIndex, setPermIndex] = useState(0);

  const manyKeys = data.keys.length > KEY_PANEL_THRESHOLD;
  const event = data.events[0] ?? null;

  // Pace comes from the Settings tab, so staff can retune the board live.
  const fullScreenMs = data.timing.fullScreenSec * 1000;
  const interruptEveryMs = data.timing.fullScreenIntervalSec * 1000;

  // Theme + accent are resolved server-side per screen (Settings tab); applied
  // on the root of every layout so the whole screen — including a takeover —
  // themes together. Refreshed by the poll, so a sheet change lands within 30s.
  const root = {
    "data-theme": data.appearance.theme,
    "data-accent": data.appearance.accent,
    "data-idle": idle,
  } as const;

  /*
   * Everything marked "Permanent" — Big Slide messages and special occasions
   * alike — holds the whole screen for its window. One of them simply stays up;
   * several take turns at the full-screen pace, so marking a second one doesn't
   * quietly bury it behind the first. Slides lead the lap, keeping the older
   * "a Permanent Big Slide comes first" order.
   */
  const permanentItems: PermanentItem[] = [
    ...data.permanentSlides.map((slide) => ({ kind: "slide", slide }) as const),
    ...data.permanentSpecialOccasions.map(
      (occasion) => ({ kind: "occasion", occasion }) as const,
    ),
  ];
  const permanentCount = permanentItems.length;
  const permanentItem = permanentCount
    ? permanentItems[mod(permIndex, permanentCount)]
    : null;
  /*
   * One item just holds, and a day of exactly that is the common case — nothing
   * is coming, so there is nothing to pace, count out or wait for. Everything
   * below hangs off this: the drain, the transport and the timer all exist only
   * once a second item makes the screen a rotation rather than a poster.
   */
  const permanentCycles = permanentCount > 1;
  const periodicSlides = data.periodicSlides;

  // A timeout per item rather than one interval, so stepping by hand restarts
  // the dwell instead of landing mid-way through somebody else's tick.
  useEffect(() => {
    if (!permanentCycles || paused) return;
    const timer = setTimeout(() => setPermIndex((i) => i + 1), fullScreenMs);
    return () => clearTimeout(timer);
  }, [permanentCycles, paused, permIndex, fullScreenMs]);

  /*
   * One rotation drives every interruption. Two independent timers would
   * eventually fire together and fight over the screen; taking turns also
   * means adding a third kind later costs nothing.
   *
   * While a lot of keys are still outstanding, the key list takes the
   * substitution board's place here too — short and periodic rather than
   * standing, since the substitution board is what people come for, and a
   * student passing at any point still catches the reminder within a few
   * minutes. Once only a handful are left it drops to the messages zone.
   */
  const queue: Interrupt[] = [];
  if (manyKeys) queue.push("keys");
  if (event) queue.push("event");
  if (periodicSlides.length) queue.push("bigslide");
  if (data.periodicSpecialOccasions.length) queue.push("specialoccasion");
  const queueKey = queue.join(",");

  /*
   * Turns in one full lap — what CycleTrack counts out along the bottom edge.
   * Each turn shows one kind's *next* item, so seeing every distinct item takes
   * a turn per kind times the largest kind: two Big Slides and two occasions
   * come round as slide, occasion, slide, occasion — four turns, not two.
   */
  const kindCounts: Record<Interrupt, number> = {
    keys: 1,
    event: 1,
    bigslide: periodicSlides.length,
    specialoccasion: data.periodicSpecialOccasions.length,
  };
  const cycleTurns = queue.length
    ? queue.length * Math.max(...queue.map((kind) => kindCounts[kind]))
    : 0;

  /*
   * The shape of one turn: a burst, then whatever is left of the interval back
   * on the dashboard. With Full Screen Time ≥ the interval there is no
   * dashboard time in a turn at all and the bursts run back to back — the
   * burst is capped rather than allowed to run into the next one.
   */
  const burstMs = Math.min(fullScreenMs, interruptEveryMs);
  const restMs = Math.max(0, interruptEveryMs - burstMs);

  // Re-arm when a kind appears or vanishes, or staff retune the pace. Any burst
  // still up goes with it: its timer died with the old effect, and without this
  // it would hold the screen until the next tick. The lap the bottom hairline
  // draws starts here too — with the dashboard, one interval before turn 0.
  useEffect(() => {
    setShowing(null);
    setTurn(-1);
    setCycleAnchor(queueKey ? Date.now() : null);
  }, [queueKey, fullScreenMs, interruptEveryMs]);

  /*
   * One timer walks the whole rotation, alternating burst and dashboard.
   *
   * Primitive deps only — `queue` is rebuilt every render and the 30-second
   * poll re-renders even when nothing changed, so depending on its identity
   * would restart the phase on every poll and freeze the rotation.
   */
  useEffect(() => {
    if (!queueKey || paused) return;
    const due = queueKey.split(",") as Interrupt[];
    // The screen opens on the dashboard and waits a whole interval for its
    // first interruption; later dashboard spells are the rest of a turn.
    const delay = showing ? burstMs : turn < 0 ? interruptEveryMs : restMs;
    const timer = setTimeout(() => {
      // With no dashboard time left in the turn, one burst hands straight to
      // the next rather than blinking the board up for a frame between them.
      if (showing && restMs > 0) {
        setShowing(null);
        return;
      }
      const next = turn + 1;
      setTurn(next);
      setShowing(due[mod(next, due.length)]);
    }, delay);
    return () => clearTimeout(timer);
  }, [queueKey, paused, showing, turn, burstMs, restMs, interruptEveryMs]);

  /*
   * Where the hairline's lap has to start for its line to reach turn `t`'s dot
   * exactly as that turn's burst begins, `inMs` from now. Every manual jump
   * re-phases it through here, so a skipped-to burst still lands on a dot and
   * the line keeps meaning what it means on the wall. Turn `t` sits `t`
   * intervals into the lap, plus the one the lap opens with on the dashboard.
   */
  const anchorFor = useCallback(
    (t: number, inMs = 0) =>
      cycleTurns === 0
        ? // A permanent-only day has no interruption lap to phase against, and
          // the hold button still reaches this on its way past.
          Date.now()
        : Date.now() + inMs - mod(t + 1, cycleTurns) * interruptEveryMs,
    [cycleTurns, interruptEveryMs],
  );

  /** Put turn `t` on screen now, wherever the rotation had got to. */
  const jump = useCallback(
    (t: number) => {
      const due = queueKey ? (queueKey.split(",") as Interrupt[]) : [];
      if (due.length === 0) return;
      setTurn(t);
      setShowing(due[mod(t, due.length)]);
      setCycleAnchor(anchorFor(t));
    },
    [anchorFor, queueKey],
  );

  /**
   * Back to the dashboard, with the rest of this turn to read it in. No button
   * of its own: prev/next and the hold cover what a desk viewer actually wants,
   * and a burst hands the screen back inside Full Screen Time regardless. It
   * earns a key for the one case that timer can't cover — a burst held on
   * pause, where resuming restarts it in full rather than letting it run out.
   */
  const toBoard = useCallback(() => {
    setShowing(null);
    setCycleAnchor(anchorFor(turn + 1, restMs));
  }, [anchorFor, restMs, turn]);

  const togglePause = useCallback(() => {
    if (!paused) {
      setPaused(true);
      return;
    }
    // Resuming restarts the phase that's on screen — a burst held halfway gets
    // read from the top rather than snatched away — so the lap is re-phased
    // onto it, and the hairline picks up where the rotation actually is.
    setPaused(false);
    setCycleAnchor(showing ? anchorFor(turn) : anchorFor(turn + 1, restMs));
  }, [anchorFor, paused, restMs, showing, turn]);

  /*
   * Keys act on whatever is on screen: during a takeover the arrows step this
   * rotation, and on the dashboard the message zone already owns them. Space
   * holds the board either way — nothing else on the page uses it, bar a
   * focused button, which keeps it.
   */
  useEffect(() => {
    if (cycleTurns === 0 && !permanentCycles) return;
    // Nothing on screen to act on during standby, and a Space pressed at a
    // black screen would otherwise leave the board paused for the morning.
    if (blackedOut) return;
    const onKey = (press: KeyboardEvent) => {
      const onButton =
        press.target instanceof HTMLElement && press.target.closest("button");
      if (press.key === " " && !onButton) {
        press.preventDefault();
        togglePause();
        return;
      }
      if (permanentCycles) {
        // A permanent day has no dashboard to come back to, so the arrows are
        // free to step its lap and Esc has nothing to do.
        if (press.key === "ArrowRight") setPermIndex((i) => i + 1);
        if (press.key === "ArrowLeft") setPermIndex((i) => i - 1);
        return;
      }
      if (!showing) return;
      if (press.key === "ArrowRight") jump(turn + 1);
      if (press.key === "ArrowLeft") jump(turn - 1);
      if (press.key === "Escape") toBoard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blackedOut, cycleTurns, jump, permanentCycles, showing, toBoard, togglePause, turn]);

  /**
   * Which item of its kind turn `t` shows. Each turn takes one kind's next
   * item, so a kind advances once per lap of the queue — and stepping the turn
   * back steps the item back with it.
   */
  const itemAt = (t: number) => Math.floor(t / Math.max(1, queue.length));

  // Swaps into the substitution board's slot; everything else stays put.
  const showKeys =
    (showing === "keys" || forceKeyPanel) && data.keys.length > 0;
  const showEvent = (showing === "event" || forceEvent) && event !== null;
  const periodicSlide =
    showing === "bigslide" && periodicSlides.length > 0
      ? periodicSlides[mod(itemAt(turn), periodicSlides.length)]
      : null;

  // Special occasions follow the same three-way logic as Big Slide messages.
  // "Permanent" holds the whole screen for its window (in the rotation above);
  // "Yes" bursts full-screen on its turn in the rotation; "No" replaces the
  // substitution board inline, keeping the header and message strip.
  // ?occasion=1 previews the inline form, which is where the demo occasion lands.
  const periodicOccasion =
    data.periodicSpecialOccasions.length > 0 && showing === "specialoccasion"
      ? data.periodicSpecialOccasions[
          mod(itemAt(turn), data.periodicSpecialOccasions.length)
        ]
      : null;
  const inlineOccasion = data.specialOccasions[0] ?? null;

  // Past this many substitutions the top-65%-tall board gets cramped, so the
  // layout reflows to give it the full height (see the two return branches).
  // Never while the key panel or an inline occasion is in the main area.
  const wideSubs =
    !showKeys &&
    !inlineOccasion &&
    !data.substitutionsUnavailable &&
    data.substitutions.length > SUBS_WIDE_THRESHOLD;

  const poll = useCallback(async () => {
    try {
      // Carry the page's own query through (so a preview survives the poll) and
      // add the screen id, so the poll gets this screen's settings/appearance.
      const params = new URLSearchParams(window.location.search);
      params.set("screen", screenId);
      const res = await fetch(`/api/board?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as BoardData;
      setData(next);
      setServerState(stateKey(next.build, next.buildStampVisible));
      writeCache(next);
      lastOkRef.current = Date.now();
      setStale(false);
    } catch {
      // Keep the last good render on screen; only flag how old it is.
      setStale(Date.now() - lastOkRef.current > STALE_MS);
    }
  }, [screenId]);

  // If the server itself failed to reach the Sheet, fall back to the last copy
  // this screen saw today rather than showing an empty board. Keyed on the
  // explicit failure flag, not on an empty list — a genuinely quiet day must
  // not resurrect rows that were deleted from the sheet earlier today.
  useEffect(() => {
    if (!initial.substitutionsUnavailable) {
      writeCache(initial);
      return;
    }
    const cached = readCache();
    if (cached && cached.date === initial.date && cached.substitutions.length) {
      setData(cached);
      setStale(true);
    }
  }, [initial]);

  useEffect(() => {
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  /*
   * One cluster, dropped into whichever layout is on screen — a takeover is a
   * different <main>, and the controls have to reach the teacher there most of
   * all.
   */
  /*
   * The same cluster over the permanent lap. Its own handlers, because that lap
   * is a plain ring of items with no dashboard between them: every item is on
   * screen when its turn comes, so no dot is ever merely "next up".
   */
  const permanentControls = (tone: "accent" | "light" = "accent") => (
    <BoardControls
      turns={permanentCount}
      index={mod(permIndex, permanentCount)}
      paused={paused}
      idle={idle}
      tone={tone}
      onPrev={() => setPermIndex((i) => i - 1)}
      onNext={() => setPermIndex((i) => i + 1)}
      onJump={(i) => setPermIndex((p) => p - mod(p, permanentCount) + i)}
      onTogglePause={togglePause}
    />
  );

  const controls = (tone: "accent" | "light" = "accent") => {
    if (cycleTurns === 0) return null;
    /*
     * The ring is every screen this board shows, the dashboard included: dot
     * one is the board itself, the rest are the interruptions of the lap the
     * rotation is on. The dashboard has to be a station and not merely the gap
     * between them — the substitutions are what most people came to read, and
     * with the arrows walking burst to burst they were the one screen you
     * could not ask for.
     *
     * The rotation's own pacing is untouched: it still drops back to the
     * dashboard between bursts. This is about reaching it by hand.
     */
    const stations = cycleTurns + 1;
    const lapBase = turn < 0 ? 0 : Math.floor(turn / cycleTurns) * cycleTurns;
    const station = showing ? 1 + mod(turn, cycleTurns) : 0;
    const go = (to: number) => {
      const next = mod(to, stations);
      if (next === 0) toBoard();
      else jump(lapBase + next - 1);
    };

    return (
      <BoardControls
        turns={stations}
        index={station}
        home
        paused={paused}
        idle={idle}
        tone={tone}
        onPrev={() => go(station - 1)}
        onNext={() => go(station + 1)}
        onJump={go}
        onTogglePause={togglePause}
      />
    );
  };

  // Between bursts, so a deploy never cuts a full-screen message in half. The
  // page's own state is the build it was compiled from plus the stamp setting
  // it was rendered with — not the current payload, which the poll updates.
  useBuildReload(
    serverState,
    stateKey(BUILD, initial.buildStampVisible),
    blackedOut || (showing === null && !paused),
  );

  // Anything "Permanent" holds the whole screen for its window — it outranks
  // everything else, since it was set for exactly these days on purpose. A
  // permanent occasion drops the header and message strip too: the day's
  // schedule is the point.
  /*
   * Standby outranks every other layout, a permanent takeover included. The
   * whole point is a dark hall after hours, and a message nobody is there to
   * read is not a reason to light one. Returning here rather than laying black
   * over the board also unmounts the zones, so the rotations aren't quietly
   * cycling to an empty corridor all night — and the morning starts on the
   * first message rather than wherever the night left off.
   *
   * Moving a pointer lifts it (see `useBlackout`), so the teacher who opens
   * this URL from home in the evening gets the board, not the black.
   */
  if (blackedOut) {
    return (
      <Blackout
        wakesAtMin={data.blackout?.endMin ?? null}
        screenName={data.screenName}
        screenId={screenId}
      />
    );
  }

  if (permanentItem) {
    const tone =
      permanentItem.kind === "slide"
        ? bigSlideTone(permanentItem.slide)
        : "accent";
    /*
     * Only once several of them share the screen. A lone permanent item is
     * going nowhere, so a drain would count down to a return that never comes
     * and a transport would offer to step a lap of one — but a day built out
     * of nothing but permanent occasions is a rotation like any other, and
     * from a corridor it is the same question as always: is another one
     * coming, and how long do I stand here?
     *
     * Keyed on the item so the drain starts afresh each turn rather than
     * carrying on from wherever the last one left it.
     */
    const pacing = permanentCycles && (
      <>
        {!paused && (
          <BurstProgress
            key={permIndex}
            seconds={data.timing.fullScreenSec}
            tone={tone}
          />
        )}
        {permanentControls(tone)}
      </>
    );

    return permanentItem.kind === "slide" ? (
      <main
        className="kiosk relative h-screen w-screen overflow-hidden bg-bg text-text"
        {...root}
      >
        <BigSlide message={permanentItem.slide} />
        {pacing}
      </main>
    ) : (
      <main
        className="kiosk relative flex h-screen w-screen flex-col overflow-hidden bg-bg p-[1.2rem] text-text"
        {...root}
      >
        <SpecialOccasionBoard
          occasion={permanentItem.occasion}
          boardDate={data.date}
          comfortableRows={FULLSCREEN_COMFORTABLE_ROWS}
          fullscreen
        />
        {pacing}
      </main>
    );
  }

  // A "Yes" Big Slide bursts full-screen on its turn in the rotation.
  if (periodicSlide) {
    return (
      <main
        className="kiosk relative h-screen w-screen overflow-hidden bg-bg text-text"
        {...root}
      >
        <BigSlide message={periodicSlide} />
        {/* A held burst has no time left to run: the bar would be counting
            down to nothing, so the controls carry the paused state instead. */}
        {!paused && (
          <BurstProgress
            seconds={burstMs / 1000}
            tone={bigSlideTone(periodicSlide)}
          />
        )}
        {controls(bigSlideTone(periodicSlide))}
      </main>
    );
  }

  // A "Yes" special occasion bursts full-screen on its turn in the rotation.
  if (periodicOccasion) {
    return (
      <main
        className="kiosk relative flex h-screen w-screen flex-col overflow-hidden bg-bg p-[1.2rem] text-text"
        {...root}
      >
        <SpecialOccasionBoard
          occasion={periodicOccasion}
          boardDate={data.date}
          comfortableRows={FULLSCREEN_COMFORTABLE_ROWS}
          fullscreen
        />
        {!paused && <BurstProgress seconds={burstMs / 1000} />}
        {controls()}
      </main>
    );
  }

  if (showEvent && event) {
    return (
      <main
        className="kiosk relative h-screen w-screen overflow-hidden bg-bg text-text"
        {...root}
      >
        <EventPoster event={event} />
        {/* Not under `forceEvent`: the preview holds the poster indefinitely,
            so neither a draining bar nor a transport would be telling the
            truth about what the rotation is doing. */}
        {showing === "event" && (
          <>
            {!paused && <BurstProgress seconds={burstMs / 1000} />}
            {controls()}
          </>
        )}
      </main>
    );
  }

  return (
    <main
      className="kiosk relative flex h-screen w-screen flex-col gap-[1rem] overflow-hidden bg-bg p-[1.2rem] text-text"
      {...root}
    >
      <header className="flex h-[4.6rem] shrink-0 items-center justify-between rounded-lg border-[0.075rem] border-line bg-surface-1 px-[1.6rem]">
        <div className="flex items-center gap-[1rem]">
          <LogoMark
            logoUrl={data.style.logoUrl}
            className="h-[2.6rem] w-auto"
          />
          <div className="flex flex-col justify-center leading-none">
            <span className="eyebrow text-[0.75rem]">
              {data.style.schoolName ?? "Steinerschool Gent"}
            </span>
            <span className="font-display text-[1.9rem] font-bold leading-tight">
              {data.dateLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[1.1rem]">
          {data.demo && (
            <span className="rounded-sm bg-surface-2 px-[0.8rem] py-[0.3rem] font-mono text-[0.75rem] uppercase tracking-[0.08em] text-muted">
              Demo-data
            </span>
          )}
          {stale && (
            <span className="animate-pulse-soft rounded-sm bg-alert-bg px-[0.8rem] py-[0.3rem] font-mono text-[0.75rem] uppercase tracking-[0.08em] text-alert">
              Geen verbinding
            </span>
          )}
          <span className="eyebrow text-[0.75rem]">
            {data.screenName ?? `Scherm ${screenId}`}
          </span>
          <Clock />
        </div>
      </header>

      {wideSubs ? (
        /*
         * Busy day: the board takes a full-height left column so its rows stay
         * large instead of shrinking, and the message and birthday zones stack
         * in a column on the right.
         */
        <div className="flex min-h-0 flex-1 gap-[1rem]">
          <SubstitutionBoard
            substitutions={data.substitutions}
            schedule={data.schedule}
            unavailable={data.substitutionsUnavailable}
            comfortableRows={WIDE_COMFORTABLE_ROWS}
          />
          <div className="flex w-[28%] shrink-0 flex-col gap-[1rem]">
            <MessageLoop
              messages={data.messages}
              keyDuties={manyKeys ? [] : data.keys}
              durationSec={data.timing.messageCycleSec}
              tall
            />
            <BirthdayZone
              birthdays={data.birthdays}
              className="w-full shrink-0"
            />
          </div>
        </div>
      ) : (
        <>
          {inlineOccasion ? (
            <SpecialOccasionBoard occasion={inlineOccasion} boardDate={data.date} />
          ) : showKeys ? (
            <KeyPanel duties={data.keys} />
          ) : (
            <SubstitutionBoard
              substitutions={data.substitutions}
              schedule={data.schedule}
              unavailable={data.substitutionsUnavailable}
            />
          )}

          <div className="flex h-[12rem] shrink-0 gap-[1rem]">
            <MessageLoop
              messages={data.messages}
              // Only once the list is short enough to read here; while it's long
              // the main-area panel carries it instead.
              keyDuties={manyKeys ? [] : data.keys}
              durationSec={data.timing.messageCycleSec}
            />
            <BirthdayZone birthdays={data.birthdays} />
          </div>
        </>
      )}

      {/* Nothing interrupts this screen — no cycle to draw. */}
      {cycleTurns > 0 && cycleAnchor !== null && (
        <CycleTrack
          turns={cycleTurns}
          periodSec={cycleTurns * data.timing.fullScreenIntervalSec}
          anchor={cycleAnchor}
          paused={paused}
        />
      )}
      {controls()}
    </main>
  );
}
