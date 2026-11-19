import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SceneStore,newDocument,validateDocument,texturesEnabled} from '../assets/scene-core.js';

const initial=newDocument();
assert.equal(texturesEnabled(initial,'land'),true);
assert.equal(texturesEnabled(initial,'ocean'),true);
const old=newDocument();old.render_options={textures_enabled:false};
validateDocument(old);
assert.equal(texturesEnabled(old,'land'),false);
assert.equal(texturesEnabled(old,'ocean'),false);
const ancient=newDocument();delete ancient.render_options;
validateDocument(ancient);
assert.equal(texturesEnabled(ancient,'land'),true);
assert.equal(texturesEnabled(ancient,'ocean'),true);
assert.throws(()=>validateDocument({...initial,render_options:{textures_enabled:true,land_textures_enabled:'false'}}));
assert.throws(()=>validateDocument({...initial,render_options:{textures_enabled:true,ocean_textures_enabled:0}}));
assert.throws(()=>validateDocument({...initial,render_options:{textures_enabled:true,other_option:true}}));
const store=new SceneStore(old);
assert.throws(()=>store.execute({type:'SetSurfaceTextureVisibility',surface:'all',enabled:true}));
assert.throws(()=>store.execute({type:'SetSurfaceTextureVisibility',surface:'ocean',enabled:0}));
assert.equal(store.execute({type:'SetSurfaceTextureVisibility',surface:'land',enabled:true}),true);
assert.equal(texturesEnabled(store.doc,'land'),true);
assert.equal(texturesEnabled(store.doc,'ocean'),false,'legacy-off ocean remains off after toggling land on');
assert.equal(store.doc.render_options.textures_enabled,true);
assert.equal(store.doc.render_options.ocean_textures_enabled,false);
const landOnly=JSON.parse(JSON.stringify(store.doc));validateDocument(landOnly);
assert.equal(texturesEnabled(landOnly,'ocean'),false,'surface preference survives project export/import');
assert.equal(store.execute({type:'SetSurfaceTextureVisibility',surface:'ocean',enabled:true}),true);
assert.equal(texturesEnabled(store.doc,'ocean'),true);
assert.equal(store.execute({type:'SetSurfaceTextureVisibility',surface:'land',enabled:false}),true);
assert.equal(texturesEnabled(store.doc,'land'),false);
assert.equal(texturesEnabled(store.doc,'ocean'),true);
assert.equal(texturesEnabled(store.doc),true,'no-argument helper indicates any material is enabled');
assert.equal(store.execute({type:'SetSurfaceTextureVisibility',surface:'ocean',enabled:false}),true);
assert.equal(texturesEnabled(store.doc),false,'both categories disabled');
assert.equal(store.doc.render_options.textures_enabled,false);
assert.equal(store.undo(),true);
assert.deepEqual([texturesEnabled(store.doc,'land'),texturesEnabled(store.doc,'ocean')],[false,true]);
assert.equal(store.redo(),true);
assert.deepEqual([texturesEnabled(store.doc,'land'),texturesEnabled(store.doc,'ocean')],[false,false]);
assert.equal(store.execute({type:'SetSurfaceTextureVisibility',surface:'land',enabled:false}),false,'idempotent action');
assert.equal(store.execute({type:'SetTextureVisibility',enabled:true}),true,'legacy command enables both');
assert.deepEqual([texturesEnabled(store.doc,'land'),texturesEnabled(store.doc,'ocean')],[true,true]);
const before=JSON.stringify(store.doc.render_options);
assert.ok(store.execute({type:'ApplyTheme',id:'atlas'}));
assert.equal(JSON.stringify(store.doc.render_options),before,'changing style cannot reset geographic texture visibility');
assert.ok(store.undo());
assert.equal(JSON.stringify(store.doc.render_options),before);

const renderer=readFileSync(new URL('../assets/scene-renderer.js',import.meta.url),'utf8');
assert.match(renderer,/if\(!texturesEnabled\(doc,'land'\)\)return;/,'relief shading follows land checkbox');
assert.match(renderer,/if\(landTextures&&themeValue\(doc,'terrain_enabled'\)/,'terrain follows land checkbox');
assert.match(renderer,/const land=texturesEnabled\(doc,'land'\),ocean=texturesEnabled\(doc,'ocean'\)/);
assert.match(renderer,/if\(land\)\{/);
assert.match(renderer,/if\(ocean\)paintMaterial/);
assert.match(renderer,/drawGeoTextureClipped\(ctx,doc,countries,images,texture,w,h,1,filter,'ocean'\)/);
assert.match(renderer,/drawGeoTextureClipped\(ctx,doc,countries,images,texture,w,h,landOpacity,filter,'land'\)/);

// Execute the world raster routing with lightweight canvas spies. This
// catches the distinct land-only, ocean-only, both and neither paths without
// loading large geographic image assets.
const from=renderer.indexOf('function drawWorld(ctx,doc,countries,images,w,h){');
const to=renderer.indexOf('\nfunction drawGrid(',from);
assert.ok(from>0&&to>from);
const names=['textureNow','textureRenderStats','paletteFor','themeValue',
 'terrainTexture','texturesEnabled','rasterFiltered','drawGeoTextureClipped',
 'drawPolygon','materialMasks','paintReliefProfile','paintSceneMaterials'];
const observed=[];
const deps=[
 ()=>1,{lastWorldMs:0},()=>({ocean:'#123',land:'#abc'}),
 (_doc,key)=>({ocean_opacity:1,land_opacity:1,ocean_mode:'raster',
  terrain_contrast:1,terrain_saturation:1,terrain_enabled:false,terrain_strength:0,
  land_tint_strength:0})[key],
 ()=> 'bmng',texturesEnabled,
 ()=>observed.push('full-raster'),
 (_ctx,_doc,_countries,_images,_img,_w,_h,_alpha,_filter,surface)=>observed.push('clip-'+surface),
 ()=>observed.push('flat-land'),
 ()=>null,()=>{},()=>{}
];
const draw=new Function(...names,renderer.slice(from,to)+'\nreturn drawWorld;')(...deps);
const canvas={globalAlpha:1,save(){},restore(){},fillRect(){},set fillStyle(v){}};
const geometry=[{geometry:{type:'Polygon',coordinates:[]}}];
const images={bmng:{naturalWidth:256}};
function probe(land,ocean){
 const doc=newDocument();
 doc.theme.id='atlas';
 doc.render_options={textures_enabled:land||ocean,land_textures_enabled:land,ocean_textures_enabled:ocean};
 observed.length=0;
 draw(canvas,doc,geometry,images,800,500);
 return [...observed];
}
assert.deepEqual(probe(true,true),['full-raster']);
assert.deepEqual(probe(true,false),['clip-land']);
assert.deepEqual(probe(false,true),['clip-ocean','flat-land']);
assert.deepEqual(probe(false,false),['flat-land']);
console.log('SURFACE TEXTURE SWITCH PASS: independent persistence, old-project fallback, Undo/Redo, world raster and material routing');
