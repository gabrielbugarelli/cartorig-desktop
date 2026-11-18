# CartoRig 1.4 — M4 acceptance and traceability

Primary specification: `docs/ESPECIFICACAO_IMPLEMENTACAO_v2.0.md`, §§7–8, 21 M4, 22.4, 24.

Status `PASS` below means a **local, reproducible automated test** with stated scope. `PENDING` denotes an unexecuted acceptance condition; it is not silently counted as pass.

| Requirement | Acceptance test / exact assertion | Local status | Evidence |
|---|---|---|---|
| RF-STYLE-001 | Seven original preset IDs retained, Theme updates and Undo | PASS | `test_14_style_system.mjs`, `test_14_style_e2e.py` |
| RF-STYLE-002 | Historical Atlas and Terrain Cinematic themes | PASS | `test_14_style_system.mjs`, browser style controls |
| RF-STYLE-003 | Global HEX/color/number styles and reset controls | PASS tested controls | `test_14_style_e2e.py`, Style Studio DOM |
| RF-STYLE-004 / AT-043 | Red override persists under Atlas, explicit opacity 0 distinct from inherit | PASS | `test_14_style_system.mjs`, `test_14_style_e2e.py` |
| RF-STYLE-005 / AT-044 | Reset only Fill; stroke/glow remain; Undo/Redo reversible | PASS | `test_14_style_system.mjs`, `test_14_style_e2e.py` |
| RF-STYLE-006 | Save/import/export `.cartorigstyle`, unique IDs, local library, malformed preset rejected | PASS | `style_library_test.go`, browser E2E, JS tests |
| RF-STYLE-007 / AT-045 | Bundled raster texture grading changes terrain without rewriting Region fill | PASS functional grading; independent DEM hillshade NOT CLAIMED | StyleResolver/renderer and AT-043 override tests |
| RF-STYLE-008 / AT-052 | Normal vs Multiply pixels; Group alpha applied once to overlapping children | PASS | `test_14_style_pixels.py`, known 50%-alpha expected output |
| RF-STYLE-009 | Geometry cache reused after style edit, invalidated after camera change | PASS | `test_14_style_pixels.py` |
| RF-REG-001 | Independent Region instances, geography source preserved | PASS | Existing 1.3/1.2 geography tests, `test_14_style_system.mjs` |
| RF-REG-002 | Region Inspector controls and explicit Replace Geography command | PASS test contract and browser interface | `test_14_style_system.mjs`, `test_14_style_e2e.py` |
| RF-REG-003 / AT-046 | Evenodd hole, glow/shadow alpha, no opaque rectangle | PASS | `test_14_style_pixels.py` |
| RF-REG-004 | Overlapping Region hit candidates (Alt+click) | PASS code path added; exhaustive visual edge/antimeridian matrix PENDING | `scene-renderer.js`, `app.js` |
| RF-REG-005 | Selection-scoped multi-style and persistent independent overrides | PASS source + browser test | `app.js`, `test_14_style_system.mjs` |
| RF-REG-006 | Official Region remains distinct from Shape.Polygon editorial geometry | PASS existing authoring model | 1.3 Creative Tools regression |
| RF-REG-007 | Source dataset, scale and administrative metadata remain accessible | PASS in existing data model; legal-border interpretation not a cadastral claim | Region Inspector, official source manifests |
| G0 | `go test -tags fullgeo ./...`, JS unit suite, Windows cross-compiled PE | PASS | Tests and compiled artifacts |
| G1 | Studio, Undo, library, Geo/Creative regression, save/reopen | PASS on local tests | 1.4 browser and 1.3 regression |
| G2 | Rendered alpha/holes/group blends, PNG 1920×1080 | PASS in local Chromium fixture | `test_14_style_pixels.py`, `test_14_style_e2e.py` |
| G3 | 4596/7342 real official data and original 1.3 projects preserved | PASS Go / JS; full-browser world rerun may remain long | `test_world_real.mjs`, `test_world_real_embedded_browser.py` |
| G4 | Cache path style-only change, render invalidation | PASS focused tests; full Windows performance profile PENDING | `test_14_style_pixels.py` |
| G5 | Setup and Portable PE cross-built with embedded data; Windows native install/uninstall | PARTIAL — native PENDING | Go cross-build + Windows CI workflow |

**Explicit non-claims:** true DEM hillshade; Windows native runtime/installer homologation; comprehensive 1:50m LOD or production 2.0 export features. None is silently represented as complete.

**Privacy and security:** local-only `/api/styles` with session/origin checked for POST, bounded file size, schema validation and atomic write; no remote font/texture fetch. Source checksums recorded separately in `SHA256SUMS.txt` and `CartoRig-1.4-Release-Checksums.json`.
