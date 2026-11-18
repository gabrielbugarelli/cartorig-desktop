'use strict';
/* Map Composer — offline canvas renderer. Copyright 2026 Map Composer contributors. MIT. */
const $ = (id) => document.getElementById(id);
const canvas = $('mapCanvas'), canvasWrap = $('canvasWrap');
const ctx = canvas.getContext('2d',{alpha:true});
const storeKey='map-composer-project-v1';
const COUNTRY_ALIASES={
  'Brazil':['Brasil'],'United States of America':['Estados Unidos','EUA','USA','Estados Unidos da América'],
  'Russia':['Rússia','Federacao Russa','Federação Russa'],'China':['China'],
  'Germany':['Alemanha'],'France':['França'],'United Kingdom':['Reino Unido','Inglaterra'],
  'Spain':['Espanha'],'Italy':['Itália'],'Turkey':['Turquia','Türkiye'],
  'Ukraine':['Ucrânia'],'Poland':['Polônia'],'Iran':['Irã'],'Iraq':['Iraque'],
  'South Korea':['Coreia do Sul'],'North Korea':['Coreia do Norte'],
  'Saudi Arabia':['Arábia Saudita'],'India':['Índia'],'Japan':['Japão'],
  'South Africa':['África do Sul'],'Egypt':['Egito'],'Argentina':['Argentina'],
  'Venezuela':['Venezuela'],'Colombia':['Colômbia'],'Mexico':['México'],
  'Netherlands':['Holanda','Países Baixos'],'Switzerland':['Suíça'],
  'Sweden':['Suécia'],'Norway':['Noruega'],'Finland':['Finlândia'],
  'Denmark':['Dinamarca'],'Czechia':['Tchéquia','República Tcheca'],
  'Greece':['Grécia'],'Israel':['Israel'],'Syria':['Síria'],'Libya':['Líbia'],
  'Dem. Rep. Congo':['Congo RDC','República Democrática do Congo'],
  'Antarctica':['Antártida'], 'Australia':['Austrália'], 'New Zealand':['Nova Zelândia'],
  'Morocco':['Marrocos'],'Algeria':['Argélia'],'Niger':['Níger'],'Nigeria':['Nigéria']
};
const PALETTES={
 dark:{ocean:'#0d1a27',land:'#273746',border:'#8596a7',grid:'#6888a3',text:'#e9edf2',accent:'#db7657'},
 atlas:{ocean:'#c4d1ca',land:'#e3d6b8',border:'#756c5c',grid:'#948c78',text:'#352e26',accent:'#aa5e48'},
 tactical:{ocean:'#0b1719',land:'#1e3834',border:'#678e7d',grid:'#638878',text:'#d4e7d4',accent:'#d8b475'},
 relief:{ocean:'#1a4053',land:'#8c9c81',border:'#3e5552',grid:'#d3e6de',text:'#f1f6ec',accent:'#d7684f',texture:'shadedrelief'},
 satellite:{ocean:'#112c49',land:'#748c68',border:'#bbd5c0',grid:'#bedbc6',text:'#f1f6f7',accent:'#e47a58',texture:'bmng'},
 night:{ocean:'#040912',land:'#111d2b',border:'#47667e',grid:'#394f64',text:'#e5edf8',accent:'#e8a153'},
 elevation:{ocean:'#325979',land:'#9b9775',border:'#687a6b',grid:'#c6d3c7',text:'#f6f2e8',accent:'#e28664',texture:'etopo1'}
};
const defaults=()=>({version:1,name:'Geopolitica — 01',style:'dark',view:{cx:0,cy:10,zoom:1},
  layers:{background:true,grid:true,borders:true,highlights:true,routes:true,labels:true},
  highlights:[],labels:[],routes:[],borderColor:'#8c9aad',borderWidth:1.2,
  highlightColor:'#d86c52',highlightOpacity:80,resolution:'3840x2160',transparent:false});
