@echo off
REM ── 一键启动：本地工作台 (localhost:3000) + 常驻 Agent ──
cd /d "%~dp0"

REM 1) 确保常驻浏览器已启动（独立进程，9222，profile 固定在 public/agent/chrome-profile）
set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if defined CHROME_EXE (
  powershell -NoProfile -Command ^
    "$p=Join-Path $PWD 'public\agent\chrome-profile'; " ^
    "if(-not (Test-Path $p)){New-Item -ItemType Directory -Path $p -Force ^| Out-Null}; " ^
    "$up=Test-NetConnection 127.0.0.1 -Port 9222 -InformationLevel Quiet -WarningAction SilentlyContinue; " ^
    "if(-not $up){ Start-Process -FilePath '%CHROME_EXE%' -ArgumentList @('--remote-debugging-port=9222',\"--user-data-dir=$p\",'--no-first-run','--no-default-browser-check','about:blank'); " ^
    "  for($i=0;$i -lt 40;$i++){ if((Test-NetConnection 127.0.0.1 -Port 9222 -InformationLevel Quiet -WarningAction SilentlyContinue)){break}; Start-Sleep -Milliseconds 300 } }"
)

REM 2) 启动本机 Agent 服务
start "PXX Agent" cmd /k "cd /d %~dp0public\agent && node agent.mjs start"

REM 3) 首次需要 npm install + npm run build；之后直接用 next start
if not exist "node_modules\next" (
  echo 首次运行，正在安装依赖并构建（约几分钟）...
  call npm install
  call npm run build
)

start "PXX Web" cmd /k "cd /d %~dp0 && npm run start"

echo.
echo ============================================================
echo   工作台:  http://localhost:3000
echo   Agent :  http://127.0.0.1:17368
echo   浏览器:  常驻 Chrome（调试端口 9222），请勿关闭
echo.
echo   首次使用请先双击 public\agent\login-agent.bat 登录 1688 / 拼多多
echo ============================================================
echo.
timeout /t 5 >nul
start "" http://localhost:3000
