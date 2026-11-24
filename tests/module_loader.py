"""Browser test bridge: concatenate ES modules into isolated scopes with exposed public imports.
Only used by offline-in-memory browser tests; production uses real native ES module imports.
"""
import re

def browser_bundle(assets, include_app=True):
    exports={
        'reference-looks.js':'REFERENCE_LOOKS',
        'look-materials.js':'MATERIAL_IDS LAND_MATERIAL_IDS OCEAN_MATERIAL_IDS isMaterialForSurface RELIEF_PROFILES LOOK_MATERIAL_RECIPES LOOK_FAMILIES',
        'creative-engine.js':'MARKER_SYMBOLS SHAPES ROUTE_TYPES clamp01 normLon pointValid distinct resolveLink routePoints continuousPoints inverseGeodesic directGeodesic geodesicSamples curvedSamples routeSamples simplifyFreehand shapePoints destinationPoint geoDistance validateCreative sanitizeSVG',
        'scene-core.js':'clone uuid clamp COLORS madeObject newDocument texturesEnabled DEFAULT_MAP_LABELS MAP_LABEL_KINDS MAP_LABEL_SIZES validateMapLabels migrateLegacy treeIds descendants ancestors isLocked isVisible normalizeSelection validateDocument SceneStore',
        'style-resolver.js':'BLEND_MODES STYLE_NUMBERS THEME_NUMBERS THEME_COLORS THEME_TOGGLES THEME_CHOICES THEME_FIELDS themeValue isColor styleDefaults EFFECT_DEFAULTS validateStyleField validateThemeField paletteFor resolveStyle inheritedValue parseStylePreset makeStylePreset styleToFile',
        'style-effects.js':'blending withIsolatedSurface applyAtmosphere setRenderTile',
        'creative-renderer.js':'clearCreativeImageCache settleCreativeAssets shapeScreenPoints creativeHandles drawCreative hitCreative',
        'creative-interaction.js':'DRAWING_TOOLS MULTIPOINT_SHAPES POINTER_HIT_RADIUS isContinuousDraft minimumDraftPoints normalizedDraftPoints canCommitCreativeDraft creativeGuide handleRole handleHit drawHandle drawDraftGuides drawPlacementPreview',
        'creative-inspector.js':'browserFontAvailable creativeInspector',
        'inspector-layout.js':'INSPECTOR_SECTIONS createInspectorSections',
        'geo-catalog.js':'GEO_TYPES geoNormalize geoDisplayName geoDisplayParent GeoCatalog featureBounds featureFocusBounds canonicalCountryId normalizeCountryIds countryForRegion',
        'map-labels.js':'labelOptions layoutMapLabels paintMapLabels labelKinds',
        'texture-cache.js':'PREVIEW_TEXTURE_MAX_PIXELS PREVIEW_TEXTURE_BUDGET_PIXELS createFilteredTextureCache visibleRasterShifts',
        'state-boundaries.js':'stateBoundaryTolerance simplifyStateRing visibleStateCopies createStateBoundaryPreview',
        'material-projection.js':'MATERIAL_TILE_LONGITUDE_DEGREES materialPatternTransform',
        'scene-renderer.js':'polygonParts boundsOf pointInside scaleFor project unproject unwrapRing polygonCacheStats clearPolygonPathCache previewTextureStats textureRenderStats stateBoundaryStats drawObject renderScene renderMapLabelLayer renderRegionMask hitTest hitTestCandidates',
        'style-studio.js':'setupStyleStudio',
        'style-inspector.js':'renderAdvancedInspector',
        'production-vector.js':'escapeXML serializeVectorScene',
        'production-templates.js':'PROJECT_TEMPLATES createTemplate',
        'production-studio.js':'setupProductionStudio',
        'workspace-layout.js':'WORKSPACE_LAYOUT_KEY WORKSPACE_LIMITS workspaceDefaultWidths fitWorkspaceWidths setupWorkspaceLayout',
        'navigation-ui.js':'setupNavigation',
        'app.js':''
    }
    output=[]
    for name,names in exports.items():
        if not include_app and name == "app.js":
            continue
        source=(assets/name).read_text()
        source=re.sub(r'^import .*?;?\s*$','',source,flags=re.M)
        source=re.sub(r'^export (?!default )','',source,flags=re.M)
        output.append('(function(){\n'+source+'\n'+('Object.assign(window,{'+','.join(names.split())+'});' if names else '')+'\n})();')
    return '\n'.join(output)
