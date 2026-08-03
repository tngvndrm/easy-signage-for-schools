#!/usr/bin/env bash
# Install the TV power scheduler on a Raspberry Pi. Run with sudo, from this
# directory: sudo ./install.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "run me with sudo" >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> installing CEC tools"
apt-get update -qq
# cec-utils gives cec-client; v4l-utils gives cec-ctl as a backup backend.
apt-get install -y cec-utils v4l-utils

echo "==> installing agent"
install -m 0755 "$HERE/infoborden-tv-power" /usr/local/bin/infoborden-tv-power
install -d -m 0755 /etc/infoborden /var/lib/infoborden

if [[ ! -f /etc/infoborden/tv-power.conf ]]; then
  install -m 0644 "$HERE/tv-power.conf.example" /etc/infoborden/tv-power.conf
  echo "    wrote /etc/infoborden/tv-power.conf (edit it before trusting the schedule)"
else
  echo "    /etc/infoborden/tv-power.conf already exists, left alone"
fi

if [[ ! -f /etc/infoborden/tv-power-schedule.json ]]; then
  install -m 0644 "$HERE/tv-power-schedule.example.json" /etc/infoborden/tv-power-schedule.json
  echo "    wrote /etc/infoborden/tv-power-schedule.json (local fallback schedule)"
fi

echo "==> installing systemd units"
install -m 0644 "$HERE/infoborden-tv-power.service" /etc/systemd/system/
install -m 0644 "$HERE/infoborden-tv-power.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now infoborden-tv-power.timer

echo
echo "Done. Check it with:"
echo "  sudo infoborden-tv-power status"
echo "  systemctl list-timers infoborden-tv-power.timer"
echo "  journalctl -u infoborden-tv-power -f"
