# CartoRig 1.2.1 — Verification record

## Tested in this delivery environment

- 27 Brazilian `Polygon` or `MultiPolygon` features were validated as geometry and cross-checked for unique state abbreviations.
- Repaired two minor self-intersections introduced by source geometry simplification (Goiás and São Paulo), then validated all 27 features with Shapely topology checks.
- Node.js geographic-engine tests passed: typed search, diacritics, state override precedence, country search, camera mapping and antimeridian handling.
- Playwright Chromium interface test passed: create Mato Grosso and Distrito Federal as separate Region layers; edit selection; enable 27 boundaries; export valid Full HD PNG; save and reopen .cartorig with embedded state geometries.
- Existing Playwright regression tests passed: country layers, distinct colors, grouping, undo/redo, project migration, PNG and ZIP export request structure.
- `go test ./...` passed, including a new `embed.FS` test verifying that the state GeoJSON resource is available over localhost.
- Windows x64 portable and setup files were cross-compiled as PE32+ executables with Go 1.23.2.

## Not tested

- The installation flow and Open File UI in Windows itself were not run on physical Windows hardware.
- GeoJSON LOD performance and boundary accuracy at high close-up zoom were not exhaustively tested.
- The full Natural Earth 10m/50m multi-country Admin 1 catalog is not bundled in this patch.

## Dataset

Source: [br-geojson](https://github.com/henriquemalvar/br-geojson) (CC0, derived from IBGE per its README). The 27 geometric features have been generalized for editorial map composition, not juridical use. The runtime source is `assets/geodata/br_states.geojson`; the original encoded geometry representation is retained under `tools/` for traceability.
