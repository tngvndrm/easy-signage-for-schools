# Signage — Infoborden

Frontend display for the school info boards described in [SPEC.md](SPEC.md).
Replaces PiSignage: a fixed dashboard (substitutions + messages + birthdays),
not a slideshow.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | **Next.js 16 (App Router) + TypeScript** | Board pages, admin UI and the JSON API live in one deployable. One `npm run build`, one container. |
| Styling | **Tailwind CSS v4 + Steinerschool Gent tokens** | Brand colours, Averia typeface and the organic radii live as CSS variables in `app/globals.css`. |
| Substitutions | **Google Sheets API v4** (read-only, service account) | Staff keep editing a sheet they already know. No data-entry UI to build. |
| Admin data | **Firestore** (not wired yet) | Messages, birthdays, takeovers — tiny documents, serverless. |
| Images | **Cloud Storage** (not wired yet) | Banner uploads for messages/takeovers. |
| Auth | **Google OAuth + Group check** (not wired yet) | Gates `/admin` only; the board pages stay public on the school LAN. |
| Hosting | **Cloud Run** | Scales to zero, no host to patch, same Google project as the Sheet. |

Deliberately *not* used: no state manager, no component library, no CMS, no
WebSocket layer. Three screens polling a JSON endpoint every 30s is well inside
what a single small container handles.

## What's built

- `/screen/1`, `/screen/2`, `/screen/3` — the board. Identical content per the
  spec; the screen number only shows in the status bar.
- `/screen/1?takeover=1` — preview of full-screen takeover mode.
- `/screen/1?keypanel=1` — preview of the classroom-key panel.
- `/api/board` — the single JSON payload the board polls.
- `/` — index with links to each screen.

Substitutions currently render from `lib/demo-data.ts`. Set `SHEET_ID` and the
same code path reads the real sheet — the demo badge in the header disappears
once it does.

### Look & feel

The board is built on the **Steinerschool Gent brand & style guide**:

- **Colour** — Coral `#EC674A`, Gold `#D99A22`, Blue `#51A3C4` with the guide's
  100/300/500/700/900 ramps, on warm neutrals. On the board they carry meaning:
  accent for lesson periods and headings, coral for "Geen les", blue for
  classrooms, gold for the birthday card.
- **Type** — Averia Sans Libre for display, headings, periods and the clock;
  system sans for body copy; monospace eyebrows for column labels. The font is
  self-hosted at build time (`next/font`), so a flaky line can't strip the
  school's typeface off the screen.
- **Shape** — *"Afgerond, niet afgesneden."* No 90° corners anywhere. The
  guide's irregular hand-made radius is reserved for the large surfaces — the
  header and the big panels — where it reads as deliberate; small chips and row
  shading get a plain even radius, since repeating the asymmetry at that scale
  turned into noise and fought the data. The birthday and takeover cards carry
  the off-kilter blob from the feature-card pattern.

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

The timetable lives in [`lib/schedule.ts`](lib/schedule.ts):

| | | | |
| --- | --- | --- | --- |
| 1 | 08:50–09:40 | 5 | 13:20–14:10 |
| 2 | 09:40–10:30 | 6 | 14:10–15:00 |
| *kleine pauze* | 10:30–10:50 | *kleine pauze* | 15:00–15:10 |
| 3 | 10:50–11:40 | 7 | 15:10–16:00 |
| 4 | 11:40–12:30 | 8 | 16:00–16:50 |
| *middagpauze* | 12:30–13:20 | | |

Wednesday ends after period 4. Outside those windows — before the first bell,
after the last, and all weekend — nothing is marked. The marker reads the Pi's
own clock rather than the server's, so it stays right even if the board is
showing cached data.

Append `?now=11:20` (or `?now=wed+12:45`) to a screen URL to freeze it at
another moment and see how it will look without waiting for the day.

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

The key panel and the event poster share a single rotation rather than running
their own timers — two timers would eventually fire together and fight over the
screen. Every 3 minutes the board shows the next one due and then returns to the
dashboard. An admin takeover outranks both, since it was scheduled for that
exact day on purpose.

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

The target sheet is **"Signage - Vervangingen (voorbeeld)"**, id
`1De7Mx1SSBxRVgWXnzKKB9obKvw5EhGM0QaUrz5tM5v4`. `.env.local` is already filled
in for it, with `SHEET_ID` commented out until credentials exist — setting it
switches the board off demo data, and without a key every read fails.

