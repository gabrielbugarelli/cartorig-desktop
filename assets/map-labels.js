/* Offline geographic-name overlay. Pure Canvas2D renderer, independent of scene objects.
 * Anchors come from bundled NE data and explicitly editorial water-name positions.
 * No external tiles, web geocoding, dynamic fonts, or DOM dependencies. MIT.
 */
import {MAP_LABEL_KINDS,MAP_LABEL_SIZES} from './scene-core.js';
const MIN_ZOOM={countries:0.35,continents:0.35,oceans:0.35,seas:0.8,national_capitals:1.1,states:2,regional_capitals:2.4,cities:2.8};
const MAX_ZOOM={continents:2.5,oceans:24};
const ORDER=['continents','countries','oceans','seas','national_capitals','states','regional_capitals','cities'];
const DENSITY={sparse:0.6,balanced:1,detailed:1.6};
// Identical full-size layout is reused by every production export tile.
const layoutCache=new WeakMap();
const safeNumber=(v,fallback)=>Number.isFinite(v)?v:fallback;
export function labelOptions(doc){
 const config=doc?.map_labels||{};
 return {enabled:config.enabled||{},sizes:config.sizes||{},colors:config.colors||{},font:config.font==='serif'?'serif':'sans',halo:safeNumber(config.halo,2.5),density:DENSITY[config.density]||1};
}
function intersects(a,b){return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}
const collides=(rect,boxes)=>boxes.some(box=>intersects(box,rect));
// An optional injectable projector makes the placement algorithm deterministic in tests.
export function layoutMapLabels(ctx,doc,pack,w,h,project,palette){
 if(!pack)return [];
 const options=labelOptions(doc),z=doc.camera.zoom,factor=h/1080;
 const cacheKey=JSON.stringify([w,h,doc.camera,doc.map_labels,palette.text]);
 const cached=layoutCache.get(doc);
 if(cached?.key===cacheKey&&cached.pack===pack)return cached.labels;
 const maxLabels=Math.max(10,Math.min(650,Math.floor(w*h/7200*options.density)));
 const boxes=[],result=[];
 for(const kind of ORDER){
  if(!options.enabled[kind]||z<MIN_ZOOM[kind]||z>(MAX_ZOOM[kind]??Infinity))continue;
  const entries=pack[kind];if(!Array.isArray(entries))continue;
  const isCity=['national_capitals','regional_capitals','cities'].includes(kind);
  const isWater=['oceans','seas'].includes(kind);
  const size=options.sizes[kind]??MAP_LABEL_SIZES[kind];
  const fontSize=Math.max(6.2,Math.round(size*factor*10)/10);
  const font=(isWater?'italic ':'')+(kind==='countries'||kind==='continents'?'500 ':'400 ')+fontSize+'px '+(options.font==='serif'?'Georgia, serif':'Arial, sans-serif');
  ctx.font=font;
  for(const row of entries){
   const [rawName,lon,lat,rank=1]=row;
   if(result.length>=maxLabels)break;
   if(typeof rawName!=='string'||!Number.isFinite(lon)||!Number.isFinite(lat))continue;
   // At regional zoom, only show major populated places; permit more detail as zoom rises.
   if(kind==='cities'&&rank>Math.min(10,Math.floor(3+z*1.5)))continue;
   if(kind==='regional_capitals'&&z<4&&rank>6)continue;
   if(kind==='states'&&z<4&&rank>4)continue;
   const [px,py]=project(doc,lon,lat,w,h);
   if(!Number.isFinite(px)||!Number.isFinite(py)||px<-70||px>w+70||py<-35||py>h+35)continue;
   const name=(kind==='countries'||kind==='continents')?rawName.toLocaleUpperCase('en-US'):rawName;
   const width=ctx.measureText(name).width;
   if(!Number.isFinite(width)||width>Math.min(w*.72,1300))continue;
   const dot=isCity;
   const gap=Math.max(5,7*factor),lift=fontSize*1.35;
   // Capitals often sit close to country names. Try several placements around
   // the geographic dot before discarding the name; never move the dot itself.
   const placements=dot?[
    [px+gap,py],[px+gap,py-lift],[px+gap,py+lift],
    [px-width-gap,py],[px-width-gap,py-lift],[px-width-gap,py+lift]
   ]:[[px-width/2,py]];
   const pad=Math.max(2,4*factor),tall=fontSize*1.25;
   let selected=null;
   for(const [x,y] of placements){
    if(x<4||x+width>w-4||y<tall/2+3||y>h-tall/2-3)continue;
    const minX=dot?Math.min(x,px-gap/2):x,maxX=dot?Math.max(x+width,px+gap/2):x+width;
    const minY=dot?Math.min(y-tall/2,py-gap/2):y-tall/2,maxY=dot?Math.max(y+tall/2,py+gap/2):y+tall/2;
    const rect={x:minX-pad,y:minY-pad,w:maxX-minX+2*pad,h:maxY-minY+2*pad};
    if(!collides(rect,boxes)){selected={x,y,rect};break;}
   }
   if(!selected)continue;
   const {x,y,rect}=selected;
   result.push({kind,name,x,y,px,py,dot,font,size:fontSize,color:options.colors[kind]||palette.text||'#ffffff',opacity:isWater?0.85:1});
   boxes.push(rect);
  }
 }
 layoutCache.set(doc,{key:cacheKey,pack,labels:result});
 return result;
}
export function paintMapLabels(ctx,doc,pack,w,h,project,palette){
 if(!pack||!doc?.map_labels)return 0;
 ctx.save();
 try{
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.lineJoin='round';
  const labels=layoutMapLabels(ctx,doc,pack,w,h,project,palette);
  for(const item of labels){
   ctx.save();ctx.font=item.font;ctx.globalAlpha=item.opacity;
   const halo=(doc.map_labels?.halo??2.5)*h/1080;
   if(halo>0){ctx.lineWidth=Math.max(.8,2*halo);ctx.strokeStyle=palette.ocean||'#142538';ctx.globalAlpha=item.opacity*.92;ctx.strokeText(item.name,item.x,item.y);ctx.globalAlpha=item.opacity;}
   ctx.fillStyle=item.color;ctx.fillText(item.name,item.x,item.y);
   if(item.dot){
    const radius=Math.max(1.25,2.4*h/1080);
    ctx.beginPath();ctx.arc(item.px,item.py,radius,0,Math.PI*2);
    ctx.fillStyle=item.color;ctx.fill();
    ctx.lineWidth=Math.max(.6,1.2*h/1080);ctx.strokeStyle=palette.ocean||'#142538';ctx.stroke();
   }
   ctx.restore();
  }
  return labels.length;
 }finally{ctx.restore();}
}
export const labelKinds=MAP_LABEL_KINDS;
