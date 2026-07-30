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
sudo apt update && sudo apt install -y cage chromium
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
need to touch the display Pis.

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

The gap worth knowing about: a screen that boots while the **host** is down gets
Chromium's error page, because `localStorage` only helps once the page has
loaded at least once. A service worker fixes that and is still on the
not-built list.
