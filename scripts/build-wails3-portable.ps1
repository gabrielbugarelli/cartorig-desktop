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
    # Git on Windows may check out JS sources with CRLF; preview fingerprints are LF.
    # Only normalize when the resulting content matches the manifest's hash.
    $manifest = Get-Content -Raw 'assets/look-previews/manifest.json' | ConvertFrom-Json
    foreach ($entry in $manifest.sources.PSObject.Properties) {
        $path = Join-Path 'assets' $entry.Name
        $actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
        $expected = [string]$entry.Value
        if ($actual -eq $expected) { continue }
        $raw = [System.IO.File]::ReadAllBytes((Resolve-Path $path))
        $text = [System.Text.Encoding]::UTF8.GetString($raw)
        $lf = $text.Replace([Environment]::NewLine, [string][char]10)
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        $converted = $utf8.GetBytes($lf)
        $checksum = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($converted)).ToLowerInvariant()
        if ($checksum -ne $expected) {
            throw "Preview source hash mismatch (not newline-related): $path"
        }
        [System.IO.File]::WriteAllBytes((Resolve-Path $path), $converted)
        Write-Host "Restored LF line endings: $path"
    }
    # The fullgeo release guard fingerprints raw UTF-8 bytes. Windows
    # autocrlf changes these bytes unless each pinned asset is restored.
    # Never bypass the guard or recalculate expected hashes to match damage.
    $geoManifest = Get-Content -Raw 'assets/geodata/offline_integrity.json' | ConvertFrom-Json
    foreach ($entry in $geoManifest.datasets.PSObject.Properties) {
        $expected = [string]$entry.Value.sha256
        $path = Join-Path 'assets/geodata' ([string]$entry.Value.file)
        $actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -eq $expected) { continue }
        $raw = [System.IO.File]::ReadAllBytes((Resolve-Path $path))
        $text = [System.Text.Encoding]::UTF8.GetString($raw)
        $lf = $text.Replace([Environment]::NewLine, [string][char]10)
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        $converted = $utf8.GetBytes($lf)
        $checksum = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($converted)).ToLowerInvariant()
        if ($checksum -ne $expected) {
            throw "Offline dataset hash mismatch: $path (got $actual, normalized $checksum, expected $expected)"
        }
        [System.IO.File]::WriteAllBytes((Resolve-Path $path), $converted)
        Write-Host "Restored locked offline dataset bytes: $path"
    }
    # Explicit fullgeo test runs the same package init() checks as the
    # production executable; a broken release may no longer compile quietly.
    # Verify that only numerical browser diagnostics are accepted.
    & go test -run 'TestDesktop(ExportPath|Save)' ./...
    if ($LASTEXITCODE -ne 0) { throw 'Renamed native export regression failed' }
    & go test -run 'TestRecoveryDelete' ./...
    if ($LASTEXITCODE -ne 0) { throw 'Recovery deletion backend regression failed' }
    & go test -run TestDesktopHeartbeat ./...
    if ($LASTEXITCODE -ne 0) { throw 'Desktop heartbeat regression failed' }
    & go test -tags fullgeo ./...
    if ($LASTEXITCODE -ne 0) { throw 'Fullgeo release guard failed: refusing to build portable EXE' }
    # Test the Natural Earth -99 collision using the actual bundled 110m map.
    & node tests/test_country_id_collision.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Country identity regression failed' }
    & node tests/test_workspace_reset.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Workspace reset regression failed' }
    & node tests/test_desktop_native.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Desktop lifecycle regression failed' }
    & node tests/test_preview_lifecycle.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Preview lifecycle regression failed' }
    & node tests/test_desktop_diagnostics.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Desktop diagnostics regression failed' }
    & node tests/test_preview_cache.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Preview cache regression failed' }
    & node tests/test_preview_composition_integration.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Preview integration regression failed' }
    # Validate bounded pregraded terrain textures and untouched export rendering.
    & node tests/test_texture_cache.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Texture preparation regression failed' }
    & node tests/test_texture_render_path.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Texture render-path regression failed' }
    & node tests/test_state_boundaries.mjs
    if ($LASTEXITCODE -ne 0) { throw 'State boundary preview regression failed' }
    & node tests/test_label_stack.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Map label stacking regression failed' }
    & node tests/test_recovery_bulk_ui.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Recovery bulk selection UI regression failed' }
    & node tests/test_ui_stage1.mjs
    if ($LASTEXITCODE -ne 0) { throw 'UI stage-one contract regression failed' }
    & node tests/test_ui_map_display.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Compact map display regression failed' }
    & node tests/test_callout_geo_anchor.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Geographic Callout regression failed' }
    & node tests/test_callout_text_contrast.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Callout text contrast regression failed' }
    & node tests/test_material_geo_anchor.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Geographic texture material regression failed' }
    & node tests/test_ocean_material_isolation.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Separate ocean material regression failed' }
    & node --check assets/creative-renderer.js
    if ($LASTEXITCODE -ne 0) { throw 'Creative renderer JavaScript syntax invalid' }
    & node --check assets/scene-renderer.js
    if ($LASTEXITCODE -ne 0) { throw 'Scene renderer JavaScript syntax invalid' }
    & node tests/test_ui_stage1_behavior.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Project Manager keyboard regression failed' }
    & node --check assets/app.js
    if ($LASTEXITCODE -ne 0) { throw 'Invalid editor JavaScript syntax' }
    & node --check assets/production-studio.js
    if ($LASTEXITCODE -ne 0) { throw 'Invalid Project Manager JavaScript syntax' }
    if (-not $SkipTests) {
        & go test ./...
        if ($LASTEXITCODE -ne 0) { throw 'Legacy CartoRig tests failed' }
    }
    # Use the desktop module in the CI worktree only; the 2.0.4.1 go.mod in
    # Git remains unchanged for existing browser/server builds.
    Copy-Item -Force 'go.desktop.mod' 'go.mod'
    & go mod tidy
    if ($LASTEXITCODE -ne 0) { throw 'Failed to fetch Wails 3 dependencies' }
    New-Item -ItemType Directory -Force dist | Out-Null
    $env:GOOS='windows'
    $env:GOARCH='amd64'
    $env:CGO_ENABLED='0'
    # Create PNG-in-ICO icon and embed it as a Windows executable resource.
    $png=[System.IO.File]::ReadAllBytes((Resolve-Path 'assets/cartorig-brand.png'))
    if ($png.Length -lt 100 -or $png[0] -ne 137 -or $png[1] -ne 80) { throw 'CartoRig PNG icon is invalid' }
    $ico='dist/cartorig-brand.ico'
    $stream=[System.IO.File]::Create((Join-Path (Get-Location).Path $ico))
    try {
        $writer=[System.IO.BinaryWriter]::new($stream)
        $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]1)
        $writer.Write([byte]128);$writer.Write([byte]128)
        $writer.Write([byte]0);$writer.Write([byte]0)
        $writer.Write([uint16]1);$writer.Write([uint16]32)
        $writer.Write([uint32]$png.Length);$writer.Write([uint32]22)
        $writer.Write([byte[]]$png)
        $writer.Flush()
    } finally { $stream.Dispose() }
    & go install github.com/akavel/rsrc@latest
    if ($LASTEXITCODE -ne 0) { throw 'Cannot install Windows icon resource tool' }
    $rsrc=Join-Path (& go env GOPATH) 'bin/rsrc.exe'
    & $rsrc -ico $ico -arch amd64 -o 'cartorig_windows_amd64.syso'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot embed CartoRig Windows icon' }
    $out='dist/CartoRig-2.1.0-Wails3-Portable-Windows-x64.exe'
    try {
        & go build -trimpath -tags 'wails,production,fullgeo' -ldflags '-s -w -H=windowsgui' -o $out .
        if ($LASTEXITCODE -ne 0) { throw 'Wails 3 Windows compilation failed' }
    } finally {
        Remove-Item -Force 'cartorig_windows_amd64.syso' -ErrorAction SilentlyContinue
    }
    $f = Get-Item $out
    if ($f.Length -lt 5MB) { throw 'Executable too small; check embedded assets' }
    $sha=(Get-FileHash $out -Algorithm SHA256).Hash
    "$sha *$($f.Name)" | Set-Content -Encoding ascii 'dist/CartoRig-Wails3-SHA256.txt'
    Write-Host "Built $out ($([math]::Round($f.Length/1MB,1)) MiB)"
    Write-Host "SHA256: $sha"
} finally {
    Pop-Location
}
