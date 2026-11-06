@echo off
cd /d "%~dp0"
setlocal

REM ── 常驻浏览器：独立进程启动 Chrome，调试端口 9222，登录态固定保存在 chrome-profile ──
REM 用 PowerShell Start-Process 保证 Chrome 脱离本 cmd 独立存活，node 退出也不会关掉它。
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
) else (
  echo [WARN] 未找到 Chrome / Edge，Agent 将尝试自行启动浏览器。
)

REM ── 启动本机 Agent 服务（常驻，读取同一浏览器）──
start "PXX Agent" cmd /k "node agent.mjs start"
exit /b
