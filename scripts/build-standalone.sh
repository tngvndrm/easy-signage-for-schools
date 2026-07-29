#!/usr/bin/env bash
# Build a self-contained server for the LAN host.
#
# Next's standalone output deliberately leaves out static assets, so a plain
# `next build` produces a server that runs but serves an unstyled page. Copying
# them in is the step everyone misses once and debugs for an hour.
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci
npm run build

cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static

echo
echo "Ready: .next/standalone/server.js"
echo "Run with:  HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js"
