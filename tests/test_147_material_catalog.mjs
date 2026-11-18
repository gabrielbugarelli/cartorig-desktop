import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {LOOK_MATERIAL_RECIPES,LOOK_FAMILIES,MATERIAL_IDS,RELIEF_PROFILES} from '../assets/look-materials.js';
import {newDocument,SceneStore,validateDocument} from '../assets/scene-core.js';
import {themeValue,validateThemeField} from '../assets/style-resolver.js';
import {REFERENCE_LOOKS} from '../assets/reference-looks.js';
const originals=['dark','atlas','tactical','relief','satellite','night','elevation','historical','terrain'];
const ids=[...originals,...REFERENCE_LOOKS.map(x=>x.id)];
assert.equal(ids.length,36);
assert.equal(Object.keys(LOOK_MATERIAL_RECIPES).length,36);
assert.equal(LOOK_FAMILIES.length,6);
assert.equal(MATERIAL_IDS.length,22);
let fingerprint=new Set(),familyCount=new Set();
for(const id of ids){
 const r=LOOK_MATERIAL_RECIPES[id];assert(r,`Missing material recipe ${id}`);
 const store=new SceneStore(newDocument());store.execute({type:'ApplyTheme',id});
 assert.equal(themeValue(store.doc,'surface_material'),r.surface_material);
 assert.equal(themeValue(store.doc,'ocean_material'),r.ocean_material);
 assert.equal(themeValue(store.doc,'relief_profile'),r.relief_profile);
 for(const f of ['surface','land','ocean','finish']){
  const material=r[`${f==='finish'?'cartographic_finish':f+'_material'}`];
  assert(MATERIAL_IDS.includes(material),`${id} ${f}`);
  const strength=r[f==='finish'?'finish_strength':f==='surface'?'surface_strength':f+'_material_strength'];assert(strength>=0&&strength<=1);
  if(material!=='none'){
   const path=new URL('../assets/look-materials/'+material+'.png',import.meta.url);
   assert(existsSync(path),`${id} missing ${path}`);
   const buf=readFileSync(path);assert.equal(buf.subarray(1,4).toString(),'PNG');
  }
 }
 assert(RELIEF_PROFILES.includes(r.relief_profile));
 assert(r.relief_strength>=0&&r.relief_strength<=1);
 fingerprint.add(JSON.stringify(r));familyCount.add(r.family);
 const old=JSON.stringify(store.doc.scene);store.execute({type:'SetThemeProperty',key:'surface_strength',value:.75});
 store.execute({type:'SetThemeProperty',key:'land_material',value:'paper_foxed'});
 validateDocument(JSON.parse(JSON.stringify(store.doc)));
 store.undo();store.undo();assert.equal(JSON.stringify(store.doc.scene),old);
 assert.equal(themeValue(store.doc,'land_material'),r.land_material);
 store.redo();store.redo();assert.equal(themeValue(store.doc,'land_material'),'paper_foxed');
}
assert.equal(fingerprint.size,36);
assert.equal(familyCount.size,6);
for(const field of ['surface_material','land_material','ocean_material','cartographic_finish']){
 assert.throws(()=>validateThemeField(field,'file:///etc/passwd'));
 validateThemeField(field,'none');validateThemeField(field,null);
}
for(const field of ['surface_strength','land_material_strength','ocean_material_strength','finish_strength','relief_strength']){
 assert.throws(()=>validateThemeField(field,10));validateThemeField(field,0);validateThemeField(field,1);
}
console.log('PASS 1.4.7: 36 unique material recipes, 6 art families, 21 offline tiles, full validation, persistence and undo/redo');
