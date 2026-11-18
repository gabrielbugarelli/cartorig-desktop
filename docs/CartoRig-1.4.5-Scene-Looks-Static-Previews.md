# CartoRig 1.4.5 — Scene Looks: static and reproducible thumbnails

## Root cause (confirmed in user F5 recording)

Version 1.4.4 only solved the post-initialization clicking symptom. Its nine Scene Looks
were initially constructed as CSS gradients, then replaced by client-side Canvas
images after the browser loaded geographic polygons and textures. The preview
cache lived only in a JS `Map`, and was lost after F5. The code in `app.js`
shared responsibility for the gallery with `style-studio.js`, making repeated
startup rendering unavoidable. Prior test `test_144_scene_look_flicker.py`
waited until nine previews were generated before checking clicks, so it did
not test the user-observed reload sequence.

## Resolution

- Nine real 288×162 PNGs are generated once from the production `renderScene`
  Canvas pipeline, the original 177-country reference map, and bundled raster
  textures via `tools/generate_scene_look_previews.py`.
- `assets/look-previews/{dark,atlas,tactical,relief,satellite,night,elevation,historical,terrain}.png`
  are embedded in both Windows distributions and included in source ZIP.
- `assets/look-previews/manifest.json` locks previews to the hashes of all
  pixel-affecting source files. `TestBundledSceneLookPreviewsCurrent` blocks
  release if a preview or source changes without regeneration.
- Each native gallery card receives one immutable image `src`. These images
  may be loaded or cached normally by the browser; there is no temporary
  gradient and no later image substitution.
- The gallery is owned entirely by `style-studio.js` and constructed once.
  Changing a look updates its selected state and the scene, while rebuilding
  only the property editor (never the Scene Looks gallery).
- `app.js` no longer creates thumbnail canvases, stores data URLs, or schedules
  preview rendering. Fonts or textures becoming ready never rebuild gallery
  images.
- User-created styles continue to have persistent palette swatches;
  these are not confused with the nine built-in rendered previews.

## Validation

1. `go test -tags fullgeo ./...` verifies embedded PNGs, format, dimensions,
   SHA-256, renderer/input freshness, world-data integrity, and API contracts.
2. `python tests/test_145_scene_look_reload.py` checks four fresh browser
   page/JS startups (each equivalent to new F5 initialization for UI code),
   loads all nine **actual** PNG files and exercises 48 theme changes while
   asserting no thumbnail replacements or gallery node recreation.
3. `python tests/test_145_native_reload.py --executable <Windows console EXE>`
   is included in the Windows CI workflow and opens the **real Go HTTP server**,
   reloads it three times using the browser's native F5 equivalent, and clicks
   through styles. This test has **not been executed in the Linux environment**.
4. Full existing 1.3/1.4 regression suites, global datasets, geography and
   transparent PNG export remain release gates.

## Limitations

A universal promise of zero future bugs would not be verifiable. Cross-compilation
is not a native Windows install or a real Windows F5 test. Those tests remain
required for the G5 Windows acceptance gate.
