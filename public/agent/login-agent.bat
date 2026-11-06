@echo off
cd /d "%~dp0"
setlocal

REM ── 确保常驻浏览器已启动（与 start-agent.bat 用同一个端口和 profile）──
set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if defined CHROME_EXE (
  powershell -NoProfile -Command ^
    "$p=Join-Path $PWD 'chrome-profile'; " ^
    "if(-not (Test-Path $p)){New-Item -ItemType Directory -Path $p -Force ^| Out-Null}; " ^
    "$up=Test-NetConnection 127.0.0.1 -Port 9222 -InformationLevel Quiet -WarningAction SilentlyContinue; " ^
    "if(-not $up){ Start-Process -FilePath '%CHROME_EXE%' -ArgumentList @('--remote-debugging-port=9222',\"--user-data-dir=$p\",'--no-first-run','--no-default-browser-check','about:blank'); " ^
    "  for($i=0;$i -lt 40;$i++){ if((Test-NetConnection 127.0.0.1 -Port 9222 -InformationLevel Quiet -WarningAction SilentlyContinue)){break}; Start-Sleep -Milliseconds 300 } }"
)

REM ── 打开登录页；登录完浏览器保持打开，登录态持久 ──
node agent.mjs login
pause