let state=defaults(),countries=[],images={},mode='pan',routeStart=null,mouseDown=null,mouseMoved=false,previewWidth=0,previewHeight=0,toastTimer=0,saveTimer=0;
const norm=(t)=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const status=(s)=>{$('status').textContent=s};
function toast(s,isError=false){let t=$('toast');t.textContent=s;t.hidden=false;t.classList.toggle('error',isError);clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,4300)}
function saveDebounced(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storeKey,JSON.stringify(state))}catch{}},300)}
function touch(){saveDebounced();drawPreview();}
function setMode(m){mode=mode===m?'pan':m;routeStart=null;canvasWrap.classList.toggle('route-mode',mode==='route');canvasWrap.classList.toggle('label-mode',mode==='label');$('addLabel').classList.toggle('primary',mode==='label');$('addRoute').classList.toggle('primary',mode==='route');$('modeTag').hidden=mode==='pan';$('modeTag').textContent=mode==='route'?'Rota: clique no ponto inicial, depois no final · Esc cancela':'Texto: clique no mapa para posicionar · Esc cancela';status(mode==='pan'?'Navegação':'Ferramenta '+mode+' ativa')}
function restore(){try{let s=JSON.parse(localStorage.getItem(storeKey)||'null');if(s&&s.version===1){let d=defaults();state={...d,...s,view:{...d.view,...s.view},layers:{...d.layers,...s.layers}};for(let k of ['highlights','routes','labels']) if(!Array.isArray(state[k]))state[k]=[];if(!PALETTES[state.style])state.style='dark';}}catch{state=defaults()}}
function updateUI(){
 $('projectName').value=state.name;$('stageName').textContent=state.name;
 $('highlightColor').value=state.highlightColor;$('borderColor').value=state.borderColor;
 $('highlightOpacity').value=state.highlightOpacity;$('opacityValue').textContent=state.highlightOpacity+'%';
 $('borderWidth').value=state.borderWidth;$('borderValue').textContent=state.borderWidth;
 $('resolution').value=state.resolution;$('transparent').checked=state.transparent;
 document.querySelectorAll('[data-layer]').forEach(el=>el.checked=!!state.layers[el.dataset.layer]);
 document.querySelectorAll('[data-style]').forEach(el=>el.classList.toggle('active',el.dataset.style===state.style));
 renderCountryList();renderHighlights();updateCounts();drawPreview();
}
function updateCounts(){
 $('selectedCount').textContent=state.highlights.length;$('labelCount').textContent=state.labels.length+' texto(s)';$('routeCount').textContent=state.routes.length+' rota(s)';$('zoomValue').textContent=Math.round(state.view.zoom*100)+'%';
}
function renderCountryList(){
 let q=norm($('countrySearch').value),ct=$('continent').value;
 let items=countries.filter(c=>(!ct||c.continent===ct)&&(!q||norm(c.name).includes(q)||norm(c.iso).includes(q)||(COUNTRY_ALIASES[c.name]||[]).some(a=>norm(a).includes(q))));
 items.sort((a,b)=>a.name.localeCompare(b.name));
 // Search empty: show a short curated list instead of all 177.
 if(!q&&!ct){let priority=['Brazil','United States of America','Russia','China','Ukraine','Germany','France','United Kingdom','India','Iran','Israel','Turkey'];items=priority.map(n=>countries.find(c=>c.name===n)).filter(Boolean)}
 $('resultCount').textContent=items.length+' países';
 let root=$('countryResults');root.replaceChildren();
 if(!items.length){let div=document.createElement('div');div.className='placeholder';div.textContent='Nenhuma correspondência na base offline.';root.append(div);return}
 for(let c of items.slice(0,120)){
  let b=document.createElement('button');b.className='country';b.title='Clique para destacar ou remover do destaque';
  let iso=document.createElement('span');iso.className='ccode';iso.textContent=c.iso;
  let name=document.createElement('span');name.className='cname';name.textContent=c.name;
  let plus=document.createElement('span');plus.className='plus'+(state.highlights.some(h=>h.iso===c.iso)?' on':'');plus.textContent=state.highlights.some(h=>h.iso===c.iso)?'●':'+';
  b.append(iso,name,plus);b.onclick=()=>toggleCountry(c.iso);root.append(b);
 }
}
function renderHighlights(){
 const root=$('highlights');root.replaceChildren();
 if(!state.highlights.length){let s=document.createElement('span');s.className='placeholder';s.textContent='Selecione países acima ou clique no mapa.';root.append(s);return}
 for(let h of state.highlights){const country=countries.find(c=>c.iso===h.iso),item=document.createElement('div');item.className='highlight-item';
  const color=document.createElement('input');color.type='color';color.value=h.color;color.title='Cor individual do território';color.oninput=()=>{h.color=color.value;touch()};
  const nm=document.createElement('span');nm.className='name';nm.textContent=country?.name||h.iso;nm.title=nm.textContent;
  const fit=document.createElement('button');fit.className='fit-button';fit.title='Enquadrar país';fit.textContent='◎';fit.onclick=()=>fitCountry(h.iso);
  const del=document.createElement('button');del.textContent='×';del.title='Remover destaque';del.onclick=()=>toggleCountry(h.iso);
  item.append(color,nm,fit,del);root.append(item);
 }
}
function toggleCountry(iso){let i=state.highlights.findIndex(h=>h.iso===iso);if(i>=0){state.highlights.splice(i,1);status('País removido do destaque')}else{state.highlights.push({iso,color:state.highlightColor});status('País destacado · arraste o mapa ou enquadre pela lista')}renderCountryList();renderHighlights();updateCounts();touch()}
function geometryPolygons(c){return c.geometry.type==='Polygon'?[c.geometry.coordinates]:c.geometry.coordinates}
function getBBox(country){let minx=180,miny=90,maxx=-180,maxy=-90;for(let polygon of geometryPolygons(country))for(let ring of polygon)for(let p of ring){minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1]);}return {minx,miny,maxx,maxy}}
function fitCountry(iso){const c=countries.find(c=>c.iso===iso);if(!c)return;const bb=getBBox(c);state.view.cx=(bb.minx+bb.maxx)/2;state.view.cy=(bb.miny+bb.maxy)/2;const w=previewWidth||1280,h=previewHeight||720;const fit=Math.min(w/360,h/180);const dx=Math.max(10,bb.maxx-bb.minx),dy=Math.max(7,bb.maxy-bb.miny);state.view.zoom=clamp(Math.min(.77*w/dx,.77*h/dy)/fit,.8,70);updateCounts();touch();}
function fitHighlights(){if(!state.highlights.length){worldView();return}let b={minx:180,miny:90,maxx:-180,maxy:-90};for(let h of state.highlights){let c=countries.find(c=>c.iso===h.iso);if(!c)continue;let r=getBBox(c);for(let k of ['minx','miny'])b[k]=Math.min(b[k],r[k]);for(let k of ['maxx','maxy'])b[k]=Math.max(b[k],r[k])}state.view.cx=(b.minx+b.maxx)/2;state.view.cy=(b.miny+b.maxy)/2;let s=Math.min(previewWidth/360,previewHeight/180);state.view.zoom=clamp(Math.min(previewWidth*.79/Math.max(12,b.maxx-b.minx),previewHeight*.79/Math.max(8,b.maxy-b.miny))/s,.8,70);updateCounts();touch();}
function worldView(){state.view={cx:0,cy:0,zoom:1};updateCounts();touch()}
function scaleFor(w,h){return Math.min(w/360,h/180)*clamp(Number(state.view.zoom)||1,.35,80)}
function project(lon,lat,w,h){let k=scaleFor(w,h);return [w/2+(lon-state.view.cx)*k,h/2+(state.view.cy-lat)*k]}
function unproject(px,py,w,h){let k=scaleFor(w,h);return [clamp(state.view.cx+(px-w/2)/k,-180,180),clamp(state.view.cy-(py-h/2)/k,-90,90)]}
function paintBase(c,w,h){let p=PALETTES[state.style];c.fillStyle=p.ocean;c.fillRect(0,0,w,h);
 if(p.texture){let img=images[p.texture];if(img?.complete&&img.naturalWidth){let k=scaleFor(w,h),[x,y]=project(-180,90,w,h);c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(img,x,y,360*k,180*k);c.restore();return}}
 // Countries serve as the base for stylized presets.
 c.fillStyle=p.land;
 for(let country of countries){drawCountryPath(c,country,w,h);c.fill('evenodd')}
 if(state.style==='night'){
  // Lightweight simulated atmospheric edge for cinematic night preset.
  let g=c.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,Math.max(w,h)*.8);g.addColorStop(0,'#00000000');g.addColorStop(1,'#000000aa');c.fillStyle=g;c.fillRect(0,0,w,h);
 }
}
function drawCountryPath(c,geo,w,h){c.beginPath();let k=scaleFor(w,h),x0=w/2-state.view.cx*k,y0=h/2+state.view.cy*k;
 for(let polygon of geometryPolygons(geo))for(let ring of polygon){let moved=false;for(let point of ring){let x=x0+point[0]*k,y=y0-point[1]*k;if(!moved){c.moveTo(x,y);moved=true}else c.lineTo(x,y)}if(moved)c.closePath()}
}
function drawGrid(c,w,h){let p=PALETTES[state.style];c.save();c.strokeStyle=p.grid;c.globalAlpha=state.style==='atlas'?.28:.18;c.lineWidth=Math.max(.5,w/2200);
 let zoom=state.view.zoom,inc=zoom>20?2:zoom>8?5:zoom>3?10:30;
 c.beginPath();for(let x=-180;x<=180;x+=inc){let a=project(x,-90,w,h),b=project(x,90,w,h);c.moveTo(...a);c.lineTo(...b)}for(let y=-90;y<=90;y+=inc){let a=project(-180,y,w,h),b=project(180,y,w,h);c.moveTo(...a);c.lineTo(...b)}c.stroke();c.restore()}
