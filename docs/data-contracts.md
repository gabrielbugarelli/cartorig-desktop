# CartoRig 1.1 — Project and export data contracts

## `.cartorig` project

JSON object with `format: "cartorig-project"`, `schema_version: "2.0.0"`, UUID `project_id`, `revision`, `name`, `canvas`, `camera`, `theme`, `scene.root_ids`, `objects`, `asset_refs`. The preliminary JSON Schema is in `docs/CartoRig_2.0_Project_Schema.json`. `SceneStore.validateDocument()` enforces referential integrity of parent/child lists, a single WorldMap object, object opacities, and coordinates.

Object types currently editable: WorldMap, Grid, Borders, Region (Country only), Route (two endpoints), Label, Marker (basic), Group. The object ID is an immutable UUID. Group `children` and root lists are ordered bottom-to-top. A duplicate gets new IDs. Region source uses ISO-like `feature_id` in the 1:110m dataset.

## Original Map Composer project migration

Opening a `version: 1` JSON converts `state.highlights`, `routes`, `labels`, group flags, camera, style and resolution to the new model without modifying the original file. This is a one-way import; saving always writes `.cartorig`.

## Layer ZIP

`CartoRig/project.cartorig`, `CartoRig/manifest.json`, `CartoRig/layers/NNN_Type_Name.png` for each visible visual object, and `CartoRig/Final_Composite.png`. All PNGs use identical pixels and camera. Export does not save or mutate the project, and Solo preview is not exported. The base map is included as a separate layer when visible, even if the final background is set to transparent.

PNG layers are raster at native output resolution. Text/vector layers remain raster (SVG is M5). The package is editor-agnostic; no `.setting` or editor automation included.

### Endpoint and anchor representation

Route endpoints use `from: {"lat": -15.79, "lon": -47.88}` and `to: {"lat": -34.6, "lon": -58.38}` with `path_type: "Straight"`. Labels use `position_mode: "geo"`, `anchor: {"lat": ..., "lon": ...}`, and `typography.font_size`. Markers use an `anchor`, `symbol: "Circle"`, and `style.symbol_size`. These keys comply structurally with the approved preliminary project schema and replace the older Map Composer coordinate arrays on import.
