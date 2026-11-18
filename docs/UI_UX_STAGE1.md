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
