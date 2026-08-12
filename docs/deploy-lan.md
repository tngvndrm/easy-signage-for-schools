# Deploying on the school LAN

One small box on the school network serves all three screens. Nothing is exposed
to the internet, so the student names on the board never leave the building.

The host can be a spare Raspberry Pi 4 — it's serving three clients polling a
JSON endpoint every 30 seconds, which is nothing. Don't run it on one of the
three display Pis: rebooting that screen would take the other two down with it.

```
             ┌──────────────┐
   Sheets ──▶│  infobord    │◀── http://infobord.local/screen/1
  (outbound) │  (LAN host)  │◀── http://infobord.local/screen/2
             └──────────────┘◀── http://infobord.local/screen/3
```

Only the host talks to Google. The screens only ever talk to the host.

## 1. Prepare the host

Raspberry Pi OS Lite, plus Node 22 and Avahi so the name `infobord.local`
resolves without anyone managing DHCP reservations:

```bash
sudo hostnamectl set-hostname infobord
sudo apt update && sudo apt install -y git avahi-daemon
# The host clock decides what "today" is for every screen — keep it synced.
sudo timedatectl set-ntp true
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo useradd --system --home /opt/infoborden --shell /usr/sbin/nologin infoborden
```

## 2. Install the app

```bash
sudo git clone <this-repo> /opt/infoborden
sudo chown -R infoborden:infoborden /opt/infoborden
sudo -u infoborden bash -c 'cd /opt/infoborden && ./scripts/build-standalone.sh'
```

## 3. Credentials and config

Copy `service-account.json` to `/opt/infoborden/` and lock it down — it's the
one real secret on the box:

```bash
sudo chown infoborden:infoborden /opt/infoborden/service-account.json
sudo chmod 600 /opt/infoborden/service-account.json
```

Create `/opt/infoborden/.env.local`. **Use an absolute path for the key**: the
service runs from `.next/standalone`, so the `./service-account.json` that works
in development resolves to the wrong place here.

```
SHEET_ID=1De7Mx1SSBxRVgWXnzKKB9obKvw5EhGM0QaUrz5tM5v4
SHEET_RANGE=Vervangingen!A1:H400
KEYS_SHEET_RANGE=Sleutels!A1:H200
EVENTS_SHEET_RANGE=Evenementen!A1:H100
GOOGLE_APPLICATION_CREDENTIALS=/opt/infoborden/service-account.json
TIMEZONE=Europe/Brussels
LOCALE=nl-BE
BREAK_AFTER_PERIOD=4
THEME=light
ACCENT=coral
```

## 4. Run it as a service

```bash
sudo cp /opt/infoborden/deploy/infoborden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now infoborden
systemctl status infoborden
```

It binds port 80 via a capability rather than running as root, so the screens
get a bare URL. Check it from your laptop:

```bash
curl -s http://infobord.local/api/board | head -c 200
```

## 5. Point each screen at it

Each display Pi runs the board full-screen under **cage**, a minimal Wayland
kiosk compositor. No desktop, no display manager, no autologin greeter — cage
boots straight into one full-screen Chromium and nothing else. Pi OS **Lite** is
the right image for the screens too; the desktop packages are not needed.

On each display Pi:

```bash
sudo apt update && sudo apt install -y cage chromium wlrctl
sudo git clone <this-repo> /opt/infoborden        # or copy just deploy/
sudo cp /opt/infoborden/deploy/infoborden-kiosk.service /etc/systemd/system/
```

Set which screen this Pi is, and where the board lives. During a laptop test
that's the dev server's LAN address; in production it's the host from step 1:

```bash
sudo tee /etc/default/infoborden-kiosk <<'EOF'
SCREEN=1
BOARD_URL=http://infobord.local/screen/1
EOF
```

The kiosk runs on the console, so make that the boot target (no desktop) and
start it:

```bash
sudo systemctl set-default multi-user.target
sudo systemctl enable --now infoborden-kiosk
```

The board should appear on the panel within a few seconds. If it doesn't:

```bash
journalctl -u infoborden-kiosk -b --no-pager | tail -30
```

- `Permission denied` on `/dev/dri` or input → the seat session didn't grant
  device access. Add the user to the hardware groups and reboot:
  `sudo usermod -aG video,render,input infobordbeheerder`.
