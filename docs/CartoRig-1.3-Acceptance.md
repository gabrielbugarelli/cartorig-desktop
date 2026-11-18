# CartoRig 1.3 — M3 Acceptance Matrix

Source of truth: `CartoRig_Especificacao_Implementacao_v2.0(1).md` sections 9–12, 21/M3 and AT-027 through AT-042.

| Test | Result | Evidence / exact scope |
|---|---|---|
| AT-027 Straight Route | PASS | Scene model and render in browser, independent endpoints |
| AT-028 Curved ±1 | PASS | Quadratic geographic Bézier, reference endpoints and sign reversal |
| AT-029 Near antipodal WGS84 | PASS on tested cases | 94 GeographicLib reference pairs, including antipodes, < 1 m distance error; solver has documented edge limitations |
| AT-030 Custom Route 4 waypoints | PASS | Creation, JSON ordering, handles/Inspector, undoable editing |
| AT-031 Linked Marker→Route | PASS | Marker anchor change updates route point; ID link and freeze on deletion |
| AT-032 Duplicate linked marker | PASS on browser test | DuplicateObject creates a fresh UUID and does not retarget existing Route links; checked in `test_13_creative_e2e.py` |
| AT-033 Geo Anchored Label | PASS | WGS84 anchor and shared camera projection |
| AT-034 Screen Pinned Label | PASS | Fixed normalized screen position across camera changes |
| AT-035 Unicode + multiline + halo | PASS | Browser tests with Latin accents and Cyrillic, Canvas strokeText/fillText |
| AT-036 Missing font diagnostic | PASS on browser test | Non-installed test font shows `Font unavailable` in Label Inspector; Canvas uses sans-serif fallback |
| AT-037 Malicious SVG | PASS | Active SVG elements, attributes and external references rejected; safe icon rasterized |
| AT-038 Editable editorial Polygon | PASS | UI drawing and finite vertex model, palette, lock/rollback, handles |
| AT-039 Callout geo→screen | PASS on model/render | Geographic leader and normalized screen box, save/reopen; linked marker support |
| AT-040 WGS84 Distance | PASS | Vincenty + numerical shooting solver independent of zoom and resolution |
| AT-041 Esc cancellation | PASS | Browser test verifies incomplete Route not persisted; Freehand cancellation in model |
| AT-042 Isolated Shape alpha PNG | PASS | Transparent exterior, 1920x1080 canvas, 8K isolated object test |

**Gates:** G0 backend, JS checks and builds PASS. G1 functional browser tests PASS with the partial acceptance items above. G2 Canvas/PNG matching PASS on tested 1080p and 8K cases. G3 geodata and legacy projects PASS. G4 1.2.3 optimized index preserved. G5 offline data included and Windows PE compiled; **native Windows execution and installer validation are PENDING**.

**Status:** 1.3 release candidate for the tested M3 workflows; **not fully homologated** under M3 because native Windows execution and the full snapping/edge-interaction matrix remain pending. One repeat of the full-real-world Chromium stress regression exceeded the tool execution timeout; other real dataset integrity and earlier browser validations passed.