function drawBorders(c,w,h){let p=PALETTES[state.style];c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle=state.borderColor||p.border;c.globalAlpha=state.style==='satellite'?.8:.72;c.lineWidth=Math.max(.3,state.borderWidth*w/1920);for(let country of countries){drawCountryPath(c,country,w,h);c.stroke()}c.restore()}
function drawHighlights(c,w,h){c.save();c.lineJoin='round';c.lineCap='round';let k=Math.max(1,w/1920);for(let hlt of state.highlights){let country=countries.find(c=>c.iso===hlt.iso);if(!country)continue;drawCountryPath(c,country,w,h);c.fillStyle=hlt.color||state.highlightColor;c.globalAlpha=state.highlightOpacity/100;c.fill('evenodd');c.strokeStyle=hlt.color||state.highlightColor;c.globalAlpha=.95;c.lineWidth=2*k;c.stroke()}c.restore()}
function drawRoutes(c,w,h){c.save();let factor=Math.max(.8,w/1920);for(let rt of state.routes){let a=project(rt.from[0],rt.from[1],w,h),b=project(rt.to[0],rt.to[1],w,h);
  let angle=Math.atan2(b[1]-a[1],b[0]-a[0]);c.lineWidth=2.8*factor;c.lineCap='round';c.strokeStyle=rt.color||'#efb95c';c.fillStyle=rt.color||'#efb95c';c.shadowColor=rt.color||'#efb95c';c.shadowBlur=5*factor;c.setLineDash([8*factor,6*factor]);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.setLineDash([]);
  c.beginPath();c.moveTo(b[0],b[1]);c.lineTo(b[0]-14*factor*Math.cos(angle-.5),b[1]-14*factor*Math.sin(angle-.5));c.lineTo(b[0]-14*factor*Math.cos(angle+.5),b[1]-14*factor*Math.sin(angle+.5));c.closePath();c.fill();c.shadowBlur=0;
  for(let p of [a,b]){c.beginPath();c.arc(...p,3.5*factor,0,Math.PI*2);c.fill()}
 }c.restore()}
