/* 1.2.3 optimization regression; all assertions use actual offline Natural Earth files. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {GeoCatalog,geoNormalize} from '../assets/geo-catalog.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const geo=new GeoCatalog(read('../assets/countries.json'),read('../assets/geodata/localities.json'));
geo.setUnavailableStates(read('../assets/geodata/admin1-names.json'));
geo.install('br-states-bundled.geojson',read('../assets/geodata/br_states.geojson'),'State');
geo.install('ne_110m_populated_places_bundled.geojson',read('../assets/geodata/cities_world.geojson'),'City');
geo.install('ne_10m_admin1_world.geojson',read('../assets/geodata/admin1_world.geojson'),'State');
geo.install('ne_10m_populated_places_world.geojson',read('../assets/geodata/cities_world_full.geojson'),'City');
assert.equal(geo.entries.filter(e=>e.type==='State'&&e.source_file==='ne_10m_admin1_world.geojson').length,4596);
assert.equal(geo.entries.filter(e=>e.type==='City'&&e.source_file==='ne_10m_populated_places_world.geojson').length,7342);
for(const [queries,type,country] of [
 [['Munique','München','Munich'],'City','Germany'],
 [['Baviera','Bayern','Bavaria'],'State','Germany'],
 [['Ontario','Ontário'],'State','Canada'],
 [['São Paulo','sao paulo','SÃO PAULO'],'State','Brazil']
]){
 const results=queries.map(q=>geo.searchPage(q,type,'',20,country));
 for(let i=0;i<results.length;i++){
  assert.ok(results[i].total>0,`No results for ${queries[i]}`);
  assert.ok(results[i].items.length<=20);
  assert.equal(results[i].items[0].id,results[0].items[0].id,`Alias differs: ${queries[i]}`);
 }
}
const distinct=geo.searchPage('São Paulo','All','',20);
assert.ok(distinct.items.some(e=>e.type==='State')&&distinct.items.some(e=>e.type==='City'));
const germany=geo.searchPage('Munique','City','',20,'Germany');
assert.equal(germany.items.length,1);
assert.equal(geo.searchPage('Munique','City','',20,'France').items.length,0);
for(const q of ['a','m','Mun','Munique','Baviera','São Paulo','Germany']){
 geo._queryCache.clear();let start=performance.now();let r=geo.searchPage(q,'All','',20);let elapsed=performance.now()-start;
 assert.ok(elapsed<50,`Search ${q} took ${elapsed.toFixed(1)}ms (expected <50)`);
 assert.ok(r.items.length<=20);
 console.log(`Search ${q.padEnd(10)} ${(elapsed).toFixed(2)}ms (${r.total} results)`);
}
// Check every city is available through intentional filtered browsing.
const pages=[];let first=geo.searchPage('','City','',200);
for(let offset=0;offset<first.total;offset+=200){const page=geo.searchPage('','City','',200,'',offset);pages.push(...page.items);}
assert.equal(pages.length,first.total);
assert.equal(new Set(pages).size,pages.length);
assert.ok(pages.length>=7342);
// Spatial acceleration must be identical to previous bbox predicate for random
// camera poses, including both sides of the antimeridian and high zoom levels.
const allStates=geo.entries.filter(e=>e.type==='State'&&e.geometry&&e.bbox);
const oldVisible=(lon,lat,sx,sy)=>allStates.filter(x=>{
 const b=x.bbox;
 return Math.abs(b.maxy+b.miny-2*lat)/2<sy+(b.maxy-b.miny)/2&&[-360,0,360].some(shift=>Math.abs(b.minx+b.maxx-2*(lon+shift))/2<sx+(b.maxx-b.minx)/2);
});
let seed=29447;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<220;i++){
 const lon=i<4?[-179.9,179.9,0,89][i]:random()*360-180;
 const lat=i<4?0:random()*170-85;
 const sx=i<4?20:Math.min(180,5+random()*110),sy=i<4?10:Math.min(90,5+random()*70);
 const expected=new Set(oldVisible(lon,lat,sx,sy));const found=geo.getVisibleStates(lon,lat,sx,sy);
 assert.equal(found.length,expected.size,`Viewport ${i}: accelerated count=${found.length} vs exact ${expected.size}`);
 for(const e of found)assert.ok(expected.has(e),`Viewport ${i} unexpected ${e.name}`);
}
console.log('OPTIMIZED WORLD SEARCH + SPATIAL INDEX: PASS');
