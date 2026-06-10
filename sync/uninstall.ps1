# ============================================================
# Ginkoyes V2 — Desinstalleur
#
# Arrete et supprime le service Windows GinkoyesSync.
# Supprime le repertoire d'installation (apres confirmation).
# NE desinstalle PAS MariaDB ni Tailscale.
#
# Usage : powershell -ExecutionPolicy Bypass -File uninstall.ps1
# ============================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$DefaultInstallDir = "C:\Ginkoyes"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  Ginkoyes V2 — Desinstallation" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

$installDir = Read-Host "Repertoire d'installation [$DefaultInstallDir]"
if ([string]::IsNullOrWhiteSpace($installDir)) { $installDir = $DefaultInstallDir }

# ============================================================
# Stop and uninstall service
# ============================================================

Write-Host ""
Write-Host "[1/3] Arret du service..." -ForegroundColor Yellow

# Try to stop via Windows services
$svc = Get-Service -Name "GinkoyesSync" -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -eq "Running") {
        Stop-Service -Name "GinkoyesSync" -Force
        Write-Host "  [OK] Service arrete" -ForegroundColor Green
    } else {
        Write-Host "  Service deja arrete" -ForegroundColor Gray
    }
} else {
    Write-Host "  Service non trouve (peut-etre deja desinstalle)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[2/3] Desenregistrement du service..." -ForegroundColor Yellow

$installServiceJs = Join-Path $installDir "dist\install-service.js"
if (Test-Path $installServiceJs) {
    try {
        Push-Location $installDir
        node dist\install-service.js uninstall 2>&1 | Out-Null
        Pop-Location
        Start-Sleep -Seconds 2
        Write-Host "  [OK] Service desenregistre" -ForegroundColor Green
    } catch {
        Write-Host "  Desenregistrement echoue : $_" -ForegroundColor Red
        Write-Host "  Tentative via sc.exe..." -ForegroundColor Gray
        sc.exe delete GinkoyesSync 2>$null
    }
} else {
    Write-Host "  install-service.js non trouve, tentative via sc.exe..." -ForegroundColor Gray
    sc.exe delete GinkoyesSync 2>$null
}

# ============================================================
# Remove install directory
# ============================================================

Write-Host ""
Write-Host "[3/3] Suppression des fichiers..." -ForegroundColor Yellow

if (Test-Path $installDir) {
    $confirm = Read-Host "  Supprimer $installDir et tout son contenu ? (O/N)"
    if ($confirm -eq "O" -or $confirm -eq "o") {
        Remove-Item $installDir -Recurse -Force
        Write-Host "  [OK] $installDir supprime" -ForegroundColor Green
    } else {
        Write-Host "  Repertoire conserve" -ForegroundColor Gray
    }
} else {
    Write-Host "  Repertoire non trouve : $installDir" -ForegroundColor Gray
}

# ============================================================
# Summary
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Desinstallation terminee" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Note : MariaDB et Tailscale n'ont PAS ete desinstalles." -ForegroundColor Gray
Write-Host "  Pour les supprimer, utilisez 'Ajout/Suppression de programmes'." -ForegroundColor Gray
Write-Host ""
