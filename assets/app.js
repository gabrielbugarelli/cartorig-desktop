import {MATERIAL_IDS} from './look-materials.js';
import {setupNavigation} from './navigation-ui.js';
/* CartoRig M0/M1 — three-pane editing UI. No animation engine. MIT. */
import {SceneStore,newDocument,migrateLegacy,validateDocument,madeObject,uuid,treeIds,isVisible,isLocked,normalizeSelection,clamp,clone} from './scene-core.js';
import {renderScene,renderMapLabelLayer,drawPreviewSelection,project,unproject,scaleFor,hitTest,hitTestCandidates,boundsOf,pointInside,polygonCacheStats} from './scene-renderer.js';
import {createPreviewCache,previewBackingScale} from './preview-cache.js';
import {createPreviewScheduler} from './preview-scheduler.js';
import {setupProductionStudio} from './production-studio.js';
import {GeoCatalog,geoNormalize,geoDisplayName,geoDisplayParent,featureBounds,featureFocusBounds,normalizeCountryIds,countryForRegion} from './geo-catalog.js';
import {SHAPES,ROUTE_TYPES,MARKER_SYMBOLS,sanitizeSVG,pointValid,resolveLink} from './creative-engine.js';
import {drawCreative,creativeHandles,settleCreativeAssets} from './creative-renderer.js';
import {creativeInspector} from './creative-inspector.js';
import {setupStyleStudio} from './style-studio.js';
import {resolveStyle} from './style-resolver.js';
import {renderAdvancedInspector} from './style-inspector.js';
const $=id=>document.getElementById(id);
const canvas=$('mapCanvas'),wrap=$('canvasWrap'),ctx=canvas.getContext('2d',{alpha:true});
const currentKey='cartorig-m1-last-project',legacyKey='map-composer-project-v1';
const aliases={'Brazil':['Brasil'],'Russia':['Rússia'],'Ukraine':['Ucrânia'],'Germany':['Alemanha'],'Spain':['Espanha'],'United States of America':['Estados Unidos','EUA','USA'],'United Kingdom':['Reino Unido','Inglaterra'],'France':['França'],'Poland':['Polônia'],'China':['China'],'Iran':['Irã'],'South Korea':['Coreia do Sul'],'North Korea':['Coreia do Norte'],'Saudi Arabia':['Arábia Saudita'],'Japan':['Japão'],'Turkey':['Turquia'],'Sweden':['Suécia'],'Greece':['Grécia'],'Netherlands':['Holanda'],'Egypt':['Egito'],'Australia':['Austrália'],'India':['Índia'],'Argentina':['Argentina']};
const norm=geoNormalize;
let countries=[],byIso=new Map(),images={},store=new SceneStore(),tool='select',routeFrom=null,drag=null,previewW=1,previewH=1,expanded=new Set(),selectedTab='layers',rightTab='styles',toastTimer=0,saveTimer=0,soloId=null,dragPreview=null;
let creativeDraft=null,creativeCursor=null,editHandles=false,editOffset=false,inlineTextEditor=null;
let lastSavedFileName=null,sessionToken="",geo=null,worldAdminState="checking",worldCitiesState="checking",worldAdminCount=0,appReady=false,worldAdminHealth=null,worldCitiesHealth=null,verifiedGeoHealth=null;
const GEO_RESULTS_PAGE=20, GEO_SEARCH_DELAY_MS=180;
let geoSearchOffset=0,geoSearchTimer=null;
window.CartoRig={get ready(){return appReady},get scene(){return clone(store.doc)},get selection(){return [...store.selection]}, get history(){return {undo:store.undoStack.length,redo:store.redoStack.length}},execute:cmd=>exec(cmd),get countryCount(){return countries.length},get geoCatalog(){return geo},get geoDatasets(){return geo?.dataStatus()||[]},get geoIntegrity(){return verifiedGeoHealth},get creativeDraft(){return clone(creativeDraft)},setTool:name=>setTool(name),
 get performance(){return {preview:previewScheduler.getStats(),composition:previewCache.getStats(),polygonCache:{hits:polygonCacheStats.hits,misses:polygonCacheStats.misses},heap:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize}:null}}};
