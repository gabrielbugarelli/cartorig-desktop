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
