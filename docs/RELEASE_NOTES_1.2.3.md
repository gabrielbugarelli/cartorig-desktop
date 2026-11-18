# CartoRig 1.2.3 — Release Notes: Full Real-Data Offline Edition

- Added complete source-pinned Natural Earth 10m worldwide Admin 1 (4,596 polygons) and Populated Places (7,342 points), actually embedded in both portable Windows executable and Windows installer. The full files are included in the downloadable source ZIP.
- Fixed a critical catalog deduplication defect that previously discarded Admin 1 shapes sharing a country/name and similarly named towns. All distinct official feature IDs now remain independently searchable.
- Corrected product identification to `1.2.3 GEO` and updated country/type filters, translated/local display where available, search without diacritics, and distinguishing same-name locations.
- Added per-dataset source URL, scale, official Git revision, SHA-256 checksum and integrity status in diagnostics. Bundled datasets require no download; cached datasets are validated and may be repaired.
- Fixed fit behavior across the antimeridian and preserved exact original GeoJSON boundaries on independent Region objects. Included viewport, styling, alpha export and save/reopen tests using four full real 10m administrative geometries (Ontario, California, Bavaria, Mato Grosso) and Munich point.
- Added strict build verification: the `fullgeo` tagged build requires both complete official datasets and their integrity manifest; Windows release workflow blocks publication if real browser E2E or native installer smoke test fails.

**QA boundary:** Complete geodata integration and cross-compilation are verified in this delivery. Native Windows installation and execution were not conducted on the host that produced these files; see the accompanying acceptance report for precise tests performed and remaining Windows-specific verification.

## 1.2.3 optimization update — worldwide search and spatial culling

- No results are rendered when the text field is empty and no type/country/continent filter is selected. An explicit filter enables browsing.
- Search uses a precomputed bilingual/alias substring index, with a cached normalized representation and bounded page cache. Exact, prefix, alias and substring ranking remains deterministic.
- Search field uses a 180 ms debounce and clears stale results immediately; result pages contain at most 20 entries.
- A 10°×10° geographic grid is used for visible Admin 1 subdivision selection on the Canvas when border display is active. All 4,596 source polygons remain intact.
- Source-ID lookup, counts and dataset type availability use precomputed indexes instead of repeated scans during updates.
- Added real-data performance, pagination, alias, country-filter, spatial equivalence and browser UI tests.
- Full offline geodata SHA-256 locks remain unchanged.
- Windows native install/launch remains unverified in this Linux cross-compilation environment.
