# Package an already approved Windows portable EXE as a normal Windows
# installer. DOES NOT claim code signing; needs a trusted signing certificate
# to remove "Unknown publisher" in Defender SmartScreen.
[CmdletBinding()]
param(
  [string]$SourceExe = 'dist/CartoRig-2.4.0-Preview-Wails3-Portable-Windows-x64.exe',
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$ExpectedSHA256
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $root
try{
  $source=(Resolve-Path -LiteralPath $SourceExe -ErrorAction Stop).Path
  $actual=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
  if($actual -ne $ExpectedSHA256.ToLowerInvariant()){
    throw "Refusing to bundle EXE with unapproved SHA256: $actual"
  }
  if(([IO.Path]::GetFileName($source)) -ne 'CartoRig-2.4.0-Preview-Wails3-Portable-Windows-x64.exe'){
    throw 'Installer source EXE must have the approved 2.4.0 Preview filename'
  }
  $compiler=Get-Command ISCC.exe -ErrorAction SilentlyContinue
  $compilerPath=if($compiler){$compiler.Source}else{$null}
  if(-not $compilerPath){
    foreach($candidate in @(
      "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
      "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
      "$env:ProgramFiles(x86)\Inno Setup 7\ISCC.exe",
      "$env:ProgramFiles\Inno Setup 7\ISCC.exe"
    )) {
      if(Test-Path -LiteralPath $candidate){$compilerPath=$candidate;break}
    }
  }
  if(-not $compilerPath){throw 'Inno Setup compiler ISCC.exe was not found. Install Inno Setup 6 or 7.'}
  New-Item -ItemType Directory -Force 'dist/installer' | Out-Null
  $brand=(Resolve-Path 'assets/cartorig-brand.png').Path
  $png=[IO.File]::ReadAllBytes($brand)
  if($png.Length -lt 100 -or $png[0] -ne 137 -or $png[1] -ne 80){
    throw 'Cannot create installer icon: invalid embedded CartoRig PNG'
  }
  $iconPath=(Join-Path (Resolve-Path dist).Path 'cartorig-installer.ico')
  $stream=[IO.File]::Create($iconPath)
  try{
    $bw=[IO.BinaryWriter]::new($stream)
    $bw.Write([uint16]0);$bw.Write([uint16]1);$bw.Write([uint16]1)
    $bw.Write([byte]128);$bw.Write([byte]128)
    $bw.Write([byte]0);$bw.Write([byte]0)
    $bw.Write([uint16]1);$bw.Write([uint16]32)
    $bw.Write([uint32]$png.Length);$bw.Write([uint32]22)
    $bw.Write([byte[]]$png);$bw.Flush()
  }finally{$stream.Dispose()}
  & $compilerPath 'installer/cartorig-desktop.iss'
  if($LASTEXITCODE -ne 0){throw "Inno Setup compile failed: exit=$LASTEXITCODE"}
  $setup=(Resolve-Path 'dist/installer/CartoRig-2.4.0-Preview-Setup-Windows-x64.exe').Path
  if((Get-Item $setup).Length -lt 5MB){throw 'Installer output too small'}
  $checksum=(Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
  "$checksum  $([IO.Path]::GetFileName($setup))" | Set-Content -LiteralPath 'dist/installer/CartoRig-2.4.0-Preview-Setup-Windows-x64-SHA256.txt' -Encoding ascii
  $sig=Get-AuthenticodeSignature -LiteralPath $setup
  Write-Host "Inno Setup installer generated: $setup"
  Write-Host "Installer SHA256: $checksum"
  Write-Host "Authenticode status: $($sig.Status) — unsigned preview (SmartScreen may warn)"
}finally{Pop-Location}
