import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REFERENCE_LOOKS} from '../assets/reference-looks.js';
import {COLORS,newDocument,SceneStore,validateDocument} from '../assets/scene-core.js';
import {paletteFor,themeValue,BUILTIN_LOOK_DEFAULTS} from '../assets/style-resolver.js';
const original=['dark','atlas','tactical','relief','satellite','night','elevation','historical','terrain'];
const audit=JSON.parse(readFileSync(new URL('../docs/SCENE_LOOKS_REFERENCE_AUDIT.json',import.meta.url),'utf8'));
assert.equal(REFERENCE_LOOKS.length,27);
assert.equal(audit.looks.length,27);
assert.equal(new Set(REFERENCE_LOOKS.map(x=>x.id)).size,27);
const paletteKeys=['ocean','land','border','grid','text','accent'];
const looks=[...original,...REFERENCE_LOOKS.map(x=>x.id)];

for(const look of REFERENCE_LOOKS){
 assert.equal(audit.looks.find(x=>x.id===look.id)?.reference_sha256,look.reference_sha256);
 assert(Object.hasOwn(COLORS,look.id));
 for(const key of paletteKeys)assert.match(look.palette[key],/^#[0-9a-f]{6}$/i);
 assert.equal(look.group,'Reference Collection');
 assert(look.description.length>20 && look.limitation.length>20);
 assert(BUILTIN_LOOK_DEFAULTS[look.id]);
}
for(const key of looks){
 const store=new SceneStore(newDocument());
 const initialIds=Object.keys(store.doc.objects).sort();const initialRoots=[...store.doc.scene.root_ids];
 store.execute({type:'ApplyTheme',id:key});
 assert.equal(store.doc.theme.id,key);
 assert.deepEqual(Object.keys(store.doc.objects).sort(),initialIds,'Applying theme must never add/map objects');
 assert.deepEqual(store.doc.scene.root_ids,initialRoots);
 assert(Object.hasOwn(paletteFor(store.doc),'ocean'));
 assert.equal(store.doc.theme.overrides?.border_color,undefined,'New look must clear prior global override');
 validateDocument(store.doc);
 validateDocument(JSON.parse(JSON.stringify(store.doc)));
 store.undo();assert.equal(store.doc.theme.id,'dark');store.redo();assert.equal(store.doc.theme.id,key);
 if(REFERENCE_LOOKS.some(x=>x.id===key)){
  const spec=REFERENCE_LOOKS.find(x=>x.id===key);
  assert.equal(themeValue(store.doc,'texture_source'),spec.defaults.texture_source);
  assert.equal(themeValue(store.doc,'atmosphere_vignette'),spec.defaults.atmosphere_vignette);
 }
}
const referenceFingerprints=REFERENCE_LOOKS.map(x=>JSON.stringify([x.palette,x.defaults]));
assert.equal(new Set(referenceFingerprints).size,27,'All reference looks require distinct real palette/render settings');
console.log('PASS CartoRig 1.4.6: 9 original + 27 reference-based, distinct, real theme presets; 36 reversible project round-trips');
