/* CartoRig 1.3 inspector — editors for static creative objects. MIT. */
import {MARKER_SYMBOLS,SHAPES,ROUTE_TYPES,geoDistance,resolveLink} from './creative-engine.js';
import {drawCreative} from './creative-renderer.js';
import {resolveStyle} from './style-resolver.js';
export function browserFontAvailable(family){
 if(typeof document==='undefined')return true;
 const name=String(family||'').replace(/["\\]/g,'');if(['sans-serif','serif','monospace','system-ui'].includes(name.toLowerCase()))return true;
 const ctx=document.createElement('canvas').getContext('2d'),sample='WWWWmmmmllii12345678éÁç世界';
 return ['monospace','serif','sans-serif'].some(fallback=>{
  ctx.font=`24px ${fallback}`;let base=ctx.measureText(sample).width;
  ctx.font=`24px "${name}",${fallback}`;return Math.abs(ctx.measureText(sample).width-base)>.2;
 });
}
export function creativeInspector(root,obj,doc,{exec,field,check,group,locked,toast,editText,importImage,editPath,geoPoint,convertShape,setCalloutBoxMode,editOffset,findCities,representative}){
 const id=obj.id,update=(path,value)=>exec({type:'SetProperty',id,path,value}),style=(key,v)=>update('style.'+key,v);
 function choose(where,label,choices,value,change){let block=document.createElement('label');block.className='field-label';block.textContent=label;let el=document.createElement('select');el.className='control compact';el.disabled=locked;for(let [val,text] of choices.map(x=>Array.isArray(x)?x:[x,x]))el.add(new Option(text,val));el.value=value;el.onchange=()=>change(el.value);block.append(el);where.append(block);return el;}
 function button(where,label,fn){let el=document.createElement('button');el.textContent=label;el.className='control compact';el.disabled=locked;el.onclick=fn;where.append(el);return el;}
 function number(where,label,path,value,min,max,step=.1){field(where,label,value,v=>update(path,v),{type:'number',min,max,step,disabled:locked});}
 function color(where,label,key,fallback){field(where,label,obj.style?.[key]??fallback,v=>style(key,v),{type:'color',disabled:locked});}
 function textarea(where,label,value,change){const wrap=document.createElement('label');wrap.className='field-label';wrap.textContent=label;let el=document.createElement('textarea');el.rows=3;el.className='control compact';el.value=value;el.disabled=locked;el.onchange=()=>change(el.value);wrap.append(el);where.append(wrap);return el;}
 function coordinate(where,prefix,pt,path){for(let axis of ['lon','lat'])field(where,`${prefix} ${axis==='lon'?'longitude':'latitude'}`,pt?.[axis]??0,v=>update(path,{...pt,[axis]:v}),{type:'number',min:axis==='lon'?-180:-90,max:axis==='lon'?180:90,step:.00001,disabled:locked});}
 function link(where,which,pt){let choices=[['','Free coordinate'],...Object.values(doc.objects).filter(x=>x.type==='Marker'&&x.id!==id).map(x=>[x.id,'Marker: '+x.name])];choose(where,which+' anchor source',choices,pt?.linked_object_id||'',val=>update(which,{...pt,linked_object_id:val||null,source_kind:val?'marker link':'free coordinate'}));}
 function editStyle(g,defaultColor='#efb95c'){color(g,'Stroke color','stroke_color',defaultColor);number(g,'Stroke width (px)','style.stroke_width',obj.style?.stroke_width??3,0,40,.5);choose(g,'Line style',['Solid','Dashed','Dotted'],obj.style?.stroke_style||'Solid',v=>style('stroke_style',v));choose(g,'Stroke cap',['round','butt','square'],obj.style?.line_cap||'round',v=>style('line_cap',v));}
 if(obj.type==='Route'){
  let g=group(root,'ROUTE DESIGNER');choose(g,'Path type',ROUTE_TYPES,obj.path_type||'Straight',v=>update('path_type',v));
  if(obj.path_type==='Curved')number(g,'Curvature (-1 to 1)','curvature',obj.curvature||0,-1,1,.05);
  editStyle(g);choose(g,'Arrowheads',['None','Start','End','Both'],obj.style?.arrowheads||'End',v=>style('arrowheads',v));number(g,'Arrow size','style.arrow_size',obj.style?.arrow_size??12,0,64,1);
  let endpoints=group(root,'GEOGRAPHIC ENDPOINTS');for(let side of ['from','to']){
   let pt=obj[side];link(endpoints,side,pt);
   const locationSearch=document.createElement('input');locationSearch.type='search';locationSearch.className='control compact';locationSearch.placeholder=`Find city for ${side}…`;locationSearch.setAttribute('aria-label',`Search ${side} city`);endpoints.append(locationSearch);
   const results=document.createElement('div');results.className='creative-location-results';endpoints.append(results);
   locationSearch.oninput=()=>{results.replaceChildren();if(locationSearch.value.trim().length<2)return;for(let e of findCities(locationSearch.value).slice(0,7)){
     let b=document.createElement('button');b.textContent=`${e.name} · ${e.parent}`;b.title='Use exact city source coordinates';b.disabled=locked;b.onclick=()=>{let coord=e.geometry?.coordinates||[e.lon,e.lat];update(side,{lon:coord[0],lat:coord[1],source_kind:'city catalog',source_feature_id:e.id,linked_object_id:null});};results.append(b);
   }};
   const refs=Object.values(doc.objects).filter(x=>x.type==='Region');if(refs.length){let picker=choose(endpoints,`${side} from Region`,[['','Select Region'],...refs.map(x=>[x.id,x.name])],'',value=>{if(!value)return;let loc=representative(doc.objects[value]);if(loc)update(side,{...loc,source_kind:'region representative point',source_feature_id:doc.objects[value].source?.feature_id,linked_object_id:null});});}
   coordinate(endpoints,side,pt,side);
  }
  let path=group(root,'EDIT PATH · WAYPOINTS');button(path,'Edit handles on canvas',editPath);button(path,'Reverse Route',()=>exec({type:'SetProperties',id,values:{from:obj.to,to:obj.from,waypoints:[...(obj.waypoints||[])].reverse()}}));
  if(obj.path_type!=='Custom')button(path,'Convert to Custom Path',()=>exec({type:'SetProperties',id,values:{path_type:'Custom',waypoints:[]}}));
  if(obj.path_type==='Custom'){
   button(path,'Add Waypoint',()=>update('waypoints',[...(obj.waypoints||[]),{lon:(obj.from.lon+obj.to.lon)/2,lat:(obj.from.lat+obj.to.lat)/2}]));
   (obj.waypoints||[]).forEach((pt,i)=>{let row=document.createElement('div');row.className='creative-waypoint';let span=document.createElement('small');span.textContent=`Waypoint ${i+1}: ${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)}`;row.append(span);let del=document.createElement('button');del.textContent='−';del.title='Remove waypoint';del.onclick=()=>update('waypoints',obj.waypoints.filter((_,j)=>j!==i));del.disabled=locked;row.append(del);path.append(row);for(let key of ['lon','lat'])field(path,`Waypoint ${i+1} ${key}`,pt[key],v=>update('waypoints',obj.waypoints.map((x,j)=>i===j?{...x,[key]:v}:x)),{type:'number',min:key==='lon'?-180:-90,max:key==='lon'?180:90,step:.0001,disabled:locked});});
  }
  const inv=geoDistance(resolveLink(doc,obj.from),resolveLink(doc,obj.to));let note=document.createElement('small');note.textContent=`WGS84 endpoint separation: ${(inv.meters/1000).toFixed(1)} km${inv.approximate?' · near-antipodal approximation':''}`;path.append(note);
 }
 if(obj.type==='Marker'){
  let g=group(root,'MARKER STUDIO');let lib=document.createElement('div');lib.className='marker-library';for(let symbol of MARKER_SYMBOLS){let b=document.createElement('button');b.title=symbol;b.setAttribute('aria-label','Select '+symbol+' icon');b.className='marker-library-item'+((obj.symbol||'Circle')===symbol?' selected':'');let c=document.createElement('canvas');c.width=40;c.height=40;drawCreative(c.getContext('2d'),{camera:{center_lon:0,center_lat:0,zoom:1},asset_refs:[],objects:{}},{type:'Marker',symbol,anchor:{lon:0,lat:0},style:{symbol_size:8,stroke_width:1,stroke_color:'#fff',fill_color:'#e5b467'}},40,40,()=>[20,20]);let t=document.createElement('small');t.textContent=symbol;b.append(c,t);b.onclick=()=>update('symbol',symbol);b.disabled=locked;lib.append(b);}g.append(lib);color(g,'Fill','fill_color','#e5b467');color(g,'Stroke','stroke_color','#ffffff');number(g,'Symbol size (logical px)','style.symbol_size',obj.style?.symbol_size??12,1,200,1);number(g,'Stroke width','style.stroke_width',obj.style?.stroke_width??2,0,40,.5);number(g,'Rotation','rotation',obj.rotation||0,-180,180,1);number(g,'Offset X','offset_x',obj.offset_x||0,-10000,10000,1);number(g,'Offset Y','offset_y',obj.offset_y||0,-10000,10000,1);
  button(g,'Edit offset handle',editOffset);button(g,'Reset offset',()=>exec({type:'SetProperties',id,values:{offset_x:0,offset_y:0}}));button(g,'Import SVG/PNG icon',()=>importImage(obj));let assets=doc.asset_refs||[];
  choose(g,'Embedded asset',[['','Built-in vector symbol'],...assets.filter(a=>a.catalog_visible!==false).map(a=>[a.id,(a.favorite?'★ ':'')+a.name])],obj.asset_ref||'',v=>update('asset_ref',v||null));
  let asset=assets.find(a=>a.id===obj.asset_ref);if(asset){
   let tools=group(root,'CUSTOM ICON ASSET');let img=document.createElement('img');img.src=asset.data;img.width=54;img.height=54;img.alt='Embedded icon preview';tools.append(img);
   button(tools,asset.favorite?'Remove favorite':'Favorite icon',()=>exec({type:'SetAssetFavorite',asset_id:asset.id,value:!asset.favorite}));
   button(tools,'Remove from library (keep used copy)',()=>exec({type:'RemoveAssetFromLibrary',asset_id:asset.id,keepEmbedded:true}));
  }
  let pos=group(root,'GEO ANCHOR');coordinate(pos,'Position',obj.anchor,'anchor');
 }
 if(obj.type==='Label'){
  let g=group(root,'TYPOGRAPHY STUDIO');choose(g,'Typography preset',[['','Custom'],['country','Country Name'],['city','City Label'],['ocean','Ocean Label'],['headline','Headline'],['callout','Strategic Callout']],'',v=>{const presets={country:{font_size:42,font_weight:700,align:'center'},city:{font_size:24,font_weight:600,align:'center'},ocean:{font_size:34,font_weight:400,align:'center'},headline:{font_size:70,font_weight:900,align:'left'},callout:{font_size:26,font_weight:700,align:'left'}};if(presets[v])exec({type:'SetProperties',id,values:{typography:{...obj.typography,...presets[v]}}});});textarea(g,'Text (Unicode and multiple lines)',obj.text||'',v=>update('text',v));button(g,'Edit inline on canvas',editText);
  const ty=obj.typography||{};if(!browserFontAvailable(ty.font_family||'Segoe UI')){const warning=document.createElement('small');warning.className='creative-font-warning';warning.textContent=`Font unavailable: ${ty.font_family||'Segoe UI'}. Using installed system sans-serif fallback; verify typographic layout before export.`;g.append(warning);}field(g,'Font family',ty.font_family||'Segoe UI',v=>update('typography.font_family',v),{disabled:locked});choose(g,'Font weight',[['400','Regular'],['600','Semibold'],['700','Bold'],['900','Black']],String(ty.font_weight||700),v=>update('typography.font_weight',Number(v)));number(g,'Size (logical px)','typography.font_size',ty.font_size||27,1,400,1);number(g,'Line height','typography.line_height',ty.line_height||1.2,.7,3,.1);
  choose(g,'Alignment',['left','center','right'],ty.align||'center',v=>update('typography.align',v));number(g,'Rotation','typography.rotation',ty.rotation||0,-180,180,1);number(g,'Letter spacing','typography.letter_spacing',ty.letter_spacing||0,-5,30,.5);color(g,'Text color','text_color','#ffffff');color(g,'Halo color','halo_color','#08111e');number(g,'Halo width','style.halo_width',obj.style?.halo_width??4,0,30,.5);color(g,'Background color','background_color',obj.style?.background_color||'#123049');number(g,'Background padding','style.background_padding',obj.style?.background_padding||0,0,100,1);
  let pos=group(root,'POSITION');choose(pos,'Position mode',[['geo','Geo Anchored'],['screen','Screen Pinned']],obj.position_mode||'geo',v=>{if(v==='screen'){const screen=geoPoint(obj.anchor);exec({type:'SetProperties',id,values:{position_mode:'screen',screen_pos:screen}});}else{let anchor=geoPoint(null,obj.screen_pos);exec({type:'SetProperties',id,values:{position_mode:'geo',anchor}});}});
  if(obj.position_mode==='screen'){number(pos,'X (0–1)','screen_pos.x',obj.screen_pos?.x??.5,0,1,.01);number(pos,'Y (0–1)','screen_pos.y',obj.screen_pos?.y??.5,0,1,.01);}else coordinate(pos,'Geo anchor',obj.anchor,'anchor');
  number(pos,'Offset X','offset_x',obj.offset_x||0,-10000,10000,1);number(pos,'Offset Y','offset_y',obj.offset_y||0,-10000,10000,1);
  let choices=[['','No linked Marker'],...Object.values(doc.objects).filter(x=>x.type==='Marker').map(x=>[x.id,x.name])];choose(pos,'Linked Marker',choices,obj.linked_object_id||'',v=>update('linked_object_id',v||null));
 }
 if(obj.type==='Shape'){
  let g=group(root,'DRAWING & ANNOTATION');
  choose(g,'Shape kind',SHAPES,obj.shape_kind,v=>update('shape_kind',v));choose(g,'Coordinate space',[['geo','Geographic (WGS84)'],['screen','Screen relative']],obj.coordinate_space,v=>convertShape(obj,v));editStyle(g,'#eab766');color(g,'Fill','fill_color','#a9653d');
  // Match the displayed swatch to the effective renderer color, including
  // inherited Callout colors in older .cartorig projects.
  color(g,'Text color','text_color',resolveStyle(doc,obj).text_color||'#ffffff');
  if(obj.shape_kind==='Callout'){textarea(g,'Callout text',obj.text||'',v=>update('text',v));color(g,'Box background','background_color','#123049');
   if(obj.coordinate_space==='geo'){
    choose(g,'Text box follows',[['geo','Map (recommended)'],['screen','Screen (fixed position)']],obj.callout_box?'screen':'geo',mode=>setCalloutBoxMode(obj,mode));
    const hint=document.createElement('small');
    hint.textContent=obj.callout_box?'The box stays in place as the map moves. Switch to Map to attach it to the second geographic point.':'The two clicks are geographic points. The box moves and scales with the map.';
    g.append(hint);
   }
   choose(g,'Linked marker',[['','Free geographic point'],...Object.values(doc.objects).filter(x=>x.type==='Marker').map(x=>[x.id,x.name])],obj.linked_object_id||'',v=>update('linked_object_id',v||null));
   if(obj.callout_box){for(let axis of ['x','y'])field(g,`Screen box ${axis}`,obj.callout_box[axis],v=>update('callout_box.'+axis,v),{type:'number',min:0,max:1,step:.01,disabled:locked});}
  }
  if(obj.shape_kind==='Distance'){const d=obj.coordinate_space==='geo'?geoDistance(obj.points[0],obj.points.at(-1)):null;let small=document.createElement('small');small.textContent=d?`${(d.meters/1000).toFixed(3)} km (WGS84)${d.approximate?' · approximation near antipodes':''}`:'Visual length only · no geographic measurement';g.append(small);}
  let verts=group(root,'EDIT VERTICES');button(verts,'Edit handles on canvas',editPath);
  obj.points.forEach((p,i)=>{let row=document.createElement('div');row.className='creative-waypoint';row.textContent=`Point ${i+1}`;let del=document.createElement('button');del.textContent='−';del.title='Remove point';del.disabled=locked||obj.points.length<=(obj.shape_kind==='Polygon'?3:2);del.onclick=()=>update('points',obj.points.filter((_,j)=>j!==i));row.append(del);verts.append(row);
   for(let key of obj.coordinate_space==='screen'?['x','y']:['lon','lat'])field(verts,`Point ${i+1} ${key}`,p[key],v=>update('points',obj.points.map((pt,j)=>j===i?{...pt,[key]:v}:pt)),{type:'number',min:obj.coordinate_space==='screen'?0:key==='lon'?-180:-90,max:obj.coordinate_space==='screen'?1:key==='lon'?180:90,step:.0001,disabled:locked});
  });
 }
}
