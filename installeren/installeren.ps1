# Hoekje kantoor - installatie (eenmalig)
# Gebruik: dubbelklik op Installeren.cmd in dezelfde map.
# Haalt de nieuwste versie van de app van GitHub (boddie91/hoekje-kantoor-dashboard).
# Daarna werkt de app zichzelf bij; opnieuw installeren is alleen nodig als Electron zelf verandert.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # maakt downloaden veel sneller
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here = $PSScriptRoot
Start-Transcript -Path (Join-Path $here 'installatie-log.txt') -Force | Out-Null

function Stap($t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }

$electronVersie = '38.8.6'
$dst    = Join-Path $env:LOCALAPPDATA 'HoekjeKantoor'
$zip    = Join-Path $dst "electron-v$electronVersie-win32-x64.zip"
$appDir = Join-Path $dst 'app'
$exe    = Join-Path $appDir 'HoekjeKantoor.exe'

try {
  New-Item -ItemType Directory -Force $dst | Out-Null

  if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 50MB) {
    Stap 'Electron downloaden (ongeveer 110 MB, kan een paar minuten duren)'
    $url = "https://github.com/electron/electron/releases/download/v$electronVersie/electron-v$electronVersie-win32-x64.zip"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Write-Host ('Gedownload: ' + [math]::Round((Get-Item $zip).Length / 1MB) + ' MB')
  } else {
    Stap 'Electron is al gedownload'
  }

  Stap 'Nieuwste versie van de app ophalen van GitHub'
  $repoZip = Join-Path $env:TEMP 'hoekje-kantoor-dashboard.zip'
  $repoDir = Join-Path $env:TEMP 'hoekje-kantoor-dashboard'
  Invoke-WebRequest -Uri 'https://codeload.github.com/boddie91/hoekje-kantoor-dashboard/zip/refs/heads/main' -OutFile $repoZip -UseBasicParsing
  if (Test-Path $repoDir) { Remove-Item $repoDir -Recurse -Force }
  Expand-Archive -Path $repoZip -DestinationPath $repoDir -Force
  $bron = Join-Path $repoDir 'hoekje-kantoor-dashboard-main\app'
  if (-not (Test-Path (Join-Path $bron 'main.js'))) { throw 'De app-bestanden ontbreken in de download van GitHub.' }

  Stap 'App samenstellen'
  Get-Process HoekjeKantoor -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 500
  if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $appDir -Force
  Remove-Item (Join-Path $appDir 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
  $res = Join-Path $appDir 'resources\app'
  New-Item -ItemType Directory -Force $res | Out-Null
  Copy-Item (Join-Path $bron '*') $res -Recurse -Force
  Remove-Item $repoZip, $repoDir -Recurse -Force -ErrorAction SilentlyContinue
  Rename-Item (Join-Path $appDir 'electron.exe') 'HoekjeKantoor.exe'
  if (-not (Test-Path $exe)) { throw "App niet gevonden: $exe" }

  Stap 'Snelkoppeling op het bureaublad maken'
  $desk = [Environment]::GetFolderPath('Desktop')
  $ws = New-Object -ComObject WScript.Shell
  $lnk = $ws.CreateShortcut((Join-Path $desk 'Hoekje kantoor.lnk'))
  $lnk.TargetPath = $exe
  $lnk.WorkingDirectory = $appDir
  $lnk.IconLocation = (Join-Path $res 'icon.ico') + ',0'
  $lnk.Description = 'Kantoor-dashboard Hoekje'
  $lnk.Save()
  Write-Host ('Snelkoppeling: ' + (Join-Path $desk 'Hoekje kantoor.lnk'))

  Stap 'Klaar! De app wordt gestart.'
  Start-Process $exe
  Write-Host 'INSTALLATIE GESLAAGD' -ForegroundColor Green
}
catch {
  Write-Host ''
  Write-Host ('FOUT: ' + $_.Exception.Message) -ForegroundColor Red
}
finally {
  Stop-Transcript | Out-Null
}
