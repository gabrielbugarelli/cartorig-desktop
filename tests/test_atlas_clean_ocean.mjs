// Regression for Documentary_Terrain.cartorig: Atlas textures should be
// terrestrial, not a veil of marine_noise over the entire sea.
import assert from 'node:assert/strict';
import {newDocument,SceneStore,texturesEnabled} from '../assets/scene-core.js';
import {LOOK_MATERIAL_RECIPES} from '../assets/look-materials.js';
import {themeValue,paletteFor} from '../assets/style-resolver.js';
import {readFileSync} from 'node:fs';

const doc=newDocument();
doc.theme={id:'atlas',overrides:{show_state_boundaries:true},type_defaults:{}};
doc.render_options={textures_enabled:true};
assert.ok(texturesEnabled(doc));
const land=['surface_material','land_material','cartographic_finish'];
for(const name of land){
 assert.notEqual(themeValue(doc,name),'none',`Atlas must preserve terrestrial ${name}`);
}
assert.equal(themeValue(doc,'ocean_material'),'none','Atlas sea should not use a marine pattern by default');
assert.equal(themeValue(doc,'ocean_material_strength'),0);
assert.equal(LOOK_MATERIAL_RECIPES.atlas.ocean_material,'none');
assert.equal(LOOK_MATERIAL_RECIPES.atlas.ocean_material_strength,0);
assert.equal(paletteFor(doc).texture,undefined,'Atlas must not add a second full-world base raster');
const renderer=readFileSync(new URL('../assets/scene-renderer.js',import.meta.url),'utf8');
assert.match(renderer,/paintMaterial\(ctx,images,doc,'surface_material','surface_strength','land',w,h,masks\)/);
assert.match(renderer,/paintMaterial\(ctx,images,doc,'land_material','land_material_strength','land',w,h,masks\)/);
assert.match(renderer,/paintMaterial\(ctx,images,doc,'cartographic_finish','finish_strength','land',w,h,masks\)/);
assert.match(renderer,/paintMaterial\(ctx,images,doc,'ocean_material','ocean_material_strength','ocean',w,h,masks\)/);
assert.match(renderer,/if\(!image\?\.naturalWidth\|\|!\(strength>0\)\)return;/,
 'no material should be painted when ocean strength is zero');

const store=new SceneStore(doc);
assert.ok(store.execute({type:'SetThemeProperty',key:'ocean_material',value:'marine_waves'}));
assert.ok(store.execute({type:'SetThemeProperty',key:'ocean_material_strength',value:.5}));
assert.equal(themeValue(store.doc,'ocean_material'),'marine_waves','explicit maritime material must remain possible');
assert.equal(themeValue(store.doc,'ocean_material_strength'),.5);
assert.ok(store.undo());assert.ok(store.undo());
assert.equal(themeValue(store.doc,'ocean_material'),'none');
assert.equal(themeValue(store.doc,'ocean_material_strength'),0);
const reopened=new SceneStore(JSON.parse(JSON.stringify(store.doc)));
assert.equal(themeValue(reopened.doc,'ocean_material'),'none','legacy Atlas documents should inherit updated recipe');
assert.notEqual(LOOK_MATERIAL_RECIPES['oceanic-engraving'].ocean_material,'none',
 'nautical looks should preserve marine materials');
assert.ok(LOOK_MATERIAL_RECIPES['oceanic-engraving'].ocean_material_strength>0);
console.log('ATLAS CLEAN OCEAN PASS: paper only on continents, no sea grain, explicit water materials and nautical Looks supported');
