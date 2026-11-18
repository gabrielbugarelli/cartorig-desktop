# CartoRig — UI/UX Stage 1 (feature/ui-ux-evolution)

Status: implementation completed on the UI branch; manual WebView2 acceptance pending. No merge into `main` is intended before review.

## Scope delivered

- **Project Manager:** three keyboard-accessible, ARIA-linked task tabs: Projects, Recoveries, Templates. Opening the manager defaults to Projects. The recovery badge is refreshed from the actual snapshots. Saved projects, custom templates and recoveries have informative empty states. The recovery selection and deletion actions remain in their original component and use the existing secure API.
- **Scene:** a clear `+ Add place` entry opens Geography and focuses the search. Group, duplicate and delete controls have meaningful labels. Visibility and lock buttons use consistent inlined SVG icons with existing tooltips and aria-labels. Search with no matching layers has a clear-reset action.
- **Geography:** initial state suggests browsing countries, states, and cities. No-results state offers filter clearing. Search result controls are labeled `View`, `Add`, `Marker`, and `Text`. Newly created objects open Scene + Inspector so their properties can be edited without switching tabs manually.
- **Inspector:** a meaningful no-selection state directs users to choose a map object or browse Geography.
- **File menu:** destructive `Reset map…` moved from the main bar into File while retaining the existing confirmation, undo history, and shortcut-independent handler.

## Boundaries and compatibility

No changes to renderer, the Wails native save path, data schema, exports, autosave storage or API. Project files remain compatible with CartoRig 2.1.0. This stage does not change the full advanced styling controls, add translations, or implement customizable pane sizes (later stages).

## Automated checks

- `node tests/test_ui_stage1.mjs`: UI IDs, accessible relationships, feature wiring and free-only workflow guard.
- `node tests/test_ui_stage1_behavior.mjs`: active tab, panel visibility, keyboard navigation and ARIA state.
- `node tests/test_workspace_reset.mjs`: reset still undoable after moving the action into File.
- `node tests/test_recovery_bulk_ui.mjs`: existing recovery operations retained.
- `node --check assets/app.js`, `node --check assets/production-studio.js`: syntax validation.
- Existing preview, texture, boundary and export regression tests remain part of the Windows build.

## Manual Windows acceptance

1. Open Project Manager and switch between Projects, Recoveries and Templates; verify focus and arrow/Home/End navigation.
2. Save a map, reopen it from Recent projects, and verify template creation stays on the Templates tab.
3. Confirm Recoveries empty state or select/delete individual, multiple and all snapshots; verify Saved projects remain intact.
4. Open Scene with only base layers, choose Add place, browse countries, add Brazil, and confirm Scene and Inspector display the new region.
5. Search for a nonexistent place, clear filters, and verify search restores its initial guidance. Search for a nonexistent scene layer and clear it.
6. Toggle visibility/lock icons, group/duplicate/delete layers, confirm all actions still work.
7. Use File > Reset map, confirm the existing warning and Undo restores the prior composition.
8. Verify WebView2 map performance, systray restoration and export formats as before.

## Free GitHub Actions policy

The Stage 1 workflow is manually triggered only (`workflow_dispatch`), uses the public repository with standard `windows-2022` runner, skips if private, cancels overlapping runs, and keeps logs and ZIP artifacts for three days. Run manually from Actions > CartoRig Wails 3 Portable > Run workflow > `feature/ui-ux-evolution`. No push-triggered compilation is enabled on this branch.

## Feedback refinements (18 Nov 2026)

- Removed the two initial onboarding cards, *Find a place to add to your map* in Geography and *Build your first map layer* in Scene. Geography still has normal search/filter controls and provides actionable feedback only for an actual failed search; Scene still provides an action when a typed layer query matches no entries.
- Combined **Show textures** and **State boundaries** under a compact, always-expanded **MAP DISPLAY** group inside Looks > Personalize. The underlying `SetTextureVisibility` project option and `show_state_boundaries` theme override remain independent and unchanged. Disabled Rivers/Lakes/Coastlines inputs remain available internally for compatibility but are not displayed to users as unsupported toggles.
- Added `tests/test_ui_map_display.mjs` to the manual-only Windows build and refreshed browser UI assertions. No rendering engine, project schema, native save, or export changes.

## Callout geographic positioning and moving print textures (18 Nov 2026)

- **Callout:** Two clicks now establish two actual vertices in the selected coordinate space. For geographic shapes the first point is the geographical leader anchor, the second the text-box origin. Both transform together with pan, zoom, and camera rotation. No new implicit screen-pinned `callout_box` is saved. Projects created before this change retain their existing `callout_box` (explicit screen pin) for backward compatibility. Inspector offers **Text box follows → Map (recommended)** or **Screen (fixed position)** and a one-click conversion that preserves the currently visible position. Vertex editing and hit-testing now handle either mode.
- **Materials:** The repeating surface/land/ocean/print-finish patterns are now tied to geographic position through an affine CanvasPattern transform, not the viewport origin. A material repeats every 90° of longitude, producing four seamless repeats around the 360° world and consistent pan/zoom/bearing across preview and export tiles. Existing terrain-color and relief rasters were already geographically projected and are unchanged. CanvasPattern instances are reused per context/image to avoid recreating large surfaces.
- **Tests:** `tests/test_callout_geo_anchor.mjs` covers both modes, saved projects, camera motion and Undo/Redo. `tests/test_material_geo_anchor.mjs` covers pan, zoom, rotation, 180° wrap, compositing and export tile coordinates. Added to the free Windows portable build.
- **Manual acceptance:** add a Callout with two clicks, pan/zoom/rotate the map and check both ends follow the same geography. Select an older pinned Callout and switch its Text box follows mode to Map. Enable textures under MAP DISPLAY on a paper/noise look and pan the map: the pattern should move with the geography; repeat with land and ocean material, zoom, camera rotation, and PNG/ZIP export.

