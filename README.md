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
- **Shape** — *"Afgerond, niet afgesneden."* No 90° corners anywhere: every
  container uses the guide's irregular `--radius-sm/md/lg`, and the birthday and
  takeover cards carry the off-kilter blob from the feature-card pattern.

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
column, with a bar that drains as the lesson runs — so the board says both which
row is live and how much of it is left. A block like "1 & 2" stays marked
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

### Display behaviour

- **Resolution independent.** `html { font-size: calc(100vh / 54) }` and every
  dimension in `rem`, so 1080p and 4K render the identical layout, just scaled.
  Nothing to tune per screen.
- **Rows share the vertical space.** More substitutions means shorter rows, not
  a scrollbar — a kiosk has no one to scroll it.
- **Message loop** cross-fades every 12s (per-item `durationSec` overrides it).
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

1. In the Google Cloud project, enable the **Google Sheets API** and create a
   service account.
2. Share the substitution sheet with that service account's email, **Viewer**.
3. Set the environment (see `.env.example`):

   ```
   SHEET_ID=1AbC...              # the id from the sheet URL
   SHEET_RANGE=Vervangingen!A1:F400
   BREAK_AFTER_PERIOD=4          # "pauze" divider is drawn after this period
   TIMEZONE=Europe/Brussels
   ```

   Locally, point `GOOGLE_APPLICATION_CREDENTIALS` at the service-account JSON
   key. On Cloud Run, attach the service account to the revision instead — no
   key file to store.

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
