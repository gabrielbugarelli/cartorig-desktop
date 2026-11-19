import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newDocument,texturesEnabled} from '../assets/scene-core.js';
import {themeValue} from '../assets/style-resolver.js';

const renderer=readFileSync(new URL('../assets/scene-renderer.js',import.meta.url),'utf8');
const start=renderer.indexOf('function paintSceneMaterials(ctx,doc,countries,images,w,h){');
const end=renderer.indexOf('\nfunction paintReliefProfile(',start);
assert.ok(start>=0&&end>start);
const func=renderer.slice(start,end);
const calls=[],stats={},masks={land:{region:'land'},ocean:{region:'ocean'}};
const make=new Function('paintMaterial','materialMasks','texturesEnabled','textureNow','textureRenderStats',
 func+'\nreturn paintSceneMaterials;');
const render=make((ctx,images,doc,key,strength,mask,w,h,requestedMasks)=>{
 assert.equal(requestedMasks,masks,'all materials share the real coastline mask');
 calls.push({key,strength,mask});
},()=>masks,texturesEnabled,()=>0,stats);
const doc=newDocument();doc.theme.id='atlas';
assert.equal(themeValue(doc,'surface_material'),'paper_clean');
assert.equal(themeValue(doc,'land_material'),'paper_fibrous');
assert.equal(themeValue(doc,'ocean_material'),'marine_waves','Atlas must use its own water-specific texture');
assert.ok(themeValue(doc,'ocean_material_strength')>0&&themeValue(doc,'ocean_material_strength')<=.2);
assert.equal(themeValue(doc,'cartographic_finish'),'ink_grain');
render({},doc,[],{},1280,720);
assert.deepEqual(calls.map(x=>[x.key,x.mask]),[
 ['surface_material','land'],
 ['land_material','land'],
 ['cartographic_finish','land'],
 ['ocean_material','ocean']
],'paper, land and print textures must never be painted across the sea');
// Explicitly requested marine patterns still use the ocean-only mask.
doc.theme.overrides.ocean_material='marine_waves';
doc.theme.overrides.ocean_material_strength=.6;
calls.length=0;render({},doc,[],{},1280,720);
assert.equal(themeValue(doc,'ocean_material'),'marine_waves');
assert.equal(themeValue(doc,'ocean_material_strength'),.6);
assert.deepEqual(calls.find(x=>x.key==='ocean_material').mask,'ocean');
doc.render_options.textures_enabled=false;
calls.length=0;render({},doc,[],{},1280,720);
assert.equal(calls.length,0,'textures toggle continues to suppress all materials');
assert.match(renderer,/ctx\.clip\(masks\[mask\],'evenodd'\)/,
 'land and ocean clipping must use the geographically projected coastline paths');
assert.match(renderer,/materialPatternTransform/,'geographic material transform must be preserved');
assert.match(renderer,/const materialPatternCache=new WeakMap\(\)/,'do not regress texture cache');
console.log('OCEAN MATERIAL PASS: paper and print only on land; separate ocean material; texture toggle and cache retained');