function showToast(s,error=false){let el=$('toast');el.textContent=s;el.hidden=false;el.classList.toggle('error',error);clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4000);}
function status(s){$('status').textContent=s;}
function scheduleCache(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(currentKey,JSON.stringify(store.doc));}catch(e){status('Local recovery cache unavailable');}},350);}
// Native Scene Looks use immutable, version-locked PNGs embedded in the binary.
// All gallery thumbnail presentation is owned by style-studio.js; app.js never
// draws, substitutes or re-encodes Scene Looks during startup or theme changes.
function stateChanged(type){if(type==='change'){scheduleCache();if(appReady)production.scheduleAutosave();}syncUI(type);}
store.onChange=stateChanged;
const styleStudio=setupStyleStudio({getDoc:()=>store.doc,getSelection:()=>store.selection,exec,toast:showToast,downloadable,getToken:()=>sessionToken});
const production=setupProductionStudio({getDoc:()=>store.doc,getSelection:()=>store.selection,execute:cmd=>exec(cmd),getCountries:()=>countries,getImages:()=>images,getToken:()=>sessionToken,replaceDoc:d=>{store.replace(d);setTab('layers')},render:renderScene,settle:settleCreativeAssets,download:downloadable,notify:showToast,status,markSaved:()=>store.markSaved()});
window.CartoRig.production=production;
function exec(command){if(!appReady)return false;try{let done=store.execute(command);if(done){if(['SaveUserStyle','ImportUserStyle','RenameUserStyle','DeleteUserStyle'].includes(command.type))void styleStudio.persistGlobal(command.type==='DeleteUserStyle'?command.id:null);}return done;}catch(e){showToast(e.message,true);status('Action blocked · '+e.message);return false;}}
function select(ids){store.setSelection(ids);if(ids.length){setRightTab('inspector');if(window.CartoRigNavigation?.compact())window.CartoRigNavigation.setRight(true);}}
function topSelection(){return normalizeSelection(store.doc,store.selection);}
function setTab(which){selectedTab=which;for(let t of ['Layers','Geography']){$('tab'+t).classList.toggle('active',t.toLowerCase()===which);$('tab'+t).setAttribute('aria-selected',String(t.toLowerCase()===which));$('tab'+t).tabIndex=t.toLowerCase()===which?0:-1;$('panel'+t).hidden=t.toLowerCase()!==which;}}
function setRightTab(which){rightTab=which;document.body.classList.toggle('show-style-studio',which==='styles');for(let t of ['Inspector','Styles']){$('tab'+t).classList.toggle('active',t.toLowerCase()===which);$('tab'+t).setAttribute('aria-selected',String(t.toLowerCase()===which));$('tab'+t).tabIndex=t.toLowerCase()===which?0:-1;$('panel'+t).hidden=t.toLowerCase()!==which;}}
function bindTabs(){
 $('tabLayers').onclick=()=>setTab('layers');$('tabGeography').onclick=()=>setTab('geography');
 $('tabInspector').onclick=()=>setRightTab('inspector');$('tabStyles').onclick=()=>setRightTab('styles');
 $('styleStudioClose').onclick=()=>window.CartoRigNavigation?.setRight(false);
 for(const [ids,activate] of [[[ 'tabLayers','tabGeography'],setTab],[[ 'tabInspector','tabStyles'],setRightTab]]){
  ids.forEach((id,i)=>$(id).addEventListener('keydown',e=>{
   const next=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:e.key==='Home'?0:e.key==='End'?ids.length-1:null;
   if(next===null)return;e.preventDefault();const target=ids[(next+ids.length)%ids.length];$(target).click();$(target).focus();
  }));
 }
 $('layerTree').addEventListener('keydown',e=>{
  const row=e.target.closest('[role="treeitem"]');if(!row)return;
  const items=[...$('layerTree').querySelectorAll('[role="treeitem"]')];const i=items.indexOf(row);let next=null;
  if(e.key==='ArrowDown')next=items[Math.min(i+1,items.length-1)];
  if(e.key==='ArrowUp')next=items[Math.max(i-1,0)];
  if(e.key==='Home')next=items[0];if(e.key==='End')next=items.at(-1);
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
   const o=store.doc.objects[row.dataset.id];
   if(o?.type==='Group'){
    const expand=e.key==='ArrowRight';if(expand!==expanded.has(o.id)){
     expand?expanded.add(o.id):expanded.delete(o.id);renderTree();next=$('layerTree').querySelector(`[data-id="${o.id}"]`);
    }
   }
  }
  if(e.key==='Enter'||e.key===' '){e.preventDefault();select([row.dataset.id]);next=$('layerTree').querySelector(`[data-id="${row.dataset.id}"]`);}
  if(next){e.preventDefault();for(const item of $('layerTree').querySelectorAll('[role="treeitem"]'))item.tabIndex=-1;next.tabIndex=0;next.focus();}
 });
}
function insertNode(type,fields){let o=madeObject(type,fields?.name||type,fields||{});if(exec({type:'CreateObject',object:o}))setTab('layers');return o;}
function addCountry(iso){let c=byIso.get(iso);if(!c)return;return addGeoEntry({id:c.iso,name:c.name,type:'Country',source_id:'ne_admin0_110m',geometry_type:'Polygon',geometry:c.geometry});}
function addGeoEntry(entry,mode='Marker'){
 if(entry.geometry_type==='Unavailable'||!entry.geometry && entry.type==='State'){showToast('Polygon unavailable. Import a real Admin 1 GeoJSON dataset first.',true);return null;}
 let o=null;
 if(entry.type==='City'){
  let [lon,lat]=entry.geometry?.coordinates||[entry.lon,entry.lat];if(!Number.isFinite(lon)||!Number.isFinite(lat)){showToast('Point coordinates unavailable',true);return null;}
  const origin={name:entry.name,parent:entry.parent,scale:entry.scale||'unknown',dataset_id:entry.source_id,source_version:entry.source_version,feature_id:entry.id,source_file:entry.source_file};
  o=mode==='Label'?insertNode('Label',{name:entry.name,text:entry.name,position_mode:'geo',anchor:{lon,lat},geo_source_info:origin,typography:{font_size:27},style:{text_color:'#f3eee7'}}):insertNode('Marker',{name:entry.name,symbol:'Circle',anchor:{lon,lat},geo_source_info:origin,style:{fill_color:'#e5b467',symbol_size:12}});
 }else if(['Country','State','Continent'].includes(entry.type)){
  let source={dataset_id:entry.source_id||'ne_admin0_110m',feature_id:entry.id,source_version:entry.source_version||'unknown'};
  const fields={name:entry.name,region_kind:entry.type,source,geo_source_info:{name:entry.name,parent:entry.parent||'World',scale:entry.scale|| (entry.type==='Country'?'110m':'unknown'),dataset_id:entry.source_id,source_version:entry.source_version,feature_id:entry.id,source_file:entry.source_file},style:{fill_opacity:.8,stroke_width:2}};
  if(entry.type==='Continent'){fields.source={dataset_id:'ne_continents_110m',feature_id:entry.name};}
  else if(entry.type==='State'){fields.embedded_geometry=entry.geometry;}
  o=insertNode('Region',fields);
 }
 if(o&&store.doc.objects[o.id]){showToast(geoDisplayName(entry)+' added to Scene Explorer');status(geoDisplayName(entry)+' added to Scene Explorer');}return o;
}
function fitGeoEntry(e){if(e.type==='City'){let v=e.geometry?.coordinates||[e.lon,e.lat];if(exec({type:'SetCameraPose',pose:{center_lon:v[0],center_lat:v[1],zoom:Math.max(8,store.doc.camera.zoom)}})){showToast(geoDisplayName(e)+' centered');status(geoDisplayName(e)+' centered');}return;}
 let g=e.type==='Continent'?geo?.continents?.[e.name]:e.detail_data?.geometry||e.geometry;if(g){fitBounds(featureFocusBounds(g));showToast(geoDisplayName(e)+' framed');status(geoDisplayName(e)+' framed');}else showToast('Geometry not installed for '+e.name,true);
}
function renderCountryList({append=false}={}){
 const q=$('countrySearch').value.trim(),ct=$('continent').value,kind=$('geoType')?.value||'All',country=$('geoCountry')?.value||'';
 const root=$('countryResults'),count=$('resultCount');
 // On initial load, do not display 160 arbitrary places or walk the full
 // worldwide catalog. Explicit type/country/continent filtering is browsing.
 if(!append)root.replaceChildren();
 const browsing=Boolean(ct||country||kind!=='All');
 if(!q&&!browsing){
  count.textContent='';
  return;
 }
 const {items,total,hasMore}=geo?geo.searchPage(q,kind,ct,GEO_RESULTS_PAGE,country,geoSearchOffset):{items:[],total:0,hasMore:false};
 const displayed=Math.min(geoSearchOffset+items.length,total);
 count.textContent=total?`${displayed} of ${total} locations`:'0 locations';
 if(!append&&!total){
  const help=document.createElement('div');help.className='help';
  help.textContent='No matches';
  root.append(help);return;
 }
 // Avoid a full DOM replacement on pagination; retain scroll position.
 if(append)root.querySelector('.geo-more')?.remove();
 const fragment=document.createDocumentFragment();
 const matches=new Map();for(const item of items){const key=[item.type,geoNormalize(item.parent),geoNormalize(item.name)].join(':');matches.set(key,(matches.get(key)||0)+1);}
 for(const e of items){
  const row=document.createElement('div');row.className='country-result geo-result';row.dataset.type=e.type;
  const tag=document.createElement('small');tag.className='geo-tag';tag.textContent=e.type;
  const body=document.createElement('span');body.className='name';
  const name=document.createElement('strong');name.textContent=geoDisplayName(e);
  const parent=document.createElement('small');
  const nameKey=[e.type,geoNormalize(e.parent),geoNormalize(e.name)].join(':');
  const disambig=(matches.get(nameKey)||0)>1?` · Source ID ${e.id}`:'';
  parent.textContent=geoDisplayParent(e.parent||'World')+' · '+(e.geometry_type==='Unavailable'?'Polygon unavailable':e.geometry_type||'Polygon')+disambig;
  body.append(name,parent);
  const fit=document.createElement('button');fit.textContent='⌕';fit.title='Fit location';fit.disabled=e.geometry_type==='Unavailable';fit.onclick=()=>fitGeoEntry(e);
  row.append(tag,body,fit);
  const button=(text,title,callback,disabled=false)=>{let b=document.createElement('button');b.textContent=text;b.title=title;b.disabled=disabled;b.onclick=callback;row.append(b);};
  if(e.type==='City'){button('M+','Add city marker',()=>addGeoEntry(e,'Marker'));button('T+','Add city label',()=>addGeoEntry(e,'Label'));}
  else button('+','Add independent Region',()=>addGeoEntry(e),e.geometry_type==='Unavailable');
  fragment.append(row);
 }
 if(hasMore){
  const more=document.createElement('button');more.className='geo-more';more.type='button';more.textContent=`Show ${Math.min(GEO_RESULTS_PAGE,total-displayed)} more · ${displayed} of ${total}`;
  more.onclick=()=>{geoSearchOffset+=GEO_RESULTS_PAGE;renderCountryList({append:true});};
  fragment.append(more);
 }
 root.append(fragment);
}
function queueCountrySearch(immediate=false){
 if(geoSearchTimer!==null){clearTimeout(geoSearchTimer);geoSearchTimer=null;}
 geoSearchOffset=0;
 if(immediate||!$('countrySearch').value.trim())renderCountryList();
 else {
  // Clear obsolete results immediately so a click can never select a stale
  // location while a new query is being debounced.
  $('countryResults').replaceChildren();
  $('resultCount').textContent='Searching…';
  geoSearchTimer=setTimeout(()=>{geoSearchTimer=null;renderCountryList();},GEO_SEARCH_DELAY_MS);
 }
}
function geoStatus(){
 if(!geo)return;
 // Production datasets load and validate normally, but source hashes and repair
 // actions are no longer part of the everyday Geography panel.
 $('showBrazilStates').checked=store.doc.theme.overrides.show_state_boundaries===true;
 for(const typ of ['River','Lake','Coastline']){
  const input=$('show'+typ+'s');if(!input)continue;
  input.disabled=!geo._overview?.types?.has(typ);
  input.checked=store.doc.theme.overrides[`show_${typ.toLowerCase()}s`]===true;
 }
}
async function loadWorldAdmin1(){
 worldAdminState='loading';geoStatus();
 let response=await fetch('/api/admin1/data');if(!response.ok)throw Error('World boundaries not available (HTTP '+response.status+')');
 let json=await response.json();let result=geo.install('ne_10m_admin1_world.geojson',json,'State');
 if(result.accepted<3000)throw Error('World data incomplete: '+result.accepted+' polygons');
 worldAdminState='ready';images._geo=geo;renderCountryList();geoStatus();invalidatePreviewResources();
 status('World subdivisions ready · '+result.accepted+' polygons');return result;
}
async function ensureWorldAdmin1(force=false){
 if(!geo||worldAdminState==='installing'||worldAdminState==='loading'||worldAdminState==='ready')return;
 try{
  let r=await fetch('/api/admin1/status');if(!r.ok)throw Error('World dataset service unavailable');
  let state=await r.json();worldAdminHealth=state;
  if(!state.installed||force){worldAdminState='installing';geoStatus();status('First-time setup: downloading Natural Earth Admin 1 world dataset…');
    let response=await fetch('/api/admin1/install'+(force?'?repair=1':''),{method:'POST',headers:{'X-CartoRig-Token':sessionToken}});
    if(!response.ok)throw Error((await response.text()).slice(0,230));
  }
  await loadWorldAdmin1();
 }catch(e){worldAdminState='error';geoStatus();status('World boundaries not installed');showToast('Global Admin 1: '+e.message,true);console.warn('Global Admin1 dataset setup failed',e);}
}

async function loadWorldCities(){
 worldCitiesState='loading';geoStatus();let response=await fetch('/api/cities/data');
 if(!response.ok)throw Error('Global city catalogue unavailable (HTTP '+response.status+')');
 let json=await response.json(),result=geo.install('ne_10m_populated_places_world.geojson',json,'City');
 if(result.accepted<500)throw Error('City catalogue incomplete: '+result.accepted);
 worldCitiesState='ready';renderCountryList();geoStatus();status('World cities ready · '+result.accepted+' points');return result;
}
async function ensureWorldCities(force=false){
 if(!geo||['ready','installing','loading'].includes(worldCitiesState))return;
 try{let r=await fetch('/api/cities/status');if(!r.ok)throw Error('Global cities service unavailable');
  let state=await r.json();worldCitiesHealth=state;if(!state.installed||force){worldCitiesState='installing';geoStatus();
   let response=await fetch('/api/cities/install'+(force?'?repair=1':''),{method:'POST',headers:{'X-CartoRig-Token':sessionToken}});
   if(!response.ok)throw Error((await response.text()).slice(0,230));}
  await loadWorldCities();
 }catch(e){worldCitiesState='error';geoStatus();console.warn('Full world cities unavailable; bundled cities remain available',e);}
}
function updateCountryFilter(){let el=$('geoCountry');if(!el)return;let val=el.value,continent=$('continent').value;
 let countriesIn=geo.countries.filter(c=>!continent||c.continent===continent).sort((a,b)=>a.name.localeCompare(b.name));
 el.replaceChildren(new Option('All countries',''),...countriesIn.map(c=>new Option(geoDisplayParent(c.name),c.name)));
 if(countriesIn.some(c=>c.name===val))el.value=val;
}

