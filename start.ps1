# start.ps1 — Lance backend Flask et frontend React (Windows PowerShell)
# Usage: PowerShell -ExecutionPolicy Bypass -File .\start.ps1

$ErrorActionPreference = 'Stop'

function Write-Section($text) {
  Write-Host "`n=== $text ===" -ForegroundColor Cyan
}

function Find-Python {
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) { return 'py' }
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) { return 'python' }
  throw "Python introuvable. Installez Python 3.x et réessayez."
}

$ROOT = Split-Path -Parent $PSCommandPath
Set-Location $ROOT

# ----------------------------------------
# Backend: venv + deps + env + start
# ----------------------------------------
Write-Section 'Préparation backend'
$PY = Find-Python
$venvPath = Join-Path $ROOT '.venv'
if (-not (Test-Path $venvPath)) {
  Write-Host 'Création du venv (.venv)…'
  & $PY -m venv .venv
}

$venvPython = Join-Path $venvPath 'Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
  throw 'Environnement virtuel invalide (.venv). Supprimez .venv et relancez le script.'
}

Write-Host 'Mise à jour des dépendances backend…'
& $venvPython -m pip install --upgrade pip > $null
& $venvPython -m pip install -r (Join-Path $ROOT 'backend\requirements.txt')

# Variables d'environnement backend
if (-not $env:JWT_SECRET_KEY) { $env:JWT_SECRET_KEY = 'change_me_dev' }
if (-not $env:UPLOAD_FOLDER) { $env:UPLOAD_FOLDER = (Join-Path $ROOT 'backend\uploads') }
if (-not (Test-Path $env:UPLOAD_FOLDER)) { New-Item -ItemType Directory -Force -Path $env:UPLOAD_FOLDER | Out-Null }
$env:FLASK_ENV = 'development'

# Démarrage backend dans une nouvelle fenêtre PowerShell
Write-Host 'Démarrage du backend (http://localhost:5000)…'
$backendCmd = "& `"$venvPython`" `"$($ROOT)\backend\app.py`""
Start-Process -FilePath powershell -ArgumentList "-NoExit","-Command",$backendCmd -WorkingDirectory (Join-Path $ROOT 'backend') | Out-Null

# ----------------------------------------
# Frontend: npm i + start
# ----------------------------------------
Write-Section 'Préparation frontend'
$frontendDir = Join-Path $ROOT 'frontend'
if (-not (Test-Path (Join-Path $frontendDir 'package.json'))) {
  throw 'frontend/package.json introuvable.'
}

# Variables d'environnement frontend (utilisées par npm start)
# Détecter automatiquement l'IP locale principale (carte UP avec passerelle)
try {
  $localIp = (
    Get-NetIPConfiguration |
      Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
      ForEach-Object { $_.IPv4Address.IPAddress } |
      Select-Object -First 1
  )
  if (-not $localIp) {
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress -First 1)
  }
} catch { $localIp = $null }
if (-not $localIp) { $localIp = '127.0.0.1' }

$env:LOCAL_IP = $localIp
$env:FRONTEND_ORIGIN = "http://$localIp:3000"
if (-not $env:REACT_APP_API_URL) { $env:REACT_APP_API_URL = "http://$localIp:5000/api" }
$env:HOST = '0.0.0.0'  # Permet l'accès depuis le réseau local

Write-Host 'Installation des dépendances frontend (npm install)…'
Push-Location $frontendDir
try {
  npm install --no-fund --no-audit
} finally {
  Pop-Location
}

Write-Host 'Démarrage du frontend (http://localhost:3000)…'
$frontendCmd = "cd `"$($frontendDir)`"; npm start"
Start-Process -FilePath powershell -ArgumentList "-NoExit","-Command",$frontendCmd -WorkingDirectory $frontendDir | Out-Null

Write-Section 'Tout est lancé'
Write-Host ("Backend: http://{0}:5000" -f $localIp) -ForegroundColor Green
Write-Host 'Frontend (desktop): http://localhost:3000' -ForegroundColor Green
Write-Host ("Frontend (mobile): http://{0}:3000" -f $localIp) -ForegroundColor Yellow
Write-Host "Conseil: Utilisez l'adresse mobile sur votre téléphone connecté au même WiFi"


