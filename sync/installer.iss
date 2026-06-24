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
var
  // Page Configuration Firebird
  FirebirdPage: TWizardPage;
  GbkFileEdit: TNewEdit;
  GbkBrowseButton: TNewButton;
  GbakExeEdit: TNewEdit;
  GbakBrowseButton: TNewButton;

  // Page Synchronisation
  SyncPage: TWizardPage;
  SyncTimeEdit: TNewEdit;

// -------------------------------------------------------
// Auto-detection de gbak.exe
// -------------------------------------------------------
function DetectGbakExe: String;
var
  Paths: array of String;
  I: Integer;
begin
  Result := '';
  SetLength(Paths, 4);
  Paths[0] := 'C:\Program Files\Firebird\Firebird_4_0\gbak.exe';
  Paths[1] := 'C:\Program Files\Firebird\Firebird_3_0\gbak.exe';
  Paths[2] := 'C:\Program Files (x86)\Firebird\Firebird_3_0\gbak.exe';
  Paths[3] := 'C:\Ginkoia\Firebird\gbak.exe';

  for I := 0 to Length(Paths) - 1 do
  begin
    if FileExists(Paths[I]) then
    begin
      Result := Paths[I];
      Exit;
    end;
  end;
end;

// -------------------------------------------------------
// Bouton Parcourir pour GBK
// -------------------------------------------------------
procedure GbkBrowseClick(Sender: TObject);
var
  FileName: String;
begin
  FileName := GbkFileEdit.Text;
  if GetOpenFileName('Selectionner le fichier SV.GBK', FileName, '', 'Fichiers GBK (*.GBK)|*.GBK|Tous les fichiers (*.*)|*.*', 'GBK') then
    GbkFileEdit.Text := FileName;
end;

// -------------------------------------------------------
// Bouton Parcourir pour gbak.exe
// -------------------------------------------------------
procedure GbakBrowseClick(Sender: TObject);
var
  FileName: String;
begin
  FileName := GbakExeEdit.Text;
  if GetOpenFileName('Selectionner gbak.exe', FileName, '', 'Executables (*.exe)|*.exe|Tous les fichiers (*.*)|*.*', 'exe') then
    GbakExeEdit.Text := FileName;
end;

// -------------------------------------------------------
// Creation des pages custom
// -------------------------------------------------------
procedure InitializeWizard;
var
  LabelGbk, LabelGbkDesc, LabelGbak: TNewStaticText;
  LabelSync, LabelSyncDesc: TNewStaticText;
  DetectedGbak: String;
