# Windows server: load .env.local and start the Infoborden server on PORT
# (default 3000). Run it by hand first; then register it in Task Scheduler
# ("At startup") to keep it running — see docs/deploy-lan.md, Part 1.4.

$ErrorActionPreference = "Stop"

# The script lives in deploy/; the repo root is one level up.
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env.local")) {
  Write-Error ".env.local not found next to package.json - create it first (docs/deploy-lan.md, Part 1.3)."
}

Get-Content ".env.local" | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*)\s*$') {
    Set-Item -Path ("Env:" + $Matches[1]) -Value $Matches[2]
  }
}

if (-not $env:PORT) { $env:PORT = "3000" }
$env:HOSTNAME = "0.0.0.0"

node .next\standalone\server.js
