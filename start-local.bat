@echo off
echo Starting Samarth local environment...
cd /d "%~dp0server"
if not exist node_modules (
  echo Installing server dependencies...
  npm install
)
start "Samarth Server" cmd /k "node server.js"
cd /d "%~dp0"
Start-Sleep 1 >nul
start "" "http://localhost:3000/samarth.html"
start "" "http://localhost:3000/"
echo Done. Node server started on port 3000; site served from the same port.
pause
