# Installing Infoborden

Everything stays on the school network: only the machine running the server
talks to Google (outbound), so the student names on the board never leave the
building. The screens only ever talk to that server.

There are two ways to set it up. **Pick one, then follow the parts below** —
the steps are shared, and each part says what differs per mode.

```
A. Standalone — one device per screen        B. Server–client — one server, N screens

      Google Sheets                                Google Sheets
           ▲                                            ▲
           │ (outbound only)                            │ (outbound only)
   ┌───────┴─────────┐                         ┌────────┴─────────┐
   │ display Pi      │                         │ server           │
   │ server ◀─ kiosk │                         │ (Pi, Mac or Win) │
   └─────────────────┘                         └──┬─────┬─────┬───┘
                                                  │     │     │
                                              kiosk 1  kiosk 2  kiosk 3
```

**Mode A — standalone.** The display Pi runs the server itself and points its
own kiosk browser at `localhost`. No second box, no name resolution, nothing
else to fail. The trade-off: every screen is an island — each one carries its
own copy of the app and the service-account key, polls Google on its own, and
has to be updated separately. Best for a single screen.

**Mode B — server–client.** One always-on machine runs the server; every
display Pi is a dumb client showing it. Data, configuration and updates live
in one place. The server can be a spare Raspberry Pi, a Mac, or a Windows
machine. Best for two or more screens. Prefer a dedicated box over doubling
one of the display Pis: rebooting that display would take the data source away
from the others (they'd fall back to cached data and show "Geen verbinding").

Either way you'll do two parts:

- **Part 1 — the server**: get the app built, wired to the Google Sheet, and
  running. In Mode A this happens *on the display Pi itself*.
- **Part 2 — the display(s)**: turn each display Pi into a kiosk that shows
  the board full-screen. Identical in both modes; only the URL differs.

## What you need

- Per screen: a Raspberry Pi (4 or newer) on **Pi OS Lite** — no desktop —
  attached to its TV/display.
- Mode B only: the server machine (spare Pi with Pi OS Lite, or a Mac or
  Windows machine that is always on during school hours).
- The Google Sheet wired to a service account — the Google-side setup
  (Cloud project, Sheets API, service account, sharing) is in the README under
  [**Wiring the Google Sheet**](../README.md#wiring-the-google-sheet). You'll
  need the `service-account.json` key file and the sheet id in Part 1.3.

---

# Part 1 — The server

Goal: `http://<server>/screen/1` renders the board in a normal browser. In
Mode A, "the server" is the display Pi itself; do this part on it first, then
Part 2 on the same device.

## 1.1 Prepare the machine and get the code

**Raspberry Pi (Mode A, or a Pi server in Mode B)** — install Node 22 and
Avahi (so the screens can find the server as `infobord.local` without anyone
managing DHCP reservations), and create the service user:

```bash
sudo hostnamectl set-hostname infobord
sudo apt update && sudo apt install -y git avahi-daemon
# The server clock decides what "today" is for every screen — keep it synced.
sudo timedatectl set-ntp true
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo useradd --system --home /opt/infoborden --shell /usr/sbin/nologin infoborden
```

Then put the repo in `/opt/infoborden`. If the Pi can reach wherever the repo
is hosted (GitHub, a school Git server), clone it:

```bash
sudo git clone https://github.com/<org>/<repo>.git /opt/infoborden
sudo chown -R infoborden:infoborden /opt/infoborden
```

If it can't — private repo, no credentials on the Pi, locked-down network —
push a copy across from your laptop instead ("Updating" below then means
re-running this rsync):

```bash
rsync -a --exclude node_modules --exclude .next ./ <user>@infobord.local:/tmp/infoborden/
ssh <user>@infobord.local 'sudo mv /tmp/infoborden /opt/infoborden && sudo chown -R infoborden:infoborden /opt/infoborden'
```

**Mac (Mode B)** — install Node 22+ (`brew install node@22`, or the installer
from nodejs.org) and clone the repo somewhere convenient, e.g. `~/infoborden`.
Bonjour is built in, so the screens can reach the Mac as
`<its-name>.local` (System Settings → General → Sharing → local hostname).

**Windows (Mode B)** — install Node 22+ (nodejs.org) and
[Git for Windows](https://gitforwindows.org) (its **Git Bash** shell runs the
build script as-is), and clone the repo, e.g. to `C:\infoborden`. Windows'
`.local` name resolution is unreliable as a *server* — give the machine a
fixed IP (or a DHCP reservation) and use that IP in the screens' URLs.

## 1.2 Build

The build produces a self-contained server in `.next/standalone/` — the script
also copies in the static assets that `next build` deliberately leaves out
(the step everyone misses once and debugs for an hour):

```bash
./scripts/build-standalone.sh
```

- Pi: run it as the service user —
  `sudo -u infoborden bash -c 'cd /opt/infoborden && ./scripts/build-standalone.sh'`
- Mac: run it in Terminal from the repo directory.
- Windows: run it in **Git Bash** from the repo directory — or its PowerShell
  twin, no Git Bash needed:
  `powershell -ExecutionPolicy Bypass -File scripts\build-standalone.ps1`.

## 1.3 Credentials and config

Copy `service-account.json` into the repo directory and (on the Pi) lock it
down — it's the one real secret on the box:

```bash
sudo chown infoborden:infoborden /opt/infoborden/service-account.json
sudo chmod 600 /opt/infoborden/service-account.json
```

Create `.env.local` in the repo directory. **Use an absolute path for the
key**: the service runs from `.next/standalone`, so the
`./service-account.json` that works in development resolves to the wrong place
here.

```
SHEET_ID=<the long id from the sheet's URL>
GOOGLE_APPLICATION_CREDENTIALS=/opt/infoborden/service-account.json
TIMEZONE=Europe/Brussels
LOCALE=nl-BE
THEME=light
ACCENT=coral
```

(On Mac/Windows, use that machine's absolute path, e.g.
`/Users/you/infoborden/service-account.json` or
`C:\infoborden\service-account.json`.)

The per-tab ranges (`SHEET_RANGE`, `KEYS_SHEET_RANGE`, …) all have sensible
defaults; copy them from [`.env.example`](../.env.example) only if your tabs
use different names or need more rows.

Now prove the whole chain — key, sharing, sheet id — before wiring anything
into a service, while the error messages are still cheap to act on:

```bash
npm run check:sheet          # on the Pi: sudo -u infoborden bash -c 'cd /opt/infoborden && npm run check:sheet'
```

It says exactly which step is missing (no key, sheet not shared, API not
enabled); fix and re-run until every check is green.

## 1.4 Run it — and keep it running

**Raspberry Pi** — a systemd unit ships in `deploy/`:

```bash
sudo cp /opt/infoborden/deploy/infoborden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now infoborden
systemctl status infoborden
```

It binds **port 80** via a capability rather than running as root, so the
screens get a bare URL, and `Restart=always` means it heals itself — nobody is
watching a signage box.

**Mac** — a LaunchAgent template ships in `deploy/`; it starts the server at
login on **port 3000** and restarts it if it dies:

```bash
sed "s|__REPO__|$HOME/infoborden|" deploy/infoborden.launchagent.plist \
  > ~/Library/LaunchAgents/local.infoborden.plist
launchctl load ~/Library/LaunchAgents/local.infoborden.plist
```

(Auto-login the Mac account so a power cut doesn't strand the server at the
login screen.)

**Windows** — `deploy/start-infoborden.ps1` loads `.env.local` and starts the
server on **port 3000**. Try it by hand first, then register it to run at
startup:

```powershell
powershell -ExecutionPolicy Bypass -File C:\infoborden\deploy\start-infoborden.ps1
```

Task Scheduler → Create Task → trigger **At startup**, action *Start a
program*: `powershell.exe` with arguments
`-ExecutionPolicy Bypass -File C:\infoborden\deploy\start-infoborden.ps1`,
and tick "Run whether user is logged on or not". Allow inbound connections
when the Windows Firewall asks (or add a rule for TCP 3000).

On **Windows Server** — IIS holding port 80, pinned execution policy, a proper
service wrapper instead of Task Scheduler — follow the dedicated runbook:
[`deploy-windows.md`](deploy-windows.md).

**Check it** — from another machine on the network:

```bash
curl -s http://infobord.local/api/board | head -c 200          # Pi (port 80)
curl -s http://<server>.local:3000/api/board | head -c 200     # Mac
curl -s http://<server-ip>:3000/api/board | head -c 200        # Windows
```

JSON means the server side is done.

## If the server misbehaves

| Symptom | Cause and fix |
| --- | --- |
| `npm ci` fails with "Unsupported engine … node >=22" | Node too old (an apt-default Node, usually). Install Node 22 as in 1.1 — the install is *meant* to stop here rather than fail confusingly at runtime. |
| `EACCES` binding `0.0.0.0:80` | Only the systemd unit may bind port 80 (it grants the capability). Started by hand, use `PORT=3000 node .next/standalone/server.js` — and put `:3000` in the screens' URLs. |
| `EADDRINUSE` | Something else owns the port. Pick another `PORT` and update the screens' `BOARD_URL` to match. |
| Service restart-loops | `journalctl -u infoborden -n 50`. Usual causes: `.env.local` missing at `/opt/infoborden/.env.local` (the unit's `EnvironmentFile`), or a *relative* `GOOGLE_APPLICATION_CREDENTIALS`. |
| Board shows a **Demo-data** badge | `SHEET_ID` isn't reaching the server — `.env.local` not found or edited without restarting the service (`sudo systemctl restart infoborden`). |
| Board shows **"Rooster tijdelijk niet beschikbaar"** | The server runs but can't reach Google: no internet route, firewall, or revoked key. The journal logs the exact Sheets error per tab. |
| `check:sheet` fails | Its own output is the fix list: share the sheet with the printed address, enable the Sheets API in the right project, correct the sheet id. |
| Screens can't reach a Windows server, local browser can | Windows Firewall is blocking inbound node. Add an inbound rule for TCP 3000. |
| `infobord.local` doesn't resolve | Pi: Avahi missing (`sudo apt install avahi-daemon`). Windows server: don't rely on `.local` — use the fixed IP. Some Android tablets also can't do mDNS; the IP always works. |

---

# Part 2 — The display(s)

Each display Pi runs the board full-screen under **cage**, a minimal Wayland
kiosk compositor. No desktop, no display manager, no autologin greeter — cage
boots straight into one full-screen Chromium and nothing else. Pi OS **Lite**
is the right image; the desktop packages are not needed.

In Mode A this is the same device as Part 1; in Mode B repeat this part on
every display Pi.

## 2.1 Install the kiosk

```bash
sudo apt update && sudo apt install -y cage chromium wlrctl
```

The kiosk service runs as the user `infobordbeheerder` — create it, in the
groups that grant access to the GPU and input devices:

```bash
sudo useradd -m -G video,render,input infobordbeheerder
```

(If you'd rather run as the user you imaged the Pi with, edit `User=` in
`infoborden-kiosk.service` and add that user to the same groups.)

Then install the kiosk unit. It ships in the repo's `deploy/` directory,
which must exist at `/opt/infoborden/deploy/` on **this** Pi first:

- **Mode A** — nothing to do: Part 1 already put the whole repo at
  `/opt/infoborden`.
- **Mode B** — a display Pi doesn't have the repo yet. If it can reach
  wherever the repo is hosted, clone it (the kiosk only *reads* `deploy/`, so
  a root-owned clone is fine — no service user needed here):

  ```bash
  sudo apt install -y git
  sudo git clone https://github.com/<org>/<repo>.git /opt/infoborden
  ```

  If it can't — private repo, no credentials on the Pi — push just the
  `deploy/` directory (the unit, the launch script and the splash page is all
  the kiosk needs) across from your laptop, run from the repo directory. Note
  the target is this display Pi's own hostname or IP, *not* `infobord.local`
  (that's the server):

  ```bash
  rsync -a ./deploy/ <user>@<display-pi>:/tmp/infoborden-deploy/
  ssh <user>@<display-pi> 'sudo mkdir -p /opt/infoborden && sudo rm -rf /opt/infoborden/deploy && sudo mv /tmp/infoborden-deploy /opt/infoborden/deploy'
  ```

  (`rsync -a` keeps the exec bit on `kiosk-cage.sh`; if the files travel some
  other way — scp from Windows, a USB stick — put it back:
  `sudo chmod +x /opt/infoborden/deploy/kiosk-cage.sh`.)

With `deploy/` in place, install the unit (on the Pi):

```bash
sudo cp /opt/infoborden/deploy/infoborden-kiosk.service /etc/systemd/system/
```

## 2.2 Point it at the board

Set which screen this Pi is, and where the board lives:

```bash
sudo tee /etc/default/infoborden-kiosk <<'EOF'
SCREEN=1
BOARD_URL=http://localhost/screen/1
EOF
```

`BOARD_URL` per mode:

| Setup | `BOARD_URL` |
| --- | --- |
| Mode A (standalone) | `http://localhost/screen/1` |
| Mode B, Pi server | `http://infobord.local/screen/1` |
| Mode B, Mac server | `http://<mac-name>.local:3000/screen/1` |
| Mode B, Windows server | `http://<server-ip>:3000/screen/1` |

(`/screen/2` and `/screen/3` for the other displays, matching `SCREEN=`.)

## 2.3 Boot into it

The kiosk runs on the console, so make that the boot target (no desktop) and
start it:

```bash
sudo systemctl set-default multi-user.target
sudo systemctl daemon-reload
sudo systemctl enable --now infoborden-kiosk
```

The board should appear on the panel within a few seconds. A screen that boots
before the server is up shows a branded "verbinden…" splash from its own disk
and forwards to the board the moment the server answers.

Finally, a nightly reboot keeps everything honest — Chromium's memory use, a
wedged compositor, a leaked file handle all reset before anyone notices. It's
also what picks up new *code* after an update (see "Updating"):

```bash
echo '30 3 * * * root /sbin/shutdown -r now' | sudo tee /etc/cron.d/infoborden-reboot
```

(If the Pi also runs the TV-power schedule, keep the reboot inside the TV's
off window — see [`pi/tv-power/README.md`](../pi/tv-power/README.md).)

## If the screen misbehaves

First stop, always:

```bash
journalctl -u infoborden-kiosk -b --no-pager | tail -30
```

| Symptom | Cause and fix |
| --- | --- |
| Unit fails immediately, `status=217/USER` in the journal | The `infobordbeheerder` user doesn't exist — create it as in 2.1 (or fix `User=` in the unit). |
| `Permission denied` on `/dev/dri` or input devices | The seat session didn't grant device access. `sudo usermod -aG video,render,input infobordbeheerder`, then reboot. |
| A login prompt appears instead of the board | The Pi still boots to a getty or desktop. `sudo systemctl set-default multi-user.target`, check the unit is enabled, reboot. |
| Blank window, service running | Chromium reached the compositor but not the board. Check `BOARD_URL` (typo, wrong port, wrong mode row above) and test it: `curl -I "$BOARD_URL"`. |
| Stuck on the "verbinden…" splash | The server isn't answering: not running, wrong address, or a firewall between them. Verify Part 1's `curl` check from this Pi. |
| Clock stuck at `--:--`, messages never cycle | The screen is pointed at a **dev** server. Never do that — see below. |
| An arrow cursor sits mid-screen | `wlrctl` isn't installed (the kiosk script uses it to park the pointer); `sudo apt install wlrctl` and restart the kiosk. |
| Board shows old data with a **"Geen verbinding"** badge | The screen lost the server more than five minutes ago and is showing its cached copy — by design. Fix the server or the network; it recovers on the next successful poll. |

## Never point a screen at `next dev`

The screens must load the **production** server — the standalone build from
Part 1, or `npm run start`. Next's dev server (`npm run dev`) does not hydrate
reliably in the Pi's Chromium: the page renders but no client JavaScript takes
over, so the clock sticks at `--:--`, the messages stop cycling, and the board
never polls for new data. It looks like a frozen screenshot. Production
hydrates correctly. If you test against a laptop before the server exists, run
`./scripts/build-standalone.sh` and serve that, not `npm run dev`.

---

# Updating

On the server (in Mode A: on each screen — that's the trade-off):

```bash
# Pi
sudo -u infoborden bash -c 'cd /opt/infoborden && git pull && ./scripts/build-standalone.sh'
sudo systemctl restart infoborden
# Mac / Windows: git pull, re-run the build (1.2), restart the server process.
# Installed by rsync instead of git? Re-run the rsync, then build.
```

The display Pis' `deploy/` files (kiosk unit, launch script, splash) rarely
change; when they do, on each display Pi: `sudo git -C /opt/infoborden pull`
(or re-run the rsync from 2.1), re-copy the unit if it changed
(`sudo cp /opt/infoborden/deploy/infoborden-kiosk.service /etc/systemd/system/ && sudo systemctl daemon-reload`),
then `sudo systemctl restart infoborden-kiosk`.

**Sheet content** needs none of this — the board picks it up on its next
30-second poll. A **new build** is different: the screens' browsers only load
new code on a page load, so it arrives at the nightly reboot — or immediately
with `sudo systemctl restart infoborden-kiosk` on each display Pi.

# Moving a Pi to a different Wi-Fi network

New building, new access point, or the school rotated the Wi-Fi password — this
comes up once a year and costs an afternoon if you follow the wrong guide.

**Most tutorials online are out of date.** Editing
`/etc/wpa_supplicant/wpa_supplicant.conf` does nothing on Pi OS Bookworm: the
network stack is NetworkManager now, and it ignores that file. If you edited it
and nothing changed, that's why.

Two notes before you start. The **server** should be on Ethernet if the cabinet
has a port — it serves every screen, and a cable removes a whole class of
morning-of failures. And if you SSH into a Pi *over Wi-Fi*, your session dies
the moment the network switches. Do it over Ethernet, or with a keyboard and
monitor on the Pi, unless you enjoy surprises.

## With a shell on the Pi

`nmtui` is a text UI — no syntax to get wrong, which matters when you're doing
this on a stepladder:

```bash
sudo nmtui
```

Choose *Activate a connection*, pick the new SSID, type the password.

The same thing without the UI, for when you're doing all four boxes in a row:

```bash
nmcli device wifi list                                          # what's in range
sudo nmcli device wifi connect "NEW_SSID" password "NEW_PASSWORD"
sudo nmcli connection delete "OLD_SSID"                         # stop it competing
```

Delete the old network. If both are configured and both are reachable — during
a migration where the old AP is still up — the Pi will happily pick the wrong
one after a reboot, and you'll be debugging it in November.

Confirm it actually landed, and get the new address:

```bash
nmcli -t -f NAME,DEVICE connection show --active
hostname -I
```

## Check the country code when you change sites

The regulatory domain decides which channels the radio may use; a wrong or
unset one hides most of the 5 GHz band, and the symptom is "it connects but
it's slow" rather than a clear error:

```bash
sudo raspi-config nonint do_wifi_country BE
```

## When you can't reach the Pi at all

If the Pi is already provisioned, the fastest fix is a keyboard and a monitor —
genuinely faster than the SD card route, which needs a Linux machine to write
to the ext4 root partition. macOS and Windows can't mount it without extra
tooling.

The `custom.toml` trick you'll find online only applies to a **freshly imaged**
card: the boot partition is read once on first boot and then never again. It's
worth knowing for when you're building a replacement screen anyway, since it
saves attaching a keyboard to a new Pi at all — set it in Raspberry Pi Imager's
advanced options, or write `/boot/firmware/custom.toml` yourself:

```toml
config_version = 1

[system]
hostname = "infobord"

[user]
name = "infobordbeheerder"
password = "YOUR_PASSWORD"
password_encrypted = false

[wlan]
ssid = "NEW_SSID"
password = "NEW_PASSWORD"
password_encrypted = false
country = "BE"

[ssh]
enabled = true
```

(`hostname = "infobord"` is for the *server* Pi — a Mode B display Pi should
get its own name.)

## After the move

The screens find the server by name, so `infobord.local` keeps working on the
new network without touching `BOARD_URL` — that's the reason Avahi is in step
1.1. Two things to check anyway:

- **Avahi needs the screens and the server on the same subnet.** mDNS doesn't
  cross VLANs. If the school put the Pis on a separate device VLAN from where
  you're testing, the name resolves from the screens but not from your laptop,
  which looks like a dead server when it isn't. Test from a screen:
  `curl -I http://infobord.local/api/board`.
- **Guest networks usually block client-to-client traffic.** The server will
  reach Sheets fine and the screens will still show "Geen verbinding", because
  the screens can't reach the server. If that's the only network on offer, ask
  for a port on the wired VLAN instead — this deployment needs the screens to
  talk to the server, not to the internet.

# What breaks, and what happens

| Failure | Result |
| --- | --- |
| School internet down | The server can't reach Sheets. The board shows "Rooster tijdelijk niet beschikbaar" rather than implying a quiet day. Messages, birthdays and the clock keep working. |
| Server down or rebooting (Mode B) | Screens keep showing their last board from `localStorage`, and raise "Geen verbinding" after five minutes. |
| Server service crashes (Mode A) | systemd restarts it within seconds; the kiosk shows the cached board meanwhile. |
| One display Pi down | The others are unaffected — in Mode B they only depend on the server; in Mode A they were never connected to it at all. |
| Power cut | Server and screens come back on their own; `Restart=always` and the kiosk autostart handle it. |
| Screen boots while the server is down | The "verbinden…" splash (served from the screen's own disk) holds until the server answers, then forwards — no error page, and it lands on fresh data. |

### Power resilience (recommended, Mode B)

The one scenario the splash smooths over is a building-wide power cut where a
display Pi boots faster than the server. To stop it happening at all, put a
small UPS on the **server** (and ideally the network switch): the server then
rides through short blips and outlasts the displays' boot, so they rarely meet
a dead server. A ~€40 mini-UPS covers it. The splash handles the rest. (Mode A
has no such race — each screen boots its own server.)