function drawLabels(c,w,h){c.save();let p=PALETTES[state.style],factor=Math.max(.5,w/1920);for(let label of state.labels){let [x,y]=project(label.point[0],label.point[1],w,h);let size=clamp(Number(label.size)||25,12,120)*factor;
  c.font=`700 ${size}px "Segoe UI",Arial,sans-serif`;c.textBaseline='middle';c.textAlign='center';c.lineJoin='round';c.lineWidth=5*factor;c.strokeStyle='#08111edd';c.strokeText(label.text,x,y);c.fillStyle=label.color||p.text;c.shadowColor='#000a';c.shadowBlur=9*factor;c.fillText(label.text,x,y);c.shadowBlur=0;
 }c.restore()}
const RENDER_ORDER=['background','grid','borders','highlights','routes','labels'];
function renderTo(c,w,h,only=null){c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);
  if(!only&&state.transparent){const tile=18*w/1920;c.fillStyle='#19232e';c.fillRect(0,0,w,h);c.fillStyle='#23303d';for(let y=0;y<h;y+=tile*2)for(let x=0;x<w;x+=tile*2){c.fillRect(x,y,tile,tile);c.fillRect(x+tile,y+tile,tile,tile)}}
  for(let l of RENDER_ORDER){if(only&&l!==only)continue;if(!state.layers[l])continue;
    if(l==='background'){if(!state.transparent||only==='background')paintBase(c,w,h)}
    else if(l==='grid')drawGrid(c,w,h);
    else if(l==='borders')drawBorders(c,w,h);
    else if(l==='highlights')drawHighlights(c,w,h);
    else if(l==='routes')drawRoutes(c,w,h);
    else if(l==='labels')drawLabels(c,w,h);
  }
  c.restore()}
