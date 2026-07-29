#!/usr/bin/env bash
# Chromium kiosk autostart for one screen.
#
# Install on each Pi as /home/pi/kiosk.sh, then set SCREEN below (1, 2 or 3)
# and wire it up per docs/deploy-lan.md.
set -euo pipefail

SCREEN="${SCREEN:-1}"
BOARD_URL="${BOARD_URL:-http://infobord.local/screen/${SCREEN}}"

# Never let the panel blank or the mouse pointer sit on screen.
if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

# Chromium refuses to start if it thinks it crashed last time, which is exactly
# what a power cut looks like. Clearing these flags avoids the restore bubble
# covering the board until someone walks over and dismisses it.
PROFILE="${HOME}/.config/chromium/Default/Preferences"
if [ -f "$PROFILE" ]; then
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/; s/"exited_cleanly":false/"exited_cleanly":true/' "$PROFILE" || true
fi

CHROME=$(command -v chromium-browser || command -v chromium)

exec "$CHROME" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI,Translate \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --start-fullscreen \
  "$BOARD_URL"
