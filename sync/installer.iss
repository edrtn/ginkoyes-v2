#define MyAppName "Ginkoyes Serveur"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ginkoyes"
#define MyAppURL "https://github.com/edrtn/ginkoyes-v2"

[Setup]
AppId={{B8A3F2E1-5C7D-4A9B-8E6F-1D2C3B4A5E6F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppSupportURL={#MyAppURL}
DefaultDirName=C:\Ginkoyes
DefaultGroupName={#MyAppName}
OutputDir=..\release
OutputBaseFilename=GinkoyesServeur-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Files]
; Scripts PowerShell
Source: "setup.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-task.ps1"; DestDir: "{app}"; Flags: ignoreversion

; Service de synchronisation
Source: "sync.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "service.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-service.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "tsconfig.service.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "sync-config.json"; DestDir: "{app}"; Flags: ignoreversion

; Scripts SQL schema
Source: "..\sql\*.sql"; DestDir: "{app}\sql"; Flags: ignoreversion

[Icons]
Name: "{group}\Desinstaller {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -NoExit -File ""{app}\setup.ps1"""; \
  Description: "Lancer la configuration du serveur Ginkoyes"; \
  StatusMsg: "Configuration du serveur Ginkoyes..."; \
  Flags: postinstall waituntilterminated runascurrentuser

[UninstallRun]
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\uninstall.ps1"""; \
  Flags: runhidden waituntilterminated runascurrentuser
