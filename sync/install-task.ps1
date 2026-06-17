# ============================================================
# SportLink Server - Installation tache planifiee Windows
# Execute la synchronisation chaque nuit a 02h00
# Usage : Executer en tant qu'administrateur
#   powershell -ExecutionPolicy Bypass -File install-task.ps1
# ============================================================

$TaskName = "SportLink-Sync-Nightly"
$Description = "Synchronisation nightly Ginkoia (Firebird) vers MariaDB pour SportLink Server"

# Chemin vers le script de sync (ajuster selon l'installation)
$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $SyncDir
$NodePath = "node"
$TsxPath = "npx"
$ScriptPath = Join-Path $SyncDir "sync.ts"

# Commande a executer
$Action = New-ScheduledTaskAction `
    -Execute $TsxPath `
    -Argument "tsx `"$ScriptPath`"" `
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
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# Verifier si la tache existe deja
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "La tache '$TaskName' existe deja. Mise a jour..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Creer la tache
Register-ScheduledTask `
    -TaskName $TaskName `
    -Description $Description `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest

Write-Host ""
Write-Host "Tache planifiee '$TaskName' installee avec succes."
Write-Host "  Heure : 02h00 chaque jour"
Write-Host "  Script : $ScriptPath"
Write-Host ""
Write-Host "Pour verifier : Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Pour executer manuellement : Start-ScheduledTask -TaskName '$TaskName'"
