@echo off
REM One-click: local workbench (localhost:3000) + resident Agent + Chrome
cd /d "%~dp0"

REM 1) resident Chrome (CDP 9222, profile in public\agent\chrome-profile)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0public\agent\ensure-browser.ps1"

REM 2) local Agent service
start "PXX Agent" cmd /k "cd /d ""%~dp0public\agent"" && node agent.mjs start"

REM 3) first run: install + build; then serve
if not exist "node_modules\next" (
  echo First run: installing deps and building, please wait...
  call npm install
  call npm run build
)
start "PXX Web" cmd /k "cd /d ""%~dp0"" && npm run start"

echo.
echo ============================================================
echo   Workbench : http://localhost:3000
echo   Agent     : http://127.0.0.1:17368
echo   Browser   : resident Chrome on port 9222 - DO NOT CLOSE IT
echo.
echo   First time: run public\agent\login-agent.bat to sign in
echo ============================================================
echo.
timeout /t 4 >nul
start "" http://localhost:3000
