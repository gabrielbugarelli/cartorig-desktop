; CartoRig 2.4.0 — traditional per-user Windows installer.
; Build with Inno Setup 6. Source EXE must be verified against the approved
; GitHub Actions QA artifact before ISCC compiles this script.
#define AppName "CartoRig Desktop"
#define AppVersion "2.4.0"
#define AppDisplayVersion "2.4.0"
#define AppExeName "CartoRig.exe"
#define SourceExe "CartoRig-2.4.0-Wails3-Portable-Windows-x64.exe"

[Setup]
AppId={{3928EE55-FFF5-5966-A76E-186D41369FFF}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppDisplayVersion}
AppPublisher=CartoRig
AppPublisherURL=https://github.com/gabrielbugarelli/cartorig-desktop
AppSupportURL=https://github.com/gabrielbugarelli/cartorig-desktop/issues
AppUpdatesURL=https://github.com/gabrielbugarelli/cartorig-desktop/releases
DefaultDirName={localappdata}\Programs\CartoRig Desktop
DefaultGroupName=CartoRig Desktop
UninstallDisplayName=CartoRig Desktop ({#AppDisplayVersion})
UninstallDisplayIcon={app}\{#AppExeName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
UsePreviousLanguage=yes
CloseApplications=yes
RestartApplications=no
AllowNoIcons=yes
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
OutputDir=..\dist\installer
OutputBaseFilename=CartoRig-2.4.0-Setup-Windows-x64
LicenseFile=..\LICENSE
SetupIconFile=..\dist\cartorig-installer.ico
SetupLogging=yes
MinVersion=10.0
ShowLanguageDialog=auto

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked

[Files]
Source: "..\dist\{#SourceExe}"; DestDir: "{app}"; DestName: "{#AppExeName}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\CartoRig Desktop"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Comment: "CartoRig Desktop"
Name: "{autodesktop}\CartoRig Desktop"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Iniciar CartoRig Desktop"; Flags: nowait postinstall skipifsilent
