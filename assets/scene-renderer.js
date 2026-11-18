/* CartoRig 1.2 — deterministic RGBA scene renderer; geographic camera + antimeridian wrapping. MIT. */
import {COLORS,clamp,treeIds,isVisible,ancestors,texturesEnabled} from './scene-core.js';
import {drawCreative,hitCreative,creativeHandles} from './creative-renderer.js';
import {paletteFor,resolveStyle,themeValue} from './style-resolver.js';
import {withIsolatedSurface,blending,applyAtmosphere,setRenderTile} from './style-effects.js';
import {paintMapLabels} from './map-labels.js';
import {countryForRegion} from './geo-catalog.js';
import {createFilteredTextureCache,visibleRasterShifts} from './texture-cache.js';
import {createStateBoundaryPreview} from './state-boundaries.js';
import {materialPatternTransform} from './material-projection.js';
const rad=Math.PI/180;
const preparedTextureCache=createFilteredTextureCache();
const stateBoundaryPreview=createStateBoundaryPreview();
export const stateBoundaryStats=()=>stateBoundaryPreview.getStats();
let fastTexturePreview=false;
const textureNow=()=>typeof performance==='undefined'?Date.now():performance.now();
export const previewTextureStats=()=>preparedTextureCache.getStats();
export const textureRenderStats={lastWorldMs:0,lastMaterialsMs:0,lastReliefMs:0,lastRasterFilterMs:0,filteredRasterCalls:0,preparedRasterCalls:0,rasterCopies:0,culledCopies:0};
const clampLongitude=v=>((Number(v)+180)%360+360)%360-180;
const points=g=>g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
export const polygonParts=c=>points(c?.geometry);
export function boundsOf(c){let b={minx:Infinity,miny:Infinity,maxx:-Infinity,maxy:-Infinity};for(let poly of polygonParts(c))for(let ring of poly)for(let p of ring){b.minx=Math.min(b.minx,p[0]);b.maxx=Math.max(b.maxx,p[0]);b.miny=Math.min(b.miny,p[1]);b.maxy=Math.max(b.maxy,p[1]);}return b;}
const inRing=(lon,lat,ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){let a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
export function pointInside(lon,lat,c){return polygonParts(c).some(poly=>{let outer=unwrapRing(poly[0]);if(![-360,0,360].some(off=>inRing(lon+off,lat,outer)))return false;return !poly.slice(1).some(r=>{let hole=unwrapRing(r,outer[0][0]);return [-360,0,360].some(off=>inRing(lon+off,lat,hole));});});}
export const scaleFor=(doc,w,h)=>Math.min(w/360,h/180)*clamp(doc.camera.zoom,.35,80);
const cameraPose=(doc,lon,lat,w,h)=>{let k=scaleFor(doc,w,h),dx=(lon-doc.camera.center_lon)*k,dy=(doc.camera.center_lat-lat)*k,theta=(doc.camera.bearing||0)*rad;return [w/2+dx*Math.cos(theta)-dy*Math.sin(theta),h/2+dx*Math.sin(theta)+dy*Math.cos(theta)];};
export function project(doc,lon,lat,w,h){let delta=lon-doc.camera.center_lon;delta=((delta+180)%360+360)%360-180;if(Math.abs(delta+180)<1e-9 && lon-doc.camera.center_lon>0)delta=180;return cameraPose(doc,doc.camera.center_lon+delta,lat,w,h);}
export function unproject(doc,x,y,w,h){let k=scaleFor(doc,w,h),theta=-(doc.camera.bearing||0)*rad,dx=x-w/2,dy=y-h/2;let lon=doc.camera.center_lon+(dx*Math.cos(theta)-dy*Math.sin(theta))/k,lat=doc.camera.center_lat-(dx*Math.sin(theta)+dy*Math.cos(theta))/k;return [clampLongitude(lon),lat];}
export function unwrapRing(ring,reference=null){if(!ring.length)return [];let first=ring[0][0];if(reference!==null)first+=360*Math.round((reference-first)/360);let result=[[first,ring[0][1]]];for(let i=1;i<ring.length;i++){let lon=ring[i][0];lon+=360*Math.round((result.at(-1)[0]-lon)/360);result.push([lon,ring[i][1]]);}return result;}
function drawPolygonPath(ctx,doc,geometry,w,h,shift=0){ctx.beginPath();for(let poly of points(geometry)){let outer=unwrapRing(poly[0]);let anchor=outer[0]?.[0]??0;for(let ring of poly){let coords=ring===poly[0]?outer:unwrapRing(ring,anchor);for(let i=0;i<coords.length;i++){let [x,y]=cameraPose(doc,coords[i][0]+shift,coords[i][1],w,h);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}if(coords.length)ctx.closePath();}}}
// Path2D geometry cache is per source feature and camera/viewport. Theme/color
// changes reuse already projected vertices instead of rebuilding huge polygons.
let polygonCache=new WeakMap();
export const polygonCacheStats={hits:0,misses:0};
export function clearPolygonPathCache(){polygonCache=new WeakMap();polygonCacheStats.hits=0;polygonCacheStats.misses=0;}
function cachedPolygonPaths(doc,geometry,w,h){
 if(typeof Path2D==='undefined')return null;
 const c=doc.camera,key=[w,h,c.center_lon,c.center_lat,c.zoom,c.bearing||0].join(':');
 const entry=polygonCache.get(geometry);if(entry?.key===key){polygonCacheStats.hits++;return entry.paths;}
 const paths=[];
 for(const shift of [-360,0,360]){
  const path=new Path2D();for(const poly of points(geometry)){
   const outer=unwrapRing(poly[0]);const anchor=outer[0]?.[0]??0;
   for(const ring of poly){const coords=ring===poly[0]?outer:unwrapRing(ring,anchor);
    for(let i=0;i<coords.length;i++){const [x,y]=cameraPose(doc,coords[i][0]+shift,coords[i][1],w,h);if(!i)path.moveTo(x,y);else path.lineTo(x,y);}if(coords.length)path.closePath();}
  }paths.push(path);
 }
 polygonCache.set(geometry,{key,paths});polygonCacheStats.misses++;return paths;
}
function drawPolygon(ctx,doc,geometry,w,h,fill=true,stroke=false){
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))return;
 const paths=cachedPolygonPaths(doc,geometry,w,h);
 if(paths){for(const path of paths){if(fill)ctx.fill(path,'evenodd');if(stroke)ctx.stroke(path);}return;}
 for(const shift of [-360,0,360]){drawPolygonPath(ctx,doc,geometry,w,h,shift);if(fill)ctx.fill('evenodd');if(stroke)ctx.stroke();}
}
function raster(ctx,doc,img,w,h){
 if(!img||img.complete===false||!(img.naturalWidth||img.width))return false;
 const k=scaleFor(doc,w,h),theta=(doc.camera.bearing||0)*rad;
 // Never change the exact full-resolution export raster; cull copies only
 // for the screen preview where subpixel seam differences are immaterial.
 const shifts=fastTexturePreview?visibleRasterShifts({width:w,height:h,k,center_lon:doc.camera.center_lon,center_lat:doc.camera.center_lat,bearing:doc.camera.bearing||0}):[-1,0,1];
 textureRenderStats.rasterCopies+=shifts.length;textureRenderStats.culledCopies+=3-shifts.length;
 ctx.save();ctx.translate(w/2,h/2);ctx.rotate(theta);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality=fastTexturePreview?'medium':'high';
 for(const shift of shifts)ctx.drawImage(img,(-180-doc.camera.center_lon+360*shift)*k,(doc.camera.center_lat-90)*k,360*k,180*k);
 ctx.restore();return true;
}
function rasterFiltered(ctx,doc,img,w,h,filter){
 const started=textureNow();textureRenderStats.filteredRasterCalls++;
 // Prepare large JPEGs once at bounded preview resolution, then reuse them.
 if(fastTexturePreview){
  const prepared=preparedTextureCache.get(img,filter);
  if(prepared){
   textureRenderStats.preparedRasterCalls++;
   const result=raster(ctx,doc,prepared,w,h);
   textureRenderStats.lastRasterFilterMs=textureNow()-started;
   return result;
  }
 }
 // Export path: original source and full-quality per-pass filter.
 ctx.save();ctx.filter=filter;const result=raster(ctx,doc,img,w,h);ctx.restore();
 textureRenderStats.lastRasterFilterMs=textureNow()-started;return result;
}
// Textures are local bundled images, never remote resources. The source names
// are validated by StyleResolver and the Source Manifest.
function terrainTexture(doc,palette){
 if(!texturesEnabled(doc))return null;
 const name=themeValue(doc,'texture_source');
 return name==='solid'?null:name==='auto'?(palette.texture||null):name;
}
function drawLandTextureClipped(ctx,doc,countries,images,img,w,h,alpha,filter){
 const visible=images._geo?.getCountriesForDraw(doc.camera.zoom)||countries;
 ctx.save();
 if(typeof Path2D==='function'){
  // Reuse the land mask already shared by shading and print materials.
  const masks=materialMasks(doc,countries,images,w,h);
  if(masks){ctx.clip(masks.land,'evenodd');ctx.globalAlpha*=alpha;rasterFiltered(ctx,doc,img,w,h,filter);}
 }else{ // Canvas without Path2D: transparent mask, no land shape may leak into sea
  const layer=document.createElement('canvas');layer.width=w;layer.height=h;
  const g=layer.getContext('2d');rasterFiltered(g,doc,img,w,h,filter);
  g.globalCompositeOperation='destination-in';g.fillStyle='#fff';
  for(const c of visible)drawPolygon(g,doc,c.geometry,w,h,true,false);
  ctx.globalAlpha*=alpha;ctx.drawImage(layer,0,0);layer.width=0;layer.height=0;
 }
 ctx.restore();
}
// CartoRig 1.4.7 -- materials are decorative print/water/paper surfaces.
// Geographic height / ocean depth are NEVER inferred from the print tiles.
function materialImage(images,name){
 return name==='none'?null:images['material-'+name];
}
// Cache each CanvasPattern for its Canvas2D context/image pair. Updating the
// affine matrix is much cheaper than recreating or filtering image textures.
const materialPatternCache=new WeakMap();
function materialPattern(ctx,image,doc,w,h){
 if(!image?.naturalWidth)return null;
 let patterns=materialPatternCache.get(ctx);
 if(!patterns){patterns=new WeakMap();materialPatternCache.set(ctx,patterns);}
 let pattern=patterns.get(image);
 if(!pattern){pattern=ctx.createPattern(image,'repeat');if(!pattern)return null;patterns.set(image,pattern);}
 const k=scaleFor(doc,w,h);
 const transform=materialPatternTransform({w,h,k,center_lon:doc.camera.center_lon,center_lat:doc.camera.center_lat,bearing:doc.camera.bearing||0,imageWidth:image.naturalWidth});
 // The matrix applies to the pattern, not the canvas: full-frame clip masks,
 // compositing, and tiled PNG exports keep the same geographic alignment.
 if(typeof pattern.setTransform==='function')pattern.setTransform(transform);
 else{
  // Older Canvas implementations lack CanvasPattern.setTransform; the caller
  // can still render using context transforms when needed.
  return {pattern,transform,fallback:true};
 }
 return {pattern,transform,fallback:false};
}
let materialMaskCache=new WeakMap();
function materialMasks(doc,countries,images,w,h){
 if(typeof Path2D!=='function')return null;
 const cam=doc.camera;
 const signature=[w,h,cam.center_lon,cam.center_lat,cam.zoom,cam.bearing||0].join(':');
 const source=images._geo?.getCountriesForDraw(doc.camera.zoom)||countries;
 const prior=materialMaskCache.get(doc);
 if(prior?.signature===signature&&prior.length===source.length&&prior.first===source[0]?.geometry&&prior.last===source.at(-1)?.geometry&&prior.geo===images._geo&&prior.datasetCount===(images._geo?.datasets?.size||0))return prior.masks;
 const land=new Path2D(),ocean=new Path2D();ocean.rect(0,0,w,h);
 for(const c of source)for(const path of cachedPolygonPaths(doc,c.geometry,w,h)||[]){land.addPath(path);ocean.addPath(path);}
 const masks={land,ocean};materialMaskCache.set(doc,{signature,length:source.length,first:source[0]?.geometry,last:source.at(-1)?.geometry,geo:images._geo,datasetCount:images._geo?.datasets?.size||0,masks});return masks;
}
function paintMaterial(ctx,images,doc,key,strengthKey,mask,w,h,masks){
 const image=materialImage(images,themeValue(doc,key));
 const strength=themeValue(doc,strengthKey);
 if(!image?.naturalWidth||!(strength>0))return;
 const material=materialPattern(ctx,image,doc,w,h);if(!material)return;
 // Transparent pixels in material PNGs provide a neutral base. Apply only
 // within valid geography for land / ocean material; no fake boundaries.
 ctx.save();
 if(mask!=='all'){
  if(!masks){ctx.restore();return;} // fail safe: do not leak land tint to sea
  ctx.clip(masks[mask],'evenodd');
 }
 ctx.globalAlpha*=strength;
 ctx.fillStyle=material.pattern;
 if(material.fallback){
  // Compatibility with older Canvas2D implementations: transform the context
  // instead of the pattern, and paint precisely the inverse-mapped viewport.
  const {a,b,c,d,e,f}=material.transform,det=a*d-b*c;
  if(Math.abs(det)>1e-12){
   const corners=[[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>[(d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det]);
   const left=Math.min(...corners.map(p=>p[0])),right=Math.max(...corners.map(p=>p[0]));
   const top=Math.min(...corners.map(p=>p[1])),bottom=Math.max(...corners.map(p=>p[1]));
   ctx.transform(a,b,c,d,e,f);
   ctx.fillRect(left,top,right-left,bottom-top);
  }
 }else ctx.fillRect(0,0,w,h);
 ctx.restore();
}
function paintSceneMaterials(ctx,doc,countries,images,w,h){
 textureRenderStats.lastMaterialsMs=0;
 if(!texturesEnabled(doc))return;
 const started=textureNow();
 const masks=materialMasks(doc,countries,images,w,h);
 // Paper/print surfaces are terrestrial materials, not water. Mask them
 // with the actual coastlines to prevent the same paper grain from covering
 // the ocean. Water receives ONLY its own ocean_material pattern. Preserve
 // geographic transforms, memoized paths and the original atlas recipes.
 paintMaterial(ctx,images,doc,'surface_material','surface_strength','land',w,h,masks);
 paintMaterial(ctx,images,doc,'ocean_material','ocean_material_strength','ocean',w,h,masks);
 paintMaterial(ctx,images,doc,'land_material','land_material_strength','land',w,h,masks);
 paintMaterial(ctx,images,doc,'cartographic_finish','finish_strength','land',w,h,masks);
 textureRenderStats.lastMaterialsMs=textureNow()-started;
}
function paintReliefProfile(ctx,doc,countries,images,w,h){
 textureRenderStats.lastReliefMs=0;
 if(!texturesEnabled(doc))return;
 const profile=themeValue(doc,'relief_profile');
 const strength=themeValue(doc,'relief_strength');
 if(!(strength>0)||profile==='none'||profile==='bathymetric')return;
 const shade=images.shadedrelief;
 if(!shade?.naturalWidth)return;
 const grade={soft:'grayscale(1) contrast(1.05)',natural:'grayscale(1) contrast(1.22)',rugged:'grayscale(1) contrast(1.9)',engraved:'grayscale(1) contrast(2)',dark:'grayscale(1) contrast(1.65)'}[profile];
 if(!grade)return;
 const masks=materialMasks(doc,countries,images,w,h);
 if(!masks)return;
 const started=textureNow();
 ctx.save();ctx.clip(masks.land,'evenodd');
 ctx.globalAlpha*=Math.min(.55,strength*.55);
 ctx.globalCompositeOperation='multiply';
 rasterFiltered(ctx,doc,shade,w,h,grade);ctx.restore();
 textureRenderStats.lastReliefMs=textureNow()-started;
}
function drawWorld(ctx,doc,countries,images,w,h){
 const started=textureNow();
 const theme=paletteFor(doc),o=doc.theme?.overrides||{};
 ctx.save();ctx.globalAlpha*=themeValue(doc,'ocean_opacity');ctx.fillStyle=theme.ocean;ctx.fillRect(0,0,w,h);ctx.restore();
 const src=terrainTexture(doc,theme),texture=src&&images[src],hasTexture=!!texture?.naturalWidth;
 const filter=`contrast(${themeValue(doc,'terrain_contrast')}) saturate(${themeValue(doc,'terrain_saturation')})`;
 if(hasTexture){
  if(themeValue(doc,'ocean_mode')==='solid'||themeValue(doc,'land_opacity')!==1){
   drawLandTextureClipped(ctx,doc,countries,images,texture,w,h,themeValue(doc,'land_opacity'),filter);
  }else{rasterFiltered(ctx,doc,texture,w,h,filter);}
 }else{
  ctx.save();ctx.fillStyle=theme.land;ctx.globalAlpha*=themeValue(doc,'land_opacity');
  let visible=images._geo?.getCountriesForDraw(doc.camera.zoom)||countries;
  for(const c of visible)drawPolygon(ctx,doc,c.geometry,w,h,true,false);ctx.restore();
 }
 // Texture shading is a luminance grade of a bundled color raster, NOT a
 // physical DEM or an assertion of measured elevation.
 if(texturesEnabled(doc)&&themeValue(doc,'terrain_enabled')&&themeValue(doc,'terrain_strength')>0){
  const shade=images[themeValue(doc,'terrain_source')];
  if(shade?.naturalWidth){ctx.save();ctx.globalAlpha*=themeValue(doc,'terrain_strength');
   ctx.globalCompositeOperation='multiply';
   const masks=materialMasks(doc,countries,images,w,h);
   if(masks){ctx.clip(masks.land,'evenodd');rasterFiltered(ctx,doc,shade,w,h,`grayscale(1) contrast(${themeValue(doc,'terrain_contrast')})`);}ctx.restore();}
 }
 // Optional 1.4.6 reference look grading: apply a gentle color wash only
 // inside actual land polygons. Country shapes are cached and WGS84-anchored;
 // editorial Region overlays render later and retain their own override colors.
 const landTint=themeValue(doc,'land_tint_strength');
 if(landTint>0){
  ctx.save();ctx.globalAlpha*=landTint;ctx.fillStyle=themeValue(doc,'land_tint_color');
  const maskCountries=images._geo?.getCountriesForDraw(doc.camera.zoom)||countries;
  for(const c of maskCountries)drawPolygon(ctx,doc,c.geometry,w,h,true,false);
  ctx.restore();
 }
 paintReliefProfile(ctx,doc,countries,images,w,h);
 paintSceneMaterials(ctx,doc,countries,images,w,h);
 if(doc.theme.id==='night'){
  ctx.save();let grad=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.max(w,h)*.8);
  grad.addColorStop(0,'#00000000');grad.addColorStop(1,'#000000aa');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);ctx.restore();
 } textureRenderStats.lastWorldMs=textureNow()-started;
}
function drawGrid(ctx,doc,w,h){
 const theme=paletteFor(doc),factor=h/1080;
 ctx.strokeStyle=theme.grid;ctx.globalAlpha*=themeValue(doc,'grid_opacity');ctx.lineWidth=Math.max(.5,factor);
 const z=doc.camera.zoom,custom=themeValue(doc,'grid_interval'),inc=custom>0?custom:z>20?2:z>8?5:z>3?10:30;
 ctx.beginPath();for(let lon=-180;lon<=180;lon+=inc){let a=project(doc,lon,-90,w,h),b=project(doc,lon,90,w,h);ctx.moveTo(...a);ctx.lineTo(...b);}
 for(let lat=-90;lat<=90;lat+=inc)for(let i=0;i<360;i+=15){let a=project(doc,-180+i,lat,w,h),b=project(doc,-180+i+15,lat,w,h);if(Math.abs(a[0]-b[0])<w*1.2){ctx.moveTo(...a);ctx.lineTo(...b);}}
 ctx.stroke();
 if(themeValue(doc,'grid_labels')){
  ctx.save();ctx.globalAlpha=1;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${themeValue(doc,'grid_label_size')*factor}px sans-serif`;
  ctx.fillStyle=theme.text||'#fff';ctx.strokeStyle=theme.ocean||'#000';ctx.lineWidth=2.5*factor;
  for(let lon=-180;lon<=180;lon+=inc){let [x,y]=project(doc,lon,doc.camera.center_lat,w,h);if(x>24*factor&&x<w-24*factor&&y>10&&y<h-10){const t=`${Math.abs(lon)}°${lon<0?'W':lon>0?'E':''}`;ctx.strokeText(t,x,y+16*factor);ctx.fillText(t,x,y+16*factor);}}
  for(let lat=-90;lat<=90;lat+=inc){let [x,y]=project(doc,doc.camera.center_lon,lat,w,h);if(x>20&&x<w-20&&y>20*factor&&y<h-20*factor){const t=`${Math.abs(lat)}°${lat<0?'S':lat>0?'N':''}`;ctx.strokeText(t,x+26*factor,y);ctx.fillText(t,x+26*factor,y);}}
  ctx.restore();
 }
}
function drawBorders(ctx,doc,countries,images,w,h){
 const theme=paletteFor(doc),f=h/1080,kind=themeValue(doc,'border_style');
 ctx.strokeStyle=theme.border;ctx.lineWidth=Math.max(0,themeValue(doc,'border_width')*f);
 ctx.globalAlpha*=themeValue(doc,'border_opacity');
 ctx.setLineDash(kind==='Dashed'||(kind==='Solid'&&doc.theme.overrides?.border_dash===true)?[5*f,3*f]:kind==='Dotted'?[1*f,4*f]:[]);
 ctx.lineJoin='round';let detailed=images._geo?.getCountriesForDraw(doc.camera.zoom)||countries;
 for(const c of detailed)drawPolygon(ctx,doc,c.geometry,w,h,false,true);
}
function drawPhysical(ctx,doc,geo,w,h){if(!geo)return;let factor=h/1080,over=doc.theme.overrides;
 if(over.show_state_boundaries===true && doc.camera.zoom>=2){let k=scaleFor(doc,w,h),spanLon=Math.min(180,w/k*.8+8),spanLat=Math.min(90,h/k*.8+8);let states=geo.getVisibleStates(doc.camera.center_lon,doc.camera.center_lat,spanLon,spanLat);ctx.save();ctx.strokeStyle=over.border_color||paletteFor(doc).border||'#9ab0be';ctx.lineWidth=Math.max(.5,.9*factor);ctx.globalAlpha*=.68;ctx.lineJoin='round';if(fastTexturePreview&&typeof Path2D==='function')stateBoundaryPreview.draw(ctx,doc,states,w,h,k);
 else for(const state of states)drawPolygon(ctx,doc,state.geometry,w,h,false,true);
 ctx.restore();}for(let kind of ['Lake','River','Coastline']){let key={Lake:'show_lakes',River:'show_rivers',Coastline:'show_coastlines'}[kind];if(over[key]!==true)continue;let features=geo.details.filter(f=>f.type===kind);ctx.save();ctx.strokeStyle={Lake:'#7ab9d3',River:'#5bafd0',Coastline:'#a2bbbc'}[kind];ctx.fillStyle='#23556b';ctx.lineWidth=(kind==='River'?1.3:1)*factor;ctx.globalAlpha*=kind==='Lake'?.7:.65;for(let f of features){let g=f.geometry;if(g.type==='Polygon'||g.type==='MultiPolygon'){drawPolygon(ctx,doc,g,w,h,kind==='Lake',true);continue;}let lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];ctx.beginPath();for(let line of lines){let parts=splitLine(line);for(let segment of parts){for(let shift of [-360,0,360]){for(let [i,p] of segment.entries()){let xy=cameraPose(doc,p[0]+shift,p[1],w,h);if(!i)ctx.moveTo(...xy);else ctx.lineTo(...xy);}}}}ctx.stroke();}ctx.restore();}}
function splitLine(line){let segments=[],current=[];for(let p of line){if(current.length&&Math.abs(p[0]-current.at(-1)[0])>180){let prev=current.at(-1),adjusted=p[0]-(p[0]>prev[0]?360:-360),edge=p[0]>prev[0]?-180:180,t=(edge-prev[0])/(adjusted-prev[0]),latitude=prev[1]+(p[1]-prev[1])*t;current.push([edge,latitude]);segments.push(current);current=[[-edge,latitude]];}current.push(p);}if(current.length)segments.push(current);return segments;}
function findRegionGeometry(obj,geo,countriesByIso,zoom=1){if(obj.embedded_geometry)return obj.embedded_geometry;if(obj.region_kind==='Continent')return geo?.continents?.[obj.source?.feature_id]||null;if(obj.region_kind==='Country')return countryForRegion(obj,[...countriesByIso.values()],geo,zoom)?.geometry||null;return geo?.lookup?.(obj.source?.dataset_id,obj.source?.feature_id)?.geometry||null;}
function paintObject(ctx,doc,obj,countriesByIso,countries,images,w,h,style){
 const factor=h/1080,geo=images._geo;
 if(obj.type==='WorldMap'){drawWorld(ctx,doc,countries,images,w,h);drawPhysical(ctx,doc,geo,w,h);}
 if(obj.type==='Grid')drawGrid(ctx,doc,w,h);
 if(obj.type==='Borders')drawBorders(ctx,doc,countries,images,w,h);
 if(obj.type==='Region'){
  const geom=findRegionGeometry(obj,geo,countriesByIso,doc.camera.zoom);
  if(geom){
   ctx.save();ctx.fillStyle=style.fill_color;ctx.globalAlpha*=clamp(style.fill_opacity??.8,0,1);drawPolygon(ctx,doc,geom,w,h,true,false);ctx.restore();
   if((style.stroke_width??2)>0){ctx.save();ctx.strokeStyle=style.stroke_color;ctx.globalAlpha*=clamp(style.stroke_opacity??1,0,1);ctx.lineWidth=(style.stroke_width??2)*factor;ctx.lineJoin='round';ctx.setLineDash(style.stroke_style==='Dashed'?[8*factor,6*factor]:style.stroke_style==='Dotted'?[1*factor,4*factor]:[]);drawPolygon(ctx,doc,geom,w,h,false,true);ctx.restore();}
  }
 }
 if(['Route','Marker','Label','Shape'].includes(obj.type))drawCreative(ctx,doc,{...obj,style},w,h,project);
}
export function drawObject(ctx,doc,obj,countriesByIso,countries,images,w,h){
 const style=resolveStyle(doc,obj);
 withIsolatedSurface(ctx,w,h,(target)=>paintObject(target,doc,obj,countriesByIso,countries,images,w,h,style),{...style,opacity:clamp(obj.opacity??1,0,1)});
}
export function renderScene(ctx,doc,countries,images,w,h,{onlyIds=null,preview=false,fastTextures=false,selection=[],soloId=null,tile=null,includeMapLabels=false}={}){
 const previousTextureMode=fastTexturePreview;
 fastTexturePreview=fastTextures===true;
 textureRenderStats.filteredRasterCalls=0;textureRenderStats.preparedRasterCalls=0;textureRenderStats.rasterCopies=0;textureRenderStats.culledCopies=0;
 const previous=tile?setRenderTile(tile):null;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);if(tile)ctx.translate(-tile.x,-tile.y);try {
 const byIso=new Map(countries.map(c=>[c.iso,c]));
 const allowed=onlyIds?new Set(onlyIds):null;
 function includesAllowed(id){if(!allowed)return true;if(allowed.has(id))return true;const o=doc.objects[id];return o?.type==='Group'&&o.children.some(includesAllowed);}
 function drawList(list,target){for(let id of list){const o=doc.objects[id];if(!o||!isVisible(doc,id))continue;
  if(soloId&&id!==soloId&&!ancestors(doc,soloId).includes(id)&&!ancestors(doc,id).includes(soloId))continue;
  if(o.type==='Group'){
   if(!includesAllowed(id))continue;
   const style=resolveStyle(doc,o),opacity=clamp(o.opacity??1,0,1);
   // Group opacity, blend and effects are applied after children compose.
   if(opacity!==1||style.blend_mode!=='normal'||style.glow_enabled||style.shadow_enabled){
    withIsolatedSurface(target,w,h,sub=>drawList(o.children,sub),{...style,opacity,forceIsolation:true});
   }else drawList(o.children,target);
  }else{
   if(allowed&&!allowed.has(id))continue;
   if(doc.canvas.transparent&&o.type==='WorldMap'&&!allowed)continue;
   drawObject(target,doc,o,byIso,countries,images,w,h);
  }
 }}
 // Preserve the user's scene stacking order, including group effects.
 // Cartographic place names are a dedicated annotation overlay: painting
 // them before user-defined regions lets opaque country fills hide the text.
 drawList(doc.scene.root_ids,ctx);
 if((!allowed||includeMapLabels)&&!soloId)paintMapLabels(ctx,doc,images._labels,w,h,project,paletteFor(doc));
 // An atmosphere grade applies to the *final composite*. The alpha of empty
 // pixels must be preserved on transparent exports.
 if(!allowed){ctx.save();ctx.globalCompositeOperation='source-atop';applyAtmosphere(ctx,w,h,{atmosphere_vignette:themeValue(doc,'atmosphere_vignette'),atmosphere_tint:themeValue(doc,'atmosphere_tint'),atmosphere_tint_mix:themeValue(doc,'atmosphere_tint_mix')});ctx.restore();}
 if(preview)drawPreviewSelection(ctx,doc,countries,images,w,h,selection);
 } finally {fastTexturePreview=previousTextureMode;ctx.restore();if(tile)setRenderTile(previous)}
}
// Selection handles are separate from the expensive atlas composition.
export function drawPreviewSelection(ctx,doc,countries,images,w,h,selection=[]){
 if(!selection.length)return;
 const byIso=new Map(countries.map(c=>[c.iso,c]));
 for(const id of selection){
  const o=doc.objects[id];if(!o||!isVisible(doc,id))continue;
  ctx.save();ctx.strokeStyle='#76bbff';ctx.lineWidth=2;ctx.setLineDash([5,4]);
  if(o.type==='Region'){
   const geom=findRegionGeometry(o,images._geo,byIso,doc.camera.zoom);
   if(geom)drawPolygon(ctx,doc,geom,w,h,false,true);
  }else if(['Label','Marker','Route','Shape'].includes(o.type)){
   for(const handle of creativeHandles(doc,o,w,h,project)){
    const [x,y]=handle.xy;ctx.fillStyle='#12344d';
    ctx.fillRect(x-5,y-5,10,10);ctx.strokeRect(x-6,y-6,12,12);
   }
  }
  ctx.restore();
 }
}
export function renderMapLabelLayer(ctx,doc,images,w,h,{tile=null}={}){
 ctx.save();try{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);if(tile)ctx.translate(-tile.x,-tile.y);
  return paintMapLabels(ctx,doc,images?._labels,w,h,project,paletteFor(doc));
 }finally{ctx.restore();}
}
export function hitTestCandidates(doc,countries,x,y,w,h,geo=null){
 const [lon,lat]=unproject(doc,x,y,w,h),byIso=new Map(countries.map(c=>[c.iso,c])),result=[];
 for(const id of treeIds(doc).reverse()){
  const o=doc.objects[id];if(!o||!isVisible(doc,id)||o.type==='Group')continue;
  if(o.type==='Region'){
   const geom=findRegionGeometry(o,geo,byIso,doc.camera.zoom);
   if(geom&&pointInside(lon,lat,{geometry:geom}))result.push(id);
  }else if(['Marker','Label','Route','Shape'].includes(o.type)&&hitCreative(doc,o,x,y,w,h,project))result.push(id);
 }
 return result;
}
export function hitTest(doc,countries,x,y,w,h,geo=null){const [lon,lat]=unproject(doc,x,y,w,h),byIso=new Map(countries.map(c=>[c.iso,c]));let ids=treeIds(doc).reverse();for(let id of ids){let o=doc.objects[id];if(!o||!isVisible(doc,id)||o.type==='Group')continue;
 if(o.type==='Region'){let geom=findRegionGeometry(o,geo,byIso,doc.camera.zoom);if(geom&&pointInside(lon,lat,{geometry:geom}))return id;}
 if(['Marker','Label','Route','Shape'].includes(o.type)&&hitCreative(doc,o,x,y,w,h,project))return id;}
 return null;}

// Render a Region as an unclipped full-frame matte, using exactly the same
// WGS84 geometry/path projection as ordinary scene rendering. No effects.
export function renderRegionMask(ctx,doc,obj,countries,images,w,h,{opaque=false,tile=null}={}){
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);if(tile)ctx.translate(-tile.x,-tile.y);
 if(opaque){ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h)}
 if(obj?.type==='Region'){
  const byIso=new Map(countries.map(c=>[c.iso,c]));
  const geom=findRegionGeometry(obj,images._geo,byIso,doc.camera.zoom);
  if(geom){ctx.fillStyle='#ffffff';drawPolygon(ctx,doc,geom,w,h,true,false)}
 }
 ctx.restore();
}