// GeoJSON packs live in the Go application data folder, not in origin-scoped browser
// storage; the local server uses a new ephemeral port on every launch.
async function persistGeoPack(pack){
 const response=await fetch('/api/geo-packs',{method:'POST',headers:{'Content-Type':'application/json','X-CartoRig-Token':sessionToken},body:JSON.stringify({filename:pack.filename,kind:pack.kind,data:pack.data})});
 if(!response.ok)throw Error('Local storage failed: '+(await response.text()).slice(0,160));
 return response.json();
}
async function restoreGeoPacks(){
 try{
  let response=await fetch('/api/geo-packs');if(!response.ok)throw Error('HTTP '+response.status);
  const installed=await response.json();
  for(let item of installed){try{
   let r=await fetch('/api/geo-packs/'+item.id);if(!r.ok)throw Error('HTTP '+r.status);
   let pack=await r.json();geo.install(pack.filename,pack.data,pack.kind);
  }catch(e){console.warn('Stored geographic dataset could not be loaded:',item.filename,e);}}
 }catch(e){console.warn('Persistent geographic data service unavailable',e);}
}
async function importGeoFile(file){
 if(!file)return;
 try{
  if(file.size>120_000_000)throw Error('Maximum GeoJSON size is 120 MB');
  status('Reading GeoJSON…');
  let data=JSON.parse(await file.text()),kind=$('datasetType').value;
  let result=geo.install(file.name,data,kind);
  // Persist before reporting success, so the user knows the dataset survives a restart.
  let persisted;
  try{persisted=await persistGeoPack({filename:file.name,kind,data});}
  catch(err){geo.remove(result.datasetId);images._geo=geo;renderCountryList();geoStatus();invalidatePreviewResources();throw err;}
  images._geo=geo;renderCountryList();geoStatus();invalidatePreviewResources();
  showToast(`${result.accepted} ${result.kind} geometries installed offline`);
  status('Dataset stored permanently: '+persisted.id.slice(0,12));
 }catch(e){showToast('GeoJSON import failed: '+e.message,true);status('GeoJSON import rejected');}
}
function iconFor(type){return {Shape:'⬡',WorldMap:'▨',Grid:'⌗',Borders:'⬡',Region:'◈',Route:'↗',Label:'T',Marker:'◉',Group:'▣'}[type]||'◻';}
function renderTree(){let root=$('layerTree'),focused=document.activeElement?.closest?.('[role=treeitem]')?.dataset.id;root.replaceChildren();let doc=store.doc,q=norm($('layerSearch').value);let shown=new Set(store.selection);
 function matches(id){let o=doc.objects[id];return !q||norm(o.name).includes(q)||norm(o.type).includes(q)||(o.type==='Group'&&o.children.some(matches));}
 function add(id,depth){let o=doc.objects[id];if(!o||!matches(id))return;let row=document.createElement('div');row.className='tree-row'+(shown.has(id)?' selected':'');row.dataset.id=id;row.draggable=!isLocked(doc,id)&&!['WorldMap','Grid','Borders'].includes(o.type);row.style.paddingLeft=(6+depth*17)+'px';row.setAttribute('role','treeitem');row.setAttribute('aria-selected',String(shown.has(id)));row.tabIndex=shown.has(id)?0:-1;row.setAttribute('aria-level',String(depth+1));if(o.type==='Group')row.setAttribute('aria-expanded',String(expanded.has(id)));
 let exp=document.createElement('button');exp.className='expand';exp.textContent=o.type==='Group'?(expanded.has(id)?'▾':'▸'):' ';exp.setAttribute('aria-label','Expand or collapse group');exp.disabled=o.type!=='Group';exp.onclick=e=>{e.stopPropagation();expanded.has(id)?expanded.delete(id):expanded.add(id);renderTree();};
 let icon=document.createElement('span');icon.className='type-icon';icon.textContent=iconFor(o.type);let name=document.createElement('span');name.className='node-name';name.textContent=o.name;name.title=o.type+' · '+o.name;
 let actions=document.createElement('span');actions.className='node-actions';let eye=document.createElement('button');eye.textContent=o.visible?'◉':'◌';eye.className=o.visible?'':'off';eye.title=o.visible?'Hide':'Show';eye.setAttribute('aria-label',eye.title+' '+o.name);eye.onclick=e=>{e.stopPropagation();if(e.altKey){soloId=soloId===id?null:id;drawPreview();showToast(soloId?'Solo preview (not exported)':'Solo off');}else exec({type:'SetVisibility',id,value:!o.visible});};let lock=document.createElement('button');lock.textContent=o.locked?'▣':'▢';lock.title=o.locked?'Unlock':'Lock';lock.setAttribute('aria-label',lock.title+' '+o.name);lock.onclick=e=>{e.stopPropagation();exec({type:'SetLock',id,value:!o.locked});};actions.append(eye,lock);row.append(exp,icon,name,actions);
 row.onclick=e=>{if(e.shiftKey&&store.selection.length){const all=treeIds(doc).reverse(),last=all.indexOf(store.selection.at(-1)),curr=all.indexOf(id);let range=all.slice(Math.min(last,curr),Math.max(last,curr)+1);select([...store.selection,...range]);}else if(e.ctrlKey||e.metaKey){select(shown.has(id)?store.selection.filter(x=>x!==id):[...store.selection,id]);}else select([id]);setRightTab('inspector');};
 row.ondblclick=e=>{if(e.target.closest('button'))return;let next=prompt('Rename object',o.name);if(next?.trim())exec({type:'RenameObject',id,name:next});};
 row.ondragstart=e=>{e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';};row.ondragover=e=>{e.preventDefault();const rel=(e.clientY-row.getBoundingClientRect().top)/row.getBoundingClientRect().height;row.dataset.dropzone=o.type==='Group'&&rel>.3&&rel<.7?'inside':rel<.5?'before':'after';row.classList.add('drag-target');};row.ondragleave=()=>{row.classList.remove('drag-target');delete row.dataset.dropzone;};row.ondrop=e=>{e.preventDefault();row.classList.remove('drag-target');let from=e.dataTransfer.getData('text/plain');if(!from||from===id)return;let parent,index,zone=row.dataset.dropzone||'after';delete row.dataset.dropzone;if(zone==='inside'&&o.type==='Group'){parent=id;index=o.children.length;expanded.add(id);}else{parent=o.parent_id;index=(parent?doc.objects[parent].children:doc.scene.root_ids).indexOf(id)+(zone==='after'?1:0);}exec({type:'MoveObject',id:from,parent_id:parent,index});};
 root.append(row);if(o.type==='Group'&&(expanded.has(id)||q)){for(let child of [...o.children].reverse())add(child,depth+1);}}
 for(let id of [...doc.scene.root_ids].reverse())add(id,0);
 if(focused){const previous=[...root.querySelectorAll('[role=treeitem]')].find(n=>n.dataset.id===focused);if(previous){previous.tabIndex=0;previous.focus({preventScroll:true});}}
 if(!root.querySelector('[tabindex="0"]')){const first=root.querySelector('[role=treeitem]');if(first)first.tabIndex=0;}
}
function createField(root,label,value,onChange,{type='text',min,max,step,disabled=false,placeholder}={}){let wrap=document.createElement('label');wrap.className='field-label';wrap.textContent=label;let input=document.createElement('input');input.className='control compact';input.type=type;input.disabled=disabled;if(min!=null)input.min=min;if(max!=null)input.max=max;if(step!=null)input.step=step;if(placeholder)input.placeholder=placeholder;if(value!==undefined&&value!==null)input.value=value;
 input.onchange=()=>{let v=type==='number'?Number(input.value):input.value;if(type==='number'&&(!Number.isFinite(v)||input.value===''||(min!=null&&v<min)||(max!=null&&v>max))){showToast('Invalid '+label,true);input.value=value;return;}onChange(v);};wrap.append(input);root.append(wrap);return input;}
function createCheck(root,label,checked,onChange,disabled=false){let wrap=document.createElement('label');wrap.className='check';let input=document.createElement('input');input.type='checkbox';input.checked=!!checked;input.disabled=disabled;input.onchange=()=>onChange(input.checked);wrap.append(input,document.createTextNode(label));root.append(wrap);return input;}
function inspectorGroup(root,title){let group=document.createElement('div');group.className='inspector-group';let h=document.createElement('h3');h.textContent=title;group.append(h);root.append(group);return group;}
const inspectorAdvancedOpen=new Set();
function renderInspector(){let root=$('inspector');root.replaceChildren();let ids=store.selection,doc=store.doc;$('selectionCount').textContent=ids.length>1?ids.length+' selected':'';if(!ids.length)return;
 const target=doc.objects[ids[0]],multi=ids.length>1,locked=ids.some(id=>isLocked(doc,id));
 const objHeader=document.createElement('div');objHeader.className='ux-inspector-object';
 const objType=document.createElement('span');objType.className='ux-inspector-type';objType.textContent=multi?'MULTIPLE OBJECTS':target.type;
 const objName=document.createElement('strong');objName.textContent=multi?`${ids.length} objects selected`:target.name;
 const objState=document.createElement('small');objState.textContent=locked?'Locked selection':'';
 objHeader.append(objType,objName);if(locked)objHeader.append(objState);root.append(objHeader);if(multi){let sec=inspectorGroup(root,'MULTI-SELECTION');createField(sec,'Opacity (%)',Math.round((target.opacity??1)*100),v=>exec({type:'BatchSet',ids,path:'opacity',value:v/100}),{type:'number',min:0,max:100,disabled:locked});createCheck(sec,'Visible',ids.every(id=>doc.objects[id].visible),v=>exec({type:'BatchSet',ids,path:'visible',value:v}),locked);if(ids.every(id=>['Region','Route','Label','Marker','Shape'].includes(doc.objects[id].type))){
  const key=o=>({Region:'fill_color',Route:'stroke_color',Label:'text_color',Marker:'fill_color',Shape:'stroke_color'})[o.type];
  const values=ids.map(id=>{const o=doc.objects[id];return resolveStyle(doc,o)[key(o)]||'#d86c52';});
  if(new Set(values).size>1){let tag=document.createElement('small');tag.textContent='Color: Mixed — choose a value to update all selected objects';sec.append(tag);}
  createField(sec,'Shared color',values[0].length===4?'#'+[...values[0].slice(1)].map(c=>c+c).join(''):values[0].slice(0,7),v=>{exec({type:'BatchColor',ids,color:v})},{type:'color',disabled:locked});}return;}
 let sec=inspectorGroup(root,'IDENTITY');createField(sec,'Display name',target.name,v=>exec({type:'RenameObject',id:target.id,name:v}),{disabled:locked});let sm=document.createElement('small');sm.textContent=target.type+' · '+target.id;const objectDetails=document.createElement('details');objectDetails.className='ux-advanced ux-inspector-metadata';const objectDetailsTitle=document.createElement('summary');objectDetailsTitle.textContent='Object ID';objectDetails.append(objectDetailsTitle,sm);sec.append(objectDetails);createCheck(sec,'Visible',target.visible,v=>exec({type:'SetVisibility',id:target.id,value:v}),locked);createCheck(sec,'Locked',target.locked,v=>exec({type:'SetLock',id:target.id,value:v}));
 if(target.type!=='WorldMap'&&target.type!=='Grid'&&target.type!=='Borders'){
  let common=inspectorGroup(root,'COMPOSITION');createField(common,'Opacity (%)',Math.round((target.opacity??1)*100),v=>exec({type:'SetProperty',id:target.id,path:'opacity',value:v/100}),{type:'number',min:0,max:100,disabled:locked});}
 if(['Region','Route','Marker','Label','Shape'].includes(target.type)){
  const fx=inspectorGroup(root,'Quick effects');
  const sty=resolveStyle(doc,target);const actions=document.createElement('div');actions.className='style14-inspector-actions';
  for(const [name,values] of [['✦ Glow',sty.glow_enabled?{glow_enabled:false}:{glow_enabled:true,glow_color:'#77caff',glow_intensity:1.5,glow_radius:24,glow_mix:1}],['◐ Shadow',sty.shadow_enabled?{shadow_enabled:false}:{shadow_enabled:true,shadow_blur:22,shadow_distance:12,shadow_opacity:.65}]]){
   const b=document.createElement('button');b.textContent=name;b.disabled=locked;
   b.onclick=()=>exec({type:'SetObjectStyle',id:target.id,values});actions.append(b);
  }fx.append(actions);
 }

 function prop(group,label,key,def,type='color',options={}){createField(group,label,target.style?.[key]??def,v=>exec({type:'SetProperty',id:target.id,path:'style.'+key,value:v}),{type,disabled:locked,...options});}
 if(target.type==='Region'){let loc=inspectorGroup(root,'GEOGRAPHY');const geoMeta=document.createElement('details');geoMeta.className='ux-advanced ux-inspector-metadata';const geoMetaSummary=document.createElement('summary');geoMetaSummary.textContent='Source details';geoMeta.append(geoMetaSummary);let t=document.createElement('small');t.textContent=target.region_kind+' · '+(target.source?.dataset_id||'Unknown dataset')+' · '+(target.source?.feature_id||'unknown')+(target.embedded_geometry?' · Geometry saved in project':'');geoMeta.append(t);loc.append(geoMeta);
 const regionGeometry=target.embedded_geometry||(target.region_kind==='Country'?countryForRegion(target,countries,geo,store.doc.camera.zoom)?.geometry:geo?.lookup?.(target.source?.dataset_id,target.source?.feature_id)?.geometry)||null;
 if(regionGeometry){const bounds=featureFocusBounds(regionGeometry);let text=document.createElement('small');text.className='region-bounds';text.textContent=`WGS84 bounds: ${bounds.minx.toFixed(4)}° to ${bounds.maxx.toFixed(4)}° lon · ${bounds.miny.toFixed(4)}° to ${bounds.maxy.toFixed(4)}° lat`;geoMeta.append(text);}
 else {const unresolved=document.createElement('small');unresolved.textContent='Geometry unresolved in installed data';loc.append(unresolved);}
 if(target.geo_source_info){let detail=document.createElement('small');let a=target.geo_source_info;detail.textContent=`Source: ${a.source_file||a.dataset_id||'Natural Earth'} · scale ${a.scale||'unknown'} · ID ${a.feature_id||'unknown'} · version ${a.source_version||'unknown'}`;geoMeta.append(detail);}}
 if(target.type==='Region'){
  let actions=document.createElement('details');actions.className='ux-advanced ux-inspector-replace';const replaceSummary=document.createElement('summary');replaceSummary.textContent='Replace geography';actions.append(replaceSummary);root.append(actions);
  let query=createField(actions,'Find country, state or province','',()=>{},{});query.placeholder='Search country, province, state…';query.onchange=null;
  const matches=document.createElement('div');matches.className='creative-location-results';actions.append(matches);
  let finder=0;query.oninput=()=>{clearTimeout(finder);finder=setTimeout(()=>{
   matches.replaceChildren();if(query.value.trim().length<2)return;
   const list=geo?.search(query.value,'All','',15)||[];
   for(const candidate of list.filter(e=>['Country','State','Continent'].includes(e.type)&&e.geometry_type!=='Unavailable').slice(0,10)){
    let row=document.createElement('div');row.className='style14-geo-result';let label=document.createElement('span');label.textContent=geoDisplayName(candidate)+' · '+geoDisplayParent(candidate.parent||'World');row.append(label);
    let bt=document.createElement('button');bt.textContent='Preview / Replace';bt.onclick=()=>{
     let geom=candidate.type==='Continent'?geo?.continents?.[candidate.name]:candidate.detail_data?.geometry||candidate.geometry;
     if(!geom)geom=geo?.lookup(candidate.source_id,candidate.id)?.geometry;
     if(!geom||!['Polygon','MultiPolygon'].includes(geom.type)){showToast('Polygon source unavailable',true);return;}
     // Preview is a camera fit, not a mutation to the Region. Confirmation is explicit.
     fitBounds(featureFocusBounds(geom));
     if(!confirm('Replace the geography of '+target.name+' with '+geoDisplayName(candidate)+'? Style and UUID will be preserved.'))return;
     let source={dataset_id:candidate.source_id||'ne_admin0_110m',feature_id:candidate.id,source_version:candidate.source_version||'unknown'};
     exec({type:'ReplaceRegionGeography',id:target.id,geo:{region_kind:candidate.type,source,geometry:geom,geo_source_info:{name:candidate.name,parent:candidate.parent,scale:candidate.scale||'unknown',dataset_id:source.dataset_id,source_version:source.source_version,feature_id:candidate.id,source_file:candidate.source_file}}});
    };row.append(bt);matches.append(row);
   }
  },180);};
 }
 if((target.type==='Marker'||target.type==='Label')&&target.geo_source_info){let loc=inspectorGroup(root,'GEOGRAPHY');let a=target.geo_source_info;let d=document.createElement('small');d.textContent=`${a.parent||'World'} · ${a.dataset_id||'Natural Earth'} · scale ${a.scale||'unknown'} · ID ${a.feature_id||'unknown'}`;const metadata=document.createElement('details');metadata.className='ux-advanced ux-inspector-metadata';const summary=document.createElement('summary');summary.textContent='Source details';metadata.append(summary,d);loc.append(metadata);}
 if(['Route','Marker','Label','Shape'].includes(target.type))creativeInspector(root,target,doc,{
  exec,field:createField,check:createCheck,group:inspectorGroup,locked,toast:showToast,
  editText:()=>openInlineText(target),importImage:importCreativeIcon,findCities:q=>geo?.search(q,'City','',8)||[],
  representative:o=>{let g=o.embedded_geometry||(o.region_kind==='Country'?countryForRegion(o,countries,geo,store.doc.camera.zoom)?.geometry:geo?.lookup?.(o.source?.dataset_id,o.source?.feature_id)?.geometry);if(!g)return null;let b=featureFocusBounds(g),mx=(b.minx+b.maxx)/2,my=(b.miny+b.maxy)/2;for(let i=0;i<45;i++)for(let j=0;j<45;j++){let lon=b.minx+(b.maxx-b.minx)*(i===0?.5:i/45),lat=b.miny+(b.maxy-b.miny)*(j===0?.5:j/45);lon=((lon+180)%360+360)%360-180;if(pointInside(lon,lat,{geometry:g}))return {lon,lat};}return null;},
  editPath:()=>{setTool('select');editHandles=true;editOffset=false;showToast('Drag a blue handle to edit. Esc exits editing.');},
  editOffset:()=>{setTool('select');editHandles=true;editOffset=true;showToast('Drag the marker handle to change its visual offset.');},
  convertShape:(o,space)=>{if(space===o.coordinate_space)return;let pts=o.points.map(pt=>space==='screen'?(()=>{let [x,y]=project(doc,pt.lon,pt.lat,canvas.width,canvas.height);return {x:clamp(x/canvas.width,0,1),y:clamp(y/canvas.height,0,1)};})():(()=>{let [lon,lat]=unproject(doc,pt.x*canvas.width,pt.y*canvas.height,canvas.width,canvas.height);return {lon,lat};})());exec({type:'SetProperties',id:o.id,values:{coordinate_space:space,points:pts}});},
  geoPoint:(anchor,screen)=>{if(screen){let [lon,lat]=unproject(doc,screen.x*canvas.width,screen.y*canvas.height,canvas.width,canvas.height);return {lon:clamp(lon,-180,180),lat:clamp(lat,-90,90)};}let [x,y]=project(doc,anchor.lon,anchor.lat,canvas.width,canvas.height);return {x:clamp(x/canvas.width,0,1),y:clamp(y/canvas.height,0,1)};}
 });
 if(['Region','Route','Marker','Label','Shape','Group'].includes(target.type)){
  const advanced=document.createElement('details');advanced.className='ux-advanced ux-inspector-advanced';
  advanced.open=inspectorAdvancedOpen.has(target.type);
  advanced.addEventListener('toggle',()=>{if(advanced.open)inspectorAdvancedOpen.add(target.type);else inspectorAdvancedOpen.delete(target.type);});
  const summary=document.createElement('summary');summary.textContent='Advanced appearance & effects';
  const inner=document.createElement('div');inner.className='ux-inspector-advanced-body';
  advanced.append(summary,inner);root.append(advanced);
  renderAdvancedInspector(inner,target,doc,{exec,field:createField,check:createCheck,group:inspectorGroup,locked,toast:showToast});
 }
 
}
function syncUI(reason='change'){const d=store.doc;let inp=$('projectName');if(document.activeElement!==inp)inp.value=d.name;$('dirtyState').textContent=store.dirty?'Unsaved changes':'Saved';$('dirtyState').classList.toggle('dirty',store.dirty);$('undo').disabled=!store.undoStack.length;$('redo').disabled=!store.redoStack.length;$('zoomValue').textContent=Math.round(d.camera.zoom*100)+'%';$('selectionCount').textContent=store.selection.length>1?store.selection.length+' selected':'';$('resolution').value=d.canvas.width+'x'+d.canvas.height;$('transparent').checked=d.canvas.transparent;document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('active',b.dataset.style===d.theme.id));$('duplicate').disabled=store.selection.length!==1;$('delete').disabled=!store.selection.length;$('ungroup').disabled=store.selection.length!==1||d.objects[store.selection[0]]?.type!=='Group';$('ungroup').hidden=$('ungroup').disabled;renderTree();renderInspector();styleStudio.sync();if(reason!=='saved')drawPreview();geoStatus();}
function fitCountry(iso){let c=byIso.get(iso);if(!c)return;fitBounds(boundsOf(c));}
function fitBounds(bb){if(!Number.isFinite(bb.minx))return;let w=previewW||1280,h=previewH||720,k=Math.min(w/360,h/180),dx=Math.max(10,bb.maxx-bb.minx),dy=Math.max(7,bb.maxy-bb.miny),bearing=(store.doc.camera.bearing||0)*Math.PI/180,cs=Math.abs(Math.cos(bearing)),sn=Math.abs(Math.sin(bearing)),rotW=dx*cs+dy*sn,rotH=dx*sn+dy*cs;exec({type:'SetCameraPose',pose:{center_lon:((bb.minx+bb.maxx)/2+540)%360-180,center_lat:(bb.miny+bb.maxy)/2,zoom:clamp(Math.min(w*.77/rotW,h*.77/rotH)/k,.8,70)}});}
function fitSelection(){let box={minx:Infinity,miny:Infinity,maxx:-Infinity,maxy:-Infinity};for(let id of store.selection){let o=store.doc.objects[id],c=o?.embedded_geometry?{geometry:o.embedded_geometry}:o?.region_kind==='Continent'?{geometry:geo?.continents?.[o.source?.feature_id]}:o?.region_kind==='Country'?countryForRegion(o,countries,geo,store.doc.camera.zoom):geo?.lookup(o?.source?.dataset_id,o?.source?.feature_id);if(c?.geometry){let b=boundsOf(c);box.minx=Math.min(box.minx,b.minx);box.miny=Math.min(box.miny,b.miny);box.maxx=Math.max(box.maxx,b.maxx);box.maxy=Math.max(box.maxy,b.maxy);}else for(let pt of [o?.anchor,o?.from,o?.to])if(pt&&Number.isFinite(pt.lon)&&Number.isFinite(pt.lat)){box.minx=Math.min(box.minx,pt.lon);box.maxx=Math.max(box.maxx,pt.lon);box.miny=Math.min(box.miny,pt.lat);box.maxy=Math.max(box.maxy,pt.lat);}}if(Number.isFinite(box.minx))fitBounds(box);else showToast('No geographical bounds for selection',true);}
// In the Wails build, visibility is delivered by the native tray lifecycle.
// In a browser, document.visibilitychange supplies the equivalent signal.
let nativeWindowVisible=true;
let previewResourcesVersion=0;
const previewCache=createPreviewCache();
function invalidatePreviewResources(){previewResourcesVersion++;previewCache.invalidate();drawPreview();}
const previewScheduler=createPreviewScheduler({
 draw:renderPreviewNow,
 measure:()=>{const box=wrap.getBoundingClientRect();return {width:box.width,height:box.height};},
 requestFrame:callback=>requestAnimationFrame(callback),
 cancelFrame:id=>cancelAnimationFrame(id),
 now:()=>performance.now(),
 initiallyVisible:!document.hidden
});
function drawPreview(){previewScheduler.invalidate();}
function updatePreviewVisibility(){
 previewScheduler.setVisible(nativeWindowVisible&&!document.hidden);
}
window.addEventListener('cartorig-desktop-visibility',event=>{
 nativeWindowVisible=event.detail?.visible!==false;
 updatePreviewVisibility();
});
document.addEventListener('visibilitychange',updatePreviewVisibility);

