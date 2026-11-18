# CartoRig 1.2.1 — Installed geographic coverage

| Region | Installed | Source / scale |
|---|---:|---|
| Countries | 177 polygon features | Natural Earth Admin 0 1:110m |
| Continents | 6 polygonal groupings | Derived from installed countries |
| Brazilian states and Federal District | **27 polygon features** | IBGE-derived, editorially simplified from the CC0 `br-geojson` states dataset |
| Cities | 28 curated point anchors | Supplied coordinates, not universal coverage |
| Other countries' states/provinces | No bundled polygons | GeoJSON import remains supported and persistent |
| Natural Earth 1:50m/1:10m | Not bundled | Compatible GeoJSON may be installed manually |

## Brazilian states — supplied in executable

The application embeds 27 real Polygon/MultiPolygon geometries in `assets/geodata/br_states.geojson` and automatically registers them at startup. **No import or internet connection is required.** Search `São Paulo`, `Mato Grosso`, `Rio de Janeiro`, `Distrito Federal`, etc., set geographic type `State / Province`, and use `+` to create an independent region layer. Use the Fit button to frame the region. To show the borders of **all** 27 states, enable `Brazilian states (27 bundled polygons)` in Styles.

The source is [henriquemalvar/br-geojson](https://github.com/henriquemalvar/br-geojson), generated from IBGE territorial meshes and distributed under Creative Commons CC0 1.0 per repository. GitHub source blob SHA-1: `d06e54a3a03519ae3fa48fe3d85da6c3558cd47d`. Geometry was simplified using Douglas-Peucker with tolerance 0.045 geographic degrees followed by validity repair of two self-intersections to keep the installed app compact; **not appropriate for cadastral, legal or high-zoom border precision**. The output remains actual data-derived polygon geometry, not fabricated bounding boxes.

## Continued limitations

Other countries' Admin 1 polygons, high resolution 10m/50m country basemaps, the full global populated places index, rivers, lakes and coastlines are **not** bundled. The existing offline GeoJSON importer can install them. Windows installation was cross-compiled, not tested on a physical Windows PC.
