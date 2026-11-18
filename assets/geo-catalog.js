/* CartoRig 1.2 Geographic Catalog — offline typed search, datasets and validation. MIT. */
export const geoNormalize = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const GEO_TYPES = ['All','Continent','Country','State','City'];
// Editorial aliases (search keys, not fabricated geometry). Canonical source names remain unchanged.
const aliasGeo = {
  'bavaria':['Baviera','Bayern'], 'bayern':['Baviera','Bavaria'],
  'munich':['Munique','München','Munchen'], 'munchen':['Munique','München','Munich'],
  'vienna':['Viena','Wien'], 'cologne':['Colônia','Köln','Koln'],
  'berlin':['Berlim'], 'hamburg':['Hamburgo'],
  'lisbon':['Lisboa'], 'london':['Londres'], 'paris':['Paris'],
  'new york':['Nova York'], 'moscow':['Moscou','Moskva'],
  'sao paulo':['São Paulo'], 'rio de janeiro':['Rio de Janeiro'],
  'quebec':['Québec'], 'ontario':['Ontário'], 'california':['Califórnia'],
  'queensland':['Queensland'], 'tokyo':['Tóquio'], 'rome':['Roma'],
  'prague':['Praga','Praha'], 'warsaw':['Varsóvia','Warszawa'],
  'nuremberg':['Nuremberga','Nürnberg'], 'dusseldorf':['Düsseldorf'],
};
const displayGeo = {
  'bavaria':'Baviera (Bayern)', 'bayern':'Baviera (Bayern)',
  'munich':'Munique (München)', 'munchen':'Munique (München)',
  'ontario':'Ontário (Ontario)', 'quebec':'Quebec', 'california':'Califórnia (California)',
};
export function geoDisplayName(entry){return displayGeo[geoNormalize(entry?.name)]||entry?.name||'';}
const displayCountry={Germany:'Alemanha',Brazil:'Brasil',Canada:'Canadá','United States of America':'Estados Unidos',France:'França',Spain:'Espanha',Italy:'Itália',Australia:'Austrália',India:'Índia',Russia:'Rússia',Austria:'Áustria',China:'China',Japan:'Japão','United Kingdom':'Reino Unido',Ukraine:'Ucrânia',Switzerland:'Suíça',Poland:'Polônia',Netherlands:'Países Baixos',Portugal:'Portugal',Belgium:'Bélgica',Argentina:'Argentina',Mexico:'México',Norway:'Noruega',Sweden:'Suécia'};
export function geoDisplayParent(parent){let loc=displayCountry[parent];return loc&&loc!==parent?`${loc} (${parent})`:parent;}
function extraAliases(name,p={}) {
 const fields=Object.entries(p).filter(([k,v])=>/^(name($|_|par|alt|ascii|local)|ls_name|meganame|postal|iso_3166_2)/i.test(k)&&typeof v==='string'&&v.trim()).map(([,v])=>v);
 return [...fields,...(aliasGeo[geoNormalize(name)]||[])];
}
export const worldContinents=['Africa','Asia','Europe','North America','South America','Oceania'];
const aliasCountry={'Brazil':['Brasil'],'Russia':['Rússia'],'Ukraine':['Ucrânia'],'Germany':['Alemanha'],'Spain':['Espanha'],'United States of America':['Estados Unidos','EUA','USA'],'United Kingdom':['Reino Unido','Inglaterra'],'France':['França'],'Poland':['Polônia'],'China':['China'],'Iran':['Irã'],'South Korea':['Coreia do Sul'],'North Korea':['Coreia do Norte'],'Saudi Arabia':['Arábia Saudita'],'Japan':['Japão'],'Turkey':['Turquia'],'Sweden':['Suécia'],'Greece':['Grécia'],'Netherlands':['Holanda'],'Egypt':['Egito'],'Australia':['Austrália'],'India':['Índia']};
const nameOf=p=>p.name_en||p.NAME_EN||p.name||p.NAME||p.NAME_1||p.nameascii||p.NAMEASCII||p.nome||p.NOME||p.admin||p.ADMIN||'';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function inspectGeometry(g,expect){if(!g||typeof g!=='object')return false;if(g.type==='Point')return Array.isArray(g.coordinates)&&g.coordinates.length>=2&&finite(g.coordinates[0])&&finite(g.coordinates[1])&&Math.abs(g.coordinates[0])<=180&&Math.abs(g.coordinates[1])<=90 && (!expect||expect==='Point');
 if(!['Polygon','MultiPolygon','LineString','MultiLineString'].includes(g.type))return false;if(expect==='Polygon'&&!['Polygon','MultiPolygon'].includes(g.type))return false;
 let total=0;function validate(x,depth){if(total>4_000_000)return false;if(depth===0){total++;return Array.isArray(x)&&x.length>=2&&finite(x[0])&&finite(x[1])&&Math.abs(x[0])<=180.001&&Math.abs(x[1])<=90.001}return Array.isArray(x)&&x.length>0&&x.every(v=>validate(v,depth-1));}
 return validate(g.coordinates,{Polygon:2,MultiPolygon:3,LineString:1,MultiLineString:2}[g.type]);}