// Diagnostics only: local numerical heartbeat to distinguish renderer stalls
// from native window lifecycle hangs. Never send project contents or object names.
let desktopHealthPending=false,desktopHealthTimer=null;
function sendDesktopHealth(phase='periodic'){
 if(!sessionToken||location.hostname!=='wails.localhost'||desktopHealthPending)return;
 const metrics=previewScheduler.getStats(),composition=previewCache.getStats();const bounds=wrap.getBoundingClientRect();
 const body={phase,renders:metrics.renders,invalidations:metrics.invalidations,
 resizeEvents:metrics.resizeEvents,skippedHidden:metrics.skippedHidden,
 lastRenderMs:metrics.lastRenderMs,maxRenderMs:metrics.maxRenderMs,
 framePending:metrics.framePending,baseRenders:composition.baseRenders,baseHits:composition.baseHits,
 baseDrawMs:composition.baseRenderMs,previewPixels:canvas.width*canvas.height,previewVisible:metrics.visible,
 documentHidden:document.hidden,webviewWidth:bounds.width,webviewHeight:bounds.height};
 desktopHealthPending=true;
 const controller=new AbortController();
 const abort=setTimeout(()=>controller.abort(),2000);
 fetch('/api/desktop/heartbeat',{method:'POST',headers:{'X-CartoRig-Token':sessionToken,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal})
 .catch(()=>{}).finally(()=>{clearTimeout(abort);desktopHealthPending=false});
}
function initDesktopHealth(){
 if(location.hostname!=='wails.localhost'||desktopHealthTimer!==null)return;
 sendDesktopHealth('ready');
 desktopHealthTimer=setInterval(()=>sendDesktopHealth('periodic'),5000);
 window.addEventListener('cartorig-desktop-visibility',()=>sendDesktopHealth('visibility'));
}
function updateCanvasSize(){let box=wrap.getBoundingClientRect(),ratio=store.doc.canvas.width/store.doc.canvas.height;let cssW=Math.max(100,Math.min(box.width-34,(box.height-34)*ratio)),cssH=cssW/ratio;
 // Bound desktop preview pixels. Native-resolution PNG/SVG/ZIP exports are unchanged.
 let pxratio=location.hostname==='wails.localhost'?previewBackingScale(cssW,cssH,devicePixelRatio||1):Math.min(devicePixelRatio||1,2);previewW=cssW;previewH=cssH;canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';let w=Math.max(100,Math.round(cssW*pxratio)),h=Math.max(100,Math.round(cssH*pxratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}return {w,h};}
function renderPreviewNow(){if(!countries.length)return;let {w,h}=updateCanvasSize();let doc=store.doc;if(dragPreview){doc=clone(doc);if(dragPreview.camera)doc.camera={...doc.camera,...dragPreview.camera};if(dragPreview.anchor){let o=doc.objects[dragPreview.id];if(o)o.anchor=dragPreview.anchor;}if(dragPreview.object)doc.objects[dragPreview.id]=dragPreview.object;}
 if(dragPreview){
  // Moving an object or the camera genuinely changes the underlying scene.
  renderScene(ctx,doc,countries,images,w,h,{preview:true,selection:store.selection,soloId});
 }else{
  previewCache.paint(ctx,{
   doc,w,h,solo:soloId,assetsVersion:previewResourcesVersion,
   drawBase:surface=>renderScene(surface,doc,countries,images,w,h,{preview:false,soloId}),
   drawOverlay:surface=>drawPreviewSelection(surface,doc,countries,images,w,h,store.selection)
  });
 }
 if(creativeDraft?.points?.length){const draft=creativePreviewObject(doc);if(draft){ctx.save();ctx.globalAlpha=.7;drawCreative(ctx,doc,draft,w,h,project);ctx.restore();}}
 if(doc.canvas.transparent){ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#202e3d';ctx.fillRect(0,0,w,h);ctx.fillStyle='#15212c';let tile=24;for(let y=0;y<h;y+=tile*2)for(let x=0;x<w;x+=tile*2){ctx.fillRect(x,y,tile,tile);ctx.fillRect(x+tile,y+tile,tile,tile);}ctx.restore();}$('previewSize').textContent=w+' × '+h;}
function pointerXY(ev){let rect=canvas.getBoundingClientRect();return {x:(ev.clientX-rect.left)*canvas.width/rect.width,y:(ev.clientY-rect.top)*canvas.height/rect.height};}
function setTool(name){$('toolSelect').closest('.toolstrip').dataset.activeTool=name;tool=name;routeFrom=null;creativeDraft=null;creativeCursor=null;editHandles=false;document.querySelectorAll('[id^="tool"]').forEach(b=>{if(b.tagName==='BUTTON')b.classList.toggle('active',b.id==='tool'+name[0].toUpperCase()+name.slice(1));});wrap.classList.toggle('hand',name==='pan');$('modeTag').hidden=name==='select'||name==='pan';$('modeTag').textContent={region:'Click a region to add it',route:'Choose start point · click destination · Enter completes Custom',label:'Click to place text · inline editor',marker:'Click to place a marker',shape:'Click to add points · Enter completes polygon · Esc cancels'}[name]||'';drawPreview();}
const shapeTool=()=>$('shapeType')?.value||'Line';const routeTool=()=>$('routeType')?.value||'Straight';const shapeSpace=()=>$('shapeSpace')?.value||'geo';
function creativePoint(x,y,space=shapeSpace()){if(space==='screen')return {x:clamp(x/canvas.width,0,1),y:clamp(y/canvas.height,0,1)};let [lon,lat]=unproject(store.doc,x,y,canvas.width,canvas.height);return {lon:clamp(lon,-180,180),lat:clamp(lat,-90,90)};}
function snapCreative(p,space){if(!$('snapCreative')?.checked)return p;if(space==='geo'){
  let markers=Object.values(store.doc.objects).filter(o=>o.type==='Marker'&&o.anchor);let xy=project(store.doc,p.lon,p.lat,canvas.width,canvas.height);
  let best=null,dist=11;for(let m of markers){let at=project(store.doc,m.anchor.lon,m.anchor.lat,canvas.width,canvas.height),d=Math.hypot(at[0]-xy[0],at[1]-xy[1]);if(d<dist){best=m.anchor;dist=d;}}if(best)return {...best};
 }return {...p};}
function commitCreativeDraft(){if(!creativeDraft)return false;const d=creativeDraft,pts=d.points;
 if(d.type==='Route'&&pts.length>=2){let from=pts[0],to=pts.at(-1);if(from.lon===to.lon&&from.lat===to.lat)return false;insertNode('Route',{name:'Route',from,to,path_type:d.path_type,curvature:0,waypoints:d.path_type==='Custom'?pts.slice(1,-1):[],style:{stroke_color:'#efb95c',stroke_width:3,stroke_style:'Solid',arrowheads:'End'}});setTool('select');return true;}
 if(d.type==='Shape'&&pts.length>=(d.shape_kind==='Polygon'?3:2)){
  let fields={name:d.shape_kind,shape_kind:d.shape_kind,coordinate_space:d.coordinate_space,points:pts,style:{stroke_color:'#eab766',stroke_width:3,stroke_style:'Solid',fill_color:'#eab76644',arrowheads:'End'},editorial:true};
  if(d.shape_kind==='Callout'){fields.text='Callout';if(d.coordinate_space==='geo'){fields.callout_box={x:creativeCursor?.x/canvas.width||.65,y:creativeCursor?.y/canvas.height||.45};}}
  insertNode('Shape',fields);setTool('select');return true;
 }return false;}
function creativePreviewObject(doc){if(!creativeDraft?.points?.length)return null;let d=creativeDraft,pts=[...d.points],cursor=creativeCursor;
 if(cursor&&pts.length){let next=snapCreative(creativePoint(cursor.x,cursor.y,d.coordinate_space||'geo'),d.coordinate_space||'geo');pts.push(next);}
 if(pts.length<2)return null;
 if(d.type==='Route')return {type:'Route',from:pts[0],to:pts.at(-1),path_type:d.path_type,waypoints:d.path_type==='Custom'?pts.slice(1,-1):[],curvature:0,style:{stroke_color:'#e5b467',stroke_width:2,arrowheads:'None'}};
 return {type:'Shape',shape_kind:d.shape_kind,coordinate_space:d.coordinate_space,points:pts,style:{stroke_color:'#e5b467',stroke_width:2,fill_color:'#e5b46733'},text:'Callout'};
}
function openInlineText(objOrPoint){let original=objOrPoint?.type==='Label'?objOrPoint:null;if(inlineTextEditor)inlineTextEditor.remove();
 let anchor=original?.anchor||objOrPoint?.anchor||{lon:0,lat:0},position=original?.position_mode==='screen'?original.screen_pos:null;
 let xy=position?[position.x*canvas.width,position.y*canvas.height]:project(store.doc,anchor.lon,anchor.lat,canvas.width,canvas.height);
 let bounds=canvas.getBoundingClientRect(),parent=wrap.getBoundingClientRect(),el=document.createElement('textarea');el.className='creative-text-editor';el.setAttribute('aria-label','Inline label text');el.placeholder='Enter text · Ctrl+Enter to confirm · Esc to cancel';el.value=original?.text||'';el.style.left=(bounds.left-parent.left+xy[0]*bounds.width/canvas.width)+'px';el.style.top=(bounds.top-parent.top+xy[1]*bounds.height/canvas.height)+'px';
 const cleanup=()=>{el.remove();save.remove();inlineTextEditor=null;};el.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();cleanup();return;}if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();e.stopPropagation();let text=el.value.trim();if(text){if(original)exec({type:'SetProperty',id:original.id,path:'text',value:text});else insertNode('Label',{name:text.split('\n')[0].slice(0,100),text,position_mode:'geo',anchor,typography:{font_size:27,font_family:'Segoe UI',font_weight:700,line_height:1.2},style:{text_color:'#fff',halo_color:'#08111e',halo_width:4}});setTool('select');}cleanup();}};
 let save=document.createElement('button');save.type='button';save.className='creative-text-confirm';save.textContent='Apply text';save.onclick=()=>{el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:false}));};wrap.append(el,save);inlineTextEditor=el;el.addEventListener('blur',()=>{setTimeout(()=>{save.remove();},300);},{once:true});el.focus();}
