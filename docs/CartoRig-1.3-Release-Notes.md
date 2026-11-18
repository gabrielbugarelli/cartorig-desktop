# CartoRig 1.3 — Creative Tools

**Release candidate for Windows x64** · Go + HTML/CSS/JavaScript + Canvas 2D · English interface · MIT application code.

This version builds on the approved CartoRig 1.2.3 Optimized with its complete embedded **4,596 Natural Earth Admin 1** polygon features and **7,342 Populated Places** points. The original datasets remain in the package, without first-run network requirements. The new authoring model remains static: no motion, keyframes, timeline, audio or video editing.

## Implemented creative features

- **Route Designer:** straight, quadratic Bézier, WGS84 geodesic, custom multiple-waypoint paths; position and geometry kept in geographic coordinates; from/to city search, explicit Region representative point, Marker ID links; drag handles (endpoints and waypoints), add/remove/reverse, curvature, stroke patterns and arrowheads; undoable mutations and Freeze Links before dependent Marker deletion.
- **Marker Studio:** 10 built-in vector symbols (Circle, Square, Diamond, Pin, Flag, Airport, Port, Naval, Capital, Strategic), palette previews, symbol size, color, stroke, rotation, independent anchor and screen offsets, visual-offset editing; offline import of PNG and restricted sanitized SVG rasterized to an embedded PNG, SHA-256, asset reuse/favorites, and safe removal retaining an embedded copy if referenced.
- **Typography Studio:** inline textarea with Ctrl+Enter commit / Esc cancel; double-click edit, multiline Unicode, font family, weight, size, alignment, line height, letter spacing where supported, halo, optional background, rotation; five typography presets; Geo Anchored / Screen Pinned conversion and linked Marker support, with CSS font fallback.
- **Drawing & Annotation:** editorial Line, Arrow, Rectangle, Ellipse, Polygon, Freehand, Callout and WGS84 Distance; geo/screen coordinate modes; vertex handles, editable coordinates, in-progress preview not added to the scene until commit, Esc cancellation, marker snapping, freehand polyline simplification and zero-area/self-intersection rejection for new polygons. Callout can attach a geographic source point to a screen-pinned box.
- **Shared editor:** scene tree integration, selection and inspector, lock/visibility/groups, one-command undo/redo for drags, JSON save/reopen, compositing and PNG/layer exports using the same drawing code. Custom object and imported asset data are embedded in `.cartorig`.

## Verification completed

- `go test -tags fullgeo ./...` — PASS, complete datasets verified against the locked manifest.
- `node tests/test_geo_engine.mjs` — PASS, original geography engine and migration baseline.
- `node tests/test_world_real.mjs` — PASS, official 4596/7342 dataset feature validation, names, hierarchy and geometries.
- `node tests/test_optimized_search.mjs` — PASS, text and spatial search indices.
- `node tests/test_13_creative_geometry.mjs` — PASS, including **94 independently generated GeographicLib WGS84 reference vectors** (near-antipodal pairs included), Custom, Curved ±1, marker-linked route and rollback.
- `python tests/test_13_creative_e2e.py` — PASS, Chromium interactive toolbars, four paths, editing route handles, marker link + freeze, two label modes, Cyrillic/Unicode multiline, SVG sanitization, Polygon, Callout, Distance, PNG with alpha, 8K isolated creative object, project persistence.
- `python tests/test_world_real_embedded_browser.py` — previously passed with **real** worldwide Admin 1/city files in Chromium, four regions and PNG/layer alignment. A final repeat of this long-running stress test exceeded the execution timeout after the multilingual search stage; it should be rerun before Windows production acceptance. This browser test provides the real files as browser fixtures because localhost navigation is administratively blocked in this Linux environment.
- `python tests/test_br_states_e2e.py`, `python tests/test_world_admin1_e2e.py`, `python tests/test_m1_regressions.py`, `python tests/browser_smoke.py`, `python tests/test_123_alias_city_e2e.py` — PASS, earlier editor and geodata regressions.

## Limits / not represented as complete

1. Windows x64 binaries are **cross-compiled** under Linux and inspected as valid PE files. The installer and editor have **not been run on real Windows** in this environment. Windows installation, upgrade, uninstall and a true browser+Go localhost E2E remain to be done on Windows.
2. The M3 UI includes marker-snapping and numeric vertex editing. Comprehensive snapping to arbitrary geometric edges and a complete mode for selecting multiple coincident handles are not yet fully tested.
3. Static shadow/glow effects, editable style libraries, HDR, SVG export, 8K full-scene tile streaming, autosave/backups and other M4/M5 Production requirements are **not included** in the M3 acceptance claim.
4. The WGS84 solver uses Vincenty inverse/direct and a multi-start numerical shooting repair near antipodal cases; its test accuracy is grounded in the reference fixtures, but it does not include the official full GeographicLib/GeographicLib-JS Karney source.
5. Imported SVGs are safely rasterized to PNG for render and project persistence. Exact editable SVG vector path preservation and comprehensive OS-font packaging/licensing are not claimed.
6. The original project's `schema_version=2.0.0` remains unchanged for backward-compatible `.cartorig` reading. The application and installer version is `1.3.0`.

## Supported workflow

Launch the Go application. In Geography, search and add an official state/country or create a Marker/Label from a city. Choose a tool in the central toolbar (Route, Marker, Label or Draw) and draw in the viewer. Select the object and edit its Inspector or click `Edit handles on canvas` to reposition endpoints/vertices. `Ctrl+Enter` commits an inline text entry; `Enter` finishes Polygon or Custom Route; `Esc` cancels an incomplete draft. Save to `.cartorig` and export PNG or independent layer PNGs aligned to full output dimensions.

This source includes `.github/workflows/cartorig-1.3.yml` for a Windows-based build/test pipeline; it is provided for use by repository owners and has not been executed here.
