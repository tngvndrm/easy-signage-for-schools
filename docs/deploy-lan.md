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

On each display Pi, install `deploy/kiosk.sh` as `/home/pi/kiosk.sh`, make it
executable, and set the screen number:

```bash
chmod +x /home/pi/kiosk.sh
echo 'SCREEN=1' | sudo tee /etc/default/infoborden-kiosk   # 1, 2 or 3 per Pi
```

Wire it to start with the desktop. On Raspberry Pi OS Bookworm (Wayland), add to
`~/.config/wayfire.ini`:

```ini
[autostart]
kiosk = /home/pi/kiosk.sh
```

On an X-based image, use `~/.config/autostart/kiosk.desktop` instead:

```ini
[Desktop Entry]
Type=Application
Name=Infobord
Exec=/home/pi/kiosk.sh
X-GNOME-Autostart-enabled=true
```

### Testing the kiosk over SSH

`kiosk.sh` starts a browser, so it needs the Pi's own display session. Run it
plain over SSH and it fails with "cannot open display". Point it at the session
first:

```bash
# Raspberry Pi OS Bookworm (Wayland — the Pi 4 default)
export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-0
/home/pi/kiosk.sh

# Older X-based images
export DISPLAY=:0 XAUTHORITY=/home/pi/.Xauthority
/home/pi/kiosk.sh
```

Both need the Pi booted to the **desktop with autologin**
(`sudo raspi-config` → System Options → Boot / Auto Login → Desktop Autologin).
A display Pi running Pi OS Lite has no compositor at all, so there is nothing
for Chromium to attach to — the Lite image is right for the *host*, not for the
screens.

Under Wayland the `xset` calls in the script are silently skipped, since they're
X-only. Blanking is a compositor setting there: in `~/.config/wayfire.ini`,

```ini
[idle]
dpms_timeout = -1
screensaver_timeout = -1
```

A nightly reboot keeps everything honest:

```bash
sudo crontab -e
# 0 4 * * * /sbin/shutdown -r now
```

## Updating

```bash
sudo -u infoborden bash -c 'cd /opt/infoborden && git pull && ./scripts/build-standalone.sh'
sudo systemctl restart infoborden
```

All three screens pick the change up on their next poll — within 30 seconds, no
need to touch the display Pis.

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