async function importCreativeIcon(target){$('creativeAssetFile').dataset.target=target.id;$('creativeAssetFile').click();}
async function installCreativeIcon(file,id){if(!file||!store.doc.objects[id])return;try{
 if(file.size>2_000_000)throw Error('File exceeds 2 MB');let src='',mime='';
 if(/\.svg$/i.test(file.name)){let clean=sanitizeSVG(await file.text());src=URL.createObjectURL(new Blob([clean],{type:'image/svg+xml'}));mime='image/svg+xml';}
 else if(/\.png$/i.test(file.name)){let buf=await file.arrayBuffer(),sig=new Uint8Array(buf.slice(0,8));if(sig.join(',')!=='137,80,78,71,13,10,26,10')throw Error('Invalid PNG signature');src=URL.createObjectURL(new Blob([buf],{type:'image/png'}));mime='image/png';}
 else throw Error('Only PNG or safe SVG accepted');
 let img=new Image();try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('Image could not be decoded'));img.src=src;});}finally{URL.revokeObjectURL(src);}
 if(img.width<1||img.height<1||img.width>4096||img.height>4096)throw Error('Unsupported image dimensions');
 let c=document.createElement('canvas'),r=Math.min(1,512/Math.max(img.width,img.height));c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 let data=c.toDataURL('image/png'),bytes=new TextEncoder().encode(data),hash=await crypto.subtle.digest('SHA-256',bytes),sha=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
 exec({type:'ImportAssetAndAssign',id,asset:{id:uuid(),name:file.name,format:mime,sha256:sha,data}});showToast('Image embedded in project · '+file.name);
 }catch(e){showToast('Asset import rejected: '+e.message,true);}}
