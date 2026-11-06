@echo off
cd /d "%~dp0"
start "PXX Agent" /min cmd /c "node agent.mjs start"
exit