const allPoints=g=>{if(!g)return[];let parts=g.type==='Point'?[[g.coordinates]]:g.type==='Polygon'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];return parts.flat();};
export function featureBounds(g){const b={minx:Infinity,miny:Infinity,maxx:-Infinity,maxy:-Infinity};for(const p of allPoints(g)){if(!Array.isArray(p))continue;b.minx=Math.min(b.minx,p[0]);b.maxx=Math.max(b.maxx,p[0]);b.miny=Math.min(b.miny,p[1]);b.maxy=Math.max(b.maxy,p[1]);}return b;}
// Minimal circular longitude interval, preventing dateline-spanning regions from
// being incorrectly framed as an almost-worldwide bounding rectangle.
export function featureFocusBounds(geometry){
 const box=featureBounds(geometry);if(!Number.isFinite(box.minx))return box;
 let parts=allPoints(geometry),lons=[];
 for(const pt of parts){if(Array.isArray(pt)&&Number.isFinite(pt[0]))lons.push(((pt[0]%360)+360)%360);}
 if(lons.length<2)return box;
 lons.sort((a,b)=>a-b);let largest=-1,index=0;
 for(let i=0;i<lons.length;i++){let gap=(i===lons.length-1?lons[0]+360:lons[i+1])-lons[i];if(gap>largest){largest=gap;index=i;}}
 let width=360-largest;if(width<0||width>=box.maxx-box.minx-1e-8)return box;
 let lo=lons[(index+1)%lons.length],center=((lo+width/2+180)%360+360)%360-180;
 return {minx:center-width/2,maxx:center+width/2,miny:box.miny,maxy:box.maxy};
}
export function inferGeoType(fileName){let s=fileName.toLowerCase();return /admin[_-]?1|states|provinces/.test(s)?'State':/populated|places|cities/.test(s)?'City':/rivers|river/.test(s)?'River':/lake/.test(s)?'Lake':/coast/.test(s)?'Coastline':/admin[_-]?0|countries/.test(s)?'Country':null;}
export class GeoCatalog {
 constructor(countries=[],seeds=[]){this.countries=countries;this.countryContinent=new Map(countries.map(c=>[geoNormalize(c.name),c.continent||'']));this.datasets=new Map();this.entries=[];this.version=0;this.setSeedCities(seeds);this.unavailableStates=[];this.rebuild();}
 setUnavailableStates(entries){this.unavailableStates=entries.filter(x=>x.name&&x.type==='State'&&x.parent).map(x=>({...x,source_id:x.source_id||'metadata-only',geometry_type:'Unavailable'}));this.rebuild();}
 setSeedCities(seeds){this.seedCities=seeds.filter(e=>typeof e.name==='string'&&finite(e.lon)&&finite(e.lat)&&Math.abs(e.lon)<=180&&Math.abs(e.lat)<=90).map(e=>({...e,type:'City',source_id:e.source_id||'curated-location-anchors',geometry_type:'Point',geometry:{type:'Point',coordinates:[e.lon,e.lat]},aliases:[...(e.aliases||[]),...extraAliases(e.name)],id:e.id||`seed:${e.name}:${e.parent||''}`}));}
 install(fileName,content,type=null){if(!content||content.type!=='FeatureCollection'||!Array.isArray(content.features))throw Error('Expected a GeoJSON FeatureCollection');const kind=type&&type!=='Auto'?type:inferGeoType(fileName);if(!kind||!['Country','State','City','River','Lake','Coastline'].includes(kind))throw Error('Choose an explicit geographic dataset type');if(content.features.length>20000)throw Error('Dataset exceeds 20,000 features; preprocess it first');
 let features=[];const usedIds=new Set();const scale=(fileName.match(/(?:^|\D)(10m|50m|110m)(?:\D|$)/i)||[])[1]||'custom';for(let i=0;i<content.features.length;i++){
  let f=content.features[i],p=f.properties||{},g=f.geometry;if(!inspectGeometry(g,kind==='City'?'Point':(kind==='State'||kind==='Country'||kind==='Lake')?'Polygon':null))continue;const sourceLabel=String(p.iso_3166_2||p.adm1_code||p.ne_id||f.id||i+1);const name=String(nameOf(p)||(kind==='State'?`Unnamed subdivision [${sourceLabel}]`:`Unnamed feature [${sourceLabel}]`));let id=String(kind==='Country'?(p.ISO_A3||p.ADM0_A3||p.iso_a3||p.ADM0_A3_US||p.SOV_A3||f.id||name):kind==='State'?(p.iso_3166_2||p.ISO_3166_2||p.gn_id||p.GN_ID||p.sigla||p.SIGLA||p.cd_geocuf||f.id||`${p.admin||p.ADMIN||''}:${name}`):f.id??`${name}:${i}`).trim();let parent=String(p.admin||p.ADMIN||p.geonunit||p.GEONUNIT||p.adm0name||p.ADM0NAME||p.sov0name||p.SOV0NAME||p.country||p.COUNTRY||(kind==='State'&&p.cd_geocuf&&p.sigla?'Brazil':''));
  if(kind==='City'&&!parent)parent=String(p.adm0name||p.ADM0NAME||'');
  if(kind==='State' && /admin1_world|global_admin1/i.test(fileName)){id=String(p.ne_id??p.NE_ID??`${p.adm0_a3||p.ADM0_A3||parent}:${p.iso_3166_2||name}:${i}`);}
  if(usedIds.has(id))id+=`:${i}`;usedIds.add(id);
  let entry={id,source_id:p.source_id||`geo_${scale}_${kind.toLowerCase()}`,source_version:String(p.source_version||'unknown'),type:kind,name,parent,iso:String(p.iso_a3||p.ISO_A3||p.adm0_a3||p.ADM0_A3||''),geometry:g,geometry_type:g.type==='Point'?'Point':(['Polygon','MultiPolygon'].includes(g.type)?'Polygon':'Line'),scale,source_file:fileName,bbox:featureBounds(g),aliases:extraAliases(name,p),rank:finite(p.scalerank)?p.scalerank:(finite(p.SCALERANK)?p.SCALERANK:50)};
  features.push(entry);
 }if(!features.length)throw Error('No valid geometries of the selected type found');let suffix=String(fileName).replace(/\.geojson$/i,'').replace(/[^a-z0-9]+/gi,'_').slice(0,65).toLowerCase();let datasetId=`${kind.toLowerCase()}_${scale}_${suffix}`;this.datasets.set(datasetId,{kind,scale,features,source_file:fileName});this.rebuild();return {datasetId,kind,accepted:features.length,rejected:content.features.length-features.length};
 }
 remove(datasetId){this.datasets.delete(datasetId);this.rebuild();}
 rebuild(){
  let entries=worldContinents.map(name=>({id:`continent:${name}`,name,type:'Continent',geometry_type:'Polygon',source_id:'ne_admin0_110m',parent:'World',rank:0}));
  for(let c of this.countries)entries.push({id:c.iso,name:c.name,type:'Country',parent:c.continent||'',iso:c.iso,source_id:'ne_admin0_110m',geometry_type:'Polygon',geometry:c.geometry,rank:1,aliases:aliasCountry[c.name]||[]});
  entries.push(...this.seedCities);entries.push(...this.unavailableStates);
  const index=new Map(),cityIndex=new Map();
  for(let i=0;i<entries.length;i++){if(entries[i].type==='State')index.set(`${geoNormalize(entries[i].parent)}:${geoNormalize(entries[i].name)}`,i);if(entries[i].type==='City')cityIndex.set(`${geoNormalize(entries[i].parent)}:${geoNormalize(entries[i].name)}`,i);}
  for(let ds of this.datasets.values())for(let e of ds.features){
    if(e.type==='Country'){let old=entries.find(x=>x.type==='Country'&&(x.id===e.id||x.name===e.name));if(old)old.detail_data=e;continue;}
    if(e.type==='State'){
      let key=`${geoNormalize(e.parent)}:${geoNormalize(e.name)}`;
      if(index.has(key)){
        // An actual Admin 1 source can contain multiple different polygons with
        // the same English name and parent (e.g. Kyiv city and Kyiv oblast,
        // Latvia municipalities, etc.). Never drop one of those distinct IDs.
        // Only supersede a lower-resolution or editorial fallback from a
        // different dataset; preserve all genuine features of the same source.
        const previous=entries[index.get(key)];
        if(previous?.source_file && previous.source_file!==e.source_file && previous.scale!==e.scale){
          entries[index.get(key)]=e;continue;
        }
      }
      index.set(key,entries.length);
    }
    if(e.type==='City'){let key=`${geoNormalize(e.parent)}:${geoNormalize(e.name)}`;let previous=cityIndex.get(key);if(previous!==undefined){let old=entries[previous];if(!old.source_file||old.source_file!==e.source_file){entries[previous]={...e,aliases:[...(old.aliases||[]),...(e.aliases||[])]};continue;}}cityIndex.set(key,entries.length);}
    if(['State','City'].includes(e.type))entries.push(e);
  }
  // Once a real polygon with the same administrative identity is available,
  // remove any metadata-only placeholder, even where the source name differs.
  let confirmed=new Set(entries.filter(e=>e.type==='State'&&e.geometry).map(e=>`${geoNormalize(e.parent)}:${geoNormalize(e.name)}`));
  entries=entries.filter(e=>e.geometry_type!=='Unavailable'||!confirmed.has(`${geoNormalize(e.parent)}:${geoNormalize(e.name)}`));
  this.entries=entries;this.version++;this.details=[...this.datasets.values()].flatMap(d=>d.features);
  this.buildSearchIndex();
  this.buildSpatialIndex();
 }

