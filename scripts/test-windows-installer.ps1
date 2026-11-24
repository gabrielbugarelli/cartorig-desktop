# QA-only: exercise the *real* Inno Setup wizard package silently on a
# throwaway Windows runner, including install, shortcuts, launch and uninstall.
# Never remove CartoRig user preferences or project files.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$SetupExe,
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$ApprovedPortableSHA256
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$setup=(Resolve-Path -LiteralPath $SetupExe -ErrorAction Stop).Path
if($env:RUNNER_TEMP){
  $qaRoot=Join-Path $env:RUNNER_TEMP 'CartoRig-Installer-QA'
}else{throw 'This smoke test must run only on an isolated GitHub Windows runner.'}
$install=Join-Path $qaRoot 'Installed CartoRig'
$setupLog=Join-Path $qaRoot 'setup.log'
$uninstallLog=Join-Path $qaRoot 'uninstall.log'
New-Item -ItemType Directory -Force $qaRoot | Out-Null
$sentinel=Join-Path $env:LOCALAPPDATA 'CartoRig\installer-qa-keep-data.txt'
New-Item -ItemType Directory -Force (Split-Path -Parent $sentinel) | Out-Null
Set-Content -LiteralPath $sentinel -Value 'Keep this user project and preferences directory' -Encoding utf8
$shortcut=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\CartoRig Desktop.lnk'
try{
  $argsInstall=@('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',
     "/DIR=`"$install`"","/LOG=`"$setupLog`"")
  $proc=Start-Process -FilePath $setup -ArgumentList $argsInstall -Wait -PassThru
  if($proc.ExitCode -ne 0){throw "Installer failed with code $($proc.ExitCode)"}
  $app=Join-Path $install 'CartoRig.exe'
  $uninstaller=Join-Path $install 'unins000.exe'
  if(!(Test-Path -LiteralPath $app)){throw 'Installed CartoRig.exe not found'}
  if(!(Test-Path -LiteralPath $uninstaller)){throw 'Uninstall executable not created'}
  if(!(Test-Path -LiteralPath $shortcut)){throw 'Start Menu shortcut was not installed'}
  if(!(Test-Path -LiteralPath (Join-Path $install 'LICENSE.txt'))){throw 'License was not installed'}
  $installedHash=(Get-FileHash -LiteralPath $app -Algorithm SHA256).Hash.ToLowerInvariant()
  if($installedHash -ne $ApprovedPortableSHA256.ToLowerInvariant()){
    throw "Installed EXE differs from QA-approved portable EXE: $installedHash"
  }
  $uninstallKey=@(Get-ChildItem -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    Where-Object {($_ | Get-ItemProperty -ErrorAction SilentlyContinue).DisplayName -like 'CartoRig Desktop*'})
  if($uninstallKey.Count -lt 1){throw 'No installed-app registration found in current user uninstall registry'}
  Write-Host 'Installer registry, Start Menu, license and SHA256 verified'
  & $app --self-check
  if($LASTEXITCODE -ne 0){throw 'Installed EXE failed --self-check'}
  $gui=Start-Process -FilePath $app -PassThru
  try{
    Start-Sleep -Seconds 7
    $gui.Refresh()
    if($gui.HasExited){throw "Installed GUI terminated during smoke test: $($gui.ExitCode)"}
    Write-Host 'Installed GUI remained alive after 7 seconds'
  }finally{
    $gui.Refresh()
    if(!$gui.HasExited){Stop-Process -Id $gui.Id -Force -ErrorAction Stop}
    Start-Sleep -Seconds 1
  }
  $argsUninstall=@('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',"/LOG=`"$uninstallLog`"")
  $un=Start-Process -FilePath $uninstaller -ArgumentList $argsUninstall -Wait -PassThru
  if($un.ExitCode -ne 0){throw "Uninstaller failed with code $($un.ExitCode)"}
  Start-Sleep -Seconds 2
  if(Test-Path -LiteralPath $app){throw 'Installed executable was not removed by uninstaller'}
  if(Test-Path -LiteralPath $shortcut){throw 'Start Menu shortcut was not removed'}
  if(!(Test-Path -LiteralPath $sentinel)){throw 'ERROR: Uninstall removed user profile data'}
  Write-Host 'INSTALLER QA PASS: install, registered uninstaller, Start Menu, verified binary, startup, uninstall, retained user data'
}catch{
  Write-Host ('INSTALLER QA ERROR: '+$_)
  foreach($log in @($setupLog,$uninstallLog)){
    if(Test-Path -LiteralPath $log){Get-Content -LiteralPath $log -Tail 30}
  }
  throw
}finally{
  if(Test-Path -LiteralPath $sentinel){Remove-Item -LiteralPath $sentinel -Force}
}