function canvasClick(x,y,ev){let doc=store.doc,[lon,lat]=unproject(doc,x,y,canvas.width,canvas.height);lon=clamp(lon,-180,180);lat=clamp(lat,-90,90);
 if(tool==='route'){let point=snapCreative({lon,lat},'geo'),type=routeTool();if(!creativeDraft)creativeDraft={type:'Route',path_type:type,points:[point]};else creativeDraft.points.push(point);
 if(type!=='Custom'&&creativeDraft.points.length===2)commitCreativeDraft();else{$('modeTag').textContent=type==='Custom'?'Click to add waypoints · Enter finishes · Esc cancels':'Click destination · Esc cancels';drawPreview();}return;}
 if(tool==='shape'){let kind=shapeTool(),space=shapeSpace(),point=snapCreative(creativePoint(x,y,space),space);if(!creativeDraft)creativeDraft={type:'Shape',shape_kind:kind,coordinate_space:space,points:[point]};else creativeDraft.points.push(point);
 if(!['Polygon','Freehand'].includes(kind)&&creativeDraft.points.length>=2)commitCreativeDraft();else{$('modeTag').textContent='Click vertices · Enter finishes · Esc cancels';drawPreview();}return;}
 if(tool==='label'){openInlineText({anchor:{lon,lat}});return;}
 if(tool==='marker'){insertNode('Marker',{name:'Marker',symbol:$('markerSymbol').value||'Circle',anchor:{lon,lat},offset_x:0,offset_y:0,style:{fill_color:'#e5b467',stroke_color:'#fff',stroke_width:2,symbol_size:12}});setTool('select');return;}
 if(tool==='region'){let states=(geo?.entries||[]).filter(e=>e.type==='State'&&e.geometry&&e.bbox&&(lon>=e.bbox.minx&&lon<=e.bbox.maxx||e.bbox.maxx-e.bbox.minx>180)&&lat>=e.bbox.miny&&lat<=e.bbox.maxy);if(doc.camera.zoom>=3){let entry=states.find(e=>pointInside(lon,lat,{geometry:e.geometry}));if(entry){addGeoEntry(entry);setTool('select');return;}}
 let c=countries.find(c=>{try{return countryHit(lon,lat,c)}catch{return false}});if(c){addCountry(c.iso);setTool('select');}return;}
 if(tool==='select'){let options=ev.altKey?hitTestCandidates(doc,countries,x,y,canvas.width,canvas.height,geo):null;let hit=options?.length?options[(options.indexOf(store.selection[0])+1)%options.length]:hitTest(doc,countries,x,y,canvas.width,canvas.height,geo);if(hit){if(ev.shiftKey||ev.ctrlKey||ev.metaKey)select(store.selection.includes(hit)?store.selection.filter(id=>id!==hit):[...store.selection,hit]);else select([hit]);}else select([]);}
}
function countryHit(lon,lat,c){let b=boundsOf(c);if(lon>=b.minx&&lon<=b.maxx&&lat>=b.miny&&lat<=b.maxy)return pointInside(lon,lat,c);return pointInside(lon,lat,c);}
function setupCanvas(){canvas.addEventListener('dblclick',e=>{const p=pointerXY(e),id=hitTest(store.doc,countries,p.x,p.y,canvas.width,canvas.height,geo),o=store.doc.objects[id];if(o?.type==='Label'&&!isLocked(store.doc,id)){select([id]);openInlineText(o);}else if(o&&['Route','Shape','Marker'].includes(o.type)&&!isLocked(store.doc,id)){select([id]);editHandles=true;editOffset=false;setTool('select');editHandles=true;showToast('Drag blue vertex handles to edit');}});canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;let p=pointerXY(e);let doc=store.doc;drag={start:p,originalCamera:clone(doc.camera),moved:false,button:e.button,id:null,originalPoint:null};if(tool==='shape'&&shapeTool()==='Freehand'){drag.freehand=[snapCreative(creativePoint(p.x,p.y,shapeSpace()),shapeSpace())];creativeDraft={type:'Shape',shape_kind:'Freehand',coordinate_space:shapeSpace(),points:drag.freehand};}
 if(tool==='select'&&e.button===0){let hit=hitTest(doc,countries,p.x,p.y,canvas.width,canvas.height,geo),obj=doc.objects[hit];
 // Prefer selected handles over overlapping countries, markers and shapes.
 if(editHandles){for(let id of [...store.selection].reverse()){
   const candidate=doc.objects[id];if(!candidate||isLocked(doc,id))continue;
   let found=creativeHandles(doc,candidate,canvas.width,canvas.height,project).find(h=>Math.hypot(h.xy[0]-p.x,h.xy[1]-p.y)<15);
   if(found){drag.handle={id,index:found.index};drag.originalObject=clone(candidate);break;}
 }}
 if(!drag.handle&&obj&&store.selection.includes(hit)&&['Label','Marker'].includes(obj.type)&&!isLocked(doc,hit)){drag.id=hit;drag.originalPoint=[obj.anchor.lon,obj.anchor.lat];}}canvas.setPointerCapture(e.pointerId);wrap.classList.add('dragging');});
 canvas.addEventListener('pointermove',e=>{let p=pointerXY(e),[lon,lat]=unproject(store.doc,p.x,p.y,canvas.width,canvas.height);$('cursorCoords').textContent=lat.toFixed(2)+'°, '+lon.toFixed(2)+'°';if(creativeDraft&&!drag){creativeCursor=p;drawPreview();}if(!drag)return;let dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(!drag.moved)return;
 if(drag.handle){let {id,index}=drag.handle,obj=clone(drag.originalObject),kind=obj.type,point=creativePoint(p.x,p.y,kind==='Shape'?obj.coordinate_space:obj.type==='Label'&&obj.position_mode==='screen'?'screen':'geo');
  if(kind==='Route'){if(index===0)obj.from=point;else if(index===(obj.waypoints?.length||0)+1)obj.to=point;else obj.waypoints[index-1]=point;}
  else if(kind==='Shape')obj.points[index]=point;
  else if(kind==='Label'&&obj.position_mode==='screen')obj.screen_pos=point;
  else if(kind==='Marker'&&editOffset){let [x,y]=project(store.doc,obj.anchor.lon,obj.anchor.lat,canvas.width,canvas.height),factor=canvas.height/1080;obj.offset_x=(p.x-x)/factor;obj.offset_y=(p.y-y)/factor;}
  else if(kind==='Label'||kind==='Marker')obj.anchor=point;
  dragPreview={id,object:obj};drawPreview();
 }
 else if(drag.freehand){let point=snapCreative(creativePoint(p.x,p.y,shapeSpace()),shapeSpace());let previous=drag.freehand.at(-1);if(Math.hypot((point.x??point.lon)-(previous.x??previous.lon),(point.y??point.lat)-(previous.y??previous.lat))>0.00005){drag.freehand.push(point);creativeDraft.points=drag.freehand;drawPreview();}}
 else if(drag.id){const [lon0,lat0]=unproject(store.doc,drag.start.x,drag.start.y,canvas.width,canvas.height),point=[clamp(drag.originalPoint[0]+lon-lon0,-180,180),clamp(drag.originalPoint[1]+lat-lat0,-90,90)];dragPreview={id:drag.id,anchor:{lon:point[0],lat:point[1]}};drawPreview();}
 else if(tool==='pan'||e.buttons===4){let k=scaleFor(store.doc,canvas.width,canvas.height),camera=drag.originalCamera;dragPreview={camera:{center_lon:clamp(camera.center_lon-dx/k,-180,180),center_lat:clamp(camera.center_lat+dy/k,-90,90)}};drawPreview();}
 });
 canvas.addEventListener('pointerup',e=>{if(!drag)return;let p=pointerXY(e),action=drag;drag=null;wrap.classList.remove('dragging');if(action.freehand){creativeDraft.points=action.freehand;if(creativeDraft.points.length>=2)commitCreativeDraft();else creativeDraft=null;}
 else if(action.moved&&dragPreview){let trans=dragPreview;dragPreview=null;if(trans.camera)exec({type:'SetCameraPose',pose:trans.camera});else if(trans.object){let origin=store.doc.objects[trans.id],next=trans.object;let fields={};for(let key of ['from','to','waypoints','points','anchor','screen_pos','offset_x','offset_y'])if(JSON.stringify(origin[key])!==JSON.stringify(next[key]))fields[key]=next[key];if(Object.keys(fields).length)exec({type:'SetProperties',id:trans.id,values:fields});}else if(trans.anchor)exec({type:'SetProperty',id:trans.id,path:'anchor',value:trans.anchor});}
 else if(!action.moved&&e.button===0)canvasClick(p.x,p.y,e);drawPreview();});
 canvas.addEventListener('pointercancel',()=>{drag=null;dragPreview=null;wrap.classList.remove('dragging');drawPreview();});
 canvas.addEventListener('wheel',e=>{e.preventDefault();let p=pointerXY(e),[lon1,lat1]=unproject(store.doc,p.x,p.y,canvas.width,canvas.height);let zoom=clamp(store.doc.camera.zoom*(e.deltaY<0?1.17:1/1.17),.35,80);let draft=clone(store.doc);draft.camera.zoom=zoom;let [lon2,lat2]=unproject(draft,p.x,p.y,canvas.width,canvas.height);exec({type:'SetCameraPose',pose:{zoom,center_lon:clamp(store.doc.camera.center_lon+lon1-lon2,-180,180),center_lat:clamp(store.doc.camera.center_lat+lat1-lat2,-90,90)}});},{passive:false});}
