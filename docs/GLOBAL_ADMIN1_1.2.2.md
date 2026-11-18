# Global Admin 1 — Implementation and coverage

## Product behavior

A country and any administrative subdivision available in the installed source have the same editor actions: searchable hierarchy, Add Region, independent styles, Fit, project save/reopen and PNG layered export. The editor never creates substitute geometry for missing data.

## Source

Dataset: [Natural Earth 10m Admin 1 — states and provinces](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/). Distribution: [datasets/geo-ne-admin1](https://github.com/datasets/geo-ne-admin1), a GeoJSON republication. Official Natural Earth polygons are public domain; the redistribution includes some metadata columns with unclear third-party licenses, so review upstream notices if you redistribute the raw dataset.

## Delivered installers

These binaries contain Brazil's 27 state geometries and the global Admin1 engine, but not the ~44 MB world GeoJSON itself. On first launch the application tries to retrieve the world data automatically from the source above. It validates the response (FeatureCollection, count, geometry type, country breadth, Ontario and California), persists it atomically in the user profile, and exposes all loaded provinces to the same catalog. Future launches read only the local cache and work offline. Failure to reach the source is reported in the interface and can be retried.

**Therefore this release does not meet the stricter requirement of fully offline global Admin1 on a fresh installation.** Only builds created using the vendoring step below do.

## Creating a truly offline installer

Run with a network connection from the project root:

```powershell
go run tools/vendor-admin1.go
.\scripts\build-windows.ps1
```

The build script calls the vendoring tool itself if the file is missing, and fails instead of silently shipping a Brazil-only installer. The downloaded file is validated and added to `assets/geodata/admin1_world.geojson`; Go's embed automatically includes it in the executable and installer. Windows users then never need Internet to view provinces.

## Data integrity and limits

- Geography is WGS84, displayed in a 2D equirectangular projection.
- Natural Earth 10m is editorial cartography, not a legal/cadastral map; territorial disputes follow the source.
- Natural Earth does not supply Admin1 polygons for some small nations and disputed units. They must be reported as unavailable; not invented.
- All saved State objects persist a geometry snapshot, so reopening a project does not depend on fetching a dataset again.
- The Go parser and Chromium were tested with synthetic fixture datasets containing >3,000 polygons, **not with a full real-world downloaded dataset** in this environment.
- Installer cross-compilation was tested; running the installers on Windows remains to be verified.
