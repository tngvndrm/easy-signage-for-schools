#!/usr/bin/env bash
# Launch the board full-screen under cage, a minimal Wayland kiosk compositor.
#
# cage owns the whole display: it starts one full-screen client and exits when
# that client exits; the systemd unit then restarts it. Exactly one job, which
# is what a signage screen is.
set -euo pipefail

# The script runs twice: once as the outer launcher, then re-executed by cage as
# its client (the --inner branch), where a Wayland display exists.
if [ "${1:-}" = "--inner" ]; then
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

  # cage draws a default cursor mid-screen when no mouse is attached, and CSS
  # can't clear it until Chromium receives a pointer event. Nudge the pointer to
  # the far corner once the browser is up: Chromium then owns the cursor (which
  # the board styles as none) and any residual arrow sits in the overscan corner.
  if command -v wlrctl >/dev/null 2>&1; then
    (sleep 4; wlrctl pointer move 100000 100000) >/dev/null 2>&1 &
  fi

  # --disable-features=Translate,TranslateUI belt-and-suspenders with the page's
  # own notranslate meta, so the "Translate?" menu never appears.
  exec chromium \
    --kiosk \
    --ozone-platform=wayland \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=Translate,TranslateUI \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    "$BOARD_URL"
fi

# Outer: hand cage this same script's inner branch as its client. SCREEN and
# BOARD_URL come from the environment (the systemd EnvironmentFile) and pass
# straight through cage to the inner run.
exec cage -- "$0" --inner
