# Verify a released CartoRig Windows EXE. Fails closed on unsigned,
# self-signed/untrusted, expired or otherwise invalid Authenticode signatures.
# Must run AFTER signing and BEFORE creating the release SHA256/portable ZIP.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ExePath
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$exe=(Resolve-Path -LiteralPath $ExePath -ErrorAction Stop).Path
if ([IO.Path]::GetExtension($exe).ToLowerInvariant() -ne '.exe') {
    throw "Windows signature check requires an EXE file: $exe"
}
$signature=Get-AuthenticodeSignature -LiteralPath $exe
if ($null -eq $signature.SignerCertificate) {
    throw "UNSIGNED EXECUTABLE: $([IO.Path]::GetFileName($exe)). A SHA256 checksum does not establish publisher identity. Configure trusted code signing before distributing as signed."
}
if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
    throw "INVALID/UNTRUSTED SIGNATURE: $($signature.Status) — $($signature.StatusMessage)"
}
$signer=$signature.SignerCertificate
$codeSigningOid='1.3.6.1.5.5.7.3.3'
$usesCodeSigning=$false
foreach ($ext in $signer.Extensions) {
    if ($ext.Oid.Value -eq '2.5.29.37') {
        $eku=[Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]$ext
        foreach ($oid in $eku.EnhancedKeyUsages) {
            if ($oid.Value -eq $codeSigningOid) { $usesCodeSigning=$true }
        }
    }
}
if (-not $usesCodeSigning) {
    throw "Certificate does not have Code Signing EKU: $($signer.Subject)"
}
if ([string]::IsNullOrWhiteSpace($signer.Subject)) {
    throw 'Certificate has no publisher identity.'
}
$hash=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Authenticode: VALID"
Write-Host "Publisher: $($signer.Subject)"
Write-Host "Certificate thumbprint: $($signer.Thumbprint)"
Write-Host "Signed executable SHA256: $hash"
