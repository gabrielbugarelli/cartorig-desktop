/* 1.4.2: regression gate for every audited broken/absent Cinematic Style operation. */
import assert from 'node:assert/strict';
import {SceneStore,madeObject,COLORS,uuid} from '../assets/scene-core.js';
import {themeValue,paletteFor,resolveStyle,parseStylePreset,styleToFile,makeStylePreset,THEME_FIELDS} from '../assets/style-resolver.js';

const store=new SceneStore(),brazil=madeObject('Region','Brazil',{source:{dataset_id:'ne_admin0_110m',feature_id:'BRA'},region_kind:'Country',style:{fill_color:'#d91f30',stroke_color:'#eeeeee',shadow_enabled:true}});
store.execute({type:'CreateObject',object:brazil});
const setters={land_color:'#123456',land_opacity:.2,terrain_enabled:true,atmosphere_tint_mix:.9,grid_labels:true,grid_interval:15,border_style:'Dotted',texture_source:'etopo1',terrain_source:'bmng',ocean_mode:'solid'};
for(const [key,value] of Object.entries(setters)){
 assert.ok(THEME_FIELDS.has(key),key);
 store.execute({type:'SetThemeProperty',key,value});
 assert.equal(store.doc.theme.overrides[key],value);
 store.execute({type:'SetThemeProperty',key,value:null});
 assert.equal(Object.hasOwn(store.doc.theme.overrides,key),false,'revert '+key);
 assert.notEqual(themeValue(store.doc,key),null);
 assert.equal(store.undo(),true);assert.equal(store.doc.theme.overrides[key],value);
 assert.equal(store.redo(),true);assert.equal(Object.hasOwn(store.doc.theme.overrides,key),false);
}
store.execute({type:'SetThemeProperty',key:'land_color',value:'#123456'});
store.execute({type:'ApplyTheme',id:'atlas'});
assert.equal(paletteFor(store.doc).land,COLORS.atlas.land,'palette must visibly switch');
assert.equal(resolveStyle(store.doc,store.doc.objects[brazil.id]).fill_color,'#d91f30','country override must survive theme switch');
assert.equal(store.doc.objects[brazil.id].style.shadow_enabled,true);
assert.equal(resolveStyle(store.doc,store.doc.objects[brazil.id]).stroke_color,'#eeeeee');
store.undo();assert.equal(paletteFor(store.doc).land,'#123456','Undo must restore global override');
store.redo();assert.equal(paletteFor(store.doc).land,COLORS.atlas.land);

store.execute({type:'SetCategoryStyle',object_type:'Region',key:'glow_enabled',value:true});
store.execute({type:'SetCategoryStyle',object_type:'Region',key:'glow_color',value:'#1199ff'});
assert.equal(resolveStyle(store.doc,store.doc.objects[brazil.id]).glow_color,'#1199ff');
store.execute({type:'SetCategoryStyle',object_type:'Region',key:'glow_color',value:null});
assert.equal(resolveStyle(store.doc,store.doc.objects[brazil.id]).glow_color,'#8ac7ff');
store.execute({type:'SetCategoryStyle',object_type:'Label',key:'font_family',value:'Arial'});
store.execute({type:'SetCategoryStyle',object_type:'Label',key:'halo_width',value:5});
assert.equal(resolveStyle(store.doc,madeObject('Label','Example',{anchor:{lon:0,lat:0}})).font_family,'Arial');
assert.equal(resolveStyle(store.doc,madeObject('Label','Example',{anchor:{lon:0,lat:0}})).halo_width,5);
assert.throws(()=>store.execute({type:'SetThemeProperty',key:'texture_source',value:'http://example.com'}),/Invalid/);
assert.throws(()=>store.execute({type:'SetThemeProperty',key:'not_supported',value:'hello'}),/Unsupported/);
assert.throws(()=>store.execute({type:'SetCategoryStyle',object_type:'Label',key:'font_family',value:'<iframe>'}),/Invalid/);

store.execute({type:'SaveUserStyle',name:'Full Cinematic'});
const preset=store.doc.style_library.at(-1);const file=styleToFile(preset);
const roundtrip=parseStylePreset(file);
assert.equal(roundtrip.id,preset.id);
assert.equal(roundtrip.metadata.source_version,'1.4.2');
assert.equal(roundtrip.metadata.source_theme,'atlas');
assert.deepEqual(roundtrip.asset_refs,[]);
assert.equal(roundtrip.defaults.Label.font_family,'Arial');
assert.throws(()=>store.execute({type:'ImportUserStyle',content:file}),/already exists/);
store.execute({type:'ImportUserStyle',content:file,on_conflict:'duplicate'});
assert.notEqual(store.doc.style_library.at(-1).id,preset.id);
assert.throws(()=>parseStylePreset(JSON.stringify({...roundtrip,asset_refs:[{asset_id:uuid(),relative_path:'../evil.svg',sha256:'f'.repeat(64),mime_type:'image/svg+xml'}]})),/Unsafe/);
assert.throws(()=>parseStylePreset(JSON.stringify({...roundtrip,metadata:{origin:'<script>'}})),/Invalid/);
assert.throws(()=>parseStylePreset(JSON.stringify({...roundtrip,id:'not-uuid'})),/Invalid/);
console.log('CartoRig 1.4.2 audit: resets, nine preset switch, inheritance, Grid/Border/Terrain, category effects, complete style identity, safe import, Undo/Redo PASS');
