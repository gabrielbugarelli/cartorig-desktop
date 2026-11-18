/* CartoRig 1.4 — authoritative immutable style resolution and safe .cartorigstyle schema. MIT. */
import {COLORS,ancestors,uuid} from './scene-core.js';
import {REFERENCE_LOOKS} from './reference-looks.js';
import {MATERIAL_IDS,RELIEF_PROFILES,LOOK_MATERIAL_RECIPES} from './look-materials.js';
export const BLEND_MODES=['normal','multiply','screen','overlay'];
export const STYLE_NUMBERS=Object.freeze({fill_opacity:[0,1],stroke_opacity:[0,1],stroke_width:[0,40],symbol_size:[1,200],halo_width:[0,100],background_padding:[0,100],shadow_opacity:[0,1],shadow_blur:[0,100],shadow_distance:[0,200],shadow_angle:[0,360],glow_intensity:[0,2],glow_radius:[0,100],glow_mix:[0,1],atmosphere_vignette:[0,1],atmosphere_tint_mix:[0,1],terrain_contrast:[0,2],terrain_saturation:[0,2],terrain_strength:[0,1],land_tint_strength:[0,1],surface_strength:[0,1],land_material_strength:[0,1],ocean_material_strength:[0,1],finish_strength:[0,1],relief_strength:[0,1],grid_opacity:[0,1],border_width:[0,40],border_opacity:[0,1],land_opacity:[0,1],ocean_opacity:[0,1]});
export const THEME_NUMBERS=Object.freeze({border_width:[0,40],border_opacity:[0,1],grid_opacity:[0,1],grid_interval:[0,90],grid_label_size:[8,36],land_opacity:[0,1],ocean_opacity:[0,1],terrain_contrast:[0,2],terrain_saturation:[0,2],terrain_strength:[0,1],land_tint_strength:[0,1],surface_strength:[0,1],land_material_strength:[0,1],ocean_material_strength:[0,1],finish_strength:[0,1],relief_strength:[0,1],atmosphere_vignette:[0,1],atmosphere_tint_mix:[0,1]});
export const THEME_COLORS=Object.freeze(['land_color','ocean_color','border_color','grid_color','atmosphere_tint','typography_color','land_tint_color']);
export const THEME_TOGGLES=Object.freeze(['terrain_enabled','grid_labels','show_state_boundaries','show_rivers','show_lakes','show_coastlines']);
export const THEME_CHOICES=Object.freeze({border_style:['Solid','Dashed','Dotted'],texture_source:['auto','solid','shadedrelief','bmng','etopo1'],terrain_source:['shadedrelief','bmng','etopo1'],ocean_mode:['raster','solid'],surface_material:MATERIAL_IDS,land_material:MATERIAL_IDS,ocean_material:MATERIAL_IDS,cartographic_finish:MATERIAL_IDS,relief_profile:RELIEF_PROFILES});
export const THEME_FIELDS=new Set([...Object.keys(THEME_NUMBERS),...THEME_COLORS,...THEME_TOGGLES,...Object.keys(THEME_CHOICES),'border_dash']);

