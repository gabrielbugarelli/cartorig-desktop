/* CartoRig 2.0 vector and territory-mask export. Pure SVG serialization;
   never accepts executable markup from user text or images. */
import {project} from './scene-renderer.js';
import {routeSamples} from './creative-engine.js';
import {treeIds,isVisible} from './scene-core.js';
import {layoutMapLabels} from './map-labels.js';
import {paletteFor} from './style-resolver.js';
import {countryForRegion} from './geo-catalog.js';
export const escapeXML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function n(x){return Number.isFinite(Number(x))?Number(x).toFixed(3):'0';}
function segments(doc,pts,w,h,close=false){if(!pts?.length)return '';let p='',prev=null;for(let k=0;k<pts.length;k++){
 const q=pts[k];if(!Array.isArray(q)||q.length<2)continue;let lon=Number(q[0]),lat=Number(q[1]);
 if(prev!==null&&Math.abs(lon-prev)>180){p+=' ';prev=null;}
 const [x,y]=project(doc,lon,lat,w,h);p+=(prev===null?'M':'L')+n(x)+' '+n(y)+' ';prev=lon;
 }return p+(close?'Z':'');}
function shapePaths(doc,geometry,w,h){if(!geometry)return '';const parts=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];return parts.map(poly=>poly.map(ring=>segments(doc,ring,w,h,true)).join(' ')).join(' ');}
function style(obj){let s=obj.style||{};return ` fill="${escapeXML(s.fill_color||'none')}" fill-opacity="${n(s.fill_opacity??1)}" stroke="${escapeXML(s.stroke_color||'none')}" stroke-width="${n(s.stroke_width??0)}" opacity="${n(obj.opacity??1)}"`;}
function targetGeometry(obj,countries,geo){if(obj.embedded_geometry)return obj.embedded_geometry;const id=obj.source?.feature_id;if(obj.region_kind==='Country')return countryForRegion(obj,countries,geo,1)?.geometry||null; if(obj.region_kind==='Continent')return geo?.continents?.[id];return geo?.lookup?.(obj.source?.dataset_id,id)?.geometry;}
export function serializeVectorScene(doc,countries,geo,w,h,{onlyIds=null,labels=null,includeMapLabels=false}={}){
 let allowed=onlyIds?new Set(onlyIds):null,content=[],warnings=[];
 for(const id of treeIds(doc)) {const obj=doc.objects[id];if(!obj||obj.type==='Group'||!isVisible(doc,id)||(allowed&&!allowed.has(id)))continue;
  if(obj.type==='Region'){
   let geometry=targetGeometry(obj,countries,geo);if(!geometry){warnings.push('Missing region geometry: '+obj.name);continue}
   content.push(`<path data-id="${escapeXML(id)}" d="${shapePaths(doc,geometry,w,h)}" fill-rule="evenodd"${style(obj)}/>`);
  }else if(obj.type==='Route'){
   let pts=routeSamples(doc,obj,Math.min(w/360,h/180)*doc.camera.zoom).map(p=>[p.lon,p.lat]);let d=segments(doc,pts,w,h);
   content.push(`<path data-id="${escapeXML(id)}" d="${d}" fill="none" stroke="${escapeXML(obj.style?.stroke_color||'#efb95c')}" stroke-width="${n(obj.style?.stroke_width??2)}" opacity="${n(obj.opacity??1)}"/>`);
  }else if(obj.type==='Marker'&&obj.symbol==='Circle'){
   const [x,y]=project(doc,obj.anchor.lon,obj.anchor.lat,w,h),r=(obj.style?.symbol_size??12)*h/1080;
   content.push(`<circle data-id="${escapeXML(id)}" cx="${n(x)}" cy="${n(y)}" r="${n(r)}"${style(obj)}/>`);
  }else if(obj.type==='Label'){
   const [x,y]=obj.position_mode==='screen'?[obj.screen_pos.x*w,obj.screen_pos.y*h]:project(doc,obj.anchor.lon,obj.anchor.lat,w,h);
   const size=obj.typography?.font_size||24;
   const lines=String(obj.text||'').split('\n');const spans=lines.map((line,i)=>`<tspan x="${n(x)}" dy="${i===0?0:n(size*1.25)}">${escapeXML(line)}</tspan>`).join('');
   content.push(`<text data-id="${escapeXML(id)}" x="${n(x)}" y="${n(y)}" font-family="${escapeXML(obj.typography?.font_family||'sans-serif')}" font-size="${n(size*h/1080)}" fill="${escapeXML(obj.style?.text_color||'#fff')}" opacity="${n(obj.opacity??1)}">${spans}</text>`);
  }else if(obj.type==='Shape'&&['Line','Arrow','Polygon','Freehand'].includes(obj.shape_kind)){
   const pts=(obj.points||[]).map(p=>p.x!==undefined?[p.x*w,p.y*h]:project(doc,p.lon,p.lat,w,h));let d=pts.map((p,i)=>(i?'L':'M')+n(p[0])+' '+n(p[1])).join(' ')+(obj.shape_kind==='Polygon'?' Z':'');
   content.push(`<path data-id="${escapeXML(id)}" d="${d}"${style(obj)}/>`);
  }else if(obj.type!=='WorldMap'&&obj.type!=='Grid'&&obj.type!=='Borders')warnings.push('Unsupported vector primitive: '+obj.type+' '+obj.name);
 }
 if(includeMapLabels&&doc.map_labels&&labels&&typeof document!=='undefined'){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(ctx){const palette=paletteFor(doc);
   for(const item of layoutMapLabels(ctx,doc,labels,w,h,project,palette)){
    const stroke=escapeXML(palette.ocean||'#142538');
    if(item.dot)content.push(`<circle cx="${n(item.px)}" cy="${n(item.py)}" r="${n(Math.max(1.25,2.4*h/1080))}" fill="${escapeXML(item.color)}"/>`);
    content.push(`<text data-map-label="${escapeXML(item.kind)}" x="${n(item.x)}" y="${n(item.y)}" dominant-baseline="middle" font-family="${doc.map_labels.font==='serif'?'Georgia,serif':'Arial,sans-serif'}" font-size="${n(item.size)}" font-style="${['seas','oceans'].includes(item.kind)?'italic':'normal'}" fill="${escapeXML(item.color)}" fill-opacity="${n(item.opacity)}" stroke="${stroke}" stroke-width="${n(2*(doc.map_labels.halo??2.5)*h/1080)}" stroke-linejoin="round" paint-order="stroke fill">${escapeXML(item.name)}</text>`);
   }
  }
 }
 const result=`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><metadata>CartoRig 2.0 - equirectangular static cartography; raster textures omitted</metadata>${content.join('')}</svg>`;
 return {svg:result,warnings};
}
