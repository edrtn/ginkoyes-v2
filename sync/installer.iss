#define MyAppName "SportLink Server"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "SportLink"
#define MyAppURL "https://github.com/edrtn/ginkoyes-v2"

[Setup]
AppId={{B8A3F2E1-5C7D-4A9B-8E6F-1D2C3B4A5E6F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppSupportURL={#MyAppURL}
DefaultDirName=C:\sportlink-serveur
DefaultGroupName={#MyAppName}
OutputDir=..\release
OutputBaseFilename=SportLinkServer-Setup-{#MyAppVersion}
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

; Application GUI (dossier Electron decompresse)
Source: "..\server-app\release\win-unpacked\*"; DestDir: "{app}\gui"; Flags: ignoreversion recursesubdirs createallsubdirs

; Scripts SQL schema
Source: "..\sql\*.sql"; DestDir: "{app}\sql"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\gui\SportLink Server.exe"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\gui\SportLink Server.exe"
Name: "{group}\Desinstaller {#MyAppName}"; Filename: "{uninstallexe}"

[UninstallRun]
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\uninstall.ps1"""; \
  Flags: runhidden waituntilterminated runascurrentuser

[Code]
// -------------------------------------------------------
// Execution post-install : lancer setup.ps1 avec parametres par defaut
// La configuration InterBase se fait dans l'app Electron au premier lancement.
// -------------------------------------------------------
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Params: String;
begin
  if CurStep = ssPostInstall then
  begin
    Params := '-ExecutionPolicy Bypass -File "' + ExpandConstant('{app}') + '\setup.ps1"' +
      ' -InstallDir "' + ExpandConstant('{app}') + '"';

    WizardForm.StatusLabel.Caption := 'Configuration de SportLink Server en cours...';

    Exec('powershell.exe', Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);

    if ResultCode <> 0 then
      MsgBox('La configuration a retourne le code ' + IntToStr(ResultCode) + '.' + #13#10 +
        'Verifiez les logs dans ' + ExpandConstant('{app}') + '\logs\sync.log',
        mbError, MB_OK);
  end;
end;
