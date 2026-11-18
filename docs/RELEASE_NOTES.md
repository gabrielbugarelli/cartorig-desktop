# CartoRig 1.2.2 — Global Admin 1 engine

- Universal Natural Earth 10m Admin1 acquisition and persistent cache, not country-by-country additions.
- Search typed names with diacritics, aliases, country, and optional continent filter.
- Independent polygons, Fit and export of provinces in multiple countries.
- Country-specific Brazilian state pack preserved as first-run fallback.
- Full offline-from-install build support: `go run tools/vendor-admin1.go` before compiling.
- Global dataset is **not embedded in the precompiled 1.2.2 binaries** in this delivery: a one-time download is required. No claims of fully bundled global offline coverage for these binaries.
- No timeline or animation engine added.
