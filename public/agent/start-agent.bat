@echo off
cd /d "%~dp0"

REM Prefer the portable Node.js installation used on this Windows machine.
set "NODE_EXE=node"
if exist "%USERPROFILE%\node-v24.9.0-win-x64\node.exe" set "NODE_EXE=%USERPROFILE%\node-v24.9.0-win-x64\node.exe"

REM Keep the console open so startup errors are visible instead of disappearing.
start "PXX Agent" cmd /k ""%NODE_EXE%" agent.mjs start"
exit /b
