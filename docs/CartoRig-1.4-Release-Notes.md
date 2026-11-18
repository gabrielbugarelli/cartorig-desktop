# CartoRig 1.4 — Cinematic Styles (M4)

**Windows 10/11 x64** · Standalone Go local HTTP + HTML/CSS/JavaScript + Canvas 2D · static cartographic composition, NO timeline/keyframes/motion or online dependency.

This version extends the user-approved CartoRig 1.3 Creative Tools release and implements the CR-SPEC-2.0 M4 scope, especially **RF-STYLE-001..009** and **RF-REG-001..007**. Embedded official worldwide Natural Earth 10m data remain intact: **4,596 first-order administrative polygons** and **7,342 populated places**. Features are not dropped or replaced by synthetic international geography.

## New Style Studio

- **Theme presets:** Seven original stable IDs — `dark`, `atlas`, `tactical`, `relief`, `satellite`, `night`, `elevation` — plus **Historical Atlas** (`historical`) and **Terrain Cinematic** (`terrain`). Theme previews use the installed Canvas renderer; theme switches are Undo/Redo commands.
- **Editable global palette:** Ocean, land, borders, grid and text/accent fields, plus terrain texture grading/atmosphere controls. Numeric, HEX/picker and preset controls write actual render state through the command layer.
- **StyleResolver:** Immutable computed style from `theme → object-type defaults → inherited group defaults → explicit object overrides → effective visibility/opacity`. Missing/null values inherit; explicit black and zero opacity remain valid. Legacy 1.3 styles (including abbreviated hex) migrate without losing overrides. A theme switch does not recolor a previously overridden object.
- **Resets:** Revert one property, reset one object or category, and confirmed global override reset. All object mutations are reversible via project Undo/Redo; bulk editing is scoped to the selection.
- **Reusable library:** Save, apply, duplicate/import, rename, delete and export custom `.cartorigstyle` presets. Presets are stored in the project and also available across projects from a **locally stored, size-limited, atomic** backend file in the user's configuration directory. Import checks schema, palette keys, known bundled texture IDs and field limits, rejects script/remote assets.

## Region Editor and shared effects

- **Region Inspector:** Detailed fill and stroke controls (independent opacity, width and dash), effects, blend, metadata and geographic source identity; Fit, Duplicate, Delete and explicit Preview/Confirm `Replace Geography`. Neither color change nor theme replacement changes source polygon coordinates.
- **Shadow & Glow:** Alpha-derived effects applied to separate object surfaces; support Regions, Routes, Markers, Labels and Shapes. Soft edges, radius/distance/angle/intensity/mix and logical composition units. Canvas evenodd holes and multipart islands are preserved; transparent PNGs remain transparent beyond affected pixels.
- **Blends:** Normal, Multiply, Screen, Overlay using Canvas composite operations. Groups are first drawn to an **isolated surface** and then opacity/blend is applied once (important with overlapping children). Nested groups use the same compositing contract.
- **Terrain grading:** Contrast, saturation, and a **texture shading** strength for already bundled terrain raster textures; political overlays retain their own fill colors. These raster textures are not elevation DEMs. **True computed hillshade from an independent, versioned DEM is not claimed**; when unavailable UI must label the existing appearance as texture grading, not elevation analysis.
- **Atmosphere:** Static scene tint/vignette, controlled by scene theme; transparent output does not acquire an artificial opaque background.
- **Performance:** Projected Canvas `Path2D` geometry cache keyed by feature+camera/viewport with explicit invalidation after geometry/view changes. Style-only edits do not reprocess source polygon vertices; preview effect buffers are ephemeral.

## Preservation / upgrades

- All CartoRig 1.3 authoring tools remain available: Straight/Curved/WGS84 Geodesic/Custom Route, Marker Studio (10 symbols + vetted image import), Typography Studio (Unicode geo/screen anchored), Drawing Shapes, geographic search, Scene Explorer and independent layer PNG export.
- `.cartorig` project format remains `schema_version: 2.0.0` for backward compatibility. The **application version** is `1.4.0`. No automatic reset of existing object style. No mandatory source transformation or online data download.
- The public-domain Natural Earth files are bundled from the version-locked source manifest. The portable EXE embeds the entire catalog; Windows Setup embeds the entire portable EXE.

## Verification and scope limits

Automated tests (source tree under `tests/`): `test_14_style_system.mjs`, `test_14_style_e2e.py`, `test_14_style_pixels.py`, `style_library_test.go` plus original Go / 1.2 geography / 1.3 Creative Tools regressions. Pixel assertions explicitly test overlapping group opacity, alpha holes, blend differences, cache invalidation and transparent 1920×1080 PNG. The Go `-tags fullgeo` guard rejects missing official datasets.

**Not yet homologated:** Running Windows GUI/installer natively on Windows 10/11, Windows installation/update/uninstall and the full live-backend Chromium localhost E2E. Chromium in this Linux environment blocks `http://127.0.0.1` before page navigation (administrative restriction), despite the actual Go API returning the correct datasets. Browser fixture tests use the **actual source geometry**, not fabricated world data. The Windows CI script runs the full real Go/Windows/Chromium E2E and blocks publication on failure. Native release acceptance is therefore pending.

**Outside M4:** M5 production-level SVG export, 8K tiled streaming, autosave/recovery, masks, complete exporter wizard and editor-specific integrations; a new DEM is not downloaded or bundled. Raster hillshade control may need a dedicated licensed DEM in a future separately approved source update.

Run Windows validation and build with `./scripts/build-windows.ps1`. The workflow `.github/workflows/cartorig-1.4.yml` is included; it has not been executed in a connected Windows runner in this environment.
