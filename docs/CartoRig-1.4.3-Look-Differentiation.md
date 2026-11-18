# CartoRig 1.4.3 — visual differentiation of scene looks

The 1.4.2 versions of Shaded Relief and Terrain Cinematic used the same `shadedrelief.jpg` texture with nearly the same palette. This was not a meaningful separate look.

- **Shaded Relief:** continues to use the natural shaded relief raster without additional grading or atmosphere by default. Intended as a restrained topographic base.
- **Terrain Cinematic:** uses the bundled ETOPO raster for land, a solid deep navy ocean, contrast 1.45, saturation 0.52, separate shaded-relief color-raster texture shading at 0.24, a dark-blue tint mix of 0.18 and vignette 0.42. The source is a color raster, **not** a measured elevation DEM.
- Every scene-look thumbnail uses the real scene renderer, including theme-specific grading and atmosphere.
- All defaults are resolved by `themeValue`. No global override is added merely by selecting either look. Overrides remain editable; changing look preserves per-object styles.
- No change to project schema or to Natural Earth offline data.