const BUILTIN_MATERIAL_BASE=Object.fromEntries(REFERENCE_LOOKS.map(look=>[look.id,look.defaults]));
BUILTIN_MATERIAL_BASE.relief={texture_source:'shadedrelief',ocean_mode:'raster',terrain_enabled:false,terrain_contrast:1,terrain_saturation:1,terrain_strength:0,atmosphere_vignette:0,atmosphere_tint_mix:0,grid_opacity:.18,border_opacity:.75};
BUILTIN_MATERIAL_BASE.terrain={texture_source:'etopo1',ocean_mode:'solid',terrain_enabled:true,terrain_source:'shadedrelief',terrain_contrast:1.45,terrain_saturation:.52,terrain_strength:.24,atmosphere_vignette:.42,atmosphere_tint:'#0a1d32',atmosphere_tint_mix:.18,grid_opacity:.07,border_opacity:.6,border_width:1.05};
// Built-in looks must differ in actual raster/effect parameters, not just swatch
// colors. Shaded Relief remains a neutral, natural topographic reference.
// Terrain Cinematic is an editorial treatment built from the installed ETOPO
// color raster plus subtle texture shading; it does NOT claim DEM hillshade.
export const BUILTIN_LOOK_DEFAULTS=Object.freeze({
 relief:Object.freeze({texture_source:'shadedrelief',ocean_mode:'raster',terrain_enabled:false,terrain_contrast:1,terrain_saturation:1,terrain_strength:0,atmosphere_vignette:0,atmosphere_tint_mix:0,grid_opacity:.18,border_opacity:.75}),
 terrain:Object.freeze({texture_source:'etopo1',ocean_mode:'solid',terrain_enabled:true,terrain_source:'shadedrelief',terrain_contrast:1.45,terrain_saturation:.52,terrain_strength:.24,atmosphere_vignette:.42,atmosphere_tint:'#0a1d32',atmosphere_tint_mix:.18,grid_opacity:.07,border_opacity:.6,border_width:1.05}),
 ...Object.fromEntries(REFERENCE_LOOKS.map(look=>[look.id,Object.freeze({...look.defaults})])),
 ...Object.fromEntries(Object.entries(LOOK_MATERIAL_RECIPES).map(([id,recipe])=>[id,Object.freeze({...BUILTIN_MATERIAL_BASE[id],...recipe})]))
});

