$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "Starting Samarth local environment..." -ForegroundColor Cyan

# Start Node server (server/server.js)
Push-Location "$scriptRoot\server"
if (-not (Test-Path node_modules)) {
    Write-Host "Installing server dependencies (npm install)..." -ForegroundColor Yellow
    npm install
}
Write-Host "Starting Node server (server.js) on port 3000..." -ForegroundColor Green
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$scriptRoot\server"
Pop-Location

Start-Sleep -Seconds 1
# open site served by Node on port 3000
Start-Process "http://localhost:3000/samarth.html"
Start-Process "http://localhost:3000/"

Write-Host "Done. Node server started on port 3000; site is served from the same port." -ForegroundColor Cyan