// The exported final PNG must remain genuinely transparent; preview checkerboard is not included.
function renderExport(c,w,h,only=null){c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);
 for(let l of RENDER_ORDER){if(only && only!==l)continue;if(!state.layers[l])continue;
  if(l==='background'){if(!state.transparent||only==='background')paintBase(c,w,h)}
  if(l==='grid')drawGrid(c,w,h);
  if(l==='borders')drawBorders(c,w,h);
  if(l==='highlights')drawHighlights(c,w,h);
  if(l==='routes')drawRoutes(c,w,h);
  if(l==='labels')drawLabels(c,w,h);
 }c.restore()}
function drawPreview(){let box=canvas.getBoundingClientRect(),w=Math.max(20,Math.round(box.width)),h=Math.max(20,Math.round(box.height));previewWidth=w;previewHeight=h;let dpr=Math.min(devicePixelRatio||1,2);
 let pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}renderTo(ctx,pw,ph);$('previewSize').textContent=pw+' × '+ph;updateCounts()}
function eventXY(ev){let r=canvas.getBoundingClientRect();return {x:(ev.clientX-r.left)/r.width*previewWidth,y:(ev.clientY-r.top)/r.height*previewHeight}}
function insideRing(lon,lat,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){let a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat) && lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function pointInCountry(lon,lat,c){for(let polygon of geometryPolygons(c))if(insideRing(lon,lat,polygon[0])&&!polygon.slice(1).some(r=>insideRing(lon,lat,r)))return true;return false}
function countryAt(lon,lat){return countries.find(c=>pointInCountry(lon,lat,c))}
function canvasClick(x,y){let [lon,lat]=unproject(x,y,previewWidth,previewHeight);
 if(mode==='label'){
  let text=prompt('Texto do mapa (até 100 caracteres):','PONTO ESTRATÉGICO');if(text?.trim()){state.labels.push({id:Date.now()+Math.random(),text:text.trim().slice(0,100),point:[lon,lat],size:27,color:'#f3eee7'});setMode('pan');touch()}return;
 }
 if(mode==='route'){
  if(!routeStart){routeStart=[lon,lat];status('Rota: agora selecione o destino');$('modeTag').textContent='Selecione o destino da rota · Esc cancela'}
  else{state.routes.push({from:routeStart,to:[lon,lat],color:'#e5b467'});setMode('pan');status('Rota criada');updateCounts();touch()}return;
 }
 let country=countryAt(lon,lat);if(country)toggleCountry(country.iso)
}
canvas.addEventListener('pointerdown',ev=>{if(ev.button!==0)return;let p=eventXY(ev);mouseDown={x:p.x,y:p.y,cx:state.view.cx,cy:state.view.cy};mouseMoved=false;canvas.setPointerCapture(ev.pointerId);canvasWrap.classList.add('dragging')});
canvas.addEventListener('pointermove',ev=>{let p=eventXY(ev);let [lon,lat]=unproject(p.x,p.y,previewWidth,previewHeight);$('cursorCoords').textContent=`${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;if(!mouseDown)return;
 if(Math.hypot(p.x-mouseDown.x,p.y-mouseDown.y)>4)mouseMoved=true;
 if(mouseMoved&&mode==='pan'){const k=scaleFor(previewWidth,previewHeight);state.view.cx=mouseDown.cx-(p.x-mouseDown.x)/k;state.view.cy=clamp(mouseDown.cy+(p.y-mouseDown.y)/k,-90,90);drawPreview()}});
canvas.addEventListener('pointerup',ev=>{if(!mouseDown)return;let p=eventXY(ev);if(!mouseMoved)canvasClick(p.x,p.y);else touch();mouseDown=null;canvasWrap.classList.remove('dragging')});
canvas.addEventListener('pointercancel',()=>{mouseDown=null;canvasWrap.classList.remove('dragging')});
canvas.addEventListener('wheel',ev=>{ev.preventDefault();let p=eventXY(ev),[aLon,aLat]=unproject(p.x,p.y,previewWidth,previewHeight),ratio=ev.deltaY<0?1.15:1/1.15;
 state.view.zoom=clamp(state.view.zoom*ratio,.35,80);let [bLon,bLat]=unproject(p.x,p.y,previewWidth,previewHeight);state.view.cx+=aLon-bLon;state.view.cy=clamp(state.view.cy+aLat-bLat,-90,90);touch()},{passive:false});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&mode!=='pan')setMode('pan')});
function downloadable(blob,name){let url=URL.createObjectURL(blob);let a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function cleanName(){return state.name.trim().replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,80)||'mapa'}
function dimensions(){return state.resolution.split('x').map(Number)}
function makeExportCanvas(){let [w,h]=dimensions();let cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv}
function toPNG(cv){return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('Canvas excede memória disponível')),'image/png'))}
async function exportPNG(){try{status('Renderizando PNG...');let cv=makeExportCanvas();renderExport(cv.getContext('2d'),cv.width,cv.height);let blob=await toPNG(cv);downloadable(blob,cleanName()+'.png');status('PNG exportado');toast('PNG de '+cv.width+' × '+cv.height+' exportado');cv.width=0;cv.height=0}catch(e){toast('Não foi possível exportar: '+e.message,true);status('Falha de exportação')}}
async function exportLayerZIP(){
 let button=$('exportLayers');if(button.disabled)return;button.disabled=true;
 try{let cv=makeExportCanvas(),c=cv.getContext('2d'),form=new FormData(),total=RENDER_ORDER.length+1;
 form.append('project',JSON.stringify(state));
 for(let i=0;i<RENDER_ORDER.length;i++){let layer=RENDER_ORDER[i];status(`Exportando camada ${i+1}/${total}: ${layer}`);renderExport(c,cv.width,cv.height,layer);form.append(layer,await toPNG(cv),layer+'.png');await new Promise(resolve=>setTimeout(resolve,0))}
 status('Exportando imagem final...');renderExport(c,cv.width,cv.height);form.append('final',await toPNG(cv),'final.png');
 status('Montando pacote para Fusion...');let response=await fetch('/api/bundle',{method:'POST',body:form});if(!response.ok)throw new Error('Erro HTTP '+response.status);let archive=await response.blob();downloadable(archive,cleanName()+'_Fusion_Layers.zip');cv.width=0;cv.height=0;status('Pacote para Fusion exportado');toast('Camadas exportadas em ZIP: pronto para importar no Fusion');
 }catch(e){status('Falha de exportação');toast('Falha ao criar ZIP: '+e.message,true)}finally{button.disabled=false}
}
function saveProject(){let s=JSON.stringify(state,null,2);downloadable(new Blob([s],{type:'application/json'}),cleanName()+'.mapcomposer.json');toast('Arquivo do projeto salvo')}
async function openProject(file){if(!file)return;try{let parsed=JSON.parse(await file.text());if(parsed.version!==1||!Array.isArray(parsed.highlights)||!parsed.view)throw Error('Formato de projeto não reconhecido');let d=defaults();state={...d,...parsed,view:{...d.view,...parsed.view},layers:{...d.layers,...parsed.layers}};if(!PALETTES[state.style])state.style='dark';updateUI();touch();toast('Projeto carregado')}catch(e){toast('Projeto inválido: '+e.message,true)}}
async function bootstrap(){
 restore();
 for(let name of ['bmng','shadedrelief','etopo1']){let im=new Image();im.src='/assets/'+name+'.jpg';im.onload=drawPreview;images[name]=im}
 try{let resp=await fetch('/assets/countries.json');if(!resp.ok)throw Error('HTTP '+resp.status);countries=await resp.json();updateUI();status('Cartografia carregada · '+countries.length+' países')}catch(e){status('Erro na base geográfica');toast('Falha ao carregar países: '+e.message,true)}
 new ResizeObserver(drawPreview).observe(canvasWrap);
 $('projectName').addEventListener('input',ev=>{state.name=ev.target.value;$('stageName').textContent=state.name;saveDebounced()});
 $('countrySearch').addEventListener('input',renderCountryList);$('continent').addEventListener('change',renderCountryList);
 document.querySelectorAll('[data-style]').forEach(btn=>btn.addEventListener('click',()=>{state.style=btn.dataset.style;document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('active',b===btn));touch()}));
 document.querySelectorAll('[data-layer]').forEach(el=>el.addEventListener('change',()=>{state.layers[el.dataset.layer]=el.checked;touch()}));
 for(let id of ['highlightColor','borderColor'])$(id).addEventListener('input',ev=>{state[id]=ev.target.value;touch()});
 for(let id of ['highlightOpacity','borderWidth'])$(id).addEventListener('input',ev=>{state[id]=Number(ev.target.value);$('opacityValue').textContent=state.highlightOpacity+'%';$('borderValue').textContent=state.borderWidth;touch()});
 $('resolution').onchange=ev=>{state.resolution=ev.target.value;saveDebounced()};
 $('transparent').onchange=ev=>{state.transparent=ev.target.checked;touch()};
 $('worldView').onclick=worldView;$('centerView').onclick=fitHighlights;
 $('zoomIn').onclick=()=>{state.view.zoom=clamp(state.view.zoom*1.4,.35,80);touch()};
 $('zoomOut').onclick=()=>{state.view.zoom=clamp(state.view.zoom/1.4,.35,80);touch()};
 $('addLabel').onclick=()=>setMode('label');$('addRoute').onclick=()=>setMode('route');
 $('clearLabels').onclick=()=>{if(state.labels.length&&confirm('Remover todos os textos?')){state.labels=[];touch()}};
 $('clearRoutes').onclick=()=>{if(state.routes.length&&confirm('Remover todas as rotas?')){state.routes=[];touch()}};
 $('exportImage').onclick=exportPNG;$('exportLayers').onclick=exportLayerZIP;
 $('saveProject').onclick=saveProject;$('openProject').onclick=()=>$('projectFile').click();
 $('quitApp').onclick=async()=>{if(!confirm('Encerrar o Map Composer? Salve o projeto em JSON se quiser transferi-lo a outro PC.'))return; try{await fetch('/api/quit',{method:'POST'});document.body.innerHTML='<main style="font-family:Segoe UI,Arial,sans-serif;color:#dae7f2;background:#0d1721;min-height:100vh;display:grid;place-content:center;text-align:center"><h2>Map Composer encerrado</h2><p>Você pode fechar esta janela.</p></main>'}catch{toast('Não foi possível encerrar o aplicativo',true)}};
 $('projectFile').onchange=ev=>{openProject(ev.target.files[0]);ev.target.value=''};
 $('newProject').onclick=()=>{if(confirm('Novo projeto? A composição atual pode ser salva antes.')){state=defaults();$('countrySearch').value='';$('continent').value='';updateUI();touch()}};
 drawPreview();
}
bootstrap();
