/* Scene Looks 2.0: six distinct, deterministic visual layers per built-in look.
 * These are art directions, not synthetic elevation/bathymetric measurements.
 * Original/expanded preset IDs remain stable for old .cartorig projects. MIT.
 */
export const MATERIAL_IDS=Object.freeze([
 'none','paper_clean','paper_aged','paper_foxed','paper_fibrous','archival_sheet','canvas_weave',
 'engraving_lines','copperplate','ink_grain','print_plate','contour_etch','watercolor_wash',
 'marine_noise','marine_waves','deep_sea','document_wear','tactical_noise','dark_grain',
 'mineral_grit','dry_brush','linen'
]);
export const RELIEF_PROFILES=Object.freeze(['none','soft','natural','rugged','engraved','bathymetric','dark']);
// [family, support, land material, ocean material, print finish, relief profile, support/land/ocean/finish/relief strengths]
const RECIPE_ROWS=Object.freeze({
 dark:['Dark / Cinematic','dark_grain','mineral_grit','deep_sea','ink_grain','dark',.36,.28,.27,.12,.14],
 // Atlas is a terrestrial paper map: keep the paper grain on land,
 // and use the underlying flat ocean color. Marine patterns remain available
 // through an explicit Ocean material override and dedicated nautical Looks.
 atlas:['Paper / Parchment','paper_clean','paper_fibrous','none','ink_grain','soft',.49,.34,0,.23,.09],
 tactical:['Documentary / Tactical','archival_sheet','tactical_noise','marine_noise','print_plate','soft',.30,.45,.20,.31,.10],
 relief:['Terrain / Relief','none','mineral_grit','marine_noise','none','natural',0,.24,.15,0,.34],
 satellite:['Terrain / Relief','none','mineral_grit','marine_noise','none','natural',0,.11,.10,0,.09],
 night:['Dark / Cinematic','dark_grain','dark_grain','deep_sea','ink_grain','dark',.38,.30,.34,.10,.09],
 elevation:['Terrain / Relief','none','mineral_grit','marine_noise','contour_etch','natural',0,.24,.12,.19,.27],
 historical:['Paper / Parchment','paper_aged','paper_fibrous','marine_noise','ink_grain','engraved',.54,.42,.18,.25,.15],
 terrain:['Terrain / Relief','dark_grain','mineral_grit','deep_sea','dry_brush','rugged',.31,.44,.22,.27,.47],
 'noir-monochrome':['Dark / Cinematic','dark_grain','ink_grain','deep_sea','print_plate','dark',.42,.27,.20,.22,.08],
 'oceanic-engraving':['Ocean / Nautical','paper_fibrous','engraving_lines','marine_waves','copperplate','engraved',.34,.38,.47,.30,.15],
 'sultan-parchment':['Paper / Parchment','paper_aged','paper_fibrous','marine_noise','ink_grain','soft',.61,.43,.17,.31,.09],
 'imperial-conquest':['Documentary / Tactical','archival_sheet','dry_brush','marine_noise','print_plate','rugged',.35,.41,.22,.35,.25],
 'cold-war-archive':['Documentary / Tactical','document_wear','ink_grain','deep_sea','print_plate','dark',.51,.29,.25,.30,.16],
 'iron-curtain-noir':['Dark / Cinematic','dark_grain','tactical_noise','deep_sea','document_wear','dark',.34,.32,.19,.27,.27],
 'heritage-documentary':['Paper / Parchment','linen','watercolor_wash','marine_noise','ink_grain','soft',.48,.49,.17,.13,.11],
 'copper-topography':['Engraved / Printed','paper_foxed','copperplate','marine_noise','contour_etch','engraved',.35,.59,.17,.49,.33],
 'contour-radar':['Documentary / Tactical','dark_grain','contour_etch','marine_waves','tactical_noise','engraved',.22,.48,.22,.43,.28],
 'sepia-expedition':['Paper / Parchment','paper_aged','dry_brush','marine_noise','document_wear','natural',.64,.47,.20,.40,.20],
 'antique-campaign':['Engraved / Printed','paper_foxed','engraving_lines','marine_noise','print_plate','engraved',.58,.45,.22,.36,.27],
 'explorer-chart':['Ocean / Nautical','paper_clean','paper_fibrous','marine_waves','engraving_lines','soft',.27,.24,.62,.28,.06],
 'turquoise-bathymetry':['Ocean / Nautical','none','mineral_grit','marine_waves','ink_grain','bathymetric',0,.22,.69,.14,.12],
 'compass-antiquity':['Ocean / Nautical','paper_aged','engraving_lines','marine_noise','print_plate','engraved',.38,.37,.42,.26,.14],
 'desert-caravan':['Paper / Parchment','paper_foxed','mineral_grit','marine_noise','dry_brush','rugged',.49,.52,.12,.37,.34],
 'maritime-manuscript':['Ocean / Nautical','paper_fibrous','watercolor_wash','marine_waves','copperplate','soft',.41,.33,.56,.29,.08],
 'alpine-survey':['Terrain / Relief','none','mineral_grit','marine_noise','contour_etch','rugged',0,.39,.11,.42,.68],
 'fantasy-cartographer':['Engraved / Printed','canvas_weave','engraving_lines','marine_waves','dry_brush','engraved',.51,.52,.27,.36,.20],
 'obsidian-minimal':['Dark / Cinematic','dark_grain','none','none','none','none',.16,0,0,0,0],
 'great-lakes-depth':['Ocean / Nautical','none','watercolor_wash','deep_sea','contour_etch','bathymetric',0,.13,.67,.31,.08],
 'vintage-coast-survey':['Ocean / Nautical','paper_foxed','engraving_lines','marine_waves','print_plate','soft',.48,.32,.61,.33,.09],
 'age-of-sail':['Ocean / Nautical','paper_aged','engraving_lines','marine_waves','copperplate','engraved',.50,.35,.55,.41,.11],
 'tropical-explorer':['Ocean / Nautical','canvas_weave','watercolor_wash','marine_waves','ink_grain','natural',.22,.35,.65,.09,.20],
 'empire-spotlight':['Dark / Cinematic','dark_grain','mineral_grit','deep_sea','document_wear','dark',.34,.28,.23,.18,.25],
 'neon-heritage':['Dark / Cinematic','dark_grain','canvas_weave','marine_noise','print_plate','dark',.32,.43,.31,.19,.23],
 'engraved-chronicles':['Engraved / Printed','paper_fibrous','copperplate','marine_noise','engraving_lines','engraved',.45,.56,.16,.51,.25],
 'crimson-geopolitics':['Dark / Cinematic','dark_grain','mineral_grit','deep_sea','tactical_noise','dark',.34,.31,.30,.29,.33]
});
export const LOOK_MATERIAL_RECIPES=Object.freeze(Object.fromEntries(Object.entries(RECIPE_ROWS).map(([id,r])=>[id,Object.freeze({
 family:r[0],surface_material:r[1],land_material:r[2],ocean_material:r[3],cartographic_finish:r[4],relief_profile:r[5],
 surface_strength:r[6],land_material_strength:r[7],ocean_material_strength:r[8],finish_strength:r[9],relief_strength:r[10]
})])));
export const LOOK_FAMILIES=Object.freeze([...new Set(Object.values(LOOK_MATERIAL_RECIPES).map(x=>x.family))]);
