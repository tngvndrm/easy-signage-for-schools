# Build a self-contained server for the Windows host.
#
# The PowerShell twin of build-standalone.sh. Next's standalone output
# deliberately leaves out static assets, so a plain `next build` produces a
# server that runs but serves an unstyled page. Copying them in is the step
# everyone misses once and debugs for an hour.
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "next build failed" }

Copy-Item -Recurse -Force public .next\standalone\public
New-Item -ItemType Directory -Force .next\standalone\.next | Out-Null
Copy-Item -Recurse -Force .next\static .next\standalone\.next\static

Write-Host ""
Write-Host "Ready: .next\standalone\server.js"
Write-Host "Run with:  `$env:HOSTNAME='0.0.0.0'; `$env:PORT='3000'; node --env-file=.env.local .next\standalone\server.js"
