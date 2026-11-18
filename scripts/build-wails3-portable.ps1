param([switch]$SkipTests)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
    $goVersion = & go env GOVERSION
    if ($LASTEXITCODE -ne 0) { throw 'Go is not available' }
    if ($goVersion -notmatch '^go1\.(\d+)' -or [int]$Matches[1] -lt 26) {
        throw 'CartoRig Wails 3 requires Go 1.26 or later'
    }
    if (-not $SkipTests) {
        & go test ./...
        if ($LASTEXITCODE -ne 0) { throw 'Legacy CartoRig tests failed' }
    }
    & go mod tidy -modfile=go.desktop.mod
    if ($LASTEXITCODE -ne 0) { throw 'Failed to fetch Wails 3 dependencies' }
    New-Item -ItemType Directory -Force dist | Out-Null
    $env:GOOS='windows'
    $env:GOARCH='amd64'
    $env:CGO_ENABLED='0'
    $out='dist/CartoRig-2.1.0-Wails3-Portable-Windows-x64.exe'
    & go build -modfile=go.desktop.mod -trimpath -tags 'wails,production,fullgeo' -ldflags '-s -w -H=windowsgui' -o $out .
    if ($LASTEXITCODE -ne 0) { throw 'Wails 3 Windows compilation failed' }
    $f = Get-Item $out
    if ($f.Length -lt 5MB) { throw 'Executable too small; check embedded assets' }
    $sha=(Get-FileHash $out -Algorithm SHA256).Hash
    "$sha *$($f.Name)" | Set-Content -Encoding ascii 'dist/CartoRig-Wails3-SHA256.txt'
    Write-Host "Built $out ($([math]::Round($f.Length/1MB,1)) MiB)"
    Write-Host "SHA256: $sha"
} finally {
    Pop-Location
}
