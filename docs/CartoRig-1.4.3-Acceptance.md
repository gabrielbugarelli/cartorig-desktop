# CartoRig 1.4.3 — focused acceptance report

| Requirement | Expected result | Status |
|---|---|---|
| Distinct looks | Shaded Relief and Terrain Cinematic do not reuse identical image treatment | PASS |
| Real pixels | Raster difference significant on actual renderer | PASS (MAE 111.8, 94.4% pixels significantly changed) |
| Shaded Relief compatibility | Original texture and no added atmosphere by default | PASS |
| Terrain Cinematic treatment | ETOPO land, deep ocean, high-contrast low-saturation grading, tint and vignette | PASS |
| Region overrides | Explicit region fill survives scene look changes | PASS |
| Theme Revert | Restores values of selected theme rather than generic defaults | PASS |
| Transparent output | Atmospheric effects preserve original alpha | PASS |
| Creative tools 1.3 regressions | Route geometry and styles pass | PASS |
| World geography offline | 4596 Admin 1, 7342 world cities included unmodified | PASS |
| Windows binaries | Cross-build of installer and portable, executable payload exact match | PASS |
| Windows native installation | Setup launched on Windows 10/11 and installer/uninstaller validated | PENDING |

Test PNG previews were rendered at 800×450 using downsampled JPEG pixels derived from the actual distributed rasters to constrain Chromium CI memory; they are **not** substitutes for installing the Windows binary.