 // Build only after a dataset changes. The index contains normalized names/aliases,
 // NEVER polygon coordinates: typing in the sidebar must not visit geometry vertices.
 buildSearchIndex(){
  const docs=[],grams=new Map(),initials=new Map(),byId=new Map();
  const addPosting=(map,key,id)=>{let values=map.get(key);if(!values)map.set(key,values=[]);values.push(id);};
  for(const e of this.entries){
   const id=docs.length,name=geoNormalize(e.name),aliases=[...new Set((e.aliases||[]).map(geoNormalize).filter(Boolean))];
   const ids=[geoNormalize(e.id),geoNormalize(e.iso)].filter(Boolean);
   const fields=[...new Set([name,...aliases,...ids].filter(Boolean))];
   const postingKeys=new Set(),firstLetters=new Set();
   for(const field of fields){
    // Trigram and bigram postings make substring search possible without a
    // complete O(N * aliases) scan for each keystroke. Deduplicate per feature.
    for(let i=0;i+1<field.length;i++)postingKeys.add(field.slice(i,i+2));
    for(const word of field.split(/\s+/))if(word)firstLetters.add(word[0]);
   }
   for(const key of postingKeys)addPosting(grams,key,id);
   for(const letter of firstLetters)addPosting(initials,letter,id);
   const parent=geoNormalize(e.parent),continent=e.type==='Continent'?e.name:e.type==='Country'?e.parent:this.countryContinent.get(parent)||'';
   docs.push({entry:e,name,aliases,fields,parent,continent,rank:e.rank??40});
   if(e.id!==undefined){const k=String(e.id);if(!byId.has(k))byId.set(k,[]);byId.get(k).push(e);}
  }
  // Drop JS array capacity overhead on posting lists after the one-time build.
  for(const [k,v] of grams)grams.set(k,Uint32Array.from(v));
  for(const [k,v] of initials)initials.set(k,Uint32Array.from(v));
  this._searchDocs=docs;this._searchBigrams=grams;this._searchInitials=initials;
  this._entryById=byId;this._queryCache=new Map();
  this._overview={states:this.entries.filter(e=>e.type==='State'&&!!e.geometry).length,cities:this.entries.filter(e=>e.type==='City'&&!!e.geometry).length,types:new Set(this.details.map(e=>e.type))};
  // Used only when a caller explicitly asks to browse without a query.
  const featured=['Brazil','United States of America','Russia','Ukraine','China','France','South America'];
  this._browseOrder=docs.map((_,i)=>i).sort((i,j)=>{
   const a=docs[i],b=docs[j],ai=featured.indexOf(a.entry.name),bi=featured.indexOf(b.entry.name);
   return (ai<0?99:ai)-(bi<0?99:bi)||a.rank-b.rank||a.name.localeCompare(b.name);
  });
 }
 // Simple uniform grid. Every intersecting cell holds a reference to the
 // original polygon, never a copy of its coordinates; rebuild on import/remove.
 buildSpatialIndex(){
  const grid=new Map(),bin=(v,base,n)=>Math.max(0,Math.min(n-1,Math.floor((v+base)/10)));
  for(const e of this.entries){
   if(e.type!=='State'||!e.geometry||!e.bbox)continue;
   const b=e.bbox,x0=bin(b.minx,180,36),x1=bin(b.maxx,180,36),y0=bin(b.miny,90,18),y1=bin(b.maxy,90,18);
   for(let iy=y0;iy<=y1;iy++)for(let ix=x0;ix<=x1;ix++){
    const cell=iy*36+ix;let slot=grid.get(cell);if(!slot)grid.set(cell,slot=[]);slot.push(e);
   }
  }
  this._stateSpatialGrid=grid;
 }
 // Returns the same visible states as the earlier O(all states) bbox check,
 // after using the grid to avoid visiting geographically irrelevant features.
 getVisibleStates(centerLon,centerLat,spanLon,spanLat){
  const grid=this._stateSpatialGrid;if(!grid)return[];
  const lonBins=[];
  for(let ix=0;ix<36;ix++){
   const midpoint=-175+ix*10;
   const delta=Math.abs((((midpoint-centerLon+540)%360)+360)%360-180);
   if(delta<=spanLon+10)lonBins.push(ix);
  }
  const y0=Math.max(0,Math.floor((centerLat-spanLat+90)/10)-1);
  const y1=Math.min(17,Math.floor((centerLat+spanLat+90)/10)+1);
  const visited=new Set(),results=[];
  for(let y=y0;y<=y1;y++)for(const x of lonBins){
   for(const e of grid.get(y*36+x)||[]){
    if(visited.has(e))continue;visited.add(e);
    const b=e.bbox;
    if(Math.abs(b.maxy+b.miny-2*centerLat)/2>=spanLat+(b.maxy-b.miny)/2)continue;
    if(![0,-360,360].some(shift=>Math.abs(b.minx+b.maxx-2*(centerLon+shift))/2<spanLon+(b.maxx-b.minx)/2))continue;
    results.push(e);
   }
  }
  return results;
 }
 // Stable pagination: the exact match count is independent of the page size.
 // Search caching is invalidated on every import, removal or dataset refresh.
 searchPage(query='',type='All',continent='',limit=20,country='',offset=0){
  const q=geoNormalize(query),parts=q.split(/\s+/).filter(Boolean);
  const safeLimit=Math.max(1,Math.min(200,Math.trunc(Number(limit)||20)));
  const safeOffset=Math.max(0,Math.trunc(Number(offset)||0));
  const c=geoNormalize(country),key=JSON.stringify([q,type,continent,c,safeLimit,safeOffset]);
  if(this._queryCache.has(key))return this._queryCache.get(key);
  const docs=this._searchDocs||[];
  let candidates;
  if(parts.length){
   let best=null;
   // The shortest posting list is sufficient: a full field-level verification
   // below checks every term and does not return approximate matches.
   for(const part of parts){
    if(part.length===1){const p=this._searchInitials.get(part);if(!p){candidates=[];break;}if(best===null||p.length<best.length)best=p;}
    else for(let i=0;i+1<part.length;i++){
     const p=this._searchBigrams.get(part.slice(i,i+2));
     if(!p){candidates=[];break;}
     if(best===null||p.length<best.length)best=p;
    }
    if(candidates)break;
   }
   if(!candidates)candidates=best||[];
  }else candidates=this._browseOrder||[];
  const matches=[];
  for(const id of candidates){
   const d=docs[id],e=d.entry;
   if(type!=='All'&&e.type!==type)continue;
   if(c&&!(e.type==='Country'&&d.name===c)&&!(e.type!=='Country'&&d.parent===c))continue;
   if(continent&&d.continent&&d.continent!==continent)continue;
   const contains=part=>d.fields.some(field=>field.includes(part));
   if(parts.length===1&&parts[0].length===1){
    if(!d.fields.some(field=>field.split(/\s+/).some(word=>word.startsWith(parts[0]))))continue;
   }else if(!parts.every(contains))continue;
   const rank=!q?d.rank:d.name===q?0:d.aliases.includes(q)?0:d.name.startsWith(q)?1:d.aliases.some(a=>a.startsWith(q))?2:d.name.includes(q)?3:d.aliases.some(a=>a.includes(q))?4:5;
   matches.push({id,rank});
  }
  // Avoid unrelated weak matches once a precise name/alias match exists.
  // Example: searching 'Baviera' must not additionally surface Munich solely
  // because its Italian alternative is 'Monaco di Baviera'.
  if(q.length>=3 && matches.some(m=>m.rank<=2)){
   for(let i=matches.length-1;i>=0;i--)if(matches[i].rank>=3)matches.splice(i,1);
  }
  if(parts.length)matches.sort((a,b)=>a.rank-b.rank||docs[a.id].entry.type.localeCompare(docs[b.id].entry.type)||docs[a.id].name.localeCompare(docs[b.id].name)||a.id-b.id);
  const total=matches.length,items=matches.slice(safeOffset,safeOffset+safeLimit).map(x=>docs[x.id].entry);
  const result={items,total,offset:safeOffset,limit:safeLimit,hasMore:safeOffset+items.length<total};
  // Bound retained result arrays. No geometry is copied into cached pages.
  if(this._queryCache.size>=48)this._queryCache.delete(this._queryCache.keys().next().value);
  this._queryCache.set(key,result);
  return result;
 }
 search(query='',type='All',continent='',limit=180,country=''){return this.searchPage(query,type,continent,limit,country).items;}
 lookup(sourceId,featureId){
  if(sourceId==='ne_admin0_110m')return this.countries.find(c=>c.iso===featureId);
  if(sourceId?.startsWith('continent:'))return null;
  const entries=this._entryById?.get(String(featureId))||[];
  return entries.find(e=>!sourceId||e.source_id===sourceId)||null;
 }
 getCountriesForDraw(zoom=1){let scale=zoom>=5?'10m':zoom>=2?'50m':'110m';let datasets=[...this.datasets.values()].filter(d=>d.kind==='Country');let priority=scale==='10m'?['10m','50m']:scale==='50m'?['50m','10m']:[];if(!priority.length||!datasets.length)return this.countries;let detailed=new Map();for(let scale of priority)for(let ds of datasets.filter(d=>d.scale===scale))for(let f of ds.features){detailed.set(f.id,f);detailed.set(geoNormalize(f.name),f);}return this.countries.map(c=>{const d=detailed.get(c.iso)||detailed.get(geoNormalize(c.name));return d?{...c,geometry:d.geometry}:c;});}
 dataStatus(){return [...this.datasets.entries()].map(([id,d])=>({id,type:d.kind,scale:d.scale,count:d.features.length,filename:d.source_file}));}
}
export function splitAntimeridianLine(points){let segments=[],current=[];for(let i=0;i<points.length;i++){let p=points[i];if(!current.length){current=[p];continue;}let a=current[current.length-1];let diff=p[0]-a[0];if(Math.abs(diff)>180){let adjusted=p[0]-(diff>0?360:-360),edge=diff>0?-180:180,t=(edge-a[0])/(adjusted-a[0]);if(t>=0&&t<=1){let y=a[1]+(p[1]-a[1])*t;current.push([edge,y]);segments.push(current);current=[[-edge,y],p];continue;}}current.push(p);}if(current.length)segments.push(current);return segments;}
