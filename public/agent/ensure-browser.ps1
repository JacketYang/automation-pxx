$ErrorActionPreference = 'Continue'
# Resident browser: start a standalone Chrome/Edge with CDP port 9222.
# Login state is kept in the chrome-profile folder next to this script.
# Called via -File from start-agent.bat / login-agent.bat / start-all.bat.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$profileDir = Join-Path $here 'chrome-profile'
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }

$pf = $env:ProgramFiles
$pf86 = ${env:ProgramFiles(x86)}
if (-not $pf86) { $pf86 = 'C:\Program Files (x86)' }
$local = $env:LOCALAPPDATA
if (-not $local) { $local = $env:USERPROFILE + '\AppData\Local' }

$candidates = @()
if ($pf)   { $candidates += ($pf   + '\Google\Chrome\Application\chrome.exe') }
if ($pf86) { $candidates += ($pf86 + '\Google\Chrome\Application\chrome.exe') }
if ($local){ $candidates += ($local + '\Google\Chrome\Application\chrome.exe') }
if ($pf86) { $candidates += ($pf86 + '\Microsoft\Edge\Application\msedge.exe') }
$exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

function Port-Open([int]$port) {
  $tcp = New-Object Net.Sockets.TcpClient
  try { $r = $tcp.BeginConnect('127.0.0.1', $port, $null, $null); return ($r.AsyncWaitHandle.WaitOne(300) -and $tcp.Connected) }
  catch { return $false }
  finally { $tcp.Close() }
}

if (Port-Open 9222) {
  Write-Host '[browser] already running on port 9222, reuse it.'
  exit 0
}
if (-not $exe) {
  Write-Host '[browser] Chrome/Edge not found; agent will try to start it itself.'
  exit 0
}

$chromeArgs = @(
  '--remote-debugging-port=9222',
  ("--user-data-dir=" + $profileDir),
  '--no-first-run',
  '--no-default-browser-check',
  '--start-maximized',
  'about:blank'
)
Start-Process -FilePath $exe -ArgumentList $chromeArgs | Out-Null
for ($i = 0; $i -lt 40; $i++) {
  if (Port-Open 9222) { break }
  Start-Sleep -Milliseconds 300
}
if (Port-Open 9222) { Write-Host ("[browser] resident Chrome ready on 9222; profile=" + $profileDir) }
else { Write-Host '[browser] WARN: port 9222 not ready yet' }
