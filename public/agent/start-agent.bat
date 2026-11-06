@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-browser.ps1"
start "PXX Agent" cmd /k "node agent.mjs start"
exit /b
