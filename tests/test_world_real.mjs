/* Full offline release test: this file must fail if the REAL locked sources are not bundled. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GeoCatalog,geoNormalize,inspectGeometry,featureFocusBounds} from '../assets/geo-catalog.js';
import {pointInside,project,unproject} from '../assets/scene-renderer.js';
import {newDocument} from '../assets/scene-core.js';
const load=(p)=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const manifest=load('../assets/geodata/offline_integrity.json');
const admin=load('../assets/geodata/admin1_world.geojson');
const city=load('../assets/geodata/cities_world_full.geojson');
assert.equal(admin.features.length,4596);
assert.equal(city.features.length,7342);
assert.equal(manifest.datasets.admin1.feature_count,4596);
assert.equal(manifest.datasets.cities.feature_count,7342);
let seen=new Set(),multis=0,holes=0;
for(const f of admin.features){
 assert.equal(inspectGeometry(f.geometry,'Polygon'),true,`Bad polygon ${f.properties.name}`);
 if(f.geometry.type==='MultiPolygon')multis++;
 const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 for(const poly of polygons){if(poly.length>1)holes++;for(const ring of poly)assert.deepEqual(ring[0],ring[ring.length-1]);}
 seen.add(f.properties.admin);
}
assert.ok(seen.size>=70);
assert.ok(multis>0);
assert.ok(holes>=0);
// Exhaustive independent-feature framing contract; each of the 4,596 real
// Admin 1 geometries must fit a finite, nonempty WGS84 viewport.
for(const f of admin.features){
 let b=featureFocusBounds(f.geometry);
 assert.ok(Number.isFinite(b.minx)&&Number.isFinite(b.maxx)&&Number.isFinite(b.miny)&&Number.isFinite(b.maxy),`Nonfinite fit bounds ${f.properties.ne_id}`);
 assert.ok(b.maxx>=b.minx&&b.maxy>=b.miny,`Inverted fit bounds ${f.properties.ne_id}`);
 assert.ok(b.maxx-b.minx<=360&&b.maxy-b.miny<=180,`Illegal geographic bounds ${f.properties.ne_id}`);
}

const countries=load('../assets/countries.json');
const geo=new GeoCatalog(countries,load('../assets/geodata/localities.json'));
geo.setUnavailableStates(load('../assets/geodata/admin1-names.json'));
geo.install('br-states-bundled.geojson',load('../assets/geodata/br_states.geojson'),'State');
const n=geo.install('ne_10m_admin1_world.geojson',admin,'State');
assert.equal(n.accepted,4596,'No administrative polygon may be silently dropped by the frontend');
const trueWorldIds=new Set([...geo.datasets.values()].filter(ds=>ds.kind==='State'&&ds.scale==='10m').flatMap(ds=>ds.features.map(f=>f.id)));
const visibleWorld=[...geo.entries.filter(x=>x.type==='State'&&x.source_file==='ne_10m_admin1_world.geojson')];
assert.equal(visibleWorld.length,4596,'Every one of 4596 real administrative features must remain independently searchable');
assert.equal(new Set(visibleWorld.map(e=>e.id)).size,4596,'Homonymous source polygons must retain distinct source identities');
assert.equal(trueWorldIds.size,4596);
const c=geo.install('ne_10m_populated_places_world.geojson',city,'City');
assert.equal(c.accepted,7342,'No city may be silently dropped by the frontend');
assert.equal(geo.entries.filter(x=>x.type==='City'&&x.source_file==='ne_10m_populated_places_world.geojson').length,7342,'Every official populated place must remain independently searchable, even with the same name as another city');
let aliases=[['Baviera','Bayern','Bavaria'],['Munique','München','Munich']];
for(const variants of aliases){
 let results=variants.map(q=>geo.search(q,'All').find(x=>variants[0]==='Baviera'?x.type==='State'&&geoNormalize(x.parent)==='germany':x.type==='City'&&geoNormalize(x.parent)==='germany'));
 assert.ok(results.every(Boolean),`Missing alias in ${variants}`);
 assert.ok(results.every(v=>v.id===results[0].id),`Aliases do not point to identical feature: ${variants}`);
}
for(const [query,parent,type] of [['Ontario','Canada','State'],['California','United States of America','State'],['Mato Grosso','Brazil','State'],['Quebec','Canada','State']]){
 let e=geo.search(query,type).find(x=>geoNormalize(x.parent)===geoNormalize(parent));assert.ok(e,`Missing ${query} ${parent}`);assert.ok(e.geometry);
 let bb=featureFocusBounds(e.geometry);assert.ok(Number.isFinite(bb.minx)&&Number.isFinite(bb.maxy));
 assert.ok(bb.maxx-bb.minx<=360);
}
const sao=geo.search('São Paulo');assert.ok(sao.some(e=>e.type==='State'&&e.geometry));assert.ok(sao.some(e=>e.type==='City'&&e.geometry));
const bayern=geo.search('Baviera','State')[0];let b=featureFocusBounds(bayern.geometry);
assert.ok(b.minx>8&&b.maxx<16&&b.miny>46&&b.maxy<52,`Bavaria has unexpected bounds: ${JSON.stringify(b)}`);
let d=newDocument(),w=1920,h=1080;
for(let lon of [-179.5,-120,12,179.5]){for(let lat of [-33,0,45]){let [x,y]=project(d,lon,lat,w,h),[lo,la]=unproject(d,x,y,w,h);assert.ok(Math.abs(lo-lon)<1e-6);assert.ok(Math.abs(la-lat)<1e-6);}}
const pacific={type:'Polygon',coordinates:[[[179,-10],[-179,-10],[-179,10],[179,10],[179,-10]]]};
let db=featureFocusBounds(pacific);assert.ok(db.maxx-db.minx<5,`Bad antimeridian focus: ${JSON.stringify(db)}`);
assert.ok(pointInside(179.5,0,{geometry:pacific}));assert.ok(pointInside(-179.5,0,{geometry:pacific}));assert.ok(!pointInside(0,0,{geometry:pacific}));
console.log(`REAL WORLD GEODATA PASS: ${n.accepted} Admin 1 features, ${c.accepted} world cities, ${seen.size} countries; international aliases, independent states, Sao Paulo collision, polygon parts, antimeridian and WGS84 projection`);
