# Locally sign a *verified* CartoRig executable with a CA-trusted
# code-signing certificate already installed in CurrentUser\My.
# This script never accepts private-key bytes, passwords, PFX files or
# self-signed developer certificates from chat or the repository.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ExePath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSHA256,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$CertificateThumbprint,
    [string]$OutputDirectory = 'dist/signed'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$source=(Resolve-Path -LiteralPath $ExePath -ErrorAction Stop).Path
if ([IO.Path]::GetExtension($source).ToLowerInvariant() -ne '.exe') {
    throw 'Only PE executable files can be signed with this workflow.'
}
$original=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if ($original -ne $ExpectedSHA256.ToLowerInvariant()) {
    throw "STOP: original executable does not match the approved SHA256. Expected $ExpectedSHA256 but got $original"
}
$thumb=$CertificateThumbprint.ToUpperInvariant()
$cert=Get-Item -LiteralPath ("Cert:\CurrentUser\My\" + $thumb) -ErrorAction Stop
if (-not $cert.HasPrivateKey) {throw 'Certificate has no accessible signing key. Check your HSM/token and certificate store.'}
if ((Get-Date) -lt $cert.NotBefore -or (Get-Date) -gt $cert.NotAfter) {
    throw 'Code signing certificate is outside its validity period.'
}

$tool=(Get-Command signtool.exe -ErrorAction SilentlyContinue)
if ($null -ne $tool) {
    $signtool=$tool.Source
}else{
    $kitRoot=Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Windows Kits\10\bin'
    $tools=@()
    if(Test-Path $kitRoot){
        $tools=@(Get-ChildItem $kitRoot -Recurse -File -Filter signtool.exe -ErrorAction SilentlyContinue |
            Where-Object {$_.FullName -match '\\x64\\signtool\.exe$'} | Sort-Object FullName -Descending)
    }
    if($tools.Count -lt 1){throw 'SignTool.exe not installed. Install the Windows SDK Signing Tools.'}
    $signtool=$tools[0].FullName
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$destDirectory=(Resolve-Path -LiteralPath $OutputDirectory).Path
$target=Join-Path $destDirectory ([IO.Path]::GetFileName($source))
if([string]::Equals($source,$target,[StringComparison]::OrdinalIgnoreCase)){
    throw 'Signing must not modify the source file in place.'
}
Copy-Item -LiteralPath $source -Destination $target -Force

& $signtool sign /sha1 $thumb /fd SHA256 /tr 'http://timestamp.digicert.com' /td SHA256 $target
if ($LASTEXITCODE -ne 0){throw 'SignTool could not sign the Windows executable'}
& (Join-Path $PSScriptRoot 'verify-windows-signature.ps1') -ExePath $target
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0){throw 'Failed to validate Authenticode signer'}

$hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
$checksum=Join-Path $destDirectory 'CartoRig-Signed-Windows-x64-SHA256.txt'
"$hash  $([IO.Path]::GetFileName($target))" | Set-Content -LiteralPath $checksum -Encoding ascii
$archive=Join-Path $destDirectory 'CartoRig-Signed-Windows-x64-Portable.zip'
if(Test-Path $archive){Remove-Item -LiteralPath $archive -Force}
Compress-Archive -LiteralPath $target,$checksum -DestinationPath $archive -CompressionLevel Optimal
Write-Host "SIGNED portable: $archive"
Write-Host "SIGNED EXE SHA256: $hash"
