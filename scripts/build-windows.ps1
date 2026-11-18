# CartoRig 2.0.4.1 Texture Visibility Windows x64 release gate. PowerShell 7+.
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$env:GOOS='windows';$env:GOARCH='amd64';$env:CGO_ENABLED='0'
foreach($command in @('go','python','node')){if(-not(Get-Command $command -ErrorAction SilentlyContinue)){throw "Missing build dependency: $command"}}
Write-Host '[1/7] Verify official offline Natural Earth 10m datasets'
python tools/prepare_offline_datasets.py --verify-only
if($LASTEXITCODE -ne 0){throw 'Data verification failed'}
Write-Host '[2/7] Go backend, safety, snapshots, export sessions, tile assembly'
go test -tags fullgeo ./...
if($LASTEXITCODE -ne 0){throw 'Backend tests failed'}
Write-Host '[3/7] Geographic, Scene, styles, creative tools, and M5 contracts'
foreach($js in @('test_world_real.mjs','test_optimized_search.mjs','test_13_creative_geometry.mjs','test_14_style_system.mjs','test_147_material_catalog.mjs','test_20_production_contracts.mjs','test_203_map_labels.mjs','test_204_texture_toggle.mjs')){
 node (Join-Path 'tests' $js);if($LASTEXITCODE -ne 0){throw "$js failed"}
}
Write-Host '[4/7] Browser pixels, full-production UI and tiled rendering parity'
foreach($test in @('test_14_style_pixels.py','test_147_material_pixels.py','test_20_tiles_browser.py','test_202_ui_polish_r2.py','test_202_ui_cleanup_r3.py','test_203_map_labels_ui.py','test_203_export_labels.py','test_204_texture_ui.py','test_145_native_reload.py')){
 if($test -eq 'test_145_native_reload.py'){continue}
 python (Join-Path 'tests' $test);if($LASTEXITCODE -ne 0){throw "$test failed"}
}
New-Item -ItemType Directory -Force 'dist','installer_payload' | Out-Null
Write-Host '[5/7] Console executable for native Windows HTTP and F5 tests'
go build -trimpath -tags fullgeo -o 'dist/CartoRig-2.0.4.1-Console-Windows-x64.exe' .
if($LASTEXITCODE -ne 0){throw 'Console build failed'}
python tests/test_20_http_e2e.py --executable dist/CartoRig-2.0.4.1-Console-Windows-x64.exe
if($LASTEXITCODE -ne 0){throw 'Real Go HTTP M5 service test failed'}
python tests/test_145_native_reload.py --executable dist/CartoRig-2.0.4.1-Console-Windows-x64.exe
if($LASTEXITCODE -ne 0){throw 'Native HTTP browser/F5 test failed'}
Write-Host '[6/7] Fully offline portable EXE and embedded-installer EXE'
go build -trimpath -tags fullgeo -ldflags '-s -w -H windowsgui' -o 'dist/CartoRig-2.0.4.1-Portable-Windows-x64.exe' .
if($LASTEXITCODE -ne 0){throw 'Portable build failed'}
Copy-Item 'dist/CartoRig-2.0.4.1-Portable-Windows-x64.exe' 'installer_payload/CartoRig.exe' -Force
go build -trimpath -tags installer -ldflags '-s -w -H windowsgui' -o 'dist/CartoRig-2.0.4.1-Setup-Windows-x64.exe' .
if($LASTEXITCODE -ne 0){throw 'Installer build failed'}
Write-Host '[7/7] Native installer installation/hash test'
python tests/test_20_windows_installer.py
if($LASTEXITCODE -ne 0){throw 'Installer acceptance failed'}
Write-Host 'CartoRig 2.0.4.1 Windows acceptance passed'
