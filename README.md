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
| Hosting | **One LAN host** (small Pi, Next standalone under systemd) | Kept on the school network so student names never leave the building. See [`docs/deploy-lan.md`](docs/deploy-lan.md). |
| Screens | **Raspberry Pi + cage** kiosk | Pi OS Lite boots straight into one full-screen Chromium. No desktop. |

Deliberately *not* used: no state manager, no component library, no CMS, no
database, no WebSocket layer. Three screens polling a JSON endpoint every 30s is
well inside what one small host handles.

## What's built

Everything in the spec, all reading from the sheet:

- `/screen/1`, `/screen/2`, `/screen/3` — the board. Identical content; the
  screen number only shows in the status bar.
- `/api/board` — the single JSON payload the board polls.
- `/` — index with links to each screen and to every preview below.

Substitutions, messages, birthdays, classroom keys, events and full-screen Big
Slide takeovers all come from their sheet tabs. With `SHEET_ID` unset the board
runs on `lib/demo-data.ts` and shows a **Demo-data** badge; set it and the badge
disappears.

**Previews** (also linked from `/`), appended to a screen URL:

| Query | Shows |
| --- | --- |
| `?now=11:20` (or `?now=wed+12:45`) | the "now" marker frozen at a chosen time |
| `?date=2026-09-02` | the board for another school day |
| `?theme=dark`, `?accent=blue`/`gold` | theme / accent overrides |
| `?keypanel=1`, `?keys=3` | the classroom-key panel / the in-rotation key card |
| `?event=1` | the event poster (sample if none scheduled) |
| `?takeover=1` | a Big Slide full-screen takeover (sample) |

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

### Messages

The rotating notices — pickup calls, reminders, fundraiser posters — come from
the `Mededelingen` tab. Each has an optional show-window, so an item puts itself
up and takes itself down instead of someone remembering to delete it.

| Titel | Tekst | Van | Tot | Afbeelding | Volledig beeld | Big Slide |
| --- | --- | --- | --- | --- | --- | --- |
| Afhalen | Lotte (7A) … | | | | FALSE | No |
| Wafelverkoop 6A | Steun de bosklassen … | 01/09/2026 | 05/09/2026 | *(Drive link)* | TRUE | No |
| Fijn verlof! | We zien elkaar terug op 1 september. | 04/07 | 31/08 | | | Permanent |

- **Van / Tot** are optional. Blank `Van` = from now; blank `Tot` = until
  removed; neither = always shown. Same forgiving date formats as the rest.
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
  - `Permanent` — held full-screen for the whole `Van`–`Tot` window, hiding the
    dashboard. For "welcome back" / holiday messages where nothing else matters.
    Several at once rotate.
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

The key panel, the event poster and periodic (`Yes`) Big Slides share a single
rotation rather than running their own timers — independent timers would
eventually fire together and fight over the screen. Every 3 minutes the board
shows the next one due, then returns to the dashboard. A `Permanent` Big Slide
outranks all of them: it holds the whole screen for its window, since it was set
for exactly those days on purpose.

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

### Per-screen settings

A `Settings` tab lets staff retune each screen live — no code, no redeploy. One
row per screen (`Display` = 1/2/3):

| Display | Name | Color Scheme | Dark theme start | Light theme start |
| --- | --- | --- | --- | --- |
| 1 | Inkomhal | Coral | 18:00 | 8:30 |
| 2 | Blok B | Gold | 18:00 | 8:30 |

- **Name** shows in the status bar instead of "Scherm 1".
- **Color Scheme** is the accent — `Coral`, `Gold` or `Blue`.
- **Dark / Light theme start** flip the board between light and dark at those
  times (dark from 18:00 until 8:30, here). Leave both blank to stay on the
  environment default. Evaluated against the host clock and refreshed on the
  30-second poll, so a screen switches within half a minute of the time.
- `Turn Off` / `Turn On` are read by the separate TV-power (CEC) feature, not
  the board.

`?theme=` / `?accent=` on a screen URL still override, for previewing. Changes to
the tab land on the next poll — no reload needed.

### Display behaviour

- **Resolution independent.** `html { font-size: calc(100vh / 48) }` and every
  dimension in `rem`, so 1080p and 4K render the identical layout, just scaled.
  Nothing to tune per screen.
- **Rows share the vertical space.** More substitutions means shorter rows, not
  a scrollbar — a kiosk has no one to scroll it. Type is sized for reading from
  down the corridor; past about seven rows it scales down together so a busy day
  still fits instead of colliding.
- **Message loop** cross-fades every 12s (per-item `durationSec` overrides it)
  and shows its position as "2 van 3", so a passer-by knows whether they've seen
  everything or should wait for one more.
- **Readable at a desk too.** The same URL works on a laptop: click a dot to
  jump, use the arrows that appear on hover, or press ← / →, and the dwell timer
  restarts so nothing slides away mid-read. On a wall none of that shows —
  hover controls need a mouse, and the cursor hides itself after three still
  seconds. (On a touchscreen there's no hover, so the dots are the way to skip.)
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
3. Set `SHEET_ID` in `.env.local`. `npm run check:sheet` verifies each step and
   prints the service-account address to share with.

Each feature reads its own tab; until a tab exists that feature simply stays
dormant and the rest of the board is unaffected. The header rows:

| Tab | Header |
| --- | --- |
| `Vervangingen` | `Datum · Lesuur · Klas · Afwezige Leerkracht · Vervanging · Inhoud · Lokaal` |
| `Mededelingen` | `Titel · Tekst · Van · Tot · Afbeelding · Volledig beeld · Big Slide` |
| `Evenementen` | `Datum · Tijd · Toon vanaf · Klas · Titel · Synopsis · Poster` |
| `Sleutels` | `Klas · Leerling · Ophalen · Opgehaald · Terugbrengen · Teruggebracht` |
| `Verjaardagen` | `Voornaam · Naam · Klas · Datum` |
| `Settings` | `Display · Name · Color Scheme · Dark theme start · Light theme start` |
| `Schedule` | `Lesuur · Starttijd · Eindtijd · Toon pauzelijn` |

Importable CSV starting points for every tab are in
[`docs/sheet-template/`](docs/sheet-template) — File → Import in Google Sheets,
one per tab, keeping the tab names above. Ranges are set in `.env.example`.

Append `?date=2026-09-02` to a screen URL (or `/api/board`) to render another
school day — useful for checking entries before the day arrives.

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
- A literal `pauze` row is ignored — the board draws the divider itself from
  `BREAK_AFTER_PERIOD`.
- `Inhoud` (the substitution task) shows beside the substitute: short values
  like `Zelfstudie` as a pill, longer ones as text; `nvt`/`-` show nothing.
- An empty `Vervanging` renders as an **Info volgt** chip — never "no class", so
  students don't leave thinking a lesson was cancelled when the row is just
  unfinished.

## Deploying

Kept on the school LAN — one small host serves all three screens and nothing is
exposed to the internet. Full runbook, including the cage kiosk setup for the
display Pis, in **[`docs/deploy-lan.md`](docs/deploy-lan.md)**.

The screens must load the **production** build (`./scripts/build-standalone.sh`
or `npm run start`), never `npm run dev` — dev-mode hydration doesn't run
reliably in the Pi's Chromium.

## Not built yet

- **TV on/off scheduling** (HDMI-CEC) — tracked separately.
- **OneRoster birthdays** — deferred in the spec; moot now that the birthday
  list lives in the sheet.