const colorRE=/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const isColor=v=>typeof v==='string'&&colorRE.test(v);
export const styleDefaults=Object.freeze({
 Region:{fill_opacity:.8,stroke_width:2,stroke_opacity:1,stroke_style:'Solid'},
 Route:{stroke_width:3,stroke_opacity:1,stroke_style:'Solid'},
 Marker:{symbol_size:12,stroke_width:2},
 Label:{halo_width:4},
 Shape:{stroke_width:3,stroke_opacity:1},
 Group:{blend_mode:'normal'}
});
export const EFFECT_DEFAULTS=Object.freeze({shadow_enabled:false,shadow_color:'#000000',shadow_opacity:.35,shadow_blur:12,shadow_distance:4,shadow_angle:45,glow_enabled:false,glow_color:'#8ac7ff',glow_intensity:.5,glow_radius:16,glow_mix:1,blend_mode:'normal'});
export function validateStyleField(key,value){
 if(value===null)return true;
 if(Object.hasOwn(STYLE_NUMBERS,key)){const [min,max]=STYLE_NUMBERS[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Invalid style value: '+key);return true;}
 if(/_color$/.test(key)||key==='arrow_fill'||key==='text_color'||key==='fill_color'||key==='background_color'||key==='halo_color'){if(!isColor(value))throw Error('Invalid color for '+key);return true;}
 if(key==='shadow_enabled'||key==='glow_enabled'){if(typeof value!=='boolean')throw Error('Invalid boolean '+key);return true;}
 if(key==='blend_mode'){if(!BLEND_MODES.includes(value))throw Error('Unsupported blend mode');return true;}
 if(key==='font_family'){if(typeof value!=='string'||value.length>100||/[<>\u0000-\u001f]/.test(value))throw Error('Invalid font family');return true;}
 if(key==='stroke_style'){if(!['Solid','Dashed','Dotted'].includes(value))throw Error('Unsupported stroke style');return true;}
 return true; // Creative Tools 1.3 owns additional fields.
}
export function validateThemeField(key,value){
 if(!THEME_FIELDS.has(key))throw Error('Unsupported theme field: '+key);
 // A null theme value explicitly removes an override; inherited colors, numbers
 // and booleans must ALL support this (RF-STYLE-003/004).
 if(value===null)return true;
 if(Object.hasOwn(THEME_NUMBERS,key)){let [lo,hi]=THEME_NUMBERS[key];if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi)throw Error('Invalid theme value: '+key);return true;}
 if(THEME_COLORS.includes(key)){if(!isColor(value))throw Error('Invalid theme color');return true;}
 if(THEME_TOGGLES.includes(key)||key==='border_dash'){if(typeof value!=='boolean')throw Error('Invalid theme toggle');return true;}
 if(Object.hasOwn(THEME_CHOICES,key)){if(!THEME_CHOICES[key].includes(value))throw Error('Invalid theme option: '+key);return true;}
}
export function themeValue(doc,key){
 const over=doc?.theme?.overrides||{};if(over[key]!==undefined&&over[key]!==null)return over[key];
 const palette=paletteFor(doc);
 const paletteMap={land_color:'land',ocean_color:'ocean',border_color:'border',grid_color:'grid',typography_color:'text'};
 if(paletteMap[key])return palette[paletteMap[key]];
 const defaults={land_opacity:1,ocean_opacity:1,border_width:1.2,border_opacity:.75,border_style:'Solid',grid_opacity:doc?.theme?.id==='atlas'?.28:.18,grid_interval:0,grid_labels:false,grid_label_size:12,terrain_enabled:false,texture_source:'auto',terrain_source:'shadedrelief',terrain_contrast:1,terrain_saturation:1,terrain_strength:0,ocean_mode:'raster',land_tint_color:'#ffffff',land_tint_strength:0,surface_material:'none',land_material:'none',ocean_material:'none',cartographic_finish:'none',relief_profile:'none',surface_strength:0,land_material_strength:0,ocean_material_strength:0,finish_strength:0,relief_strength:0,atmosphere_vignette:0,atmosphere_tint:'#000000',atmosphere_tint_mix:0};
 return BUILTIN_LOOK_DEFAULTS[doc?.theme?.id]?.[key] ?? defaults[key];
}
export function paletteFor(doc){const selected=doc?.theme?.id||'dark';let fromLibrary=doc?.style_library?.find(x=>x.id===selected)?.palette;
 const base={...(COLORS[selected]||fromLibrary||COLORS.dark)};
 const overrides=doc?.theme?.overrides||{};
 for(const [key,prop] of [['land_color','land'],['ocean_color','ocean'],['border_color','border'],['grid_color','grid'],['typography_color','text']])if(overrides[key]!=null)base[prop]=overrides[key];
 return base;
}
export function resolveStyle(doc,obj){
 const palette=paletteFor(doc);
 const base={...EFFECT_DEFAULTS,...(styleDefaults[obj.type]||{})};
 if(obj.type==='Region'){base.fill_color=palette.accent||'#db7657';base.stroke_color=base.fill_color;}
 if(obj.type==='Marker'){base.fill_color=palette.accent||'#e5b467';base.stroke_color='#ffffff';}
 if(obj.type==='Route'||obj.type==='Shape')base.stroke_color=palette.accent||'#e5b467';
 if(obj.type==='Label'||obj.type==='Shape')base.text_color=palette.text||'#ffffff';
 const custom=doc?.style_library?.find(x=>x.id===doc?.theme?.id);
 Object.assign(base,custom?.defaults?.[obj.type]||{});
 const cat=doc?.theme?.type_defaults?.[obj.type];if(cat)Object.assign(base,cat);
 // Groups may set defaults for visual effects, but never overwrite the child's
 // explicit field. Group opacity and blend remain separate compositing operations.
 for(const id of ancestors(doc,obj.id).reverse()){
  const gp=doc.objects[id];if(gp?.type==='Group'&&gp.style?.child_defaults){Object.assign(base,gp.style.child_defaults);}
 }
 for(const [key,value] of Object.entries(obj.style||{}))if(value!==null&&value!==undefined)base[key]=value;
 // Stroke defaults to explicit or effective fill when no stroke color is set.
 if(obj.type==='Region'&&obj.style?.stroke_color==null)base.stroke_color=base.fill_color;
 return base;
}
export function inheritedValue(doc,obj,key){const virtual={...obj,style:{...obj.style}};delete virtual.style[key];return resolveStyle(doc,virtual)[key];}
const safeStrings=o=>Object.values(o).every(x=>typeof x!=='string'||x.length<=256);
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateStyleAssets(entries){
 if(!Array.isArray(entries)||entries.length>20)throw Error('Invalid style asset references');
 for(const a of entries){
  if(!a||typeof a!=='object'||Array.isArray(a)||!Object.keys(a).every(k=>['asset_id','relative_path','sha256','mime_type'].includes(k)))throw Error('Invalid asset metadata');
  if(typeof a.asset_id!=='string'||!uuidPattern.test(a.asset_id)||typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(a.sha256))throw Error('Invalid asset identity');
  if(typeof a.relative_path!=='string'||!/^assets\/[a-zA-Z0-9_-]+\.(?:svg|png|jpg|woff2)$/.test(a.relative_path)||a.relative_path.includes('..'))throw Error('Unsafe style asset path');
  if(!['image/svg+xml','image/png','image/jpeg','font/woff2'].includes(a.mime_type))throw Error('Unsupported style asset MIME');
 }
}
function validatePresetMetadata(metadata){
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||Object.keys(metadata).length>8)throw Error('Invalid style metadata');
 for(const [key,value] of Object.entries(metadata)){
  if(!['origin','source_theme','created_at','updated_at','author','license','source_version'].includes(key)||typeof value!=='string'||value.length>128||/[<>\u0000-\u001f]/.test(value))throw Error('Invalid style metadata: '+key);
 }
}
export function parseStylePreset(text){
 if(typeof text!=='string'||text.length>120_000)throw Error('Style file exceeds 120 KB');
 let s;try{s=JSON.parse(text);}catch{throw Error('Invalid style JSON');}
 if(!s||s.format!=='cartorig-style'||s.schema_version!=='1.0.0'||typeof s.name!=='string'||s.name.trim().length<1||s.name.length>90)throw Error('Invalid .cartorigstyle schema');
 if(!s.palette||typeof s.palette!=='object'||Array.isArray(s.palette)||!s.defaults||typeof s.defaults!=='object'||Array.isArray(s.defaults))throw Error('Invalid style payload');
 if(Object.keys(s.palette).length>16||Object.keys(s.defaults).length>10)throw Error('Style exceeds field limit');
 for(let [k,v] of Object.entries(s.palette)){if(!['ocean','land','border','grid','text','accent','texture'].includes(k)||!((k==='texture'&&['shadedrelief','bmng','etopo1',null].includes(v))||isColor(v)))throw Error('Invalid style palette entry');}
 if(s.overrides!==undefined){if(!s.overrides||typeof s.overrides!=='object'||Array.isArray(s.overrides)||Object.keys(s.overrides).length>50)throw Error('Invalid style overrides');for(const [key,v] of Object.entries(s.overrides))validateThemeField(key,v);}
 for(let [kind,fields] of Object.entries(s.defaults)){if(!Object.hasOwn(styleDefaults,kind)||typeof fields!=='object'||!fields||Array.isArray(fields)||Object.keys(fields).length>50||!safeStrings(fields))throw Error('Invalid default style');for(let [k,v] of Object.entries(fields))validateStyleField(k,v);}
 if(s.id!==undefined&&(!uuidPattern.test(s.id)))throw Error('Invalid style UUID');
 const metadata=s.metadata||{};validatePresetMetadata(metadata);
 const assetRefs=s.asset_refs||[];validateStyleAssets(assetRefs);
 if(typeof s.description!=='undefined'&&(typeof s.description!=='string'||s.description.length>400))throw Error('Invalid style description');
 return {format:'cartorig-style',schema_version:'1.0.0',id:s.id||uuid(),name:s.name.trim(),description:s.description||'',palette:structuredClone(s.palette),defaults:structuredClone(s.defaults),overrides:structuredClone(s.overrides||{}),metadata:structuredClone(metadata),asset_refs:structuredClone(assetRefs)};
}
export function makeStylePreset(doc,name){
 const p=paletteFor(doc),defaults=structuredClone(doc.theme?.type_defaults||{});
 const createdAt=new Date().toISOString();
 return parseStylePreset(JSON.stringify({format:'cartorig-style',schema_version:'1.0.0',id:uuid(),name,palette:p,defaults,overrides:doc.theme?.overrides||{},metadata:{origin:'CartoRig',source_theme:doc.theme?.id||'dark',source_version:'1.4.2',created_at:createdAt},asset_refs:[]}));
}
export function styleToFile(p){return JSON.stringify({format:'cartorig-style',schema_version:'1.0.0',id:p.id,name:p.name,description:p.description||'',palette:p.palette,defaults:p.defaults||{},overrides:p.overrides||{},metadata:p.metadata||{},asset_refs:p.asset_refs||[]},null,2);}
