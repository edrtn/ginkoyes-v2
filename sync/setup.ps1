param(
    [string]$GbkFilePath = "",
    [string]$GbakExePath = "",
    [string]$InstallDir = "",
    [string]$SyncTime = ""
)

# ============================================================
# SportLink Server - Installeur tout-en-un
#
# Installe : Node.js, MariaDB, BDD, service sync
# Usage : powershell -ExecutionPolicy Bypass -File setup.ps1
#   Mode interactif : sans parametres
#   Mode silencieux : -GbkFilePath "..." -GbakExePath "..." etc.
# Doit etre lance en tant qu'administrateur
# ============================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# Mode non-interactif si au moins GbkFilePath est fourni
$NonInteractive = -not [string]::IsNullOrWhiteSpace($GbkFilePath)

# ============================================================
# Variables globales
# ============================================================

$DefaultGbkPath = "\\SERVEUR\Backup\SV.GBK"
$DefaultInstallDir = "C:\sportlink-serveur"
$DefaultSyncTime = "02:00"
$MariaDBVersion = "11.4.5"
$NodeVersion = "20.18.1"
$DbName = "ginkoyes"
$DbUser = "ginkoyes"
$DbPassword = "ginkoyes"

# ============================================================
# Helpers
# ============================================================

function Write-Banner {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SportLink Server - Installation" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($num, $total, $msg) {
    Write-Host ""
    Write-Host "[$num/$total] $msg" -ForegroundColor Yellow
    Write-Host ("-" * 50)
}