function newProject(){if(store.dirty&&!confirm('Discard unsaved changes and create a new project?'))return;store.replace(newDocument());localStorage.removeItem(currentKey);showToast('New scene created');}
function resetMap(){
 if(!appReady)return;
 if(!confirm('Reset this map to its default state? This clears all objects, styles, labels, and map changes while keeping the current project name. You can undo this action.'))return;
 if(!exec({type:'ResetScene',confirm:true}))return;
 routeFrom=null;drag=null;dragPreview=null;creativeDraft=null;creativeCursor=null;editHandles=false;editOffset=false;soloId=null;
 if(inlineTextEditor){wrap.querySelector('.creative-text-confirm')?.remove();inlineTextEditor.remove();inlineTextEditor=null;}
 expanded.clear();setTool('select');showToast('Map reset to defaults · Undo is available');status('Map reset to defaults');
}
async function downloadable(blob,name){
 if(location.hostname==='wails.localhost'||location.protocol==='wails:'){
   const response=await fetch('/api/desktop/save?name='+encodeURIComponent(name),{
     method:'POST',headers:{'X-CartoRig-Token':sessionToken,'Content-Type':blob.type||'application/octet-stream'},body:blob
   });
   if(response.status===204)return false;
   if(!response.ok)throw Error('Save failed: '+(await response.text()).slice(0,250));
   return true;
 }
 let url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return true;
}
function safeName(){return store.doc.name.trim().replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,70)||'CartoRig_Scene';}
async function saveProject(){try{await production.saveProject();}catch(e){showToast('Project save failed: '+e.message,true);status('Save failed');}}
async function openProject(file){if(!file)return;try{const isZip=(await file.slice(0,2).text())==='PK';let legacy=null;if(!isZip){try{let raw=JSON.parse(await file.text());if(raw?.version===1)legacy=raw;}catch{}}if(legacy){const converted=migrateLegacy(legacy);validateDocument(converted);store.replace(converted);showToast('Map Composer V1 converted; use Save to preserve new project');}else{await production.openFile(file);}scheduleCache();setTab('layers');}catch(e){showToast('Could not open project: '+e.message,true);}}
function canvasForExport(){let cv=document.createElement('canvas');cv.width=store.doc.canvas.width;cv.height=store.doc.canvas.height;return cv;}
function pngBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Canvas memory limit exceeded')),'image/png'));}
async function exportImage(){let btn=$('exportImage');btn.disabled=true;try{status('Rendering PNG…');await document.fonts?.ready;await settleCreativeAssets(store.doc);let cv=canvasForExport();renderScene(cv.getContext('2d'),store.doc,countries,images,cv.width,cv.height);let blob=await pngBlob(cv);if(!await downloadable(blob,safeName()+'.png'))return;cv.width=0;cv.height=0;status('PNG exported');showToast('PNG exported · '+store.doc.canvas.width+' × '+store.doc.canvas.height);}catch(e){showToast('Export failed: '+e.message,true);status('Export failed');}finally{btn.disabled=false;}}
async function exportLayers(){let btn=$('exportLayers');btn.disabled=true;try{await document.fonts?.ready;await settleCreativeAssets(store.doc);let cv=canvasForExport(),context=cv.getContext('2d'),form=new FormData();let doc=store.doc,ids=treeIds(doc).filter(id=>doc.objects[id].type!=='Group'&&isVisible(doc,id));let manifest={app:'CartoRig',version:'2.0.4.1',geographic_datasets:geo?.dataStatus()||[],width:cv.width,height:cv.height,scene_id:doc.project_id,layers:[],background_transparent:doc.canvas.transparent};let total=ids.length+1;for(let [index,id] of ids.entries()){let o=doc.objects[id],file=String(index+1).padStart(3,'0')+'_'+o.type+'_'+o.name.replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,40)+'.png';status('Rendering layer '+(index+1)+'/'+total);renderScene(context,doc,countries,images,cv.width,cv.height,{onlyIds:[id]});let blob=await pngBlob(cv);form.append('layer',blob,file);manifest.layers.push({file,id,type:o.type,name:o.name,visible:true});await new Promise(r=>setTimeout(r,0));}
 if(doc.map_labels&&Object.values(doc.map_labels.enabled||{}).some(Boolean)){
  const count=renderMapLabelLayer(context,doc,images,cv.width,cv.height);
  if(count){form.append('layer',await pngBlob(cv),'Map_Labels.png');manifest.layers.push({file:'Map_Labels.png',id:'map-labels',type:'MapLabels',name:'Map labels',visible:true});}
 }
 renderScene(context,doc,countries,images,cv.width,cv.height);form.append('final',await pngBlob(cv),'Final_Composite.png');form.append('project',JSON.stringify(doc));form.append('manifest',JSON.stringify(manifest));status('Packaging layers…');let res=await fetch('/api/scene-bundle',{method:'POST',headers:{'X-CartoRig-Token':sessionToken},body:form});if(!res.ok)throw Error((await res.text()).slice(0,200));if(!await downloadable(await res.blob(),safeName()+'_Layers.zip'))return;cv.width=0;cv.height=0;status('Layers exported');showToast('Layered ZIP exported · '+ids.length+' individual layers');}catch(e){status('Layer export failed');showToast('Could not export layers: '+e.message,true);}finally{btn.disabled=false;}}
