#!/usr/bin/env bash
# Launch the board full-screen under cage, a minimal Wayland kiosk compositor.
#
# cage owns the whole display: it starts one client, full-screen, with no
# desktop, panel or window chrome, and exits when that client exits — the
# systemd unit then restarts it. Exactly one job, which is what a signage
# screen is.
set -euo pipefail

SCREEN="${SCREEN:-1}"
BOARD_URL="${BOARD_URL:-http://infobord.local/screen/${SCREEN}}"

# A power cut looks like a crash to Chromium; clear the flags so the "restore
# pages?" bubble never covers the board.
PREF="${HOME}/.config/chromium/Default/Preferences"
if [ -f "$PREF" ]; then
  sed -i \
    -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    -e 's/"exited_cleanly":false/"exited_cleanly":true/' \
    "$PREF" || true
fi

# cage sets WAYLAND_DISPLAY for the child; -- separates it from the browser.
exec cage -- chromium \
  --kiosk \
  --ozone-platform=wayland \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI,Translate \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  "$BOARD_URL"
