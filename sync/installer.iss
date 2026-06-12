#define MyAppName "Ginkoyes Serveur"
#define MyAppVersion "1.3.2"
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

; Application GUI (dossier Electron decompresse)
Source: "..\server-app\release\win-unpacked\*"; DestDir: "{app}\gui"; Flags: ignoreversion recursesubdirs createallsubdirs

; Scripts SQL schema
Source: "..\sql\*.sql"; DestDir: "{app}\sql"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\gui\Ginkoyes Serveur.exe"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\gui\Ginkoyes Serveur.exe"
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

  // Page Tailscale
  TailscalePage: TWizardPage;
  TailscaleKeyEdit: TNewEdit;

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
  LabelGbk, LabelGbak: TNewStaticText;
  LabelSync, LabelSyncDesc: TNewStaticText;
  LabelTs, LabelTsDesc: TNewStaticText;
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
  LabelGbk.Caption := 'Chemin vers le fichier SV.GBK :';
  LabelGbk.Top := 0;
  LabelGbk.Left := 0;

  // Edit GBK
  GbkFileEdit := TNewEdit.Create(FirebirdPage);
  GbkFileEdit.Parent := FirebirdPage.Surface;
  GbkFileEdit.Top := LabelGbk.Top + LabelGbk.Height + 6;
  GbkFileEdit.Left := 0;
  GbkFileEdit.Width := FirebirdPage.SurfaceWidth - 90;
  GbkFileEdit.Text := 'C:\Ginkoia\Backup\SV.GBK';

  // Bouton Parcourir GBK
  GbkBrowseButton := TNewButton.Create(FirebirdPage);
  GbkBrowseButton.Parent := FirebirdPage.Surface;
  GbkBrowseButton.Caption := 'Parcourir...';
  GbkBrowseButton.Top := GbkFileEdit.Top - 2;
  GbkBrowseButton.Left := GbkFileEdit.Left + GbkFileEdit.Width + 6;
  GbkBrowseButton.Width := 80;
  GbkBrowseButton.OnClick := @GbkBrowseClick;

  // Label gbak.exe
  LabelGbak := TNewStaticText.Create(FirebirdPage);
  LabelGbak.Parent := FirebirdPage.Surface;
  LabelGbak.Caption := 'Chemin vers gbak.exe :';
  LabelGbak.Top := GbkFileEdit.Top + GbkFileEdit.Height + 20;
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
  SyncTimeEdit.Text := '23:10';

  LabelSyncDesc := TNewStaticText.Create(SyncPage);
  LabelSyncDesc.Parent := SyncPage.Surface;
  LabelSyncDesc.Caption := 'La base de donnees sera synchronisee chaque jour a cette heure.';
  LabelSyncDesc.Top := SyncTimeEdit.Top + SyncTimeEdit.Height + 12;
  LabelSyncDesc.Left := 0;
  LabelSyncDesc.Font.Color := clGray;

  // =====================================================
  // Page 3 : Tailscale VPN
  // =====================================================
  TailscalePage := CreateCustomPage(SyncPage.ID,
    'VPN Tailscale (optionnel)',
    'Si vous disposez d''une cle Tailscale, entrez-la ci-dessous.');

  LabelTs := TNewStaticText.Create(TailscalePage);
  LabelTs.Parent := TailscalePage.Surface;
  LabelTs.Caption := 'Cle d''authentification Tailscale :';
  LabelTs.Top := 0;
  LabelTs.Left := 0;

  TailscaleKeyEdit := TNewEdit.Create(TailscalePage);
  TailscaleKeyEdit.Parent := TailscalePage.Surface;
  TailscaleKeyEdit.Top := LabelTs.Top + LabelTs.Height + 6;
  TailscaleKeyEdit.Left := 0;
  TailscaleKeyEdit.Width := FirebirdPage.SurfaceWidth;
  TailscaleKeyEdit.Text := '';

  LabelTsDesc := TNewStaticText.Create(TailscalePage);
  LabelTsDesc.Parent := TailscalePage.Surface;
  LabelTsDesc.Caption := 'Laissez vide pour ignorer la configuration Tailscale.';
  LabelTsDesc.Top := TailscaleKeyEdit.Top + TailscaleKeyEdit.Height + 12;
  LabelTsDesc.Left := 0;
  LabelTsDesc.Font.Color := clGray;
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
      MsgBox('Veuillez indiquer une heure de synchronisation (ex: 23:10).', mbError, MB_OK);
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
      ' -SyncTime "' + EscapeParam(SyncTimeEdit.Text) + '"' +
      ' -TailscaleKey "' + EscapeParam(TailscaleKeyEdit.Text) + '"';

    WizardForm.StatusLabel.Caption := 'Configuration du serveur Ginkoyes en cours...';

    Exec('powershell.exe', Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);

    if ResultCode <> 0 then
      MsgBox('La configuration a retourne le code ' + IntToStr(ResultCode) + '.' + #13#10 +
        'Verifiez les logs dans ' + ExpandConstant('{app}') + '\logs\sync.log',
        mbError, MB_OK);
  end;
end;
