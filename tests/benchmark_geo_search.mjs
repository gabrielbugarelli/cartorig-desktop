import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {GeoCatalog} from '../assets/geo-catalog.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const t=performance.now();
let geo=new GeoCatalog(read('../assets/countries.json'),read('../assets/geodata/localities.json'));
geo.setUnavailableStates(read('../assets/geodata/admin1-names.json'));
geo.install('br-states-bundled.geojson',read('../assets/geodata/br_states.geojson'),'State');
geo.install('ne_110m_populated_places_bundled.geojson',read('../assets/geodata/cities_world.geojson'),'City');
geo.install('ne_10m_admin1_world.geojson',read('../assets/geodata/admin1_world.geojson'),'State');
geo.install('ne_10m_populated_places_world.geojson',read('../assets/geodata/cities_world_full.geojson'),'City');
console.log(`All real datasets loaded + indexed in ${(performance.now()-t).toFixed(0)} ms, entries=${geo.entries.length}, heap=${Math.round(process.memoryUsage().heapUsed/1024/1024)} MiB, postings=${geo._searchBigrams.size}`);
const queries=['','M','Mun','Munique','Baviera','São Paulo','Ontário','Quebec','California','Berlin','sao paulo'];
for(const q of queries){
 const measurements=[];let res;
 for(let i=0;i<15;i++){geo._queryCache.clear();const a=performance.now();res=geo.searchPage(q,'All','',20,'',0);measurements.push(performance.now()-a)}
 measurements.sort((a,b)=>a-b);
 console.log(`${q.padEnd(12)} count=${res.total.toString().padStart(5)}, p50=${measurements[7].toFixed(2)} ms, max=${measurements.at(-1).toFixed(2)} ms`);
 if(q==='Munique')assert.equal(res.items[0].type,'City');
}
const paged=geo.searchPage('São Paulo','All','',1);
assert.ok(paged.total>=2);
assert.ok(geo.searchPage('São Paulo','All','',1,'',1).items[0]);
const first=geo.search('Baviera','State')[0];assert.equal(first.name,'Bavaria');
console.log('BENCHMARK PASS');
