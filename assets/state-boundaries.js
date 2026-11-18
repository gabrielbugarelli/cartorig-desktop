/* CartoRig screen-preview state boundaries. Geographic paths are prepared once
 * per geometry/level of detail, then transformed natively by Canvas2D. Exports
 * use the untouched original GeoJSON and the regular renderer. */
const COPIES=[-360,0,360];
const TOLERANCES=[0.1,0.03,0.01,0.003,0.001,0.0003,0];
const RAD=Math.PI/180;

export function stateBoundaryTolerance(pixelsPerDegree){
 const limit=0.55/Math.max(0.000001,pixelsPerDegree);
 return TOLERANCES.find(t=>t<=limit)??0;
}

function unwrap(ring,reference=null){
 if(!ring?.length)return [];
 const out=[];
 for(const point of ring){
  let lon=point[0];
  const anchor=out.length?out[out.length-1][0]:reference;
  if(anchor!==null)lon+=360*Math.round((anchor-lon)/360);
  out.push([lon,point[1]]);
 }
 return out;
}
function segmentDistanceSquared(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],denom=dx*dx+dy*dy;
 if(!denom)return (p[0]-a[0])**2+(p[1]-a[1])**2;
 const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denom));
 return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
}
function simplifyOpen(points,tolSq){
 if(points.length<=2)return points;
 const keep=new Uint8Array(points.length);
 keep[0]=1;keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){
  const [start,end]=stack.pop();
  let best=tolSq,index=-1;
  for(let i=start+1;i<end;i++){
   const dist=segmentDistanceSquared(points[i],points[start],points[end]);
   if(dist>best){best=dist;index=i;}
  }
  if(index<0)continue;
  keep[index]=1;stack.push([start,index],[index,end]);
 }
 return points.filter((_,i)=>keep[i]);
}
export function simplifyStateRing(ring,tolerance){
 if(!(tolerance>0)||ring.length<6)return ring;
 // A closed ring has identical first/last points: split at its furthest
 // vertex so RDP cannot collapse the entire shape to a point.
 const closed=ring.length>3&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1];
 const unique=closed?ring.slice(0,-1):ring;
 if(unique.length<5)return ring;
 let furthest=-1,pivot=0;
 for(let i=1;i<unique.length;i++){
  const d=(unique[i][0]-unique[0][0])**2+(unique[i][1]-unique[0][1])**2;
  if(d>furthest){furthest=d;pivot=i;}
 }
 if(pivot===0||pivot===unique.length-1)return ring;
 const left=simplifyOpen(unique.slice(0,pivot+1),tolerance*tolerance);
 const right=simplifyOpen([...unique.slice(pivot),unique[0]],tolerance*tolerance);
 const result=[...left.slice(0,-1),...right.slice(0,-1)];
 return result.length>=3?result:ring;
}
function geometryParts(geometry){
 return geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
}
function makeEntry(geometry,tolerance,createPath){
 const path=createPath();
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,originalPoints=0,drawnPoints=0;
 for(const polygon of geometryParts(geometry)){
  if(!polygon.length)continue;
  const outer=unwrap(polygon[0]);
  const anchor=outer[0]?.[0]??0;
  for(let r=0;r<polygon.length;r++){
   const unwrapped=r===0?outer:unwrap(polygon[r],anchor);
   if(unwrapped.length<3)continue;
   const reduced=simplifyStateRing(unwrapped,tolerance);
   originalPoints+=unwrapped.length;
   drawnPoints+=reduced.length;
   // Coordinates are lon and -lat, so the camera is just an affine transform.
   for(let i=0;i<reduced.length;i++){
    const [lon,lat]=reduced[i];
    if(i===0)path.moveTo(lon,-lat);else path.lineTo(lon,-lat);
   }
   path.closePath();
   // Full original bounds prevent simplified edges from being culled early.
   for(const [lon,lat] of unwrapped){
    minX=Math.min(minX,lon);maxX=Math.max(maxX,lon);
    minY=Math.min(minY,-lat);maxY=Math.max(maxY,-lat);
   }
  }
 }
 return {path,box:{minX,maxX,minY,maxY},originalPoints,drawnPoints};
}
export function visibleStateCopies(box,{w,h,k,lon,lat,bearing=0},padding=3){
 if(!box||!Number.isFinite(box.minX))return [];
 const angle=bearing*RAD,co=Math.cos(angle),si=Math.sin(angle);
 const hx=(box.maxX-box.minX)/2,hy=(box.maxY-box.minY)/2;
 const cy=(box.minY+box.maxY)/2+lat;
 const ex=k*(Math.abs(co)*hx+Math.abs(si)*hy);
 const ey=k*(Math.abs(si)*hx+Math.abs(co)*hy);
 return COPIES.filter(shift=>{
  const cx=(box.minX+box.maxX)/2+shift-lon;
  const x=w/2+k*(co*cx-si*cy),y=h/2+k*(si*cx+co*cy);
  return x+ex>=-padding&&x-ex<=w+padding&&y+ey>=-padding&&y-ey<=h+padding;
 });
}
export function createStateBoundaryPreview({createPath=()=>new Path2D(),now=()=>performance.now()}={}){
 let cache=new WeakMap();
 const stats={hits:0,misses:0,originalPoints:0,drawnPoints:0,lastDrawMs:0,maxDrawMs:0,lastFeatures:0,lastCopies:0,lastCulled:0};
 function prepare(geometry,tolerance){
  if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))return null;
  let group=cache.get(geometry);
  if(group?.has(tolerance)){
   stats.hits++;
   return group.get(tolerance);
  }
  stats.misses++;
  const entry=makeEntry(geometry,tolerance,createPath);
  if(!group){group=new Map();cache.set(geometry,group);}
  // Keep only two zoom levels per geometry, bounded independently of camera.
  if(group.size>=2)group.delete(group.keys().next().value);
  group.set(tolerance,entry);
  return entry;
 }
 function draw(ctx,doc,states,w,h,k){
  if(!(k>0&&w>0&&h>0))return false;
  const started=now();
  const camera=doc.camera,lon=camera.center_lon,lat=camera.center_lat,bearing=camera.bearing||0;
  const tolerance=stateBoundaryTolerance(k);
  const visible=[];
  let total=0,originalPoints=0,drawnPoints=0;
  for(const state of states){
   const entry=prepare(state.geometry,tolerance);
   if(!entry)continue;
   const copies=visibleStateCopies(entry.box,{w,h,k,lon,lat,bearing});
   total+=3;
   originalPoints+=entry.originalPoints;drawnPoints+=entry.drawnPoints;
   if(copies.length)visible.push({entry,copies});
  }
  let drawn=0;
  ctx.save();
  const strokeWidth=ctx.lineWidth;
  ctx.translate(w/2,h/2);ctx.rotate(bearing*RAD);ctx.scale(k,k);
  ctx.translate(-lon,lat);
  ctx.lineWidth=strokeWidth/k;
  for(const shift of COPIES){
   ctx.save();ctx.translate(shift,0);
   for(const {entry,copies} of visible)if(copies.includes(shift)){
    ctx.stroke(entry.path);drawn++;
   }
   ctx.restore();
  }
  ctx.restore();
  stats.originalPoints=originalPoints;stats.drawnPoints=drawnPoints;
  stats.lastFeatures=visible.length;stats.lastCopies=drawn;stats.lastCulled=total-drawn;
  stats.lastDrawMs=now()-started;stats.maxDrawMs=Math.max(stats.maxDrawMs,stats.lastDrawMs);
  return true;
 }
 function getStats(){return {...stats};}
 function clear(){cache=new WeakMap();}
 return {draw,getStats,clear};
}