Three steps, all needing a Google account this repo doesn't have:

1. In a Google Cloud project, enable the **Google Sheets API**, create a
   **service account**, and download a JSON key as `service-account.json` here
   (gitignored). Set `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`.
   On Cloud Run, attach the service account to the revision instead — no key
   file to store.
2. Share the sheet with that service account's email address as **Viewer**.
3. Add a **`Sleutels`** tab (keys) and a **`Verjaardagen`** tab (birthdays) —
   until each exists its feature simply stays dormant, the rest of the board is
   unaffected:

   ```
   Datum	Klas	Leerling	Ophalen	Opgehaald	Terugbrengen	Teruggebracht
   Voornaam	Naam	Klas	Datum
   ```

   `Datum` is optional: it stands in as the pickup date when `Ophalen` is left
   blank, which makes loading a whole trimester up front easier.

Then uncomment `SHEET_ID` in `.env.local`. `npm run check:sheet` verifies each
step and prints the service-account address to share with.

Append `?date=2026-09-02` to a screen URL (or `/api/board`) to render another
school day — useful for checking entries before the day arrives.

### Reading a staff-maintained sheet

The readers are deliberately forgiving, because a shared sheet never stays
uniform:

- The header row is **found**, not assumed to be row 1 — a title line or a blank
  spacer above the table doesn't blank the board.
- Unknown columns are ignored, so the sheet's extra `Inhoud` column costs
  nothing. (It isn't displayed — see "Not built yet".)
- A missing tab is treated as a normal dormant state, not a failure.
- A read that genuinely fails shows **"Rooster tijdelijk niet beschikbaar"**,
  never a blank board — an empty list must never be able to mean a broken one.

Importable starting points for both tabs are in
[`docs/sheet-template/`](docs/sheet-template) — File → Import in Google Sheets,
one CSV per tab, keeping the tab names `Vervangingen` and `Sleutels`.

### Sheet format

Header row, then one row per (period, class, absence):

| Datum | Lesuur | Klas | Afwezige Leerkracht | Vervanging | Lokaal |
| --- | --- | --- | --- | --- | --- |
| 27/07/2026 | 1-2 | 7A | Mevr. De Smet | Dhr. Peeters | A12 |
| 27/07/2026 | 6 | 9A | Mevr. De Smet | Dhr. Peeters | C21 |
| 27/07/2026 | 6 | 9C | Dhr. Janssens | Mevr. Goossens | C22 |

The reader is deliberately forgiving, so open question 1 in the spec doesn't
have to be settled before staff start using it:

- Header names are matched case/accent-insensitively with aliases
  (`Lesuur`/`Uur`, `Vervanging`/`Vervanger`, …).
- A blank `Lesuur` or `Datum` inherits the row above, so a sheet that still uses
  merged cells keeps working. Filling every row is still recommended.
- `1-2`, `1 & 2`, `1 en 2` all render as **1 & 2**.
- A literal `pauze` row is ignored — the board draws the divider itself from
  `BREAK_AFTER_PERIOD`.
- An empty `Vervanging` renders as a red **Geen les** chip.
- Rows whose `Datum` isn't today are skipped.

## Not built yet

Roughly in the order I'd tackle them:

0. **The sheet's `Inhoud` column** — the live sheet carries a 7th column
   (`Vervangtaak`, `Spel`, `Zelfstudie`) that the board reads past but doesn't
   show. It's arguably the most actionable thing on a row after the room, but
   adding it means re-proportioning the five existing columns, so it's a
   decision rather than an oversight.
1. **Firestore + admin UI** — messages, birthdays, takeovers currently come from
   `lib/demo-data.ts`. `lib/board.ts` has the seam marked with a `TODO`; the
   board and its types need no changes.
2. **Google OAuth + group check** on `/admin`.
3. **Cloud Run deploy** — `output: "standalone"` is already set; needs a
   Dockerfile and a service account with Sheets + Firestore access.
4. **Service worker** so a Pi that boots while the network is down still paints
   the last board instead of Chromium's error page. (`localStorage` only helps
   once the page itself has loaded.)
5. **Pi kiosk script** — Chromium autostart, screen-blanking off, nightly
   reboot.
