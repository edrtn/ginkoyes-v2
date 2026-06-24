# ============================================================
# SportLink Server - Installation tache planifiee Windows
# Execute la synchronisation chaque nuit a 02h00
# Usage : Executer en tant qu'administrateur
#   powershell -ExecutionPolicy Bypass -File install-task.ps1
# ============================================================

$TaskName = "SportLink-Sync-Nightly"
$Description = "Synchronisation nightly Ginkoia (Firebird) vers MariaDB pour SportLink Server"

# Chemin vers le script de sync compile
$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $SyncDir
$NodePath = "node"
$ScriptPath = Join-Path $SyncDir "dist\sync.js"

# Commande a executer (mode incremental par defaut)
$Action = New-ScheduledTaskAction `
    -Execute $NodePath `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory $ProjectRoot

# Declencheur : chaque jour a 02h00
$Trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "02:00"

# Parametres : executer meme si l'utilisateur n'est pas connecte
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 6) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 15)

# Verifier si la tache existe deja
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "La tache '$TaskName' existe deja. Mise a jour..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Creer la tache (execute en tant que SYSTEM pour fonctionner sans login)
Register-ScheduledTask `
    -TaskName $TaskName `
    -Description $Description `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -User "SYSTEM" `
    -RunLevel Highest

Write-Host ""
Write-Host "Tache planifiee '$TaskName' installee avec succes."
Write-Host "  Heure : 02h00 chaque jour"
Write-Host "  Script : $ScriptPath"
Write-Host "  Mode : incremental (par defaut)"
Write-Host "  Timeout : 6 heures"
Write-Host "  Retries : 2 (toutes les 15 min)"
Write-Host "  Utilisateur : SYSTEM"
Write-Host ""
Write-Host "Pour verifier : Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Pour executer manuellement : Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Pour forcer un full sync : node `"$ScriptPath`" --full"