function Write-Ok($msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Err($msg) {
    Write-Host "  [ERREUR] $msg" -ForegroundColor Red
}

function Write-Info($msg) {
    Write-Host "  $msg" -ForegroundColor Gray
}

function Ask-Input($prompt, $default) {
    $val = Read-Host "  $prompt [$default]"
    if ([string]::IsNullOrWhiteSpace($val)) { return $default }
    return $val
}

function Test-CommandExists($cmd) {
    try {
        Get-Command $cmd -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Download-File($url, $dest) {
    Write-Info "Telechargement : $url"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($url, $dest)
    Write-Info "Telecharge : $dest"
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ============================================================
# [1/6] Prerequisites
# ============================================================

function Step-Prerequisites {
    Write-Step 1 6 "Verification des prerequis"

    # Check admin
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Err "Ce script doit etre lance en tant qu'administrateur."
        exit 1
    }
    Write-Ok "Droits administrateur"

    # Check OS
    $os = [System.Environment]::OSVersion
    Write-Ok "OS : $($os.VersionString)"

    # Check Firebird / gbak.exe
    if (-not [string]::IsNullOrWhiteSpace($GbakExePath)) {
        # Parametre fourni par l'installeur GUI
        $script:GbakPath = $GbakExePath
        if (Test-Path $script:GbakPath) {
            Write-Ok "Firebird gbak.exe (parametre) : $($script:GbakPath)"
        } else {
            Write-Err "gbak.exe introuvable au chemin fourni : $($script:GbakPath)"
            exit 1
        }
    } else {
        # Auto-detection
        $gbakPaths = @(
            "C:\Program Files\Firebird\Firebird_4_0\gbak.exe",
            "C:\Program Files\Firebird\Firebird_3_0\gbak.exe",
            "C:\Program Files (x86)\Firebird\Firebird_3_0\gbak.exe",
            "C:\Ginkoia\Firebird\gbak.exe"
        )
        $script:GbakPath = $null
        foreach ($p in $gbakPaths) {
            if (Test-Path $p) {
                $script:GbakPath = $p
                break
            }
        }
        if ($script:GbakPath) {
            Write-Ok "Firebird gbak.exe detecte : $($script:GbakPath)"
        } else {
            Write-Err "gbak.exe non trouve. Verifiez que Firebird 3.0 est installe."
            $script:GbakPath = Read-Host "  Chemin vers gbak.exe"
            if (-not (Test-Path $script:GbakPath)) {
                Write-Err "Fichier introuvable : $($script:GbakPath)"
                exit 1
            }
        }
    }

    # Configure Firebird Legacy Auth (requis par node-firebird)
    $fbDir = Split-Path -Parent $script:GbakPath
    $fbConf = Join-Path $fbDir "firebird.conf"
    if (Test-Path $fbConf) {
        $confContent = Get-Content $fbConf -Raw
        if ($confContent -notmatch "(?m)^AuthServer\s*=.*Legacy_Auth") {
            Add-Content -Path $fbConf -Value "`nAuthServer = Legacy_Auth, Srp, Win_Sspi"
            Add-Content -Path $fbConf -Value "AuthClient = Legacy_Auth, Srp, Win_Sspi"
            Add-Content -Path $fbConf -Value "WireCrypt = Disabled"
            Write-Ok "Firebird configure pour Legacy Auth"
            # Redemarrer le service Firebird pour appliquer
            $fbServices = Get-Service -DisplayName "*Firebird*" -ErrorAction SilentlyContinue
            foreach ($svc in $fbServices) {
                Restart-Service $svc.Name -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            }
        }
    }
}

# ============================================================
# [2/6] Configuration
# ============================================================

function Step-Configuration {
    Write-Step 2 6 "Configuration"

    if ($NonInteractive) {
        # Mode non-interactif : utiliser les parametres fournis
        $script:GbkPath = $GbkFilePath
        $script:InstallDir = if ([string]::IsNullOrWhiteSpace($InstallDir)) { $DefaultInstallDir } else { $InstallDir }
        $script:SyncTime = if ([string]::IsNullOrWhiteSpace($SyncTime)) { $DefaultSyncTime } else { $SyncTime }

        if (-not (Test-Path $script:GbkPath)) {
            Write-Info "SV.GBK non present a $($script:GbkPath) - la sync sera lancee quand le fichier sera disponible."
        } else {
            Write-Ok "SV.GBK trouve : $($script:GbkPath)"
        }
    } else {
        # Mode interactif : Read-Host
        $script:GbkPath = Ask-Input "Chemin du fichier SV.GBK" $DefaultGbkPath
        if (-not (Test-Path $script:GbkPath)) {
            Write-Err "Fichier SV.GBK introuvable : $($script:GbkPath)"
            Write-Info "La premiere synchronisation echouera si le fichier n'est pas present."
            $continue = Read-Host "  Continuer quand meme ? (O/N)"
            if ($continue -ne "O" -and $continue -ne "o") { exit 0 }
        } else {
            Write-Ok "SV.GBK trouve : $($script:GbkPath)"
        }

        $script:InstallDir = Ask-Input "Repertoire d'installation" $DefaultInstallDir
        $script:SyncTime = Ask-Input "Heure de synchronisation quotidienne (HH:MM)" $DefaultSyncTime
    }

    Write-Ok "Configuration validee"
    Write-Info "  SV.GBK     : $($script:GbkPath)"
    Write-Info "  gbak.exe   : $($script:GbakPath)"
    Write-Info "  Install    : $($script:InstallDir)"
    Write-Info "  Sync       : $($script:SyncTime) chaque jour"
}

# ============================================================
# [3/6] Node.js
# ============================================================

function Step-NodeJS {
    Write-Step 3 6 "Node.js"

    if (Test-CommandExists "node") {
        $ver = node --version
        Write-Ok "Node.js deja installe : $ver"
        return
    }

    Write-Info "Node.js non detecte, installation..."
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $msiUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-$arch.msi"
    $msiPath = "$env:TEMP\node-v$NodeVersion.msi"

    Download-File $msiUrl $msiPath

    Write-Info "Installation silencieuse de Node.js..."
    Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait -NoNewWindow

    Refresh-Path

    if (Test-CommandExists "node") {
        $ver = node --version
        Write-Ok "Node.js installe : $ver"
    } else {
        Write-Err "L'installation de Node.js a echoue. Installez-le manuellement depuis https://nodejs.org"
        exit 1
    }

    # Cleanup
    Remove-Item $msiPath -ErrorAction SilentlyContinue
}

# ============================================================
# [4/6] MariaDB
# ============================================================

function Step-MariaDB {
    Write-Step 4 6 "MariaDB"

    $mysqlCmd = $null

    # Check if MariaDB/MySQL is already available
    if (Test-CommandExists "mysql") {
        $mysqlCmd = "mysql"
        Write-Ok "MariaDB/MySQL deja installe"
    } else {
        # Check default install locations
        $mariaDbPaths = @(
            "C:\Program Files\MariaDB 11.4\bin\mysql.exe",
            "C:\Program Files\MariaDB 11.3\bin\mysql.exe",
            "C:\Program Files\MariaDB 11.2\bin\mysql.exe",
            "C:\Program Files\MariaDB 10.11\bin\mysql.exe"
        )
        foreach ($p in $mariaDbPaths) {
            if (Test-Path $p) {
                $mysqlCmd = $p
                Write-Ok "MariaDB detecte : $p"
                break
            }
        }
    }

    if (-not $mysqlCmd) {
        Write-Info "MariaDB non detecte, installation..."
        $arch = if ([Environment]::Is64BitOperatingSystem) { "winx64" } else { "win32" }
        $msiUrl = "https://downloads.mariadb.org/rest-api/mariadb/$MariaDBVersion/mariadb-$MariaDBVersion-$arch.msi"
        $msiPath = "$env:TEMP\mariadb-$MariaDBVersion.msi"

        Download-File $msiUrl $msiPath

        Write-Info "Installation silencieuse de MariaDB..."
        Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn SERVICENAME=MariaDB ADDLOCAL=ALL PASSWORD=root" -Wait -NoNewWindow

        Refresh-Path

        # Find mysql.exe
        $mariaDbPaths = @(
            "C:\Program Files\MariaDB 11.4\bin\mysql.exe",
            "C:\Program Files\MariaDB 11.3\bin\mysql.exe"
        )
        foreach ($p in $mariaDbPaths) {
            if (Test-Path $p) {
                $mysqlCmd = $p
                break
            }
        }

        if (-not $mysqlCmd) {
            Write-Err "MariaDB installe mais mysql.exe introuvable."
            Write-Err "Ajoutez le dossier bin de MariaDB au PATH et relancez."
            exit 1
        }

        # Wait for service to start
        Write-Info "Attente du demarrage du service MariaDB..."
        Start-Sleep -Seconds 5
        Write-Ok "MariaDB installe"

        # Cleanup
        Remove-Item $msiPath -ErrorAction SilentlyContinue
    }

    $script:MysqlCmd = $mysqlCmd

    # Setup database
    Write-Info "Creation de la base de donnees..."

    $setupSql = @'
CREATE DATABASE IF NOT EXISTS {DBNAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '{DBUSER}'@'localhost' IDENTIFIED BY '{DBPASS}';
CREATE USER IF NOT EXISTS '{DBUSER}'@'%' IDENTIFIED BY '{DBPASS}';
GRANT ALL PRIVILEGES ON {DBNAME}.* TO '{DBUSER}'@'localhost';
GRANT ALL PRIVILEGES ON {DBNAME}.* TO '{DBUSER}'@'%';
FLUSH PRIVILEGES;
'@
    $setupSql = $setupSql -replace '\{DBNAME\}', $DbName -replace '\{DBUSER\}', $DbUser -replace '\{DBPASS\}', $DbPassword
    try { $setupSql | & $mysqlCmd -u root -proot 2>&1 | Out-Null } catch {}
    if ($LASTEXITCODE -ne 0) {
        # Try without password (fresh install)
        try { $setupSql | & $mysqlCmd -u root 2>&1 | Out-Null } catch {}
    }
    Write-Ok "Base '$DbName' et utilisateur '$DbUser' crees"

    # Run schema scripts
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $script:InstallDir }
    $sqlDir = Join-Path $scriptDir "..\sql"
    if (-not (Test-Path $sqlDir)) {
        $sqlDir = Join-Path $scriptDir "sql"
    }

    $sqlFiles = @(
        "001_schema.sql",
        "002_indexes.sql",
        "003_custom_tables.sql",
        "005_ventes_daily.sql",
        "007_composite_indexes.sql",
        "008_vpn_config.sql",
        "010_vpn_config_l2tp.sql",
        "018_vpn_ssh_tunnel.sql"
    )

    foreach ($file in $sqlFiles) {
        $filePath = Join-Path $sqlDir $file
        if (Test-Path $filePath) {
            Write-Info "Execution : $file"
            try {
                $sqlContent = Get-Content $filePath -Raw
                $sqlContent | & $mysqlCmd -u $DbUser "-p$DbPassword" $DbName 2>&1 | Out-Null
            } catch {
                Write-Info "Avertissement sur $file : $($_.Exception.Message)"
            }
            Write-Ok "$file"
        } else {
            Write-Info "Script non trouve (ignore) : $filePath"
        }
    }

    # Run stored procedure (needs DELIMITER handling, use source)
    $procFile = Join-Path $sqlDir "006_refresh_ventes_daily.sql"
    if (Test-Path $procFile) {
        Write-Info "Execution : 006_refresh_ventes_daily.sql"
        try { & $mysqlCmd -u $DbUser "-p$DbPassword" $DbName -e "SOURCE $procFile" 2>&1 | Out-Null } catch {}
        if ($LASTEXITCODE -ne 0) {
            # Fallback: read and execute without DELIMITER (strip it)
            $procContent = Get-Content $procFile -Raw
            $procContent = $procContent -replace 'DELIMITER \$\$', ''
            $procContent = $procContent -replace '\$\$', ';'
            $procContent = $procContent -replace 'DELIMITER ;', ''
            try { $procContent | & $mysqlCmd -u $DbUser "-p$DbPassword" $DbName 2>&1 | Out-Null } catch {}
        }
        Write-Ok "Procedure refresh_ventes_daily() creee"
    }

    Write-Ok "Base de donnees configuree"
}

# ============================================================
# [5/6] Service SportLink
# ============================================================

function Step-Service {
    Write-Step 5 6 "Service SportLink"

    # Create install directory
    if (-not (Test-Path $script:InstallDir)) {
        New-Item -Path $script:InstallDir -ItemType Directory -Force | Out-Null
    }
    Write-Ok "Repertoire : $($script:InstallDir)"

    # Create logs directory
    $logsDir = Join-Path $script:InstallDir "logs"
    if (-not (Test-Path $logsDir)) {
        New-Item -Path $logsDir -ItemType Directory -Force | Out-Null
    }

    # Copy sync files (skip if source = destination)
    $srcDir = if ($PSScriptRoot) { $PSScriptRoot } else { $script:InstallDir }
    if ($srcDir -ne $script:InstallDir) {
        $filesToCopy = @("sync.ts", "service.ts", "install-service.ts", "tsconfig.service.json")
        foreach ($f in $filesToCopy) {
            $src = Join-Path $srcDir $f
            if (Test-Path $src) {
                Copy-Item $src $script:InstallDir -Force
            }
        }

        # Copy SQL directory
        $sqlSrc = Join-Path (Split-Path -Parent $srcDir) "sql"
        $sqlDest = Join-Path $script:InstallDir "sql"
        if (Test-Path $sqlSrc) {
            if (-not (Test-Path $sqlDest)) { New-Item -Path $sqlDest -ItemType Directory -Force | Out-Null }
            Copy-Item "$sqlSrc\*" $sqlDest -Force
        }
    }
    Write-Ok "Fichiers copies"

    # Create backup directory
    $backupDir = Join-Path $script:InstallDir "backup"
    if (-not (Test-Path $backupDir)) {
        New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
    }

    # Parse sync time
    $timeParts = $script:SyncTime -split ":"
    $hour = [int]$timeParts[0]
    $minute = [int]$timeParts[1]
    $cronExpr = "$minute $hour * * *"

    # Generate sync-config.json
    $tempFdbPath = Join-Path $backupDir "temp_sync.fdb"
    $logPath = Join-Path $logsDir "sync.log"

    $configObj = @{
        firebird = @{
            gbkSourcePath = $script:GbkPath
            gbkLocalPath = Join-Path $script:InstallDir "backup\SV.GBK"
            tempFdbPath = $tempFdbPath
            gbakPath = $script:GbakPath
            user = "SYSDBA"
            password = "ginkoia"
        }
        mariadb = @{
            host = "127.0.0.1"
            port = 3306
            user = $DbUser
            password = $DbPassword
            database = $DbName
        }
        sync = @{
            batchSize = 1000
            logPath = $logPath
            schedule = $cronExpr
        }
    }
    $configJson = $configObj | ConvertTo-Json -Depth 3
    $configPath = Join-Path $script:InstallDir "sync-config.json"
    [IO.File]::WriteAllText($configPath, $configJson)
    Write-Ok "sync-config.json genere"

    # Create package.json for the service
    $pkgJson = @{
        name = "sportlink-sync"
        version = "1.0.0"
        private = $true
        dependencies = @{
            "mysql2" = "^3.11.0"
            "node-firebird" = "^2.3.2"
            "node-schedule" = "^2.1.1"
            "node-windows" = "^1.0.0-beta.8"
            "typescript" = "^5.6.0"
            "@types/node" = "^20.0.0"
            "@types/node-schedule" = "^2.1.0"
        }
    } | ConvertTo-Json -Depth 3
    [IO.File]::WriteAllText((Join-Path $script:InstallDir "package.json"), $pkgJson)

    # npm install
    Write-Info "Installation des dependances npm..."
    Push-Location $script:InstallDir
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    npm install --omit=dev 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $prevEAP
        Write-Err "npm install echoue (exit code $LASTEXITCODE)"
        exit 1
    }
    Write-Ok "Dependances installees"

    # Compile TypeScript -> dist/
    Write-Info "Compilation TypeScript..."
    npx tsc -p tsconfig.service.json 2>&1 | Out-Null
    $ErrorActionPreference = $prevEAP
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Compilation echouee (exit code $LASTEXITCODE)"
        Write-Info "Tentative avec tsx au lieu de tsc..."
    }

    # Copy sync-config.json to dist/ (service.js looks for it in __dirname)
    $distDir = Join-Path $script:InstallDir "dist"
    if (Test-Path $distDir) {
        Copy-Item $configPath (Join-Path $distDir "sync-config.json") -Force
    }

    # Install Windows service (from dist/)
    Write-Info "Enregistrement du service Windows..."
    try {
        node dist\install-service.js 2>&1
        Start-Sleep -Seconds 3
        Write-Ok "Service SportLinkSync installe et demarre"
    } catch {
        Write-Err "Installation du service echouee : $_"
        Write-Info "Vous pouvez l'installer manuellement : node dist\install-service.js"
    }
    Pop-Location
}

# ============================================================
# [6/6] First sync
# ============================================================

function Step-FirstSync {
    Write-Step 6 6 "Premiere synchronisation"
    Write-Info "La premiere synchronisation n'est pas lancee automatiquement."
    Write-Info "Ouvrez 'SportLink Server' depuis le bureau et cliquez sur 'Lancer sync'."
}

# ============================================================
# Summary
# ============================================================

function Show-Summary {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Installation terminee !" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Service : SportLinkSync (services.msc)" -ForegroundColor White
    Write-Host "  Config  : $($script:InstallDir)\sync-config.json" -ForegroundColor White
    Write-Host "  Logs    : $($script:InstallDir)\logs\sync.log" -ForegroundColor White
    Write-Host "  Sync    : tous les jours a $($script:SyncTime)" -ForegroundColor White

    Write-Host ""
    Write-Host "  Commandes utiles :" -ForegroundColor Gray
    Write-Host "    Get-Service SportLinkSync          # Etat du service" -ForegroundColor Gray
    Write-Host "    Restart-Service SportLinkSync       # Redemarrer" -ForegroundColor Gray
    Write-Host "    type $($script:InstallDir)\logs\sync.log  # Voir les logs" -ForegroundColor Gray
    Write-Host ""
}

# ============================================================
# Main
# ============================================================

Write-Banner
Step-Prerequisites
Step-Configuration
Step-NodeJS
Step-MariaDB
Step-Service
Step-FirstSync
Show-Summary

exit 0
