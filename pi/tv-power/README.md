# TV power schedule

> **Not in use at Steinerschool Gent, and don't switch it on there.** These Pis are
> powered from their TV's USB port, so putting the TV into standby cuts the Pi's
> power — and a Pi with no power can't send the `on` command that would wake the TV
> in the morning. Somebody would have to walk to each screen with a remote.
>
> The board blacks itself out on schedule instead: **Standby hours** in the main
> [README](../../README.md#standby-hours), from the same `Turn Off` / `Turn On`
> columns. The panel stays lit, which is the cost of the workaround.
>
> Everything below stands for a deployment where each Pi has its own power supply.

Turns the attached TV on and off on a schedule, over HDMI-CEC, from the Raspberry Pi
that already drives it. No extra hardware, no smart plug — the same HDMI cable that
carries the picture carries the power commands.

The schedule lives in a JSON file on each Pi (`/etc/infoborden/tv-power-schedule.json`)
— edit it there; the format is documented below.

---

## Step 0 — Before you touch the Pi

Two things on the TV side, both of which are the usual reason CEC "doesn't work":

1. **Enable CEC in the TV's menu.** Every manufacturer renamed it:
   | Brand | Menu name |
   |---|---|
   | Samsung | Anynet+ |
   | LG | SIMPLINK |
   | Sony | BRAVIA Sync |
   | Philips | EasyLink |
   | Panasonic | VIERA Link |
   | Sharp | Aquos Link |
   | Toshiba | Regza Link / CE-Link |
   | Hisense / TCL | HDMI CEC |

   Also look for a sub-option like "Auto power off / Device auto power on" and enable it.

2. **Use HDMI0 on the Pi 4** — the micro-HDMI port *nearest the USB-C power connector*.
   CEC is only wired to that port. If your screens are on HDMI1, move the cable.

Avoid HDMI switches, splitters and long passive extenders between Pi and TV; most of
them silently drop CEC even when the picture is fine.

## Step 1 — Prove CEC works, before installing anything

On one Pi, over SSH:

```bash
sudo apt update && sudo apt install -y cec-utils
```

Check the TV is visible on the CEC bus:

```bash
echo scan | cec-client -s -d 1
```

You want a block like `device #0: TV` with a vendor and an OSD name. If you see
`device #0` and nothing else, or the command hangs and returns nothing, CEC is not
getting through — go back to Step 0 before continuing.

Now try it for real. Turn the TV off:

```bash
echo "standby 0" | cec-client -s -d 1
```

And back on:

```bash
echo "on 0" | cec-client -s -d 1
```

If the TV wakes but stays on a different input, this also switches it back:

```bash
echo "as" | cec-client -s -d 1
```

**If the TV goes to standby but never wakes:** some TVs disable the CEC receiver in
standby entirely. See "If your TV refuses to wake" at the bottom — that's the case the
`FALLBACK_*_CMD` settings exist for.

## Step 2 — Install the agent

Copy this directory to the Pi and run the installer:

```bash
sudo ./install.sh
```

It installs `cec-utils` + `v4l-utils`, drops the agent at `/usr/local/bin/infoborden-tv-power`,
writes `/etc/infoborden/tv-power.conf` and a local fallback schedule, and enables a
systemd timer that ticks once a minute.

## Step 3 — Configure this Pi

```bash
sudo nano /etc/infoborden/tv-power.conf
```

At minimum set `SCREEN_ID` (1, 2 or 3) and `TIMEZONE`. Leave `SCHEDULE_URL` empty —
the agent runs off `/etc/infoborden/tv-power-schedule.json`. Then put the real
on/off times in that file (the installer seeded it with the example schedule).

## Step 4 — Verify

```bash
sudo infoborden-tv-power status
```

```
now:            2026-09-01 08:12 CEST
schedule source:local file
today's windows:[{'on': '07:30', 'off': '17:30'}]
desired:        on
last applied:   on
CEC backend:    cec-client
TV reports:     on
```

`TV reports: no answer` means CEC isn't reaching the TV — back to Step 1.

Force a decision without waiting for the timer, and watch what it does:

```bash
sudo infoborden-tv-power run --dry-run
```

Drive the TV by hand at any time:

```bash
sudo infoborden-tv-power off
```

And watch the timer over a real transition:

```bash
journalctl -u infoborden-tv-power -f
```

## Step 5 — Roll out to the other two Pis

Same install, only `SCREEN_ID` differs.

---

## The schedule format

```json
{
  "version": 1,
  "timezone": "Europe/Brussels",
  "weekly": {
    "mon": [{ "on": "07:30", "off": "17:30" }],
    "wed": [{ "on": "07:30", "off": "13:30" }],
    "sat": [],
    "sun": []
  },
  "exceptions": [
    { "date": "2026-11-11", "windows": [] },
    { "date": "2026-12-18", "windows": [{ "on": "07:30", "off": "22:00" }] }
  ]
}
```

- A day may have **several windows** (e.g. on for the morning, off over a long lunch,
  on again) — they're just listed in order.
- An empty list means **off all day**: that's how holidays and closure days are expressed.
- `exceptions` fully replace the weekly windows for that date. This is what an evening
  event (theater play, parents' evening) or a school holiday looks like.
- A window whose `off` is earlier than its `on` **crosses midnight** — `20:00`–`02:00`
  keeps the screen up past midnight.
- A missing day key means off all day.

## How it behaves

- **It only acts on change.** The one-minute tick is a no-op unless the desired state
  differs from what it last applied, so the TV isn't spammed with CEC traffic.
- **It re-asserts, gently.** Every `REASSERT_SECONDS` (default 15 min) it *asks* the TV
  its power state, and only re-sends if the TV disagrees with the schedule. That
  recovers a screen someone switched off with a remote, without fighting the remote
  every minute.
- **Chromium keeps running** while the TV sleeps. The board is already rendered when the
  screen wakes, so there's no boot-up or blank-page moment in the morning.
- **A broken schedule fails safe.** If the schedule file is missing or invalid, the
  agent falls back to "always on" — a bad edit never leaves the hall with a dark
  screen for an unknown reason.

## If your TV refuses to wake over CEC

Some TVs cut the CEC receiver in standby. Then the trick is to never let the TV go to
standby at all: instead, kill the HDMI signal so the panel sleeps on its own, and restore
it to wake. Set both commands in `/etc/infoborden/tv-power.conf` — they run *alongside*
the CEC attempt, so it's fine to have both:

```
# Wayland (Pi OS Bookworm desktop / labwc / cage)
FALLBACK_ON_CMD=wlr-randr --output HDMI-A-1 --on
FALLBACK_OFF_CMD=wlr-randr --output HDMI-A-1 --off
```

```
# X11 kiosk
FALLBACK_ON_CMD=xset -display :0 dpms force on
FALLBACK_OFF_CMD=xset -display :0 dpms force off
```

```
# Legacy / fkms graphics stack
FALLBACK_ON_CMD=vcgencmd display_power 1
FALLBACK_OFF_CMD=vcgencmd display_power 0
```

Note this leaves the TV powered (it just shows no signal), so it saves the panel and the
light but not the standby wattage.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `scan` finds no TV | CEC off in TV menu, or cable on HDMI1 instead of HDMI0 |
| Works from SSH, not from the timer | Check `journalctl -u infoborden-tv-power`; the unit runs as root by design because `/dev/cec0` isn't world-writable |
| TV wakes on the wrong input | Leave `CEC_SET_ACTIVE_SOURCE=1`; if it fights another device, set it to `0` |
| TV turns back on right after someone switches it off | Expected — see re-assert above. Raise `REASSERT_SECONDS`, or set it to `0` |
| Everything off at odd hours | `sudo infoborden-tv-power status` and check `schedule source` — it should say `local file`; the always-on `fallback` means the schedule file is missing or invalid |
| `cec-client` hangs | Another process holds the adapter; `sudo systemctl stop infoborden-tv-power.timer` while testing by hand |

If you also run a nightly auto-reboot (see `docs/deploy-lan.md`, Part 2.3), schedule it
*inside* the off window — a reboot re-runs the agent 45s after boot and it will
re-apply whatever the schedule says.
