# CartoRig 2.0.4 — Independent texture visibility

## UX

- Location: Looks → Personalize → Global Composition → **Show textures**.
- One checkbox, no explanatory card or redundant actions.
- Enabled by default, matching the 2.0.3 look preview. Disable to render a flat vector-style map while keeping the exact look palette and geography.
- Works for all 36 built-in looks and user styles; switching looks leaves the texture visibility flag unchanged.

## Data model / compatibility

- New document property: `render_options: {textures_enabled: true}`.
- Missing `render_options` in old `.cartorig` files means textures enabled.
- `SetTextureVisibility` is a validated CommandBus action with Undo and Redo.
- Rendering/appearance option is intentionally independent of `theme` and not stored in `.cartorigstyle` presets.
- No migration or schema bump (`schema_version: 2.0.0`).

## Render coverage

When the flag is disabled: map base textures (`bmng`, `etopo1`, `shadedrelief` and palette texture defaults), tonal raster shading, relief profile rasters, and all `look-materials` PNG overlays (support/land/ocean/print) are omitted. Flat land/ocean fills, borders, geographic grid, geodata, labels, object effects, atmosphere and per-object style remain unchanged. Texture names and strengths remain stored so that re-enabling reproduces the original appearance.

The canvas, flattened PNG export, production PNG, tiled renders and layered ZIP share `renderScene` / `drawWorld`, therefore they honor the same option. SVG is intentionally vector-only and never had decorative raster textures. The thumbnail gallery remains an unmodified depiction of each look's default appearance.

## Verification

- Node model test: validation, legacy files, all look switches, persistence, Undo/Redo, palette and material preservation.
- Chromium Canvas2D test with the bundled historical paper/marine/ink PNGs: screenshots of textured and flat map, exact restoration after re-enabling, checkbox state after Undo/Redo, 640×360 production PNG output hashes differ across states.
- Existing 2.0.2 R3, 2.0.3 map-label, export, material and tile tests retained.
- Go tests protect the embedded textures, offline geography and regenerated 36 native look previews.
- Windows binaries cross-compiled; native Windows execution not yet certified.
