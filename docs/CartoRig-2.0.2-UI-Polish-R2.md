# CartoRig 2.0.2 — UI polish R2

## User-requested navigation cleanup

- Removed the redundant **RESULTS** heading and initial geographic search instruction card. No matches is shown only after an actual unsuccessful search; counts remain screen-reader accessible.
- Removed **Import GeoJSON** from Geography; the complete type selection and file chooser are now in **File → Import GeoJSON…**, preserving all geometry types, data validation and upload behavior.
- Removed **MY STYLES** from the Looks gallery and its unnecessary in-panel file management. The existing library, apply, import, save, export, duplicate, rename, and delete operations are now in **File → Map styles…**.
- Removed **About these looks** and the redundant descriptive introduction from the Looks panel. All 36 built-in looks and their category filters remain.
- Added accessible native modal dialogs (Escape, keyboard focus, close button, click outside) for File operations.

No cartographic, export, geo-data or document schema change was made; only UI actions and their locations changed.

## Tests

Run `python tests/test_202_ui_polish_r2.py` for targeted live-browser regression. The Windows executables are cross-compiled and require native Windows acceptance before full qualification.
