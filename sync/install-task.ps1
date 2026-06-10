# ============================================================
# Ginkoyes V2 — Installation tâche planifiée Windows
# Exécute la synchronisation chaque nuit à 23h10
# Usage : Exécuter en tant qu'administrateur
#   powershell -ExecutionPolicy Bypass -File install-task.ps1
# ============================================================

$TaskName = "Ginkoyes-Sync-Nightly"
$Description = "Synchronisation nightly Ginkoia (Firebird) vers MariaDB pour Ginkoyes V2"

# Chemin vers le script de sync (ajuster selon l'installation)
$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $SyncDir
$NodePath = "node"
$TsxPath = "npx"
$ScriptPath = Join-Path $SyncDir "sync.ts"

# Commande à exécuter
$Action = New-ScheduledTaskAction `
    -Execute $TsxPath `
    -Argument "tsx `"$ScriptPath`"" `
    -WorkingDirectory $ProjectRoot

# Déclencheur : chaque jour à 23h10
$Trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "23:10"

# Paramètres : exécuter même si l'utilisateur n'est pas connecté
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# Vérifier si la tâche existe déjà
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "La tache '$TaskName' existe deja. Mise a jour..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Créer la tâche
Register-ScheduledTask `
    -TaskName $TaskName `
    -Description $Description `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest

Write-Host ""
Write-Host "Tache planifiee '$TaskName' installee avec succes."
Write-Host "  Heure : 23h10 chaque jour"
Write-Host "  Script : $ScriptPath"
Write-Host ""
Write-Host "Pour verifier : Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Pour executer manuellement : Start-ScheduledTask -TaskName '$TaskName'"