- A blank window but the service is running → Chromium reached the compositor
  but not the board. Check `BOARD_URL` is right and reachable with
  `curl -I "$BOARD_URL"`.

A nightly reboot keeps everything honest:

## Updating

```bash
sudo -u infoborden bash -c 'cd /opt/infoborden && git pull && ./scripts/build-standalone.sh'
sudo systemctl restart infoborden
```

All three screens pick the change up on their next poll — within 30 seconds, no
need to touch the display Pis. Data changes land by themselves; **code** changes
land because each screen notices the host is running a build it isn't, and
reloads itself (see below).

### Which build is on the screen?

Every build is stamped with the commit it came from and the time it was built —
`a3f19c · 07-08 21:40`. A `*` after the commit means the tree was dirty when it
was built, which on the host means someone edited files in `/opt/infoborden`
instead of committing.

On a normal school day the stamp is **hidden**: nobody in the corridor needs a
commit hash, and the screens keep themselves current whether or not it's on
screen. Turn it on while you're deploying or chasing a problem, in
`/opt/infoborden/.env.local`:

```
BUILD_STAMP=on
```

```bash
sudo systemctl restart infoborden
```

It appears in the bottom-right corner of all three panels within 30 seconds,
small and faint — legible if you walk up to a screen, ignorable from down the
corridor. Set it back to `off` (or delete the line) and restart, and it's gone
again just as fast; the screens notice the setting changed and pick it up on
their next poll, so nothing needs rebooting either way.

For one screen only, without touching the host's config, append `?build=1` to
that panel's `BOARD_URL` in `/etc/default/infoborden-kiosk` (`?build=0` hides
it). In development the stamp is on by default.

What the *host* is serving, from any machine on the LAN — and this works with
the stamp hidden:

```bash
curl -s http://infobord.local/api/board | grep -o '"build":"[^"]*"'
```

The stamp is baked into the server and the browser bundle at build time, so the
screens compare the two on every poll. When they differ — the host has been
rebuilt, the panel is still running the old bundle — the screen reloads itself
at the next gap between full-screen items, so nobody watches a message get cut
in half. It reloads at most once per host build: if a reload doesn't fix the
mismatch, the board stays up rather than flashing every 30 seconds.

That happens with the stamp hidden too — it's the half of this that earns its
keep on ordinary days. It covers the failure that used to look like "the deploy
didn't work": the host was fine, and the panel was still running the bundle it
booted with weeks earlier, since a kiosk loads the page once and never navigates
again.

If a screen's stamp is still behind a few minutes after a deploy (with
`BUILD_STAMP=on`):

- Stamp matches `curl` but the change isn't there → the build didn't include it.
  Check `git log -1` on the host.
- Stamp is behind and not moving → that panel isn't polling. It should also be
  showing "Geen verbinding" within five minutes; check the network first, then
  `systemctl restart infoborden-kiosk` on that Pi.

## Never point a screen at `next dev`

The screens must load the **production** server — the standalone build from step
2, or `npm run start`. Next's dev server (`npm run dev`) does not hydrate
reliably in the Pi's Chromium: the page renders but no client JavaScript takes
over, so the clock sticks at `--:--`, the messages stop cycling, and the board
never polls for new data. It looks like a frozen screenshot. Production hydrates
correctly. If you test against a laptop before the host exists, run
`./scripts/build-standalone.sh` and serve that, not `npm run dev`.

## What breaks, and what happens

| Failure | Result |
| --- | --- |
| School internet down | Host can't reach Sheets. The board shows "Rooster tijdelijk niet beschikbaar" rather than implying a quiet day. Messages, birthdays and the clock keep working. |
| Host down or rebooting | Screens keep showing their last board from `localStorage`, and raise "Geen verbinding" after five minutes. |
| One display Pi down | The other two are unaffected — they only depend on the host. |
| Power cut | Host and screens come back on their own; `Restart=always` and the kiosk autostart handle it. |
| Screen boots while host is down | The screen shows a branded "verbinden…" splash (served from its own disk) and forwards to the board the moment the host answers — no error page, and it lands on fresh data. |

### Power resilience (recommended)

The one scenario the splash smooths over is a building-wide power cut where a
display Pi boots faster than the host. To stop it happening at all, put a small
UPS on the **host** (and ideally the network switch): the host then rides through
short blips and outlasts the displays' boot, so they rarely meet a dead host. A
~€40 mini-UPS covers it. The splash handles the rest.
