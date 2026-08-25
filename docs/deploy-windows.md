# Deploying on a Windows Server host

The same architecture as Mode B in [`install.md`](install.md) — one box on the
school network serves all three screens, nothing is exposed to the internet —
with a Windows Server host instead of a Pi. Only the host talks to Google; the
screens only ever talk to the host.

Four things genuinely differ from the Linux runbook, and each has bitten
someone: there is no systemd, port 80 is usually already taken, `.local` names
don't resolve to a Windows host, and Windows refuses to overwrite files that a
running process holds open.

Tested shape: Windows Server 2019/2022/2025, PowerShell run **as
Administrator**, host reachable from the display Pis on the school LAN.

## 1. Prepare the host

Give the box a static IP (or a DHCP reservation) and a DNS name before you
start — the screens need a stable address, and see step 7 for why `.local`
won't do here.

```powershell
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Git.Git --exact
```

Open a new PowerShell window so `PATH` picks them up, then check you're on
Node 22 or newer — Next 16 won't run on older:

```powershell
node -v
```

Two Windows-only prerequisites worth doing now rather than debugging later:

```powershell
# npm's PowerShell shim is blocked by the default execution policy.
Set-ExecutionPolicy -Scope LocalMachine RemoteSigned -Force
# node_modules paths outrun the 260-character limit during install.
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
```

The host clock decides what "today" is for every screen, so keep it synced:

```powershell
w32tm /resync
```

## 2. Install the app

```powershell
git clone <this-repo> C:\infoborden
Set-Location C:\infoborden
powershell -ExecutionPolicy Bypass -File .\scripts\build-standalone.ps1
```

That runs `npm ci`, `next build`, and copies `public\` and `.next\static\` into
the standalone bundle — Next leaves those out, and without them the board
serves unstyled.

If Defender makes the build crawl, exclude the tree:
`Add-MpPreference -ExclusionPath C:\infoborden`.

**Don't set `NODE_ENV=production` machine-wide.** npm reads it and silently
installs only the runtime dependencies, so `next build` then fails on a missing
`typescript` or `@tailwindcss/postcss` — and it fails the same way on every
future rebuild, long after anyone remembers setting it. The service supplies
its own `NODE_ENV` in step 6. Check with
`[Environment]::GetEnvironmentVariable("NODE_ENV","Machine")` and clear it if
it's set.

## 3. Credentials and config

Copy `service-account.json` to `C:\infoborden\` and lock it down — it's the one
real secret on the box. This grants the service identity from step 6
(`LocalSystem` = `NT AUTHORITY\SYSTEM`) read access and nobody else but admins:

```powershell
icacls C:\infoborden\service-account.json /inheritance:r `
  /grant "NT AUTHORITY\SYSTEM:(R)" /grant "BUILTIN\Administrators:(F)"
```

Create `C:\infoborden\.env.local`. **Use an absolute Windows path for the
key** — the service runs from `.next\standalone`, so the `./service-account.json`
that works in development resolves to the wrong place here. Backslashes are
fine; the value is read as a literal path, not shell-quoted.

```
SHEET_ID=1De7Mx1SSBxRVgWXnzKKB9obKvw5EhGM0QaUrz5tM5v4
SHEET_RANGE=Vervangingen!A1:H400
KEYS_SHEET_RANGE=Sleutels!A1:H200
EVENTS_SHEET_RANGE=Evenementen!A1:H100
MESSAGES_SHEET_RANGE=Mededelingen!A1:H200
BIRTHDAYS_SHEET_RANGE=Verjaardagen!A1:F1000
SETTINGS_SHEET_RANGE=Settings!A1:L30
SCHEDULE_SHEET_RANGE=Schedule!A1:E50
STYLE_SHEET_RANGE=Style!A1:C40
SPECIAL_OCCASIONS_RANGE=Speciale Gelegenheden!A1:K400
GOOGLE_APPLICATION_CREDENTIALS=C:\infoborden\service-account.json
TIMEZONE=Europe/Brussels
LOCALE=nl-BE
BREAK_AFTER_PERIOD=4
THEME=light
ACCENT=coral
```

There is no `EnvironmentFile=` here, so the file is loaded by Node itself with
`--env-file` in steps 5 and 6. Don't put `.env.local` inside
`.next\standalone\` — every rebuild wipes that directory.

Verify the Sheets wiring before going further; it names the exact next step for
whatever isn't done yet, and prints the service-account address to share the
sheet with:

```powershell
npm run check:sheet
```

## 4. Pick a port and open the firewall

The Linux host binds port 80 so the screens get a bare URL. On Windows that's
usually a fight not worth having: IIS, a management agent, or the Internet
Printing role service all want port 80, and the last one arrives the day
somebody adds shared printers to this box. **Run on 3000 instead.** The screens
read their URL from one config line, so `http://infobord:3000/screen/1` costs
nothing to type once per Pi.

```powershell
New-NetFirewallRule -DisplayName "Infoborden board" -Direction Inbound `
  -Protocol TCP -LocalPort 3000 -Action Allow -Profile Domain,Private
```

Domain and private profiles only — the board is never exposed to the internet.

**If you do want the bare URL on port 80**, check that nothing holds it first.
No output from either command means it's free:

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Get-Process -Id $_.OwningProcess }
```

```powershell
Get-Service W3SVC -ErrorAction SilentlyContinue
```

The second matters as much as the first: IIS installed but stopped still takes
port 80 back at the next reboot, which turns into a board that worked on Friday
and is dead on Monday. If IIS is present and the box serves nothing else,
`Stop-Service W3SVC` and `Set-Service W3SVC -StartupType Disabled`. Then use 80
in place of 3000 in the firewall rule above and in steps 5, 6 and 7. Don't
reach for an IIS reverse proxy to have both; it's another moving part on a box
nobody watches.