begin
  // =====================================================
  // Page 1 : Configuration Firebird
  // =====================================================
  FirebirdPage := CreateCustomPage(wpSelectDir,
    'Configuration Firebird',
    'Indiquez les chemins vers les fichiers Firebird necessaires.');

  // Label GBK
  LabelGbk := TNewStaticText.Create(FirebirdPage);
  LabelGbk.Parent := FirebirdPage.Surface;
  LabelGbk.Caption := 'Chemin reseau vers le fichier SV.GBK (source) :';
  LabelGbk.Top := 0;
  LabelGbk.Left := 0;

  // Edit GBK
  GbkFileEdit := TNewEdit.Create(FirebirdPage);
  GbkFileEdit.Parent := FirebirdPage.Surface;
  GbkFileEdit.Top := LabelGbk.Top + LabelGbk.Height + 6;
  GbkFileEdit.Left := 0;
  GbkFileEdit.Width := FirebirdPage.SurfaceWidth - 90;
  GbkFileEdit.Text := '\\SERVEUR\Backup\SV.GBK';

  // Bouton Parcourir GBK
  GbkBrowseButton := TNewButton.Create(FirebirdPage);
  GbkBrowseButton.Parent := FirebirdPage.Surface;
  GbkBrowseButton.Caption := 'Parcourir...';
  GbkBrowseButton.Top := GbkFileEdit.Top - 2;
  GbkBrowseButton.Left := GbkFileEdit.Left + GbkFileEdit.Width + 6;
  GbkBrowseButton.Width := 80;
  GbkBrowseButton.OnClick := @GbkBrowseClick;

  // Label explicatif
  LabelGbkDesc := TNewStaticText.Create(FirebirdPage);
  LabelGbkDesc.Parent := FirebirdPage.Surface;
  LabelGbkDesc.Caption := 'Chemin reseau du backup Ginkoia (ex: \\SERVEUR\Backup\SV.GBK). Il sera copie en local avant chaque sync.';
  LabelGbkDesc.Top := GbkFileEdit.Top + GbkFileEdit.Height + 6;
  LabelGbkDesc.Left := 0;
  LabelGbkDesc.Font.Color := clGray;

  // Label gbak.exe
  LabelGbak := TNewStaticText.Create(FirebirdPage);
  LabelGbak.Parent := FirebirdPage.Surface;
  LabelGbak.Caption := 'Chemin vers gbak.exe :';
  LabelGbak.Top := LabelGbkDesc.Top + LabelGbkDesc.Height + 20;
  LabelGbak.Left := 0;

  // Edit gbak.exe
  GbakExeEdit := TNewEdit.Create(FirebirdPage);
  GbakExeEdit.Parent := FirebirdPage.Surface;
  GbakExeEdit.Top := LabelGbak.Top + LabelGbak.Height + 6;
  GbakExeEdit.Left := 0;
  GbakExeEdit.Width := FirebirdPage.SurfaceWidth - 90;

  // Auto-detection de gbak.exe
  DetectedGbak := DetectGbakExe;
  if DetectedGbak <> '' then
    GbakExeEdit.Text := DetectedGbak
  else
    GbakExeEdit.Text := 'C:\Program Files\Firebird\Firebird_3_0\gbak.exe';

  // Bouton Parcourir gbak.exe
  GbakBrowseButton := TNewButton.Create(FirebirdPage);
  GbakBrowseButton.Parent := FirebirdPage.Surface;
  GbakBrowseButton.Caption := 'Parcourir...';
  GbakBrowseButton.Top := GbakExeEdit.Top - 2;
  GbakBrowseButton.Left := GbakExeEdit.Left + GbakExeEdit.Width + 6;
  GbakBrowseButton.Width := 80;
  GbakBrowseButton.OnClick := @GbakBrowseClick;

  // =====================================================
  // Page 2 : Synchronisation
  // =====================================================
  SyncPage := CreateCustomPage(FirebirdPage.ID,
    'Synchronisation',
    'Configurez l''heure de synchronisation quotidienne.');

  LabelSync := TNewStaticText.Create(SyncPage);
  LabelSync.Parent := SyncPage.Surface;
  LabelSync.Caption := 'Heure de synchronisation (HH:MM) :';
  LabelSync.Top := 0;
  LabelSync.Left := 0;

  SyncTimeEdit := TNewEdit.Create(SyncPage);
  SyncTimeEdit.Parent := SyncPage.Surface;
  SyncTimeEdit.Top := LabelSync.Top + LabelSync.Height + 6;
  SyncTimeEdit.Left := 0;
  SyncTimeEdit.Width := 80;
  SyncTimeEdit.Text := '02:00';

  LabelSyncDesc := TNewStaticText.Create(SyncPage);
  LabelSyncDesc.Parent := SyncPage.Surface;
  LabelSyncDesc.Caption := 'La base de donnees sera synchronisee chaque jour a cette heure.';
  LabelSyncDesc.Top := SyncTimeEdit.Top + SyncTimeEdit.Height + 12;
  LabelSyncDesc.Left := 0;
  LabelSyncDesc.Font.Color := clGray;

end;

// -------------------------------------------------------
// Validation des pages
// -------------------------------------------------------
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = FirebirdPage.ID then
  begin
    if Trim(GbkFileEdit.Text) = '' then
    begin
      MsgBox('Veuillez indiquer le chemin vers le fichier SV.GBK.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Trim(GbakExeEdit.Text) = '' then
    begin
      MsgBox('Veuillez indiquer le chemin vers gbak.exe.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;

  if CurPageID = SyncPage.ID then
  begin
    if Trim(SyncTimeEdit.Text) = '' then
    begin
      MsgBox('Veuillez indiquer une heure de synchronisation (ex: 02:00).', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

// -------------------------------------------------------
// Echappement des guillemets pour la ligne de commande
// -------------------------------------------------------
function EscapeParam(const S: String): String;
begin
  Result := S;
end;

// -------------------------------------------------------
// Execution post-install : lancer setup.ps1 en mode silencieux
// -------------------------------------------------------
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Params: String;
begin
  if CurStep = ssPostInstall then
  begin
    Params := '-ExecutionPolicy Bypass -File "' + ExpandConstant('{app}') + '\setup.ps1"' +
      ' -GbkFilePath "' + EscapeParam(GbkFileEdit.Text) + '"' +
      ' -GbakExePath "' + EscapeParam(GbakExeEdit.Text) + '"' +
      ' -InstallDir "' + EscapeParam(ExpandConstant('{app}')) + '"' +
      ' -SyncTime "' + EscapeParam(SyncTimeEdit.Text) + '"';

    WizardForm.StatusLabel.Caption := 'Configuration de SportLink Server en cours...';

    Exec('powershell.exe', Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);

    if ResultCode <> 0 then
      MsgBox('La configuration a retourne le code ' + IntToStr(ResultCode) + '.' + #13#10 +
        'Verifiez les logs dans ' + ExpandConstant('{app}') + '\logs\sync.log',
        mbError, MB_OK);
  end;
end;
