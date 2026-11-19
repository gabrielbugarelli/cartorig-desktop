/* No geographic material may leak across the coastline. Every Look has
 * separate land/ocean material channels, with safe legacy override handling. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MATERIAL_IDS,LAND_MATERIAL_IDS,OCEAN_MATERIAL_IDS,isMaterialForSurface,LOOK_MATERIAL_RECIPES} from '../assets/look-materials.js';
import {newDocument,SceneStore} from '../assets/scene-core.js';
import {themeValue} from '../assets/style-resolver.js';

assert.equal(MATERIAL_IDS.length,22);
assert.equal(OCEAN_MATERIAL_IDS.length,4);
assert.ok(LAND_MATERIAL_IDS.includes('paper_fibrous'));
assert.ok(LAND_MATERIAL_IDS.includes('ink_grain'));
assert.ok(OCEAN_MATERIAL_IDS.includes('marine_waves'));
assert.ok(OCEAN_MATERIAL_IDS.includes('marine_noise'));
assert.ok(OCEAN_MATERIAL_IDS.includes('deep_sea'));
assert.deepEqual(LAND_MATERIAL_IDS.filter(x=>OCEAN_MATERIAL_IDS.includes(x)),['none']);
assert.deepEqual([...new Set([...LAND_MATERIAL_IDS,...OCEAN_MATERIAL_IDS])].sort(),[...MATERIAL_IDS].sort());
for(const id of LAND_MATERIAL_IDS)assert.equal(isMaterialForSurface(id,'land'),true,id);
for(const id of OCEAN_MATERIAL_IDS)assert.equal(isMaterialForSurface(id,'ocean'),true,id);
assert.equal(isMaterialForSurface('paper_aged','ocean'),false);
assert.equal(isMaterialForSurface('marine_waves','land'),false);
assert.equal(isMaterialForSurface('none','land'),true);
assert.equal(isMaterialForSurface('none','ocean'),true);
assert.equal(isMaterialForSurface('paper_aged','all'),false);

for(const [id,recipe] of Object.entries(LOOK_MATERIAL_RECIPES)){
 for(const key of ['surface_material','land_material','cartographic_finish'])
  assert.equal(isMaterialForSurface(recipe[key],'land'),true,`${id} ${key} incorrectly uses marine texture`);
 assert.equal(isMaterialForSurface(recipe.ocean_material,'ocean'),true,`${id} uses terrestrial texture on water`);
 assert.ok(recipe.land_material_strength>=0&&recipe.land_material_strength<=1);
 assert.ok(recipe.ocean_material_strength>=0&&recipe.ocean_material_strength<=1);
}
assert.equal(Object.keys(LOOK_MATERIAL_RECIPES).length,36);
const atlas=LOOK_MATERIAL_RECIPES.atlas;
assert.equal(atlas.land_material,'paper_fibrous');
assert.equal(atlas.ocean_material,'marine_waves','Atlas sea should use a marine rather than a terrestrial material');
assert.ok(atlas.ocean_material_strength>0&&atlas.ocean_material_strength<=.2,'marine water must stay understated');

const studio=readFileSync(new URL('../assets/style-studio.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../assets/scene-renderer.js',import.meta.url),'utf8');
assert.match(studio,/\['surface_material','Land paper \/ support','select',LAND_MATERIAL_IDS\]/);
assert.match(studio,/\['land_material','Land texture','select',LAND_MATERIAL_IDS\]/);
assert.match(studio,/\['cartographic_finish','Land engraving \/ print finish','select',LAND_MATERIAL_IDS\]/);
assert.match(studio,/\['ocean_material','Ocean texture','select',OCEAN_MATERIAL_IDS\]/);
assert.match(studio,/LAND · CONTINENTS ONLY/);
assert.match(studio,/OCEAN · WATER ONLY/);

// Exercise the real paintMaterial implementation with a fake Canvas2D context.
// Even deliberately malformed old .cartorig overrides cannot paint the wrong region.
const start=renderer.indexOf('function paintMaterial(ctx,images,doc,key,strengthKey,mask,w,h,masks){');
const end=renderer.indexOf('\nfunction paintSceneMaterials(',start);
assert.ok(start>0&&end>start,'paintMaterial implementation must exist');
const factory=new Function('isMaterialForSurface','themeValue','materialImage','materialPattern',
 renderer.slice(start,end)+'\nreturn paintMaterial;');
const paint=factory(isMaterialForSurface,themeValue,
 (_,name)=>name==='none'?null:{naturalWidth:128,material:name},
 (_ctx,img)=>({pattern:{image:img},fallback:false}));
const calls=[];
const ctx={
 globalAlpha:1,save(){},restore(){},clip(mask){calls.push(['clip',mask]);},
 fillRect(){calls.push(['fill',this.fillStyle.patternName||'material']);},
 fillStyle:null
};
const masks={land:'LAND CLIP',ocean:'OCEAN CLIP'};
const doc=newDocument();doc.theme.id='atlas';doc.theme.overrides={};
function run(key,strength,region){calls.length=0;paint(ctx,{},doc,key,strength,region,640,360,masks);return [...calls];}
const land=run('land_material','land_material_strength','land');
assert.deepEqual(land[0],['clip','LAND CLIP']);
assert.equal(land.filter(x=>x[0]==='fill').length,1);
const water=run('ocean_material','ocean_material_strength','ocean');
assert.deepEqual(water[0],['clip','OCEAN CLIP']);
assert.equal(water.filter(x=>x[0]==='fill').length,1);

// Old files can store a paper name in an ocean override. Do not reject or
// erase the project, but never render it in water.
const store=new SceneStore(doc);
assert.ok(store.execute({type:'SetThemeProperty',key:'ocean_material',value:'paper_aged'}));
const legacy=new SceneStore(JSON.parse(JSON.stringify(store.doc))).doc;
assert.equal(themeValue(legacy,'ocean_material'),'paper_aged');
calls.length=0;paint(ctx,{},legacy,'ocean_material','ocean_material_strength','ocean',640,360,masks);
assert.equal(calls.length,0,'invalid paper-on-ocean override must not draw');
assert.ok(store.execute({type:'SetThemeProperty',key:'land_material',value:'marine_waves'}));
calls.length=0;paint(ctx,{},store.doc,'land_material','land_material_strength','land',640,360,masks);
assert.equal(calls.length,0,'invalid wave-on-land override must not draw');
assert.ok(store.undo());assert.equal(themeValue(store.doc,'land_material'),'paper_fibrous');
assert.ok(store.undo());assert.equal(themeValue(store.doc,'ocean_material'),'marine_waves');
console.log('MATERIAL CATEGORY PASS: 36 presets, two material catalogs, coast masks, legacy safety and Undo');
