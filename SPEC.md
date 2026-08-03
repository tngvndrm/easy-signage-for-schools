# School Signage — Draft Spec

Replacement for PiSignage. Goal: lean, easy for non-technical staff to update, resilient to flaky internet.

## Displays
- 3 screens, landscape, each running on a Raspberry Pi 4 in Chromium kiosk mode.
- Each screen has its own URL (`/screen/1`, `/screen/2`, `/screen/3`).
- All three show the same layout/content by default (single "board" broadcast to all screens) unless we later decide a screen needs to differ.

## Layout — this is a dashboard, not a slideshow
Normal mode is a fixed layout with zones on screen simultaneously, not one big rotation:

1. **Substitution board — persistent, always visible, top priority.**
   Per lesson period, today's absent teachers, who's substituting, and which classroom. Takes the dominant share of the screen (e.g. top ~65%).
   - **Source: Google Sheet.** Staff currently maintain this in a slide deck, which is fidgety — replacing that with a sheet they already know how to edit. Our server reads the sheet via the Sheets API, polling every few minutes, and renders it — no separate data-entry UI to build or maintain.
   - **Actual columns** (from the current layout): `Lesuur (period) | Klas | Afwezige Leerkracht | Vervanging | Lokaal`.
     - `pauze` is a visual separator row (lunch break), not data.
     - A period can have more than one substitution (e.g. period 6 had both 9A and 9C) — shown as two rows under that period.
     - Consecutive periods for the same absence are combined ("1 & 2").
   - **Recommended sheet format**: one row per (period, class, absence) — fill in `Lesuur` on *every* row (e.g. `6`, `6` for both period-6 rows; `1-2` for a combined block) rather than leaving it blank/merged. Reading real values instead of relying on merged cells is far more reliable via the Sheets API. The board groups rows by period for display and inserts the `pauze` divider itself based on a configured break period — staff won't need to type a "pauze" row.
   - Board shows only today's rows (matched by a `Datum` column), sorted by period.

2. **Messages loop — smaller zone, rotates.**
   Replaces the current 3-slide loop:
   - Student pickup notices ("X, Y, Z please pick up ...")
   - Reminders ("don't forget to submit a/b/c")
   - Event banner (e.g. upcoming theater play)
   Authored in our lean admin UI (text + optional image/banner), with optional start/end dates so items expire on their own.

3. **Birthday shoutout — small zone.**
   "Happy birthday to Jan Janssen, class 7A" — one line, shown automatically on that day, then gone.
   - **v1: manual entry in admin** (name, class, date) — a few seconds of work whenever a birthday comes up.
   - **Deferred: OneRoster REST API.** If the school's student system exposes OneRoster's Demographics service (where `birthDate` lives — not part of the core 1.1 roster objects), we could later pull name + class + birth date automatically instead. Revisit once we know which system, if any, exposes it — not needed for v1.

## Full-screen takeover mode
On specific days, replace the whole layout with one full-screen message instead of the normal dashboard — e.g. "Welcome back", "Enjoy the weekend", "Tonight: Class 100 performs 'Midsummer Night's Dream'...".

**Ad-hoc**: staff create one in admin for a specific date (+ optional time window), it auto-activates and auto-reverts to the normal dashboard afterward. No recurring-rule scheduling needed.

## TV power schedule
The screens shouldn't run 24/7 — they power down outside school hours and wake in the morning.

- **Mechanism: HDMI-CEC from the Pi.** The Pi sends `standby`/`on` to the TV over the existing HDMI cable, so the TV genuinely goes to standby rather than showing a "no signal" box. No smart plugs (many TVs won't power on again when mains returns, so a plug can't wake the screen). For TVs that disable their CEC receiver in standby, a per-Pi fallback kills the HDMI signal instead.
- **Agent**: `pi/tv-power/` — a small Python agent run by a systemd timer once a minute. It acts only on state changes, and every ~15 min asks the TV its actual power state and re-asserts only if the TV disagrees (recovers a screen someone switched off with a remote).
- **Schedule shape**: weekly windows per day (a day may have several, or none = off all day), plus dated `exceptions` that replace the weekly windows for that date — holidays, closure days, and evening events. Windows may cross midnight.
- **Distribution**: served per screen at `GET /api/screens/:id/power-schedule`. Each Pi polls every ~10 min and caches to disk; on failure it falls back to the cached copy, then a local file, then "always on" — a network outage never leaves the hall dark for an unexplained reason.
- Chromium stays running while the TV sleeps, so the board is already rendered when the screen wakes.

## Admin UI
- Login via Google OAuth, restricted to members of a specific Google Group (e.g. `signage-admins@[schooldomain]`) — no separate passwords to manage, staff use their existing school Google account.
- Messages: add/edit the 3 rotating message-loop items, each with optional image and start/end date.
- Birthdays: add "name, class, date" (until/unless OneRoster is wired up) — shown automatically on the day.
- Takeovers: create an ad-hoc full-screen message for a date (+ time window).
- Power schedule: set the weekly on/off hours, and add dated exceptions (closed all day / extended for an evening event). Shared by all screens by default, overridable per screen.
- Substitution board needs **no admin UI** — it's the Google Sheet.

## Hosting
**Proposed: Google Cloud Run**, given the whole stack is already Google-centric (Sheets for substitutions, Google Group for login, possibly OneRoster later):
- Small Node.js container, scales to ~0 cost when idle, no server to patch. Comfortably within the free tier for 3 screens polling every 30s.
- **Firestore** for the small admin-authored data (messages, birthdays, takeover schedule, TV power schedule) — serverless, no DB to run.
- **Cloud Storage** for uploaded banner images.
- Google OAuth + Group-membership check (Admin SDK Directory API) gates `/admin`.

Alternative considered: hosting on a machine on the school network. Rejected as the default because remote admin access (editing messages from outside school wifi) would need a VPN or port-forwarding, which is more ongoing maintenance than a Cloud Run deployment. Happy to revisit if you'd rather keep everything fully local/offline.

- **Board page**: one page rendering the layout described above; polls the server every ~30s for changes (messages/birthdays/takeover state) and periodically for sheet data.
- **Resilience**: board caches last-known data client-side (localStorage/PWA cache), so a dropped connection doesn't blank the screen — it just shows slightly stale info until reconnected.
- **Pi setup**: one-time script — Raspberry Pi OS Lite, Chromium kiosk autostart to the board URL, disable screen blanking, nightly auto-reboot (scheduled inside the TV's off window), TV power agent from `pi/tv-power/`. No further SSH access needed day-to-day.

## Open questions
1. Confirm the recommended flat-row Sheet format (period filled on every row) works for whoever maintains it — or should the reader instead handle merged cells from a layout closer to the current slide?
2. OK with Google Cloud Run + Firestore hosting, or would you rather keep this fully local/offline on school hardware despite the remote-admin-access trade-off?
3. Confirm the Google Group to gate admin login (does one already exist, e.g. a staff/office group, or do we create `signage-admins@...`)?
4. Do all 3 screens always show the identical board, or might they ever need to differ?
6. Do the 3 TVs support HDMI-CEC (needs confirming on the actual hardware — see `pi/tv-power/README.md` step 1), and do all 3 share one on/off schedule?
5. ~~OneRoster for birthdays~~ — deferred, revisit later. v1 uses manual entry.

## Non-goals (to keep it lean)
- No multi-tenant / multi-school support.
- No analytics/proof-of-play reporting.
- No native mobile app — admin is a responsive web page.
- No per-teacher/per-class login — this is a small shared-content tool, not a full SIS.
