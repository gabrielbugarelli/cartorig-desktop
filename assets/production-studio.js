/* CartoRig 2.0 Production Studio. Browser UI never owns disk paths or ZIPs.
   Filesystem, integrity, and incremental packaging are handled by local Go. */
import {treeIds,isVisible} from './scene-core.js';
import {renderRegionMask,renderMapLabelLayer} from './scene-renderer.js';
import {serializeVectorScene} from './production-vector.js';
import {resolveStyle} from './style-resolver.js';
import {PROJECT_TEMPLATES,createTemplate} from './production-templates.js';
const $=id=>document.getElementById(id);
const waitFrame=()=>new Promise(r=>setTimeout(r,0));
const safe=n=>String(n).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,43)||'Layer';
export function setupProductionStudio({getDoc,getSelection,execute,getCountries,getImages,getToken,replaceDoc,render,settle,download,notify,status,markSaved}){
 let savedProjectId=null,autoTimer=null,exportAbort=null,exportId=null,exportRunning=false;
 const modalFocus=new Map();
 const focusable=modal=>[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden&&!el.closest('[hidden]')&&el.getClientRects().length);
 // Capture shortcuts before the editor hears them while a dialog is active.
 document.addEventListener('keydown',event=>{
  const modal=[...document.querySelectorAll('.prod-overlay')].find(el=>!el.hidden);if(!modal)return;
  if(event.key==='Escape'){
   event.preventDefault();event.stopImmediatePropagation();
   if(!exportRunning)closeModal(modal.id);return;
  }
  if(event.key==='Tab'){
   const items=focusable(modal);if(!items.length){event.preventDefault();return;}
   const first=items[0],last=items.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
  }
  event.stopImmediatePropagation();
 },true);
 const api=async(url,options={})=>{
  let r=await fetch(url,{...options,headers:{'X-CartoRig-Token':getToken(),...(options.headers||{})}});
  if(!r.ok){let t=await r.text();try{t=JSON.parse(t).error||t}catch{}throw Error(t.slice(0,250));}
  return r;
 };
 const json=(url,body)=>api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const selectedValue=(id)=>$(id).value;
 function openModal(id){const modal=$(id);modalFocus.set(id,document.activeElement);modal.hidden=false;(focusable(modal)[0]||modal).focus();}
 function closeModal(id){if(id==='productionExport'&&exportRunning)return;$(id).hidden=true;const last=modalFocus.get(id);if(last?.isConnected)last.focus();modalFocus.delete(id);}
 function syncFormatOptions(){const fmt=selectedValue('prodFormat');
  for(const field of document.querySelectorAll('[data-prod-formats]'))field.hidden=!field.dataset.prodFormats.split(' ').includes(fmt);
  const labels={layered:'Layered PNG ZIP',png:'PNG',transparent:'Transparent PNG',background:'Background PNG',mask:'Region masks',svg:'SVG',project:'.cartorig project'};
  $('prodRun').textContent=fmt==='project'?'Save and download project':'Export '+(labels[fmt]||'package');
 }
 function projectDoc(){return structuredClone(getDoc())}
 async function saveProject({downloadFile=false}={}){
  const snapshot=projectDoc(),rev=snapshot.revision;
  const r=await json('/api/v2/project/save',snapshot);const meta=await r.json();savedProjectId=meta.project_id;
  if(getDoc().project_id===snapshot.project_id&&getDoc().revision===rev)markSaved();
  if(downloadFile){let file=await api('/api/v2/project/download/'+savedProjectId);download(await file.blob(),safe(snapshot.name)+'.cartorig');}
  notify('Project saved locally'+(downloadFile?' and downloaded':''));status('Saved to CartoRig local projects · '+snapshot.name);return meta;
 }
 async function openFile(file){
  if(!file)return;
  if(file.size>48*1024*1024)throw Error('Project exceeds 48 MB limit');
  // Go validates ZIP structure, schema and file magic before replacing SceneStore.
  const response=await api('/api/v2/project/open',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:await file.arrayBuffer()});
  const doc=await response.json();replaceDoc(doc);savedProjectId=null;status('Project opened · '+doc.name);notify('Project opened: '+doc.name);
 }
 function scheduleAutosave(){clearTimeout(autoTimer);autoTimer=setTimeout(async()=>{
   if(!getDoc()||!getToken())return;
   try{await json('/api/v2/autosave',projectDoc());}catch(err){console.warn('Autosave could not complete:',err);status('Autosave unavailable; use Save to preserve the project');}
  },3000);
 }
 // Autosave recovery is available in the project manager, never a startup prompt.
 async function listRecoveries(){
  const response=await api('/api/v2/recovery'),items=await response.json();
  return Array.isArray(items)?items:[];
 }
 async function recoveryCheck(){
  try{
   const items=await listRecoveries(),trigger=$('openProjects');
   trigger.textContent=items.length?'Projects & recovery · '+items.length:'Projects & recovery';
   trigger.title=items.length?items.length+' autosave(s) available':'Saved projects and recovery';
  }catch(e){console.warn('Recovery status unavailable',e);}
 }
 async function renderRecoveries(){
  const section=$('prodRecoverySection'),host=$('prodRecoveries');
  host.replaceChildren();
  const items=await listRecoveries();
  section.hidden=!items.length;
  for(const item of items){
   const button=document.createElement('button');
   button.type='button';button.className='prod-recent';
   button.textContent=item.name+' · Revision '+item.revision+' · Restore copy';
   button.title='Restore autosave as a separate project; back up the current map first';
   button.onclick=async()=>{
    button.disabled=true;
    try{
     await json('/api/v2/autosave',projectDoc());
     const recovered=await(await api('/api/v2/recovery/'+encodeURIComponent(item.id))).json();
     recovered.project_id=crypto.randomUUID();recovered.name+=' (Recovered)';
     replaceDoc(recovered);scheduleAutosave();
     closeModal('productionProjects');
     notify('Recovery opened as a copy');
    }catch(e){button.disabled=false;notify('Recovery failed: '+e.message,true);}
   };
   host.append(button);
  }
 }
 async function recentProjects(){let list=await (await api('/api/v2/project/recent')).json();let content=$('prodRecent');content.replaceChildren();if(!list.length){content.textContent='No saved projects yet.';return};for(let x of list){let b=document.createElement('button');b.className='prod-recent';b.textContent=x.name+'  ·  Revision '+x.revision+'  ·  '+x.modified;b.onclick=async()=>{try{if(getDoc()&&confirm('Open saved project? Unsaved changes in the current scene will be discarded.')===false)return;let data=await (await api('/api/v2/project/load?id='+encodeURIComponent(x.id))).json();replaceDoc(data);savedProjectId=x.id;closeModal('productionProjects');notify('Opened '+x.name)}catch(e){notify('Cannot open recent project: '+e.message,true)}};content.append(b)}}
 async function projects(){
    await recentProjects();await renderRecoveries();const builtins=$('prodTemplates');builtins.replaceChildren();
    for(const t of PROJECT_TEMPLATES){const b=document.createElement('button');b.className='prod-recent';b.textContent=t.name+' — '+t.description;b.onclick=()=>{if(!confirm('Create a new project from this template? The current project will be replaced.'))return;replaceDoc(createTemplate(t.id));closeModal('productionProjects');notify('Template created: '+t.name)};builtins.append(b)}
    const customs=$('prodCustomTemplates');customs.replaceChildren();
    try{const list=await (await api('/api/v2/project/templates')).json();for(const t of list){const b=document.createElement('button');b.className='prod-recent';b.textContent=t.name;b.onclick=async()=>{if(!confirm('Create a project from this custom template?'))return;const d=await (await api('/api/v2/project/template/'+t.id)).json();d.project_id=crypto.randomUUID();d.revision=0;d.name+=' (Copy)';replaceDoc(d);closeModal('productionProjects')};customs.append(b)}}catch(e){console.warn('Custom templates unavailable',e)}
    openModal('productionProjects')
  }
 function selectedIds(doc){return treeIds(doc).filter(id=>doc.objects[id]?.type!=='Group'&&isVisible(doc,id))}
 function preflight(){const doc=getDoc();const warnings=[],errors=[];
  let [width,height]=selectedValue('prodResolution').split('x').map(Number),scope=selectedValue('prodScope'),fmt=selectedValue('prodFormat');
  const all=selectedIds(doc),selection=getSelection();const transparent=$('prodTransparent').checked||fmt==='transparent';const includeBackground=$('prodIncludeBackground').checked&&!transparent;let ids=all.filter(id=>includeBackground||doc.objects[id].type!=='WorldMap');
  if(scope==='selected')ids=all.filter(id=>selection.includes(id));
  if(scope==='group'){let g=doc.objects[selection[0]];if(g?.type==='Group'){let permitted=new Set(treeIds(doc,g.id));ids=all.filter(id=>permitted.has(id))}else errors.push('Select one Group in the Scene Explorer')}
  if(fmt==='mask')ids=ids.filter(id=>doc.objects[id].type==='Region');if(fmt==='background')ids=all.filter(id=>['WorldMap','Grid','Borders'].includes(doc.objects[id].type));
  if(['png','transparent'].includes(fmt)&&scope==='selected'&&ids.length===0)errors.push('Select an object to export');
  if(!['png','transparent','project'].includes(fmt)&&ids.length===0)errors.push('No eligible visible objects');
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<64||height<64||width*height>60000000)errors.push('Invalid composition resolution');
  if(width*height*4>125*1024*1024)warnings.push('8K will use 1024px tiled rendering with local Go assembly; actual speed depends on effects and hardware.');
  if(fmt==='svg'){warnings.push('Raster Scene Looks, advanced effects, unsupported symbols and image assets are omitted from Vector Only SVG');}
  for(let asset of doc.asset_refs||[]){if(!asset.data)warnings.push('Missing project asset: '+(asset.name||asset.id))}
  return {width,height,scope,fmt,ids,all,transparent,includeBackground,warnings,errors,tiled:$('prodUseTiles').checked || width*height>24_000_000};
 }
 function showPreflight(){syncFormatOptions();const p=preflight(),host=$('prodPreflight');host.replaceChildren();const row=(msg,kind)=>{let d=document.createElement('div');d.className='prod-msg '+kind;d.textContent=msg;host.append(d)};
  const detail=$('prodDetailText');detail.textContent=p.fmt==='project'?'All project objects and assets':`${p.width}×${p.height} · ${p.ids.length} eligible objects · ${p.fmt.toUpperCase()} · ~${Math.round(p.width*p.height*4/1048576)} MiB RGBA per surface`;p.errors.forEach(x=>row(x,'error'));p.warnings.forEach(x=>row(x,'warning'));$('prodRun').disabled=p.errors.length>0||exportRunning;return p;
 }
 const pngBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('PNG encoding failed; canvas memory limit')), 'image/png'));
 async function exportPackage(){
  if(exportRunning)return;const p=showPreflight();if(p.errors.length)return;
  if(p.fmt==='project'){try{await saveProject({downloadFile:true});$('prodProgress').textContent='Portable .cartorig project downloaded'}catch(e){notify(e.message,true)}return}
  if(p.warnings.length&&!confirm(p.warnings.join('\n')+'\n\nContinue with these limitations?'))return;
  exportRunning=true;exportAbort=new AbortController();$('prodCancelExport').hidden=false;$('prodRun').disabled=true;
  let job=null;let cv=null;
  try{await document.fonts?.ready;await settle(getDoc());const doc=projectDoc();doc.canvas.transparent=p.transparent;
   let start=await json('/api/v2/export/session',{width:p.width,height:p.height,project:doc,warnings:p.warnings});job=(await start.json()).id;exportId=job;
   async function send(name,blob,index,total){
    if(exportAbort.signal.aborted)throw Error('Export canceled');
    const label=`Rendering ${index}/${total} · ${name}`;status(label);$('prodProgress').textContent=label;await api('/api/v2/export/session/'+job+'/entry?name='+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':name.endsWith('.svg')?'image/svg+xml':'image/png'},body:blob,signal:exportAbort.signal});
    await waitFrame();
   }
   const paddedCanvas=document.createElement('canvas');
   let total=['png','transparent','background','svg'].includes(p.fmt)?1:p.fmt==='mask'?p.ids.length:p.ids.length+1;
   // Extended effects need extra source pixels on every side of a tile.
   // For extreme effects we stop rather than silently clip a shadow/glow.
   // The final output dimensions remain fixed: a tile never gets a new camera.
   async function renderEntry(name,ids,maskObject=null,index=1,total=1,labelsOnly=false){
     const useLabels=!labelsOnly&&!maskObject&&['final.png','background.png'].includes(name)&&['scene','visible'].includes(p.scope);
     if(!p.tiled){
       if(!cv){cv=document.createElement('canvas');cv.width=p.width;cv.height=p.height;}
       const ctx=cv.getContext('2d',{alpha:true});if(!ctx)throw Error('Canvas output unsupported');
       if(maskObject)renderRegionMask(ctx,doc,maskObject,getCountries(),getImages(),p.width,p.height,{opaque:$('prodMaskOpaque').checked});
       else if(labelsOnly)renderMapLabelLayer(ctx,doc,getImages(),p.width,p.height);
       else render(ctx,doc,getCountries(),getImages(),p.width,p.height,{onlyIds:ids,includeMapLabels:useLabels});
       await send(name,await pngBlob(cv),index,total);return;
     }
     let pad=24,scale=p.height/1080;
     for(const o of Object.values(doc.objects)){
       const st=resolveStyle(doc,o);
       const blur=st.shadow_enabled?3*Number(st.shadow_blur||0)+Number(st.shadow_distance||0):0;
       const glow=st.glow_enabled?3*Number(st.glow_radius||0):0;
       pad=Math.max(pad,Math.ceil((blur+glow)*scale));
     }
     if(pad>1024)throw Error('Effects exceed tile overscan capacity. Reduce Shadow/Glow strength or use a smaller output.');
     let tilesX=Math.ceil(p.width/1024),tilesY=Math.ceil(p.height/1024),tileNo=0;
     for(let ty=0;ty<p.height;ty+=1024)for(let tx=0;tx<p.width;tx+=1024){
       if(exportAbort.signal.aborted)throw Error('Export canceled');
       const x0=Math.max(0,tx-pad),y0=Math.max(0,ty-pad),x1=Math.min(p.width,tx+1024+pad),y1=Math.min(p.height,ty+1024+pad);
       const tile={x:x0,y:y0,width:x1-x0,height:y1-y0};paddedCanvas.width=tile.width;paddedCanvas.height=tile.height;
       const ctx=paddedCanvas.getContext('2d',{alpha:true});if(!ctx)throw Error('Canvas tiles unsupported');
       if(maskObject)renderRegionMask(ctx,doc,maskObject,getCountries(),getImages(),p.width,p.height,{opaque:$('prodMaskOpaque').checked,tile});
       else if(labelsOnly)renderMapLabelLayer(ctx,doc,getImages(),p.width,p.height,{tile});
       else render(ctx,doc,getCountries(),getImages(),p.width,p.height,{onlyIds:ids,tile,includeMapLabels:useLabels});
       const blob=await pngBlob(paddedCanvas);tileNo++;
       const label=`Exporting ${index}/${total} · tile ${tileNo}/${tilesX*tilesY} · ${name}`;status(label);$('prodProgress').textContent=label;
       const query=new URLSearchParams({name,x:String(tx),y:String(ty),cx:String(tx-x0),cy:String(ty-y0)});
       await api('/api/v2/export/session/'+job+'/tile?'+query,{method:'POST',headers:{'Content-Type':'image/png'},body:blob,signal:exportAbort.signal});
       await waitFrame();
     }
     paddedCanvas.width=0;paddedCanvas.height=0;
   }
   if(p.fmt==='svg'){
    const out=serializeVectorScene(doc,getCountries(),getImages()._geo,p.width,p.height,{onlyIds:p.ids,labels:getImages()._labels,includeMapLabels:['scene','visible'].includes(p.scope)});await send('scene.svg',new Blob([out.svg],{type:'image/svg+xml'}),1,1);
   }else{
    let count=0;
    if(p.fmt==='mask')for(const id of p.ids){await renderEntry('mask_'+safe(doc.objects[id].name)+'_'+id.slice(0,8)+'.png',[id],doc.objects[id],++count,total)}
    else if(['png','transparent','background'].includes(p.fmt)){
     await renderEntry(p.fmt==='background'?'background.png':'final.png',p.scope==='scene'&&p.includeBackground?null:p.ids,null,1,1);
    }else{
     let groups=[];const grouping=selectedValue('prodGranularity');
     if(grouping==='group'){
      for(const id of doc.scene.root_ids){const o=doc.objects[id];if(o.type==='Group'){const permitted=new Set(treeIds(doc,id));const g=p.ids.filter(x=>permitted.has(x));if(g.length)groups.push({name:o.name,id,ids:g})}else if(p.ids.includes(id))groups.push({name:o.name,id,ids:[id]})}
     }else if(grouping==='category'){
      const types=[...new Set(p.ids.map(id=>doc.objects[id].type))];groups=types.map(type=>({name:type,id:type,ids:p.ids.filter(id=>doc.objects[id].type===type)}));
     }else groups=p.ids.map(id=>({name:doc.objects[id].name,id,ids:[id]}));
     const mapLabelsEnabled=['scene','visible'].includes(p.scope)&&getImages()._labels&&Object.values(doc.map_labels?.enabled||{}).some(Boolean);
     total=groups.length+1+(mapLabelsEnabled?1:0);
     for(const [i,g] of groups.entries())await renderEntry(String(i+1).padStart(3,'0')+'_'+safe(g.name)+'_'+g.id.slice(0,8)+'.png',g.ids,null,++count,total);
     if(mapLabelsEnabled)await renderEntry('Map_Labels.png',null,null,++count,total,true);
     await renderEntry('final.png',p.scope==='scene'&&p.includeBackground?null:p.ids,null,++count,total);
    }
   }
   $('prodProgress').textContent='Packaging, validating and computing checksums…';await api('/api/v2/export/session/'+job+'/finish',{method:'POST'});
   const file=await api('/api/v2/export/download/'+job);download(await file.blob(),safe(doc.name)+'_Production.zip');
   $('prodProgress').textContent='Complete · verified production ZIP';status('Production export complete');notify('Production package exported');
  }catch(e){$('prodProgress').textContent='Export canceled or failed: '+e.message;notify('Export error: '+e.message,true);status('Production export not completed');}
  finally{if(cv){cv.width=0;cv.height=0}if(job){try{await api('/api/v2/export/session/'+job,{method:'DELETE'})}catch{}}exportId=null;exportRunning=false;exportAbort=null;$('prodCancelExport').hidden=true;showPreflight()}
 }
 function refreshExportPresets(){const el=$('prodPreset'),prior=el.value;el.replaceChildren();const none=document.createElement('option');none.value='';none.textContent='Choose a saved export preset';el.append(none);for(const p of getDoc().export_presets||[]){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;el.append(o)}if([...el.options].some(x=>x.value===prior))el.value=prior}
 function saveExportPreset(){let name=prompt('Export preset name');if(!name)return;name=name.trim().slice(0,75);if(!name)return;const config={scope:selectedValue('prodScope'),fmt:selectedValue('prodFormat'),granularity:selectedValue('prodGranularity'),resolution:selectedValue('prodResolution'),tiled:$('prodUseTiles').checked,maskOpaque:$('prodMaskOpaque').checked,transparent:$('prodTransparent').checked,includeBackground:$('prodIncludeBackground').checked};const presets=[...(getDoc().export_presets||[]),{id:crypto.randomUUID(),name,config}];if(execute({type:'SetExportPresets',presets})){refreshExportPresets();notify('Export preset saved')}}
 function applyExportPreset(){const p=(getDoc().export_presets||[]).find(x=>x.id===selectedValue('prodPreset'));if(!p)return;const c=p.config;for(const [id,key] of [['prodScope','scope'],['prodFormat','fmt'],['prodGranularity','granularity'],['prodResolution','resolution']]){if([...$(id).options].some(x=>x.value===c[key]))$(id).value=c[key]};$('prodUseTiles').checked=!!c.tiled;$('prodMaskOpaque').checked=!!c.maskOpaque;$('prodTransparent').checked=!!c.transparent;$('prodIncludeBackground').checked=c.includeBackground!==false;showPreflight()}
 function deleteExportPreset(){const id=selectedValue('prodPreset');if(!id||!confirm('Delete this export preset?'))return;execute({type:'SetExportPresets',presets:(getDoc().export_presets||[]).filter(x=>x.id!==id)});refreshExportPresets()}
 function openExport(){refreshExportPresets();$('prodTransparent').checked=!!getDoc().canvas.transparent;openModal('productionExport');showPreflight()}
 async function cancelExport(){if(exportAbort){exportAbort.abort();$('prodProgress').textContent='Canceling export…';if(exportId){try{await api('/api/v2/export/session/'+exportId,{method:'DELETE'})}catch{}}}}
 function bind(){
  $('openProduction').onclick=openExport;$('prodClose').onclick=()=>closeModal('productionExport');$('prodRun').onclick=()=>void exportPackage();$('prodCancelExport').onclick=()=>void cancelExport();$('prodSavePreset').onclick=saveExportPreset;$('prodApplyPreset').onclick=applyExportPreset;$('prodDeletePreset').onclick=deleteExportPreset;
  $('openProjects').onclick=()=>void projects().catch(e=>notify(e.message,true));$('prodProjectsClose').onclick=()=>closeModal('productionProjects');$('prodSave').onclick=()=>void saveProject().catch(e=>notify('Save failed: '+e.message,true));$('prodSaveAs').onclick=()=>void saveProject({downloadFile:true}).catch(e=>notify('Save As failed: '+e.message,true));$('prodSaveTemplate').onclick=()=>void json('/api/v2/project/template',projectDoc()).then(()=>{notify('Project saved as reusable template');return recentProjects()}).catch(e=>notify('Template save failed: '+e.message,true));
  for(let id of ['prodScope','prodFormat','prodGranularity','prodResolution','prodMaskOpaque','prodTransparent','prodIncludeBackground','prodUseTiles'])$(id).addEventListener('change',showPreflight);
 }
 bind();
 window.addEventListener('pagehide',()=>{if(autoTimer){clearTimeout(autoTimer);try{fetch('/api/v2/autosave',{method:'POST',headers:{'X-CartoRig-Token':getToken(),'Content-Type':'application/json'},body:JSON.stringify(getDoc()),keepalive:true}).catch(()=>{})}catch{}}});
 return {saveProject,openFile,scheduleAutosave,recoveryCheck,openExport,openProjects:projects,preflight,showPreflight,exportPackage};
}