### Sharing the host with a print server

Normal shared printing (Print and Document Services → **Print Server**) doesn't
touch HTTP — it rides on SMB 445 and RPC — so it coexists with the board fine.
The **Internet Printing** role service is the one to avoid: it pulls in the
whole IIS role as a dependency and publishes on port 80. On 3000 the board
doesn't care either way.

Worth knowing what you're signing up for, though: a print server accumulates
driver installs and reboot-demanding updates, and this box is meant to be up
during school hours. It works, but every printer problem becomes a signage
problem. Separate VMs if you have the room.

## 5. Smoke-test in the foreground

Before making it a service, confirm it serves — a failure here is much easier
to read than a service that won't start:

```powershell
$env:NODE_ENV="production"; $env:HOSTNAME="0.0.0.0"; $env:PORT="3000"
node --env-file=C:\infoborden\.env.local C:\infoborden\.next\standalone\server.js
```

From another window:

```powershell
curl.exe -s http://localhost:3000/api/board
```

Ctrl-C when it answers.

## 6. Run it as a service

Windows has no systemd, and `sc.exe create` won't do: `node.exe` isn't a service
binary, so Windows starts it and then kills it for never reporting ready. Use a
service wrapper. [NSSM](https://nssm.cc) is the usual choice — download it
yourself from the official site and unpack it to `C:\infoborden\tools\`.

The zip nests the binary in a `win64\` subfolder and nothing lands on `PATH`,
so put it somewhere findable — you'll need it again on every update. Adjust the
search path if you unpacked elsewhere; if it finds nothing the command prints
nothing, and the failure only surfaces later as "term not recognized":

```powershell
Copy-Item (Get-ChildItem C:\infoborden\tools -Recurse -Filter nssm.exe |
  Where-Object { $_.FullName -match 'win64' } | Select-Object -First 1).FullName `
  C:\Windows\System32\nssm.exe
```

NSSM won't create the log directory, and fails quietly to write if it's absent:

```powershell
New-Item -ItemType Directory -Force C:\infoborden\logs | Out-Null
```

Confirm the wrapper resolves before going further:

```powershell
Get-Command nssm
```

Now the `infoborden.service` unit translated one line at a time, from an
**elevated** PowerShell — registering a service needs it:

```powershell
nssm install infoborden "C:\Program Files\nodejs\node.exe"
nssm set infoborden AppParameters "--env-file=C:\infoborden\.env.local C:\infoborden\.next\standalone\server.js"
nssm set infoborden AppDirectory C:\infoborden\.next\standalone
nssm set infoborden AppEnvironmentExtra NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
nssm set infoborden Start SERVICE_DELAYED_AUTO_START
nssm set infoborden AppExit Default Restart
nssm set infoborden AppRestartDelay 5000
nssm set infoborden AppStdout C:\infoborden\logs\out.log
nssm set infoborden AppStderr C:\infoborden\logs\err.log
nssm set infoborden AppRotateFiles 1
nssm start infoborden
```

`AppDirectory` is not optional — the standalone bundle expects to run from its
own directory. Delayed auto-start is the equivalent of the unit's
`After=network-online.target`; restart-on-exit is its `Restart=always`, because
a signage box should heal itself when nobody is watching.

Check it, from the host and then from your laptop:

```powershell
Get-Service infoborden
curl.exe -s http://infobord:3000/api/board
```

**Without a third-party wrapper:** register a Task Scheduler task instead — "At
startup", "Run whether user is logged on or not", running the same
`node --env-file=… server.js` command, with *Restart every 1 minute, up to 999
times* on the Settings tab. It works and downloads nothing; NSSM gives cleaner
logs and `Get-Service`.

## 7. Point each screen at it

The display Pis are set up exactly as in Part 2 of [`install.md`](install.md)
(cage + Chromium), with one change: **`infobord.local` will not resolve.** That name came from
Avahi advertising the Pi host over mDNS, and Windows Server doesn't publish
itself that way. Use the school DNS name or the static IP:

```bash
sudo tee /etc/default/infoborden-kiosk <<'EOF'
SCREEN=1
BOARD_URL=http://infobord.school.internal:3000/screen/1
EOF
sudo systemctl restart infoborden-kiosk
```

If the Pis aren't on the school's DNS, pin it per screen instead — one line in
`/etc/hosts` on each Pi (`10.0.0.20  infobord`) and use `http://infobord:3000/…`.

## Updating

Windows won't let you overwrite a file a running process holds open, so the
build fails halfway if the service is up. Stop first — the difference from
Linux, where `git pull` over a running server just works:

```powershell
nssm stop infoborden
Set-Location C:\infoborden
git pull
powershell -ExecutionPolicy Bypass -File .\scripts\build-standalone.ps1
nssm start infoborden
```

All three screens pick the change up on their next poll — within 30 seconds, no
need to touch the display Pis.

## Windows-specific operations

- **Windows Update reboots.** Configure the active hours or a maintenance
  window outside school hours; the default can reboot the host mid-morning and
  every screen falls back to its cached board until it returns.
- **Logs.** `C:\infoborden\logs\err.log` is where a Sheets or startup failure
  surfaces — the equivalent of `journalctl -u infoborden`.
- **Never point a screen at `next dev`.** Same rule as the Linux host: dev-mode
  hydration doesn't run reliably in the Pi's Chromium, so the clock sticks at
  `--:--` and the board never polls. Serve the standalone build.

Everything in the failure table at the end of [`install.md`](install.md)
applies unchanged — the screens' resilience doesn't care what the host runs.
