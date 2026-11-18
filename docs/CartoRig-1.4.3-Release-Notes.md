# CartoRig 1.4.3 — Scene Looks: independent terrain treatments

## User-visible correction

In 1.4.2, **Shaded Relief** and **Terrain Cinematic** used the same `shadedrelief.jpg` raster and similar colors, so they appeared almost identical. This version corrects the rendering, rather than just renaming a preset.

- **Shaded Relief:** retains the existing shaded-relief raster with unmodified saturation/contrast and no cinematic vignette by default.
- **Terrain Cinematic:** uses the already bundled ETOPO raster for land, solid dark navy ocean, texture contrast `1.45`, saturation `0.52`, optional relief-texture shading enabled by default at `0.24`, atmospheric blue tint (`0.18`) and vignette (`0.42`).
- The scene-look cards contain real Canvas previews of the effective style. A clear explanation of the visual difference is now shown below the cards.
- Both styles remain editable via Scene Styles. `Revert` restores the **specific** selected look's values. Existing explicit per-object fills, effects, styles and WGS84 geometry remain unchanged when switching styles.
- All textures are already included offline. This is image-based **texture grading**; CartoRig does not claim to derive physically measured DEM elevation.

## Verification executed on Linux-based test runner

- `go test -tags fullgeo ./...`: PASS.
- `node tests/test_143_scene_looks.mjs`: PASS (texture, contrast, saturation, atmosphere, overrides, revert and independent region style).
- `python tests/test_143_preset_pixels.py`: PASS. With downsampled versions of real shipped rasters, 800×450 preview comparison shows mean absolute RGB difference **111.8/255** and **94.4%** of pixels changing by at least 24 in one RGB channel.
- `node tests/test_14_style_system.mjs`, `node tests/test_142_completion.mjs`: PASS.
- `node tests/test_13_creative_geometry.mjs`, `node tests/test_world_real.mjs`: PASS (4596 Admin 1 polygons; 7342 populated places; WGS84 routes).
- `python tests/test_14_style_pixels.py`, `python tests/test_14_style_e2e.py`, `python tests/test_141_visibility.py`, `python tests/test_142_style_e2e.py`: PASS.
- Cross-compiled Windows x64 portable and installer: both valid PE32+ binaries. Setup contains **byte-identical** portable executable. Portable executable includes **byte-identical** full 44,484,806-byte Admin 1 and 19,359,003-byte world cities GeoJSON files. Source ZIP CRC verified.

**Not homologated:** executing the setup and application natively on a Windows 10/11 computer and measuring long-duration preview performance on representative Windows hardware.
