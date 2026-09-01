# Easy Signage for Schools — Infoborden

Frontend display for the school info boards described in [SPEC.md](SPEC.md).
Replaces PiSignage: a fixed dashboard — substitutions, messages, birthdays,
classroom keys, events — not a slideshow.

**All of it is driven by one Google Sheet.** Each feature reads its own tab, so
staff maintain everything in a tool they already know and there is no admin UI,
database or login to build or run.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | **Next.js 16 (App Router) + TypeScript** | The board pages and the JSON API in one deployable. One `npm run build`. |
| Styling | **Tailwind CSS v4 + Steinerschool Gent tokens** | Brand colours, Averia typeface and the organic radii live as CSS variables in `app/globals.css`. |
| Data | **Google Sheets API v4** (read-only, service account) | One sheet, one tab per feature. Staff edit a sheet they already know; nothing to run. |
| Images | **Google Drive links** | Posters/artwork are Drive share links, rewritten to direct images by the reader. No upload pipeline. |
| Hosting | **On the school LAN** (Next standalone — on a Pi/Mac/Windows server, or on the display Pi itself) | Student names never leave the building. See [`docs/install.md`](docs/install.md). |
| Screens | **Raspberry Pi + cage** kiosk | Pi OS Lite boots straight into one full-screen Chromium. No desktop. |

Deliberately *not* used: no state manager, no component library, no CMS, no
database, no WebSocket layer. Three screens polling a JSON endpoint every 30s is
well inside what one small host handles.

## What's built

Everything in the spec, all reading from the sheet:

- `/screen/1`, `/screen/2`, `/screen/3` — the board. The same content
  everywhere, bar the standby roster, which is for the staff room's screen; the
  screen number only shows in the status bar.
- `/api/board` — the single JSON payload the board polls.
- `/` — index with links to each screen and to every preview below.

Substitutions, messages, birthdays, classroom keys, events, the standby roster
and full-screen Big Slide takeovers all come from their sheet tabs. With
`SHEET_ID` unset the board runs on `lib/demo-data.ts` and shows a **Demo-data**
badge; set it and the badge disappears.

