/* Country identity regression: Natural Earth 110m country ISO_A3=-99. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GeoCatalog,normalizeCountryIds,countryForRegion,canonicalCountryId} from '../assets/geo-catalog.js';
import {newDocument,madeObject,SceneStore} from '../assets/scene-core.js';
import {hitTest,project,pointInside} from '../assets/scene-renderer.js';
import {serializeVectorScene} from '../assets/production-vector.js';
const raw=JSON.parse(readFileSync(new URL('../assets/countries.json',import.meta.url)));
const countries=normalizeCountryIds(raw),geo=new GeoCatalog(countries);
const ambiguous=raw.filter(c=>c.iso==='-99');
assert.deepEqual(ambiguous.map(c=>c.name),['Norway','France','N. Cyprus','Somaliland','Kosovo']);
assert.equal(new Set(countries.map(c=>c.iso)).size,countries.length);
assert.equal(geo.lookup('ne_admin0_110m','-99'),null);
assert.notEqual(canonicalCountryId(ambiguous[0]),canonicalCountryId(ambiguous[1]));
assert.equal(geo.search('France','Country')[0].id,countries.find(c=>c.name==='France').iso);
function region(name,id,sourceName=name){
 return madeObject('Region',name,{region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:id},geo_source_info:{name:sourceName,dataset_id:'ne_admin0_110m',feature_id:id},style:{fill_color:'#e47a58',fill_opacity:.8,stroke_width:2}});
}
const france=region('France','-99');
const norway=region('Norway','-99');
assert.equal(countryForRegion(france,countries,geo)?.name,'France');
assert.equal(countryForRegion(norway,countries,geo)?.name,'Norway');
assert.equal(countryForRegion(region('Renamed','-99','France'),countries,geo)?.name,'France');
assert.equal(countryForRegion(region('Unknown','-99'),countries,geo),null);
assert.equal(countryForRegion(region('France',canonicalCountryId(ambiguous[1])),raw,geo)?.name,'France');
const actual=countryForRegion(france,countries,geo);
assert.ok(pointInside(2.4,46.9,actual));
assert.ok(!pointInside(2.4,46.9,countryForRegion(norway,countries,geo)));
const doc=newDocument();
doc.camera={projection:'equirectangular',center_lon:15,center_lat:53,zoom:3.5,bearing:0};
doc.objects[france.id]=france;doc.scene.root_ids.push(france.id);
const store=new SceneStore(doc);assert.equal(store.doc.objects[france.id].source.feature_id,'-99');
let [x,y]=project(doc,2.4,46.9,1920,1080);
assert.equal(hitTest(doc,countries,x,y,1920,1080,geo),france.id);
[x,y]=project(doc,10,62,1920,1080);
assert.notEqual(hitTest(doc,countries,x,y,1920,1080,geo),france.id);
const vector=serializeVectorScene(doc,countries,geo,1920,1080,{onlyIds:[france.id]});
assert.ok(JSON.stringify(vector).includes(france.id));
console.log('COUNTRY COLLISION regression PASS: France / Norway / old saves / hit testing / vector');