## Review corrections: Callout contrast and land-only paper textures (18 Nov 2026)

- Confirmed against the actual uploaded `Documentary_Terrain.cartorig` project (Atlas look; a geographic Callout with no explicit `text_color`).
- **Callout:** The scene renderer inherited the map-label color from `palette.text` (dark brown in Atlas), while the Inspector showed a white fallback swatch. Callouts now use a white effective default specifically for the dark callout box, and the Inspector uses `resolveStyle(doc,obj).text_color` to show the actual rendered value. Explicit custom text colors, type defaults, groups, Undo/Redo and old projects remain supported.
- **Materials:** `surface_material` (paper/stock) and `cartographic_finish` (print/ink) are now clipped to the actual land geometry. `land_material` stays land-only and `ocean_material` stays ocean-only. Underlying raster ocean modes, land masks, the geographic CanvasPattern cache, labels and country overlays are unchanged.
- Regressions: `tests/test_callout_text_contrast.mjs` checks Atlas text defaults, changes to Brasil, explicit red override, and Inspector synchronization; `tests/test_ocean_material_isolation.mjs` checks mask routing. The real pixel-based scene-looks test `tests/test_147_material_pixels.py` is updated to require paper and finish to leave ocean pixels unaffected.
- Manual acceptance: Reopen Documentary Terrain, select the Callout without an explicit text color, verify its text is white on navy; edit the caption, verify readability, and then intentionally override the color. With textures enabled, confirm ocean grain is distinct from terrestrial paper, including pan, zoom, rotation and PNG/ZIP output.

## Atlas ocean correction — follow-up after visual review (18 Nov 2026)

The previous fix only masked `surface_material` and `cartographic_finish` to land. The reported sea grain remained because the Atlas recipe itself retained `ocean_material: marine_noise` at 0.22 intensity. This was verified against the user's `Documentary_Terrain.cartorig` file (theme Atlas, textures enabled, no material override).

The Atlas default now uses `ocean_material: none` with strength 0; paper/fibrous/ink surfaces still appear on land with geographic camera transforms, while the Atlas sea is left as its flat map color. A user can still explicitly opt into marine patterns via ocean-material customization. Nautical presets remain unchanged.

Added `tests/test_atlas_clean_ocean.mjs` for Atlas defaults, project persistence, opt-in ocean waves and nautical presets, and strengthened `tests/test_147_material_pixels.py` to assert Atlas land pixels change but ocean pixels do not when textures are enabled. This is a minimal targeted default fix, not a rewrite of the texture system. The existing static Look thumbnail may predate this refined material default and is not the source of final rendering.

## Global classification of terrestrial and ocean textures (18 November 2026)

The previous attempt to fix sea grain by changing only the Atlas recipe to `ocean_material: none` was too narrow. **The correct model is two independent geographic material classes**, not removing water textures:

- **Terrestrial textures:** paper, parchment, canvas, fibers, engraving, print/grain, and other nonmarine materials may only be used by `surface_material`, `land_material`, and `cartographic_finish`, clipped to the coast-defined land mask.
- **Ocean textures:** `marine_noise`, `marine_waves`, and `deep_sea` may only be used by `ocean_material`, clipped to the complementary ocean mask.
- Both catalogs permit `none`. The project-level **Show textures** toggle controls both, while each Look keeps independent choices and intensities for land/ocean. The Atlas recipe uses fibrous parchment on land and subtle `marine_waves` (0.12 intensity) over the sea rather than paper over sea or an indiscriminate untextured ocean.
- All 36 built-in Look recipes are validated against these categories. The Inspector/Look editor offers distinct Land and Ocean dropdown lists and visually separates the controls.
- To preserve saved `.cartorig` compatibility, a legacy wrong-category override is retained in the document and visible in the picker as disabled/unsupported, but is **never painted** into the wrong region. The user can select a valid replacement or `none`.
- The renderer still uses cached geographic CanvasPatterns and cached coastline masks across preview and exports. Terrain/bathymetry raster imagery (`texture_source` / `ocean_mode`) is a separate georeferenced source, not classified as a decorative material tile.

Regression tests: `tests/test_material_category_logic.mjs`, `tests/test_ocean_material_isolation.mjs`, `tests/test_material_geo_anchor.mjs`, and `tests/test_147_material_pixels.py`. The old `test_atlas_clean_ocean.mjs` was removed because it encoded the incorrect assumption that all water textures must be disabled.

**This section supersedes the earlier “Atlas ocean correction” note above.** Manual acceptance: compare Atlas with textures on/off; land grain and marine waves must be distinct, must each follow pan/zoom/bearing, and remain separated in PNG/ZIP export. Test another Look using `marine_noise` or `deep_sea`, and test an old `.cartorig` that assigned a terrestrial image to ocean material.