Each screen's **pace** is staff-set too — how long a notice holds the message
zone, how often a full-screen item interrupts, and how long it stays — and a
hairline along the bottom edge shows where the screen is in that cycle. Open the
same URL on a laptop and you can step through that cycle or hold it, at your own
pace instead of the corridor's. So are its **standby hours**, which black the
board out overnight — on the wall, at least; move a pointer and the board stays
up for you. See [Per-screen settings](#per-screen-settings),
[Standby hours](#standby-hours) and
[One interruption at a time](#one-interruption-at-a-time).

**Previews** (also linked from `/`), appended to a screen URL:

| Query | Shows |
| --- | --- |
| `?now=11:20` (or `?now=wed+12:45`) | the "now" marker frozen at a chosen time |
| `?date=2026-09-02` | the board for another school day |
| `?theme=dark`, `?accent=blue`/`gold` | theme / accent overrides |
| `?keypanel=1`, `?keys=3` | the classroom-key panel / the in-rotation key card |
| `?piket=1` | the standby roster, on any screen and without waiting for its turn |
| `?event=1` | the event poster (sample if none scheduled) |
| `?takeover=1` | a Big Slide full-screen takeover (sample) |
| `?occasion=1` | the special-occasion board (sample if none scheduled) |
| `?build=1`, `?build=0` | force the corner build stamp on / off for this screen |
| `?blackout=1`, `?blackout=0` | force the standby black screen on / off for this screen |

### Look & feel

The board is built on the **Steinerschool Gent brand & style guide**:

- **Colour** — Coral `#EC674A`, Gold `#D99A22`, Blue `#51A3C4` with the guide's
  100/300/500/700/900 ramps, on warm neutrals. The **accent** (coral by default)
  carries the substitution row — lesson periods, the task pill, the room and the
  **Info volgt** chip — plus headings; **gold** owns the birthday card. All three
  appear in the logo mark. Switch the accent to gold or blue and every accented
  element follows.
- **Type** — Averia Sans Libre for display, headings, periods and the clock;
  system sans for body copy; monospace eyebrows for column labels. The font is
  self-hosted at build time (`next/font`), so a flaky line can't strip the
  school's typeface off the screen.
- **Shape** — *"Afgerond, niet afgesneden."* No 90° corners anywhere. The
  guide's irregular hand-made radius is reserved for the large surfaces — the
  header and the big panels — where it reads as deliberate; small chips and row
  shading get a plain even radius, since repeating the asymmetry at that scale
  turned into noise and fought the data. The birthday card and the text-only Big
  Slide carry the off-kilter blob from the feature-card pattern.

Both are settings, not media queries — a kiosk has nobody to prefer anything:

| Setting | Values | Default |
| --- | --- | --- |
| `THEME` | `light`, `dark` | `light` |
| `ACCENT` | `coral`, `gold`, `blue` | `coral` |

Set them in the environment for the whole deployment, or override a single
screen with `?theme=dark` / `?accent=blue` on its URL — handy for the one screen
in the dark corridor.

### The "now" marker

The period currently being taught is filled with the accent in the **Lesuur**
column, with a bar that fills as the lesson runs — so the board says both which
row is live and how far into it we are. A block like "1 & 2" stays marked
through both periods. During the middagpauze the divider itself lights up
instead.

The timetable comes from the `Schedule` tab (falling back to a built-in default when the tab is absent):

| | | | |
| --- | --- | --- | --- |
| 1 | 08:50–09:40 | 5 | 13:20–14:10 |
| 2 | 09:40–10:30 | 6 | 14:10–15:00 |
| *kleine pauze* | 10:30–10:50 | *kleine pauze* | 15:00–15:10 |
| 3 | 10:50–11:40 | 7 | 15:10–16:00 |
| 4 | 11:40–12:30 | 8 | 16:00–16:50 |
| *middagpauze* | 12:30–13:20 | | |

The board draws a divider line only for breaks whose **Toon pauzelijn** is
ticked (the middagpauze here), named as in the sheet. A school with fewer
substitutions can tick more breaks to show their lines too. Wednesday ends after
period 4 (still a code constant). Outside school hours nothing is marked, and
the marker reads the Pi's own clock, so it stays right even on cached data.

Append `?now=11:20` (or `?now=wed+12:45`) to a screen URL to freeze it at
another moment and see how it will look without waiting for the day.

### Timetable (`Schedule` tab)

One row per slot, in time order. `Lesuur` is a **period number** for a lesson or
a **break name** for a break; `Starttijd`/`Eindtijd` are `H:MM`; `Toon pauzelijn`
ticks whether that break shows a divider on the board. The board reads it for
both the "now" marker and the divider lines, so adjusting bells or moving the
divider is a sheet edit — no redeploy. A break's position is taken from its place
in the list (the divider lands after the lesson above it).

### Classroom keys

One student per class collects their classroom key for the weekend and brings it
back after. The front desk already tracks this by ticking a list, so the sheet
*is* the list — the board just shows whoever is still on it.

**How insistent the board gets scales with how much is outstanding**, because
with 22 classes most students need no reminder at all and only the stragglers do:

| Outstanding | What the board does |
| --- | --- |
| More than 6 | Takes the substitution board's area every 3 minutes, for 20 seconds |
| 1 to 6 | A card in the messages rotation, counted in "3 van 4" |
| 0 | Nothing |

Only the main region changes — the header, messages and birthday zones stay
put, so the screen never stops looking like itself. It's deliberately a short
interruption rather than a standing takeover: the substitution board is what
people come to the screen for, and the breaks are when they check it. A student
passing at any point in the day still catches the reminder within a few minutes.

A duty appears once its date arrives and vanishes the moment the front desk
ticks it off, so the board empties itself as they work through the list. Dates
already past and still unticked are flagged **te laat** and sort to the front —
those are the ones worth nagging about. Anything dated in the future stays off
the board.

Sheet tab `Sleutels`, one row per class per weekend — two ticks per row rather
than two separate rows, matching how the desk already works:

| Klas | Leerling | Ophalen | Opgehaald | Terugbrengen | Teruggebracht |
| --- | --- | --- | --- | --- | --- |
| 7A | Jan Janssen | 31/07/2026 | x | 03/08/2026 | |
| 6B | Lotte Verbeeck | 24/07/2026 | x | 27/07/2026 | |

The explicit dates are what make the occasional off-rhythm week work without any
special handling — the usual Friday-out/Monday-back can be prefilled with a
formula. Any non-empty tick counts as done (`x`, `✓`, `ja`, a date); `nee`/`no`
counts as not done.

To see either presentation without waiting for its cycle, append to a screen URL:

- `?keypanel=1` — hold the key panel in the board's main area
- `?keys=3` — trim the list (demo mode only) so the messages-zone card shows
  instead

Both are also linked from the site index at `/`.

### Piketrooster (`Piket` tab)

The standby roster: who is on call per lesson block, so a sudden absence can be
covered. It's the staff room's reference, so it shows **only on the screens
whose `Settings` row says so** — the first content on the board that isn't
identical on all three. A corridor full of students has no use for it.

It's also the one tab with **no dates in it**: one standing week that holds all
year, so nothing rolls over and Monday shows Monday because the board reads the
day, not because anyone moved a row. When a new version is drawn up, staff paste
it over the old one — and because that's the one thing that can go stale
unnoticed, the sheet's own **version line is printed on the wall** beside the
title.

Paste the roster in the shape it's already kept: weekdays across the top, lesson
blocks down the side, the names to call underneath each other. Merged `Lesuur`
cells are fine — a merged cell gives its value on its first row only, which is
exactly the "blank means same as above" the reader expects. A title/version line
above the table is expected too; the weekday header is found, not assumed.

| Lesuur | MAANDAG | DINSDAG | WOENSDAG | DONDERDAG | VRIJDAG |
| --- | --- | --- | --- | --- | --- |
| PERIODE | Anke | Dries | Gitte | Joris | Mien |
| | Bram | Eva | Hugo | Kaat | Noor |
| 3e LESUUR | Puck | Tuur | Yara | Bram | Eva |
| | Rik | Wies | Zeno | Cato | Ferre |

- A block label's **number is its lesson period** — `3e LESUUR` is period 3,
  `1-2` or `1 & 2` both. A named block above the first numbered one (`PERIODE`)
  takes the periods before it, so it marks live through periods 1 and 2.
- An empty cell, a `/` or a `-` all mean **nobody** — Wednesday afternoon, or a
  slot nobody covers. Two names in one cell (`Wim / Marieke`) stay as written.
- **Cell colours don't travel.** The board reads values, not formatting, so
  highlighting a name yellow or red in the sheet changes nothing on the wall. If
  a marking matters there, it has to be in the text.

On screen it's the whole week at once, with the moment doing the pointing:
today's column is raised out of the greyed-out rest, the lesson block that's
running carries the same accent marker and filling bar the substitution board
uses, and where the two meet is the cell that answers "who do I call now".
Every day reads at one type size — today is set in bold on a card per lesson
block, rather than larger, because a column that fills its rows is a column
whose blocks run together, and the grouping is what makes the grid legible. Over
a break no block is live, so the one that starts next is outlined and labelled
**straks** — the middagpauze is when the staff room is fullest and reading
ahead is exactly what's wanted. On a weekend nothing is today, and the five days
read at equal weight.

It takes the screen for its turn in the rotation (see
[One interruption at a time](#one-interruption-at-a-time)) rather than sitting
in the dashboard's main area like the key panel: five days by seven blocks is a
grid, and at the dashboard's size its names came out smaller than anything else
on the board — the one thing a roster on a wall can't be.

#### Who's on, without waiting for the roster's turn

The week needs the screen, but the *one line* off it doesn't — and a sudden
absence is exactly the moment nobody wants to stand in front of a board waiting
for the right slide to come round. So a small **Piket** card sits in the
dashboard's bottom row, between the notices and the birthdays, on the same
screens the roster itself is on:

- **Nu** — the block that's running: every name in the accent, at one size, in
  the sheet's own order and separated by a dot. The order already says who to
  try first, so nothing is set larger to say it twice. The bar under it drains
  over the *whole block*, not the lesson inside it, because what the staff room
  is waiting for is the handover.
- **Straks** — who takes over next, in plain text underneath.

A line of three long names scales itself down rather than dropping the last one:
the third name is exactly the one you reach for when the first two don't answer.

Between lessons nothing is running, so both lines are ones still to come
(**straks** and **daarna**) rather than a name whose hour is over — the same
reading-ahead the full roster does over a break. Blocks nobody covers are
skipped rather than shown empty, so a Wednesday shows its morning and then the
card leaves the row, exactly as the birthday card does on a day with no
birthdays. Once the last lesson of the day has started there's nothing left to
point at, and it goes.

**Not handled yet: swaps on the day.** The roster is the standing arrangement,
so if two people trade a slot this week the board still shows the standing name.
Worth adding a small exceptions block if that turns out to happen often.

### Messages

The rotating notices — pickup calls, reminders, fundraiser posters — come from
the `Mededelingen` tab. Each has an optional show-window, so an item puts itself
up and takes itself down instead of someone remembering to delete it.

| Titel | Tekst | Weergave Startdatum | Weergave Startuur | Weergave Einddatum | Weergave Einduur | Afbeelding | Volledig beeld | Big Slide |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Afhalen | Lotte (7A) … | | | | | | FALSE | No |
| Wafelverkoop 6A | Steun de bosklassen … | 01/09/2026 | | 05/09/2026 | | *(Drive link)* | TRUE | No |
| Oudercontact | Onthaal in de hal. | 05/09/2026 | 17:00 | 05/09/2026 | 20:30 | | | No |
| Fijn verlof! | We zien elkaar terug op 1 september. | 04/07 | | 31/08 | | | | Permanent |

- **Weergave Startdatum / Einddatum** are optional. Blank start = from now;
  blank end = until removed; neither = always shown. Same forgiving date formats
  as the rest.
- **Weergave Startuur / Einduur** are optional too, written `HH:MM`. Each
  sharpens *its own* date into a moment, so a notice can go up at 17:00 and come
  down at 20:30 rather than sitting there from midnight. Leave them blank and
  nothing changes — the item covers its whole days as before.
  - The end hour is exclusive: `20:30` means it's gone *by* 20:30.
  - Over several days, the hours gate only the first and last day. `01/09 10:00`
    → `03/09 11:30` covers the 2nd in full.
  - An hour with no date beside it counts as today's, so it comes back round the
    next day. For a genuine one-off, fill in the date too.
  - Screens re-read the sheet every 30 seconds, so a timed item appears (and
    goes) within half a minute of the hour you set.
- **Afbeelding** is a Drive share link, rewritten to a direct image the same way
  event posters are (share it "anyone with the link").
- **Volledig beeld** is a tickbox (`TRUE`/`x`/`ja`). Ticked *and* with an image,
  the message becomes full-bleed artwork — the picture fills the card and the
  text sits over it on a scrim. Blank, the image is a side thumbnail. Meant for
  fundraiser posters.
- **Big Slide** takes the message *out* of the small card and onto the whole
  screen (using the same artwork/poster/text treatment):
  - blank / `No` — stays a card in the rotation.
  - `Yes` — full-screen in short bursts every few minutes; the dashboard stays
    visible between bursts, like an event poster.
  - `Permanent` — held full-screen for the whole weergave window, hiding the
    dashboard. For "welcome back" / holiday messages where nothing else matters.
    Several at once take turns on that screen — together with any `Permanent`
    special occasion, which holds the screen the same way.
  (Reads `Yes`/`Ja` and `Permanent`/`Vast` loosely; a data-validation dropdown
  keeps it tidy.)

Keep card text short: a card clamps an over-long body with an ellipsis. Long
content belongs on a Big Slide, where a text-only slide left-aligns past a
threshold instead of sprawling in the centre.

### Events and posters

Theatre plays and similar events get the whole screen, in short bursts, because
the artwork is the point — a portrait poster gets the full display height, which
a panel in the dashboard could never give it.

Sheet tab `Evenementen`:

| Datum | Tijd | Toon vanaf | Klas | Titel | Synopsis | Poster |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-17 | 20u00 | 2026-09-03 | Klas 100 | Een Midzomernachtsdroom | Vier geliefden… | *(Drive link)* |

The announcement puts itself up and takes itself down: it appears on
`Toon vanaf` (or two weeks before, if blank) and disappears after the event
date, so nobody has to remember to clear last month's play off the screens.

**Posters** live in Drive. Paste the ordinary Share link — the reader rewrites
it to a direct-image URL. The file must be shared **"anyone with the link"**:
the board's browser is anonymous and doesn't carry the service account's access,
so a restricted file shows as a blank space.

Preview with `?event=1`, which falls back to a sample when nothing is scheduled.

### One interruption at a time

The key panel, the event poster, the standby roster and periodic (`Yes`) Big
Slides share a single rotation rather than running their own timers — independent timers would
eventually fire together and fight over the screen. Every `Full Screen Interval`
(3 minutes by default) the board shows the next one due for `Full Screen Time`,
then returns to the dashboard. Anything marked `Permanent` — a Big Slide message
or a special occasion — outranks all of them: it holds the whole screen for its
window, since it was set for exactly those days on purpose. One of them simply
stays up; several share that screen, swapping every `Full Screen Time`, so
marking a second one doesn't quietly bury it behind the first.

A hairline along the bottom edge of the screen says where in that cycle you are,
so nobody has to guess whether it's worth waiting:

- **During a burst** it drains over `Full Screen Time`. A takeover hides the
  substitution board, which is what most people walked over to read, and
  otherwise there's no telling a five-second interruption from a stuck screen.
  A lone `Permanent` slide or occasion gets no bar — it holds all day, and a
  drain would promise a return that never comes. Several of them do get one:
  once they take turns, the return is real and the question in the corridor is
  the usual one — is another coming, and how long do I stand here?
- **On the dashboard** it carries a dot per interruption and creeps across one
  full lap, so a student can see how many different screens there are and how
  far along they are. A lap is one turn per kind times the largest kind, not one
  per item: two Big Slides and two special occasions come round as slide,
  occasion, slide, occasion — four turns, so four dots' worth of waiting. The
  count re-derives itself as slides come and go through the week.

Both are CSS animations rather than per-frame timers, since three Pis run this
all day.

**From a desk you can drive it.** The corridor's pace isn't a teacher's: three
minutes between interruptions means you either sit out a rotation that isn't for
you, or never see the slide you opened the page to check. So the same URL on a
laptop grows a small transport above the hairline — step through everything the
screen shows, or hold one of them:

| | |
| --- | --- |
| ‹ › | one dot back or on, straight away. Past the last interruption they come back round to the dashboard, so the substitutions are always one step away rather than something to wait out |
| dots | one per screen in the lap, **the dashboard first** — jump straight to any of them. The lit dot is what's up now |
| ⏸ | hold the board — a burst stays up, or the dashboard does. Resuming starts that item over rather than snatching it away half-read |

Four controls, and every one names itself on hover. There's deliberately no
"back to the dashboard" button: a burst hands the screen back inside `Full
Screen Time` on its own, so it would only ever save a few seconds' wait — but
**Esc** does it from the keyboard, which is worth having for the case the timer
doesn't cover, a burst held on pause. Keys otherwise act on whatever is on
screen: **space** holds and releases, and during a takeover **← / →** step it.
On the dashboard the arrows stay with the message zone, which is what they're
pointing at there.

The pill and the hairline count different things, deliberately: the hairline is
a clock, marking when each interruption falls in the lap, while the pill is a
list of screens — the dashboard included, since by hand it is a destination
rather than the gap between two others.

Held, the hairline freezes rather than running on empty, and a burst drops its
draining bar — there's no time left to count down. A jump re-phases the lap, so
the line still arrives at a dot exactly when the next interruption does.

A day built out of nothing but `Permanent` items — several special occasions and
no reason for anything else on screen — is a rotation like any other, so it gets
the same transport over its own lap — with no dashboard dot, because on such a
day there is no dashboard to go back to: a dot per item, arrows, and a hold. A single
`Permanent` item gets neither that nor a drain, which is the whole point of it:
nothing is coming, so there is nothing to pace or wait for.

None of this reaches the wall. It renders only where there's a mouse to move —
a Pi and a touch panel don't even have the buttons in the page, so nothing can
be tapped by accident — and it fades with the cursor after three still seconds.
The board also won't [reload itself for a new build](#display-behaviour) while
someone is holding it.

### Birthdays

The whole-school birthday list lives in the sheet, imported once at the start of
the year and topped up by hand as students arrive. The board shows whoever has a
birthday today — matched on **day and month only**, so the stored birth year is
ignored and the same list surfaces the right names every year without editing.

Sheet tab `Verjaardagen`:

| Voornaam | Naam | Klas | Datum |
| --- | --- | --- | --- |
| Jan | Janssen | 7A | 15/09/2011 |
| Amira | Haddad | 8C | 03/02/2010 |

First and last name are joined for display ("Jan Janssen"). Dates read the same
forgiving formats as the rest of the sheet (`15/09/2011`, `15/9/2011`,
`2011-09-15`). A missing tab just leaves the birthday zone empty.

### White-labeling (`Style` tab)

Global branding a sister school can change without touching code — a small
key/value tab plus a colour table:

| | |
| --- | --- |
| `Logo` | Drive link to the school's logo (share it "anyone with the link"; falls back to the built-in mark if it can't load) |
| `School` | Name shown beside the logo |

| Color Name | Color Code |
| --- | --- |
| Coral | EC674A |
| Gold | D99A22 |
| Blue | 51A3C4 |

**Only the three base colours are needed** — the board mixes every tint and
shade it uses (pill and chip backgrounds, the birthday card, hover states) from
them with CSS `color-mix`, so there's no ramp to hand-enter. The three slots keep
the names Coral/Gold/Blue (they're what the Settings tab's `Color Scheme` picks
per screen); a school just recolours them.

**Changing the font is a build-time step, not a sheet setting.** An offline
kiosk needs its display font bundled at build (self-hosted, so a flaky line can
never strip it), so it isn't something a live sheet value can do. Swap it by
editing the one `next/font` import in `app/layout.tsx` and rebuilding — the point
where a sister school forks and deploys anyway.

### Per-screen settings

A `Settings` tab lets staff retune each screen live — no code, no redeploy. One
row per screen (`Display` = 1/2/3):

| Display | Name | Color Scheme | Dark theme start | Light theme start | Turn Off | Turn On | Message Cycle Time | Full Screen Interval | Full Screen Time | Piket |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Inkomhal | Coral | 18:00 | 8:30 | 18:00 | 8:30 | 12 | 180 | 20 | |
| 2 | Blok B | Gold | 18:00 | 8:30 | | | 12 | 180 | 20 | |
| 3 | Leraarskamer | Blue | 18:00 | 8:30 | | | 12 | 180 | 20 | Yes |

- **Name** shows in the status bar instead of "Scherm 1".
- **Color Scheme** is the accent — `Coral`, `Gold` or `Blue`.
- **Dark / Light theme start** flip the board between light and dark at those
  times (dark from 18:00 until 8:30, here). Leave both blank to stay on the
  environment default. Evaluated against the host clock and refreshed on the
  30-second poll, so a screen switches within half a minute of the time.
- **Turn Off / Turn On** are the standby hours — see
  [Standby hours](#standby-hours) below.
- **Message Cycle Time** (seconds) is how long each notice holds the message
  zone. Default 12. A message with its own duration still wins.
- **Full Screen Interval** (seconds) is how often the board hands the screen to
  a full-screen item — the key list, an event poster, a Big Slide, a special
  occasion. Default 180 (3 minutes).
- **Full Screen Time** (seconds) is how long each of those bursts stays up
  before the dashboard returns. Default 20.
- **Piket** puts the [standby roster](#piketrooster-piket-tab) in that screen's
  rotation, and the small "who's on now" card in its dashboard — `Yes` for the
  staff room, blank everywhere else. Blank is off, so a school that never adds
  the column gets no roster rather than one on every screen.
- All three timings are per screen, and blank or unparseable means "use the
  default", so a typo slows nothing down.

`?theme=` / `?accent=` on a screen URL still override, for previewing. Changes to
the tab land on the next poll — no reload needed.

### Standby hours

`Turn Off` and `Turn On` black a screen out between those times: the board is
replaced by a black screen carrying one dim line — the screen's name and when it
comes back — and the dashboard returns on its own in the morning. This is aimed
at the wall panels; anyone reading the board with a mouse in hand is left alone
(see the pointer note below).

This is a stand-in for genuinely powering the TV down over HDMI-CEC, which we
can't do here: the Pis are powered from their TV's USB port, so cutting the TV's
power takes the board down with it and there's nothing left to wake it. The
panel stays lit, but it shows black instead of a substitution board nobody is in
the building to read. The CEC agent for schools whose Pis have their own power
supply is still in [`pi/tv-power/`](pi/tv-power), unwired.

- Both cells are needed. One on its own leaves the screen awake, rather than
  guessing what the other was meant to be.
- The window normally wraps past midnight (off 18:00, back 8:30). A same-day
  window (off 12:00, on 13:00) works the same way.
- Two identical times mean a window of zero length, never a permanent one — a
  board the sheet can't turn back on is the failure worth ruling out.
- **Every day, weekends included.** There's no per-day schedule and no holiday
  exception list; the same two times apply all week.
- Judged on each screen's own clock, not the server's, and rechecked every 15
  seconds. A screen that has lost the host still puts itself to bed at six and
  wakes at half eight on the window it last heard about.
- Standby outranks everything, a permanent Big Slide included.
- **Moving a pointer wakes it, and keeps it awake for five minutes.** Standby is
  for the corridor; a teacher who opens the same URL from home at nine in the
  evening gets the board. A wall panel in a cage has no mouse, so nothing ever
  fires this and it sleeps on schedule.
- `?blackout=1` shows the standby screen at any hour and `?blackout=0` holds the
  board up during standby hours, so either can be checked from a desk. Both
  ignore the pointer, so the standby screen can actually be looked at. `?now=`
  reaches the schedule too: `?now=20:15` shows that evening, pointer rules and
  all.

### Display behaviour

- **Resolution independent.** `html { font-size: calc(100vh / 48) }` and every
  dimension in `rem`, so 1080p and 4K render the identical layout, just scaled.
  Nothing to tune per screen.
- **Rows share the vertical space.** More substitutions means shorter rows, not
  a scrollbar — a kiosk has no one to scroll it. Type is sized for reading from
  down the corridor; past about seven rows it scales down together so a busy day
  still fits instead of colliding.
- **Message loop** cross-fades every 12s by default (`Message Cycle Time` in the
  Settings tab retunes it, and a per-item `durationSec` overrides that)
  and shows its position as "2 van 3", so a passer-by knows whether they've seen
  everything or should wait for one more.
- **Readable at a desk too.** The same URL works on a laptop: click a dot to
  jump, use the arrows that appear on hover, or press ← / →, and the dwell timer
  restarts so nothing slides away mid-read. On a wall none of that shows —
  hover controls need a mouse, and the cursor hides itself after three still
  seconds. (On a touchscreen there's no hover, so the dots are the way to skip.)
  The full-screen rotation has [its own transport](#one-interruption-at-a-time)
  along the bottom edge, on the same terms.
- **Self-updating screens, and a build stamp when you want one.** Every build is
  stamped with its commit and build time — `a3f19c · 07-08 21:40` — and the
  stamp rides along in `/api/board`, so each screen can tell that the host has
  been rebuilt and it's still running the old bundle. When it is, it reloads
  itself between full-screen items. Without that a kiosk keeps its first-loaded
  JavaScript indefinitely — it polls for data, never for code — so a deploy
  reached the host and stopped there. The stamp itself is only *shown* in
  development, or when `BUILD_STAMP=on` while you're chasing a deploy: on a
  normal day the corridor doesn't need a commit hash, and the screens keep
  themselves current either way. Flipping it reaches the panels on their next
  poll. See [deploy-lan.md](docs/deploy-lan.md#which-build-is-on-the-screen).
- **Resilience.** Each successful poll is cached in `localStorage`. If the
  network drops, the last good board stays on screen and a "Geen verbinding"
  badge appears after 5 minutes. If the *server* can't reach the Sheet it
  returns an empty list rather than a 500, and the client falls back to its
  cached copy for the same date.

## Run it

```bash
npm install && npm run dev
```

Then open http://localhost:3000. Without `SHEET_ID` it serves demo data.

## Wiring the Google Sheet

The board reads one spreadsheet (id in `.env.local`). One-time setup, each step
needing a Google account:

1. In a Google Cloud project, enable the **Google Sheets API**, create a
   **service account**, and download a JSON key as `service-account.json` here
   (gitignored). Set `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`
   (use an **absolute** path on the LAN host — see the deploy guide).
2. Share the sheet with that service account's email address as **Viewer**.
   If your Workspace blocks sharing outside the domain, create the Cloud
   project (and so the service account) under the school's own Workspace
   organisation, or have an admin allow-list the account.
3. Set `SHEET_ID` in `.env.local`. `npm run check:sheet` verifies each step and
   prints the service-account address to share with.

Each feature reads its own tab; until a tab exists that feature simply stays
dormant and the rest of the board is unaffected. The header rows:

| Tab | Header |
| --- | --- |
| `Vervangingen` | `Datum · Lesuur · Klas · Afwezige Leerkracht · Vervanging · Inhoud · Lokaal` |
| `Mededelingen` | `Titel · Tekst · Weergave Startdatum · Weergave Startuur · Weergave Einddatum · Weergave Einduur · Afbeelding · Volledig beeld · Big Slide` |
| `Evenementen` | `Datum · Tijd · Toon vanaf · Klas · Titel · Synopsis · Poster` |
| `Sleutels` | `Klas · Leerling · Ophalen · Opgehaald · Terugbrengen · Teruggebracht` |
| `Verjaardagen` | `Voornaam · Naam · Klas · Datum` |
| `Settings` | `Display · Name · Color Scheme · Dark theme start · Light theme start · Turn Off · Turn On · Message Cycle Time · Full Screen Interval · Full Screen Time · Piket` |
| `Schedule` | `Lesuur · Starttijd · Eindtijd · Toon pauzelijn` |
| `Piket` | `Lesuur · Maandag · Dinsdag · Woensdag · Donderdag · Vrijdag` |
| `Speciale Gelegenheden` | `Datum · Titel · Toon vanaf · Toon tot · BigSlide · Tijd van · Tijd tot · Activiteit · Info · Locatie` |
| `Style` | `Logo · School` + a `Color Name / Color Code` table |
| `Speciale Gelegenheden` | `Datum · Titel · Weergave Startdatum · Weergave Startuur · Weergave Einddatum · Weergave Einduur · BigSlide · Tijd van · Tijd tot · Activiteit · Info · Locatie` |

`Speciale Gelegenheden` carries two pairs of times, and they do different jobs.
**Weergave Startuur / Einduur** decide when the board itself goes up and comes
down — the same optional `HH:MM` as on `Mededelingen` above. **Tijd van / Tijd
tot** are the programme's own hours, one row per item (08:00 Opening, 09:30 100m
loop), and they're what the board prints and runs its now-marker against. A
sports day whose programme starts at 08:00 usually wants a weergave start a
little earlier, so the board is already up when people walk in.

An occasion is one board made of many programme rows, so **its window is read
from the first row — the one that names the Datum and Titel** — and the weergave
cells on the continuation rows below are ignored. They're free to be blank,
stale, or left over from a copy-paste without putting the board up early.

Importable CSV starting points for every tab are in
[`docs/sheet-template/`](docs/sheet-template) — File → Import in Google Sheets,
one per tab, keeping the tab names above. Ranges are set in `.env.example`.

**A range has to be wide enough for the columns you added.** Sheets returns only
the cells inside it, so a column past the end reads as blank — and a blank
weergave hour isn't an error, it just means "no hour", which looks exactly like
the feature not working. If a deployment pins these in its own `.env.local`
rather than taking the defaults, widen them there too:

| | Was | Now |
| --- | --- | --- |
| `MESSAGES_SHEET_RANGE` | `Mededelingen!A1:H200` | `Mededelingen!A1:J200` |
| `SPECIAL_OCCASIONS_RANGE` | `Speciale Gelegenheden!A1:K400` | `Speciale Gelegenheden!A1:M400` |

The same trap bit the `Settings` tab earlier: it's eleven columns wide now, so a
pinned `Settings!A1:H30` silently drops `Full Screen Interval`, `Full Screen
Time` and `Piket` — and the board quietly falls back to its built-in pace with
no roster anywhere. `Settings!A1:L30`.

Append `?date=2026-09-02` to a screen URL (or `/api/board`) to render another
school day — useful for checking entries before the day arrives. A previewed day
has no clock of its own, so the weergave hours don't apply to it: everything set
for that day shows, whatever time you look.

### Reading a staff-maintained sheet

The readers are deliberately forgiving, because a shared sheet never stays
uniform:

- The header row is **found**, not assumed to be row 1 — a title line or a blank
  spacer above the table doesn't blank the board.
- Header names are matched case/accent-insensitively with aliases
  (`Lesuur`/`Uur`, `Vervanging`/`Vervanger`, …); column order doesn't matter and
  unknown columns are ignored.
- Dates read several forms: `27/07/2026`, `27/7/2026`, `2026-07-27`.
- A missing tab is a normal dormant state, not a failure.
- A read that genuinely fails shows **"Rooster tijdelijk niet beschikbaar"**,
  never a blank board — an empty list must never be able to mean a broken one.

### Substitution specifics (`Vervangingen`)

- Only rows whose `Datum` is today are shown, sorted by period.
- `1-2`, `1 & 2`, `1 en 2` all render as **1 & 2**, marked live through both.
- A blank `Lesuur` or `Datum` inherits the row above, so merged cells keep
  working — filling every row is still recommended.
- A literal `pauze` row is ignored — the board draws its own dividers from the
  `Schedule` tab (or the built-in default timetable).
- `Inhoud` (the substitution task) shows beside the substitute: short values
  like `Zelfstudie` as a pill, longer ones as text; `nvt`/`-` show nothing.
- An empty `Vervanging` renders as an **Info volgt** chip — never "no class", so
  students don't leave thinking a lesson was cancelled when the row is just
  unfinished.

## Deploying

Everything stays on the school LAN — nothing is exposed to the internet. Two
setups are supported: **standalone** (the display Pi runs the server itself)
and **server–client** (one server — a Pi, Mac or Windows machine — feeding
every display Pi). The full install guide, covering both modes plus the cage
kiosk setup and per-section troubleshooting, is
**[`docs/install.md`](docs/install.md)**.

The screens must load the **production** build (`./scripts/build-standalone.sh`
or `npm run start`), never `npm run dev` — dev-mode hydration doesn't run
reliably in the Pi's Chromium.

If the host has to be a Windows Server rather than a Pi, the same setup
translated — service wrapper, port 80, and the `.local` name that stops
working — is in **[`docs/deploy-windows.md`](docs/deploy-windows.md)**.

## Not built yet

- **Real TV on/off scheduling** (HDMI-CEC) — the standalone Pi-side agent in
  [`pi/tv-power/`](pi/tv-power) is driven by a local schedule file on each Pi and
  isn't wired to the sheet. It also can't be used as things stand: the Pis take
  their power from the TV's USB port, so a TV in standby is a Pi with no power.
  [Standby hours](#standby-hours) black the board out instead, from the same two
  sheet columns the agent would read.
- **Per-day standby hours** — `Turn Off` / `Turn On` apply the same times every
  day of the week. Weekends and holidays would need a day column or a dated
  exception list, as sketched in [SPEC.md](SPEC.md).
- **OneRoster birthdays** — deferred in the spec; moot now that the birthday
  list lives in the sheet.
