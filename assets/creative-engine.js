/* CartoRig 1.3 — static geographic creative tools; no timeline or animation. MIT. */
export const MARKER_SYMBOLS=Object.freeze(['Circle','Square','Diamond','Pin','Flag','Airport','Port','Naval','Capital','Strategic']);
export const SHAPES=Object.freeze(['Line','Arrow','Rectangle','Ellipse','Polygon','Freehand','Callout','Distance']);
export const ROUTE_TYPES=Object.freeze(['Straight','Curved','Geodesic','Custom']);
export const clamp01=v=>Math.max(0,Math.min(1,Number(v)));
export const normLon=v=>((Number(v)+180)%360+360)%360-180;
const rad=Math.PI/180;
export function pointValid(p){return !!p&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&p.lon>=-180&&p.lon<=180&&p.lat>=-90&&p.lat<=90;}
export function distinct(points){return new Set(points.map(p=>`${p.lon.toFixed(8)},${p.lat.toFixed(8)}`)).size;}
export function resolveLink(doc,p){let obj=p?.linked_object_id&&doc.objects[p.linked_object_id];return obj?.type==='Marker'&&pointValid(obj.anchor)?{...p,lon:obj.anchor.lon,lat:obj.anchor.lat}:p;}
export function routePoints(doc,o){let from=resolveLink(doc,o.from),to=resolveLink(doc,o.to);return o.path_type==='Custom'?[from,...(o.waypoints||[]),to]:[from,to];}
const unwrap=(lon,prev)=>lon+360*Math.round((prev-lon)/360);
export function continuousPoints(points){let out=[];for(let p of points){let lon=p.lon;if(out.length)lon=unwrap(lon,out.at(-1).lon);out.push({lon,lat:p.lat});}return out;}
// Vincenty's inverse / direct WGS84 for ordinary points, with finite, explicitly
// flagged spherical approximation when inverse fails to converge near antipodes.
const A=6378137,F=1/298.257223563,B=A*(1-F);
export function inverseGeodesic(a,b){
 if(!pointValid(a)||!pointValid(b))throw Error('Invalid WGS84 endpoints');
 const phi1=a.lat*rad,phi2=b.lat*rad,L=normLon(b.lon-a.lon)*rad;
 const U1=Math.atan((1-F)*Math.tan(phi1)),U2=Math.atan((1-F)*Math.tan(phi2));
 const sin1=Math.sin(U1),cos1=Math.cos(U1),sin2=Math.sin(U2),cos2=Math.cos(U2);
 let lam=L,cos2alpha=0,cos2sigm=0,sigma=0,sinSig=0,cosSig=0,sinAlpha=0,converged=false;
 for(let i=0;i<180;i++){
  let sl=Math.sin(lam),cl=Math.cos(lam);
  sinSig=Math.hypot(cos2*sl,cos1*sin2-sin1*cos2*cl);cosSig=sin1*sin2+cos1*cos2*cl;
  if(sinSig<1e-15){if(cosSig<0)return inverseByShooting(a,b,{meters:Math.PI*B,azimuth:0,approximate:true})||{meters:Math.PI*B,azimuth:0,approximate:true};return {meters:0,azimuth:0,approximate:false};}
  cosSig=sin1*sin2+cos1*cos2*cl;sigma=Math.atan2(sinSig,cosSig);
  sinAlpha=cos1*cos2*sl/sinSig;cos2alpha=1-sinAlpha*sinAlpha;
  cos2sigm=cos2alpha>1e-14?cosSig-2*sin1*sin2/cos2alpha:0;
  const C=F/16*cos2alpha*(4+F*(4-3*cos2alpha));
  const next=L+(1-C)*F*sinAlpha*(sigma+C*sinSig*(cos2sigm+C*cosSig*(-1+2*cos2sigm*cos2sigm)));
  if(Math.abs(next-lam)<1e-12){converged=true;lam=next;break}lam=next;
 }
 if(!converged){let dl=L,cs=Math.max(-1,Math.min(1,Math.sin(phi1)*Math.sin(phi2)+Math.cos(phi1)*Math.cos(phi2)*Math.cos(dl))),ang=Math.acos(cs),azi=Math.atan2(Math.sin(dl)*Math.cos(phi2),Math.cos(phi1)*Math.sin(phi2)-Math.sin(phi1)*Math.cos(phi2)*Math.cos(dl));const approx={meters:6371008.8*ang,azimuth:azi/rad,approximate:true};return inverseByShooting(a,b,approx)||approx;}
 let u2=cos2alpha*(A*A-B*B)/(B*B),bigA=1+u2/16384*(4096+u2*(-768+u2*(320-175*u2))),bigB=u2/1024*(256+u2*(-128+u2*(74-47*u2)));
 let ds=bigB*sinSig*(cos2sigm+bigB/4*(cosSig*(-1+2*cos2sigm*cos2sigm)-bigB/6*cos2sigm*(-3+4*sinSig*sinSig)*(-3+4*cos2sigm*cos2sigm)));
 let azimuth=Math.atan2(cos2*Math.sin(lam),cos1*sin2-sin1*cos2*Math.cos(lam))/rad;
 return {meters:B*bigA*(sigma-ds),azimuth,approximate:false};
}
// Numerical shooting with a Vincenty-direct integrator repairs the classical
// Vincenty-inverse failure near antipodes. Multiple initial azimuths are tested
// to prefer the shortest converged WGS84 solution.
function inverseByShooting(a,b,approx){
 const azis=[approx.azimuth,approx.azimuth+90,approx.azimuth-90,90,-90,0,180,45,-45,135,-135];
 const length=[approx.meters,Math.PI*B,Math.PI*A];let best=null;
 const residual=(az,d)=>{let out=directGeodesic(a,az,d);return [(out.lat-b.lat)*rad,normLon(out.lon-b.lon)*rad];};
 for(let ai of azis)for(let first of length){let az=ai,dist=first;
  for(let it=0;it<28;it++){
   let e=residual(az,dist),norm=Math.hypot(...e);
   if(!Number.isFinite(norm))break;
   if(norm<1e-10){if(dist>=0&&dist<=Math.PI*A+40000&&(!best||dist<best.meters))best={meters:dist,azimuth:((az%360)+540)%360-180,approximate:false};break;}
   let ha=1e-4,hd=15,eaz=residual(az+ha,dist),ed=residual(az,dist+hd);
   let j11=(eaz[0]-e[0])/ha,j21=(eaz[1]-e[1])/ha,j12=(ed[0]-e[0])/hd,j22=(ed[1]-e[1])/hd;
   let det=j11*j22-j12*j21;if(!Number.isFinite(det)||Math.abs(det)<1e-19)break;
   let da=(-e[0]*j22+e[1]*j12)/det,dd=(-j11*e[1]+j21*e[0])/det;
   if(!Number.isFinite(da)||!Number.isFinite(dd))break;
   da=Math.max(-90,Math.min(90,da));dd=Math.max(-2_000_000,Math.min(2_000_000,dd));
   let success=false;for(let t=1;t>=.0625;t/=2){let nextAz=az+da*t,nextDist=dist+dd*t;if(nextDist<0||nextDist>Math.PI*A+40000)continue;let r=residual(nextAz,nextDist);if(Math.hypot(...r)<norm){az=nextAz;dist=nextDist;success=true;break;}}
   if(!success)break;
  }
 }
 return best;
}
export function directGeodesic(a,azimuth,meters){
 const alpha1=azimuth*rad,phi1=a.lat*rad,tanU=(1-F)*Math.tan(phi1),u1=Math.atan(tanU),su=Math.sin(u1),cu=Math.cos(u1),sa1=Math.sin(alpha1),ca1=Math.cos(alpha1),sa=cu*sa1,ca2=1-sa*sa;
 const u2=ca2*(A*A-B*B)/(B*B),bA=1+u2/16384*(4096+u2*(-768+u2*(320-175*u2))),bB=u2/1024*(256+u2*(-128+u2*(74-47*u2)));
 const sigma1=Math.atan2(tanU,ca1),sin2sig=()=>Math.cos(2*sigma1+sigma);
 let sigma=meters/(B*bA),prev;for(let i=0;i<60;i++){let d=bB*Math.sin(sigma)*(sin2sig()+bB/4*(Math.cos(sigma)*(-1+2*sin2sig()**2)-bB/6*sin2sig()*(-3+4*Math.sin(sigma)**2)*(-3+4*sin2sig()**2)));prev=sigma;sigma=meters/(B*bA)+d;if(Math.abs(sigma-prev)<1e-12)break;}
 const ss=Math.sin(sigma),cs=Math.cos(sigma),cos2sm=sin2sig(),tmp=su*ss-cu*cs*ca1;
 let phi2=Math.atan2(su*cs+cu*ss*ca1,(1-F)*Math.sqrt(sa*sa+tmp*tmp));
 let lam=Math.atan2(ss*sa1,cu*cs-su*ss*ca1),C=F/16*ca2*(4+F*(4-3*ca2));
 let L=lam-(1-C)*F*sa*(sigma+C*ss*(cos2sm+C*cs*(-1+2*cos2sm*cos2sm)));
 return {lon:normLon(a.lon+L/rad),lat:phi2/rad};
}
function sphericalIntermediate(a,b,t){let phi1=a.lat*rad,phi2=b.lat*rad,lambda1=a.lon*rad,dl=normLon(b.lon-a.lon)*rad;let delta=Math.acos(Math.max(-1,Math.min(1,Math.sin(phi1)*Math.sin(phi2)+Math.cos(phi1)*Math.cos(phi2)*Math.cos(dl))));if(delta<1e-12)return {lon:a.lon,lat:a.lat};let p=Math.sin((1-t)*delta)/Math.sin(delta),q=Math.sin(t*delta)/Math.sin(delta);let x=p*Math.cos(phi1)*Math.cos(lambda1)+q*Math.cos(phi2)*Math.cos(lambda1+dl),y=p*Math.cos(phi1)*Math.sin(lambda1)+q*Math.cos(phi2)*Math.sin(lambda1+dl),z=p*Math.sin(phi1)+q*Math.sin(phi2);return {lon:normLon(Math.atan2(y,x)/rad),lat:Math.atan2(z,Math.hypot(x,y))/rad};}
export function geodesicSamples(a,b,pixelsPerDegree=6){let inv=inverseGeodesic(a,b);let count=Math.min(2048,Math.max(16,Math.ceil(inv.meters/100000),Math.ceil(inv.meters/111320*pixelsPerDegree/3)));let list=[];for(let i=0;i<=count;i++){let t=i/count;list.push(i===0?a:i===count?b:inv.approximate?sphericalIntermediate(a,b,t):directGeodesic(a,inv.azimuth,inv.meters*t));}list.approximate=inv.approximate;return list;}
export function curvedSamples(a,b,curvature=0,count=64){let bLon=unwrap(b.lon,a.lon),dx=bLon-a.lon,dy=b.lat-a.lat,D=Math.hypot(dx,dy),height=(curvature||0)*D/2,c={lon:(a.lon+bLon)/2-height*(dy/(D||1)),lat:(a.lat+b.lat)/2+height*(dx/(D||1))};let list=[];for(let i=0;i<=count;i++){let t=i/count,iv=1-t;list.push({lon:iv*iv*a.lon+2*iv*t*c.lon+t*t*bLon,lat:iv*iv*a.lat+2*iv*t*c.lat+t*t*b.lat});}return list;}
export function routeSamples(doc,obj,pxPerDeg=6){let pts=routePoints(doc,obj),type=obj.path_type||'Straight';if(type==='Custom'||type==='Straight')return continuousPoints(pts);if(type==='Curved')return curvedSamples(pts[0],pts.at(-1),obj.curvature||0,Math.min(1024,Math.max(48,Math.ceil(pxPerDeg*18))));return continuousPoints(geodesicSamples(pts[0],pts.at(-1),pxPerDeg));}
export function simplifyFreehand(points,tolerance=.00045){
 if(!Array.isArray(points)||points.length<3)return points;
 const dist2=(p,a,b)=>{let x=p.x??p.lon,y=p.y??p.lat,ax=a.x??a.lon,ay=a.y??a.lat,bx=b.x??b.lon,by=b.y??b.lat,dx=bx-ax,dy=by-ay,t=((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1);t=Math.max(0,Math.min(1,t));return (x-ax-t*dx)**2+(y-ay-t*dy)**2;};
 const kept=new Set([0,points.length-1]);let stack=[[0,points.length-1]];
 while(stack.length){let [a,b]=stack.pop(),max=0,index=-1;for(let i=a+1;i<b;i++){let d=dist2(points[i],points[a],points[b]);if(d>max){max=d;index=i;}}if(max>tolerance*tolerance&&index>0){kept.add(index);stack.push([a,index],[index,b]);}}
 return [...kept].sort((a,b)=>a-b).map(i=>points[i]);
}
export function shapePoints(doc,o){return (o.points||[]).map(p=>o.coordinate_space==='screen'?{x:p.x,y:p.y}:p);}
export function destinationPoint(doc,o,which){const p=o[which];return resolveLink(doc,p);}
export function geoDistance(a,b){return inverseGeodesic(a,b);}
export function validateCreative(o){
 if(o.type==='Route'){
  if(!ROUTE_TYPES.includes(o.path_type)||!pointValid(o.from)||!pointValid(o.to)||((o.waypoints||[]).some(p=>!pointValid(p))))throw Error('Invalid route or WGS84 coordinates');
  if((o.path_type==='Custom'?distinct([o.from,...(o.waypoints||[]),o.to]):distinct([o.from,o.to]))<2)throw Error('Route needs two distinct points');
  if(o.path_type==='Curved'&&(!Number.isFinite(o.curvature||0)||Math.abs(o.curvature||0)>1))throw Error('Route curvature must be between -1 and 1');
 }
 if(o.type==='Marker'&&(!pointValid(o.anchor)||!MARKER_SYMBOLS.includes(o.symbol||'Circle')))throw Error('Invalid marker');
 if(o.type==='Label'){
  if(!['geo','screen'].includes(o.position_mode||'geo')||!pointValid(o.anchor)||typeof o.text!=='string'||o.text.length>10000)throw Error('Invalid label');
  if(o.position_mode==='screen'&&(!Number.isFinite(o.screen_pos?.x)||!Number.isFinite(o.screen_pos?.y)||o.screen_pos.x<0||o.screen_pos.x>1||o.screen_pos.y<0||o.screen_pos.y>1))throw Error('Invalid screen-pinned position');
 }
 if(o.type==='Shape'){
  if(!SHAPES.includes(o.shape_kind)||!['geo','screen'].includes(o.coordinate_space)||!Array.isArray(o.points)||o.points.length>10000)throw Error('Invalid editorial shape');
  if(o.callout_box!=null){
   if(o.shape_kind!=='Callout'||!Number.isFinite(o.callout_box.x)||!Number.isFinite(o.callout_box.y)||o.callout_box.x<0||o.callout_box.x>1||o.callout_box.y<0||o.callout_box.y>1)throw Error('Invalid pinned Callout box');
  }
  for(let p of o.points){if(o.coordinate_space==='geo'?!pointValid(p):!(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))throw Error('Invalid shape coordinates');}
  if(o.points.length<(o.shape_kind==='Polygon'?3:2))throw Error('Insufficient shape vertices');
  if(o.shape_kind==='Polygon'){
    let v=o.points.map(p=>o.coordinate_space==='screen'?[p.x,p.y]:[p.lon,p.lat]);
    if(distinct(o.points.map(p=>o.coordinate_space==='screen'?{lon:p.x,lat:p.y}:p))<3)throw Error('Polygon requires three unique vertices');
    let area=0;for(let i=0;i<v.length;i++){let b=v[(i+1)%v.length];area+=v[i][0]*b[1]-b[0]*v[i][1];}if(Math.abs(area)<1e-10)throw Error('Polygon has zero area');
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(let i=0;i<v.length;i++)for(let j=i+2;j<v.length;j++){
      if(i===0&&j===v.length-1)continue;
      let a=v[i],b=v[(i+1)%v.length],c=v[j],d=v[(j+1)%v.length],ab=cross(a,b,c),ac=cross(a,b,d),cd=cross(c,d,a),ce=cross(c,d,b);
      if(ab*ac<0&&cd*ce<0)throw Error('Self-intersecting editorial polygon');
    }
  }
 }
}
export function sanitizeSVG(source){
 if(typeof source!=='string'||source.length>300000||!/^\s*<svg[\s>]/i.test(source))throw Error('Not a safe SVG file');
 if(/<!doctype|<!entity|<script|<foreignObject|<iframe|<image|<use\b|<style|<animate|on[a-z]+\s*=|\b(?:href|src)\s*=|url\s*\(|@import|<\?xml-stylesheet/i.test(source))throw Error('SVG contains scripts, external references or active content');
 let parsed=new DOMParser().parseFromString(source,'image/svg+xml');if(parsed.querySelector('parsererror'))throw Error('Malformed SVG');
 let allow=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','linearGradient','radialGradient','stop']);
 let attributes=new Set(['xmlns','width','height','viewBox','d','x','y','x1','y1','x2','y2','cx','cy','rx','ry','r','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','transform','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform']);
 for(let node of parsed.getElementsByTagName('*')){if(!allow.has(node.localName))throw Error('SVG element not allowed: '+node.localName);for(let a of [...node.attributes])if(!attributes.has(a.name)||/url\(|javascript:|data:/i.test(a.value))throw Error('Unsafe SVG attribute '+a.name);}
 let el=parsed.documentElement;el.setAttribute('xmlns','http://www.w3.org/2000/svg');return new XMLSerializer().serializeToString(el);
}