function deleteSelected(){let ids=topSelection();if(!ids.length)return;let names=ids.map(id=>store.doc.objects[id].name);if(!confirm('Delete '+names.length+' selected object(s)?\n'+names.join(', ')))return;for(let id of ids){if(!store.doc.objects[id])continue;let ok=exec({type:'DeleteObject',id});if(!ok&&confirm('This object is referenced. Freeze linked coordinates and delete?'))exec({type:'DeleteObject',id,freeze:true});}}
function bindButtons(){
 $('newProject').onclick=newProject;$('saveProject').onclick=saveProject;$('resetMap').onclick=resetMap;$('openProject').onclick=()=>$('projectFile').click();$('projectFile').onchange=e=>{openProject(e.target.files[0]);e.target.value='';};$('projectName').onchange=e=>exec({type:'SetProjectName',name:e.target.value});$('saveAsProject').onclick=()=>void production.saveProject({downloadFile:true}).catch(e=>showToast('Save As failed: '+e.message,true));
 $('undo').onclick=()=>store.undo();$('redo').onclick=()=>store.redo();$('duplicate').onclick=()=>{if(store.selection.length===1)exec({type:'DuplicateObject',id:store.selection[0]});};$('delete').onclick=deleteSelected;
 $('newGroup').onclick=()=>{if(store.selection.length){if(exec({type:'GroupSelection',ids:store.selection}))expanded.add(store.selection[0]);}else {let o=madeObject('Group','New Group',{children:[]});exec({type:'CreateObject',object:o});expanded.add(o.id);}};
 $('ungroup').onclick=()=>{if(store.selection.length===1)exec({type:'Ungroup',id:store.selection[0]});};$('centerView').onclick=fitSelection;$('worldView').onclick=()=>exec({type:'SetCameraPose',pose:{center_lon:0,center_lat:10,zoom:1,bearing:0}});$('zoomIn').onclick=()=>exec({type:'SetCameraPose',pose:{zoom:store.doc.camera.zoom*1.4}});$('zoomOut').onclick=()=>exec({type:'SetCameraPose',pose:{zoom:store.doc.camera.zoom/1.4}});
 $('toolSelect').onclick=()=>setTool('select');$('toolPan').onclick=()=>setTool('pan');$('toolRegion').onclick=()=>setTool('region');$('toolRoute').onclick=()=>setTool('route');$('toolLabel').onclick=()=>setTool('label');$('toolMarker').onclick=()=>setTool('marker');$('toolShape').onclick=()=>setTool('shape');
 $('creativeAssetFile').onchange=e=>{const id=e.target.dataset.target;if(e.target.files[0])installCreativeIcon(e.target.files[0],id);e.target.value='';};
 $('countrySearch').oninput=()=>queueCountrySearch();$('continent').onchange=()=>{updateCountryFilter();queueCountrySearch(true);};$('geoCountry').onchange=()=>queueCountrySearch(true);$('geoType').onchange=()=>queueCountrySearch(true);$('importDataset').onclick=()=>$('datasetFile').click();$('datasetFile').onchange=async e=>{await importGeoFile(e.target.files?.[0]);e.target.value='';};$('layerSearch').oninput=renderTree;
 document.querySelectorAll('[data-style]').forEach(btn=>btn.onclick=()=>exec({type:'ApplyStyle',id:btn.dataset.style}));$('showBrazilStates').onchange=e=>exec({type:'SetThemeProperty',key:'show_state_boundaries',value:e.target.checked});for(let typ of ['River','Lake','Coastline'])$('show'+typ+'s').onchange=e=>exec({type:'SetThemeProperty',key:`show_${typ.toLowerCase()}s`,value:e.target.checked});
 $('resolution').onchange=e=>{let [width,height]=e.target.value.split('x').map(Number);exec({type:'SetCanvas',canvas:{width,height}});};$('transparent').onchange=e=>exec({type:'SetCanvas',canvas:{transparent:e.target.checked}});$('exportImage').onclick=exportImage;$('exportLayers').onclick=exportLayers;
 window.addEventListener('cartorig-asset-loaded',()=>invalidatePreviewResources());window.addEventListener('keydown',e=>{let editing=e.target.matches('input,textarea,select,[contenteditable=true]');if(e.key==='Escape'){routeFrom=null;if(inlineTextEditor){wrap.querySelector('.creative-text-confirm')?.remove();inlineTextEditor.remove();inlineTextEditor=null;}setTool('select');return;}if(editing)return;
 if(e.key==='Enter'&&creativeDraft){e.preventDefault();commitCreativeDraft();return;}let ctrl=e.ctrlKey||e.metaKey;if(ctrl){if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?store.redo():store.undo();}else if(e.key.toLowerCase()==='y'){e.preventDefault();store.redo();}else if(e.key.toLowerCase()==='s'){e.preventDefault();saveProject();}else if(e.key.toLowerCase()==='o'){e.preventDefault();$('projectFile').click();}else if(e.key.toLowerCase()==='n'){e.preventDefault();newProject();}else if(e.key.toLowerCase()==='d'){e.preventDefault();if(store.selection.length===1)exec({type:'DuplicateObject',id:store.selection[0]});}else if(e.key.toLowerCase()==='g'){e.preventDefault();if(e.shiftKey){if(store.selection.length===1)exec({type:'Ungroup',id:store.selection[0]});}else if(store.selection.length){exec({type:'GroupSelection',ids:store.selection});}}else if(e.key.toLowerCase()==='e'&&e.shiftKey){e.preventDefault();exportLayers();}return;}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}else if(e.key.toLowerCase()==='v')setTool('select');else if(e.key.toLowerCase()==='h')setTool('pan');else if(e.key.toLowerCase()==='r')setTool('route');else if(e.key.toLowerCase()==='t')setTool('label');else if(e.key.toLowerCase()==='m')setTool('marker');else if(e.key.toLowerCase()==='d')setTool('shape');else if(e.key.toLowerCase()==='f')fitSelection();else if(e.key==='0')$('worldView').click();});
}
async function init(){
 bindTabs();bindButtons();setupNavigation();setupCanvas();try{let session=await fetch('/api/session');sessionToken=(await session.json()).token||'';void styleStudio.loadGlobal();}catch(e){status('Session unavailable');showToast('Session initialization failed',true);return;}try{let resp=await fetch('/assets/countries.json');if(!resp.ok)throw Error('HTTP '+resp.status);countries=normalizeCountryIds(await resp.json());byIso=new Map(countries.map(c=>[c.iso,c]));status('Ready · '+countries.length+' countries');}catch(e){status('Dataset error');showToast('Country dataset unavailable: '+e.message,true);return;}
 let geoRead=async(path,fallback)=>{try{let r=await fetch('/assets/geodata/'+path);if(!r.ok)throw Error('Unavailable');return await r.json();}catch(e){console.warn('Optional geo metadata unavailable:',path);return fallback;}};
 const seeds=await geoRead('localities.json',[]),unavailable=await geoRead('admin1-names.json',[]),continents=await geoRead('continents.json',{});
 geo=new GeoCatalog(countries,seeds);geo.continents=continents;geo.setUnavailableStates(unavailable);
 const labelPack=await geoRead('map_labels.json',null);
 if(labelPack?.version===1&&Array.isArray(labelPack.countries)&&Array.isArray(labelPack.states))images._labels=labelPack;
 else showToast('Offline map labels dataset unavailable',true);
 // Ships inside the Go embed.FS package. No user import or Internet required.
 const brStatesResponse=await fetch('/assets/geodata/br_states.geojson');
 if(!brStatesResponse.ok)throw Error('Bundled Brazilian state polygons are missing');
 const brazilStatePack=geo.install('br-states-bundled.geojson',await brStatesResponse.json(),'State');
 const bundledCities=await geoRead('cities_world.geojson',{type:'FeatureCollection',features:[]});
 if(bundledCities.features.length<200)throw Error('Bundled worldwide city points are missing');
 geo.install('ne_110m_populated_places_bundled.geojson',bundledCities,'City');
 if(brazilStatePack.accepted!==27||brazilStatePack.rejected!==0)throw Error('Bundled Brazil Admin 1 data failed validation');
 await restoreGeoPacks();images._geo=geo;geoStatus();
 // Decorative 1.4.7 textures are offline original artwork, never remote maps.
 const materialLoads=MATERIAL_IDS.filter(n=>n!=='none').map(async name=>{
  const image=new Image();images['material-'+name]=image;
  image.src='/assets/look-materials/'+name+'.png';
  try{await image.decode();}catch(e){console.warn('Scene Look material unavailable:',name,e);}
 });
 void Promise.allSettled(materialLoads).then(()=>invalidatePreviewResources());
 for(let t of ['bmng','etopo1','shadedrelief']){let im=new Image();im.src='/assets/'+t+'.jpg';im.onload=()=>{invalidatePreviewResources();};images[t]=im;}
 let existing=null;try{let raw=localStorage.getItem(currentKey);if(raw){existing=JSON.parse(raw);validateDocument(existing);}else{let legacy=JSON.parse(localStorage.getItem(legacyKey)||'null');if(legacy?.version===1)existing=migrateLegacy(legacy);}}catch(e){console.warn('Recovery cache invalid:',e);existing=null;}if(existing){store.replace(existing);status('Recovered previous composition');}else store.replace(newDocument());
 updateCountryFilter();renderCountryList();setTab('layers');setRightTab('styles');syncUI();appReady=true;document.getElementById('app').classList.remove('loading');void production.recoveryCheck();new ResizeObserver(()=>previewScheduler.onResize()).observe(wrap);initDesktopHealth();void Promise.all([ensureWorldAdmin1(),ensureWorldCities()]);
}
init();
