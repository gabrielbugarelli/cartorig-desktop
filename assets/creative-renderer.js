/* 1.3 Creative Tools — same code path for preview and final PNG exports. MIT. */
import {clamp} from './scene-core.js';
import {routeSamples,routePoints,geoDistance,resolveLink,MARKER_SYMBOLS} from './creative-engine.js';
const RAD=Math.PI/180;
const iconCache=new Map();
export function clearCreativeImageCache(){iconCache.clear();}
function imageFor(doc,obj){let src=doc.asset_refs?.find(a=>a.id===obj.asset_ref)?.data;if(!src||typeof Image==='undefined')return null;
 let item=iconCache.get(src);if(!item){let im=new Image();item={image:im,loaded:false};im.onload=()=>{item.loaded=true;window.dispatchEvent?.(new Event('cartorig-asset-loaded'));};im.onerror=()=>{item.error=true;};im.src=src;iconCache.set(src,item);}return item.loaded?item.image:null;}
export async function settleCreativeAssets(doc){for(let a of doc.asset_refs||[]){if(!a.data?.startsWith('data:image/'))continue;const im=new Image();await new Promise((ok,no)=>{im.onload=ok;im.onerror=()=>no(Error('Project image could not be decoded'));im.src=a.data;});iconCache.set(a.data,{image:im,loaded:true});}}
const unit=(p,doc,w,h,project)=>p?.x!==undefined?[p.x*w,p.y*h]:project(doc,p.lon,p.lat,w,h);
function wrappedXY(doc,p,w,h,project,shift=0){return project(doc,p.lon+shift,p.lat,w,h);}
function worldXY(doc,p,w,h,project){let delta=p.lon-doc.camera.center_lon,nearest=p.lon-360*Math.round(delta/360),diff=nearest-doc.camera.center_lon,scale=Math.min(w/360,h/180)*doc.camera.zoom,t=(doc.camera.bearing||0)*RAD,dx=diff*scale,dy=(doc.camera.center_lat-p.lat)*scale;return [w/2+dx*Math.cos(t)-dy*Math.sin(t),h/2+dx*Math.sin(t)+dy*Math.cos(t)];}
function drawGeoSegments(ctx,doc,pts,w,h){if(pts.length<2)return [];
 let normalized=[pts[0]];for(let i=1;i<pts.length;i++){let p=pts[i],prev=normalized.at(-1),l=p.lon+360*Math.round((prev.lon-p.lon)/360);normalized.push({lon:l,lat:p.lat});}
 const k=Math.min(w/360,h/180)*doc.camera.zoom,theta=(doc.camera.bearing||0)*RAD;
 const xy=(p,shift)=>{let dx=(p.lon+shift-doc.camera.center_lon)*k,dy=(doc.camera.center_lat-p.lat)*k;return [w/2+dx*Math.cos(theta)-dy*Math.sin(theta),h/2+dx*Math.sin(theta)+dy*Math.cos(theta)];};
 // Split at each world seam before projection, retaining independent segments.
 let pieces=[],line=[normalized[0]];
 for(let i=1;i<normalized.length;i++){
  let a=normalized[i-1],b=normalized[i],edge=Math.floor((a.lon+180)/360),end=Math.floor((b.lon+180)/360);
  if(edge!==end){let seam=180+360*(b.lon>a.lon?edge:edge-1),t=(seam-a.lon)/(b.lon-a.lon),mid={lon:seam,lat:a.lat+(b.lat-a.lat)*t};line.push(mid);pieces.push(line);line=[mid];}
  line.push(b);
 }pieces.push(line);
 let visible=[];for(const piece of pieces)for(let shift of [-360,0,360]){let path=piece.map(p=>xy(p,shift));if(!path.some(p=>p[0]>=-w&&p[0]<=2*w&&p[1]>=-h&&p[1]<=2*h))continue;visible.push(path);ctx.moveTo(...path[0]);for(let i=1;i<path.length;i++)ctx.lineTo(...path[i]);}
 return visible;
}
function strokeStyle(ctx,s,f){let kind=s.stroke_style||(s.dashed===true?'Dashed':'Solid'),width=Math.max(0,s.stroke_width??3);ctx.lineWidth=width*f;ctx.setLineDash(kind==='Dashed'?[8*f,6*f]:kind==='Dotted'?[1*f,5*f]:[]);ctx.lineCap=s.line_cap||'round';ctx.lineJoin=s.line_join||'round';}
function arrow(ctx,from,to,r,fill){let dx=to[0]-from[0],dy=to[1]-from[1],n=Math.hypot(dx,dy);if(n<.1)return;let a=Math.atan2(dy,dx);ctx.beginPath();ctx.moveTo(to[0],to[1]);ctx.lineTo(to[0]-r*Math.cos(a-.48),to[1]-r*Math.sin(a-.48));ctx.lineTo(to[0]-r*Math.cos(a+.48),to[1]-r*Math.sin(a+.48));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function symbol(ctx,kind,x,y,r){ctx.beginPath();switch(kind){
 case 'Square':ctx.rect(x-r,y-r,r*2,r*2);break;
 case 'Diamond':ctx.moveTo(x,y-r*1.35);ctx.lineTo(x+r*1.2,y);ctx.lineTo(x,y+r*1.35);ctx.lineTo(x-r*1.2,y);ctx.closePath();break;
 case 'Pin':ctx.moveTo(x,y+r*1.5);ctx.bezierCurveTo(x-r*2,y-r*.3,x-r,y-r*1.8,x,y-r*1.8);ctx.bezierCurveTo(x+r,y-r*1.8,x+r*2,y-r*.3,x,y+r*1.5);ctx.closePath();break;
 case 'Flag':ctx.moveTo(x-r,y+r);ctx.lineTo(x-r,y-r);ctx.lineTo(x+r,y-r*.5);ctx.lineTo(x-r,y);ctx.closePath();break;
 case 'Airport':ctx.moveTo(x,y-r*1.5);ctx.lineTo(x+r*.28,y-r*.1);ctx.lineTo(x+r*1.2,y+r*.4);ctx.lineTo(x+r*1.1,y+r*.7);ctx.lineTo(x,y+r*.3);ctx.lineTo(x-r*1.1,y+r*.7);ctx.lineTo(x-r*1.2,y+r*.4);ctx.lineTo(x-r*.28,y-r*.1);ctx.closePath();break;
 case 'Port':ctx.arc(x,y-r*.6,r*.3,0,Math.PI*2);ctx.moveTo(x,y-r*.3);ctx.lineTo(x,y+r);ctx.moveTo(x-r,y+r*.1);ctx.quadraticCurveTo(x,y+r*1.5,x+r,y+r*.1);break;
 case 'Naval':ctx.moveTo(x-r,y-r*.2);ctx.lineTo(x+r,y-r*.2);ctx.lineTo(x+r*.5,y+r*.8);ctx.lineTo(x-r*.5,y+r*.8);ctx.closePath();ctx.moveTo(x,y-r*.2);ctx.lineTo(x,y-r*1.4);break;
 case 'Capital':for(let i=0;i<10;i++){let a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.5:r*1.15;ctx.lineTo(x+rr*Math.cos(a),y+rr*Math.sin(a));}ctx.closePath();break;
 case 'Strategic':ctx.arc(x,y,r,0,Math.PI*2);ctx.moveTo(x-r*1.5,y);ctx.lineTo(x+r*1.5,y);ctx.moveTo(x,y-r*1.5);ctx.lineTo(x,y+r*1.5);break;
 default:ctx.arc(x,y,r,0,Math.PI*2);
 }}
export function shapeScreenPoints(doc,o,w,h,project){return (o.points||[]).map(p=>unit(p,doc,w,h,project));}
export function creativeHandles(doc,o,w,h,project){
 if(o.type==='Route')return routePoints(doc,o).map((p,i)=>({...p,xy:worldXY(doc,p,w,h,project),index:i}));
 if(o.type==='Shape'){
  const handles=(o.points||[]).map((p,i)=>({...p,xy:unit(p,doc,w,h,project),index:i}));
  if(o.shape_kind==='Callout'&&handles.length){
   // Old saved Callouts have an explicitly screen-pinned box. Show the
   // real box control handle, not the obsolete underlying second vertex.
   if(o.callout_box)handles.at(-1).xy=[o.callout_box.x*w,o.callout_box.y*h];
   if(o.linked_object_id&&o.coordinate_space==='geo'){
    const marker=doc.objects?.[o.linked_object_id];
    if(marker?.type==='Marker'&&marker.anchor)handles[0].xy=worldXY(doc,marker.anchor,w,h,project);
   }
  }
  return handles;
 }
 if(o.type==='Marker'||o.type==='Label'){let p=resolveLink(doc,o.anchor);return p?[{...p,xy:o.type==='Label'&&o.position_mode==='screen'?[o.screen_pos.x*w,o.screen_pos.y*h]:worldXY(doc,p,w,h,project),index:0}]:[];}
 return [];
}
function drawRoute(ctx,doc,o,w,h,project){let f=h/1080,s=o.style||{},pts=routeSamples(doc,o,Math.min(w/360,h/180)*doc.camera.zoom),paths=[];ctx.save();ctx.strokeStyle=s.stroke_color||'#efb95c';ctx.fillStyle=s.arrow_fill||ctx.strokeStyle;strokeStyle(ctx,s,f);ctx.beginPath();paths=drawGeoSegments(ctx,doc,pts,w,h);ctx.stroke();ctx.setLineDash([]);
 const arrowMode=s.arrowheads||'End',size=(s.arrow_size??12)*f;for(const path of paths){if(path.length<2)continue; if(arrowMode==='Start'||arrowMode==='Both')arrow(ctx,path[1],path[0],size,ctx.fillStyle);if(arrowMode==='End'||arrowMode==='Both')arrow(ctx,path.at(-2),path.at(-1),size,ctx.fillStyle);}ctx.restore();}
function drawMarker(ctx,doc,o,w,h,project){let f=h/1080,s=o.style||{},p=resolveLink(doc,o.anchor);if(!p)return;let [x,y]=worldXY(doc,p,w,h,project),r=Math.max(1,(s.symbol_size??12)*f);x+=(o.offset_x||0)*f;y+=(o.offset_y||0)*f;ctx.save();ctx.translate(x,y);ctx.rotate((o.rotation||0)*RAD);ctx.translate(-x,-y);ctx.fillStyle=s.fill_color||'#e5b467';ctx.strokeStyle=s.stroke_color||'#fff';ctx.lineWidth=Math.max(0,(s.stroke_width??2))*f;let bitmap=imageFor(doc,o);if(bitmap){ctx.drawImage(bitmap,x-r,y-r,r*2,r*2);}else{symbol(ctx,o.symbol||'Circle',x,y,r);ctx.fill();if(ctx.lineWidth>0)ctx.stroke();}ctx.restore();}
function drawLabel(ctx,doc,o,w,h,project){let f=h/1080,s=o.style||{},ty=o.typography||{},p=resolveLink(doc,o.anchor);if(!p)return;
 let linked=o.linked_object_id&&doc.objects[o.linked_object_id];if(linked?.type==='Marker')p=linked.anchor;let xy=o.position_mode==='screen'&&o.screen_pos?[o.screen_pos.x*w,o.screen_pos.y*h]:worldXY(doc,p,w,h,project);let [x,y]=xy;x+=(o.offset_x||0)*f;y+=(o.offset_y||0)*f;
 let size=clamp(ty.font_size||27,1,400)*f,lines=String(o.text||o.name).split('\n').slice(0,300),lh=(ty.line_height||1.2)*size,align=ty.align||'center';ctx.save();ctx.translate(x,y);ctx.rotate((ty.rotation||0)*RAD);ctx.font=`${ty.italic?'italic ':''}${ty.font_weight||s.font_weight||700} ${size}px ${JSON.stringify(ty.font_family||s.font_family||'Segoe UI')},Arial,sans-serif`;ctx.textAlign=align;if('letterSpacing' in ctx)ctx.letterSpacing=((ty.letter_spacing||0)*f)+'px';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.fillStyle=s.text_color||'#fff';ctx.strokeStyle=s.halo_color||'#08111e';ctx.lineWidth=(s.halo_width??4)*f;
 let maxw=Math.max(...lines.map(t=>ctx.measureText(t).width),0),height=lines.length*lh,pad=(s.background_padding||0)*f;if(s.background_color){let origin=align==='left'?0:align==='right'?-maxw:-maxw/2;ctx.fillStyle=s.background_color;ctx.fillRect(origin-pad,-height/2-pad,maxw+2*pad,height+2*pad);ctx.fillStyle=s.text_color||'#fff';}
 for(let i=0;i<lines.length;i++){let y=(i-(lines.length-1)/2)*lh;if(ctx.lineWidth>0)ctx.strokeText(lines[i],0,y);ctx.fillText(lines[i],0,y);}ctx.restore();}
function drawShape(ctx,doc,o,w,h,project){let f=h/1080,s=o.style||{},kind=o.shape_kind,pts=shapeScreenPoints(doc,o,w,h,project);if(pts.length<2)return;
 ctx.save();ctx.strokeStyle=s.stroke_color||'#eab766';ctx.fillStyle=s.fill_color||'#eab76644';strokeStyle(ctx,s,f);let a=pts[0],b=pts.at(-1);if(o.linked_object_id&&o.coordinate_space==='geo'){const marker=doc.objects[o.linked_object_id];if(marker?.type==='Marker'&&marker.anchor)a=worldXY(doc,marker.anchor,w,h,project);}
 if(kind==='Callout'){
  let caption=o.text||'Callout',px=o.callout_box?o.callout_box.x*w:b[0],py=o.callout_box?o.callout_box.y*h:b[1];
  // Newly drawn geographic Callouts use point #2 (b), which projects with
  // the camera. Explicit legacy screen-pinned boxes keep their old behavior.
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(px,py);ctx.stroke();ctx.setLineDash([]);
  let width=Math.max(130*f,caption.length*11*f),height=44*f;
  ctx.fillStyle=s.background_color||'#12273dee';ctx.fillRect(px,py-height/2,width,height);ctx.strokeRect(px,py-height/2,width,height);
  ctx.fillStyle=s.text_color||'#fff';ctx.font=`${18*f}px sans-serif`;ctx.textBaseline='middle';ctx.fillText(caption,px+12*f,py,width-20*f);
  ctx.restore();return;
 }
 if(kind==='Distance'){let m=o.coordinate_space==='geo'?geoDistance(o.points[0],o.points.at(-1)):null;ctx.beginPath();if(o.coordinate_space==='geo')drawGeoSegments(ctx,doc,o.points,w,h);else{ctx.moveTo(...a);ctx.lineTo(...b);}ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=s.text_color||'#fff';ctx.font=`${16*f}px sans-serif`;ctx.textAlign='center';let label=m?(m.meters/1000).toFixed(1)+' km'+(m.approximate?' ~':''):'Visual length';ctx.fillText(label,(a[0]+b[0])/2,(a[1]+b[1])/2-12*f);ctx.restore();return;}
 ctx.beginPath();if(kind==='Rectangle'){ctx.rect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
 else if(kind==='Ellipse'){let cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.abs(a[0]-b[0])/2,ry=Math.abs(a[1]-b[1])/2;ctx.ellipse(cx,cy,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);}
 else if(o.coordinate_space==='geo'&&['Line','Arrow','Freehand'].includes(kind)){drawGeoSegments(ctx,doc,o.points,w,h);}
 else{ctx.moveTo(...a);for(const p of pts.slice(1))ctx.lineTo(...p);if(kind==='Polygon')ctx.closePath();}
 if(['Rectangle','Ellipse','Polygon'].includes(kind))ctx.fill();ctx.stroke();ctx.setLineDash([]);if(kind==='Arrow')arrow(ctx,pts.at(-2),pts.at(-1),(s.arrow_size||13)*f,s.arrow_fill||ctx.strokeStyle);ctx.restore();}
export function drawCreative(ctx,doc,o,w,h,project){if(o.type==='Route')drawRoute(ctx,doc,o,w,h,project);else if(o.type==='Marker')drawMarker(ctx,doc,o,w,h,project);else if(o.type==='Label')drawLabel(ctx,doc,o,w,h,project);else if(o.type==='Shape')drawShape(ctx,doc,o,w,h,project);}
const segDist=(a,b,x,y)=>{let dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a[0]+dx*t-x,a[1]+dy*t-y);};
export function hitCreative(doc,o,x,y,w,h,project){let f=h/1080;if(o.type==='Marker'||o.type==='Label'){let handles=creativeHandles(doc,o,w,h,project);if(!handles.length)return false;let [hx,hy]=handles[0].xy;hx+=(o.offset_x||0)*f;hy+=(o.offset_y||0)*f;let tolerance=o.type==='Marker'?Math.max(9,(o.style?.symbol_size||12)*f):Math.max(20,(o.typography?.font_size||27)*String(o.text||'').length*.32*f);return Math.abs(hx-x)<tolerance&&Math.abs(hy-y)<Math.max(15,(o.typography?.font_size||27)*f);}
 if(o.type==='Route'){let pts=routeSamples(doc,o,Math.min(w/360,h/180)*doc.camera.zoom);let ctx={moveTo(){},lineTo(){}};let paths=drawGeoSegments(ctx,doc,pts,w,h);return paths.some(p=>p.slice(1).some((b,i)=>segDist(p[i],b,x,y)<Math.max(6,(o.style?.stroke_width||3)*f/2+6)));}
 if(o.type==='Shape'){let pts=shapeScreenPoints(doc,o,w,h,project);if(!pts.length)return false;
  if(o.shape_kind==='Callout'&&pts.length>=2){
   const handles=creativeHandles(doc,o,w,h,project),a=handles[0].xy,b=handles.at(-1).xy;
   const width=Math.max(130*f,String(o.text||'Callout').length*11*f),height=44*f;
   return segDist(a,b,x,y)<Math.max(6,((o.style?.stroke_width||2)*f)/2+5)
    ||(x>=b[0]-8*f&&x<=b[0]+width+8*f&&y>=b[1]-height/2-8*f&&y<=b[1]+height/2+8*f);
  }
  if(['Polygon','Rectangle','Ellipse'].includes(o.shape_kind)&&pts.length>=(o.shape_kind==='Rectangle'?2:3)){
    let polygon=o.shape_kind==='Rectangle'?[[pts[0][0],pts[0][1]],[pts[1][0],pts[0][1]],[pts[1][0],pts[1][1]],[pts[0][0],pts[1][1]]]:pts;
    let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){let a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(inside)return true;
  }
  return pts.slice(1).some((b,i)=>segDist(pts[i],b,x,y)<8*f)||pts.some(p=>Math.hypot(p[0]-x,p[1]-y)<9*f);}
 return false;}
