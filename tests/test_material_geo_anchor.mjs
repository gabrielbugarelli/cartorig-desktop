/* Texture materials must share WGS84 coordinates with the camera; paper,
 * land, ocean and print finish use one repeated material path. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialPatternTransform,MATERIAL_TILE_LONGITUDE_DEGREES} from '../assets/material-projection.js';
import {newDocument} from '../assets/scene-core.js';
import {project,scaleFor} from '../assets/scene-renderer.js';

const close=(x,y,eps=1e-7)=>assert.ok(Math.abs(x-y)<=eps,`difference ${x} vs ${y}`);
const use=(t,x,y)=>[t.a*x+t.c*y+t.e,t.b*x+t.d*y+t.f];
const img={naturalWidth:512,naturalHeight:512};
const doc=newDocument(),W=1440,H=810;
const transform=()=>materialPatternTransform({w:W,h:H,k:scaleFor(doc,W,H),...doc.camera,imageWidth:img.naturalWidth});
function worldPixel(lon,lat){
 // Image material pixel coordinates, with source (-180°,90°).
 const deg=MATERIAL_TILE_LONGITUDE_DEGREES/img.naturalWidth;
 return [(lon+180)/deg,(90-lat)/deg];
}
function matchMap(lon,lat){
 // The renderer projects the geographically closest wrapped world copy.
 // The pattern is 360-degree periodic, so that copy has the same texture.
 const delta=lon-doc.camera.center_lon;
 const shifted=doc.camera.center_lon+((delta+180)%360+360)%360-180;
 const [u,v]=worldPixel(shifted,lat),got=use(transform(),u,v),want=project(doc,lon,lat,W,H);
 close(got[0],want[0]);close(got[1],want[1]);
}
assert.equal(MATERIAL_TILE_LONGITUDE_DEGREES,90);
const points=[[-80,-15],[0,0],[40,36],[175,-45]];
for(const [lon,lat] of points)matchMap(lon,lat);
for(const pose of [
 {center_lon:-55,center_lat:2,zoom:2,bearing:0},
 {center_lon:12,center_lat:-30,zoom:5,bearing:0},
 {center_lon:170,center_lat:33,zoom:4,bearing:37},
 {center_lon:-179,center_lat:10,zoom:6,bearing:-83}
]){
 Object.assign(doc.camera,pose);
 for(const [lon,lat] of points)matchMap(lon,lat);
}
const original=transform();
const p=worldPixel(28,-16);
const initial=use(original,...p);
doc.camera.center_lon+=13;
const moved=use(transform(),...p);
assert.notDeepEqual(moved,initial,'texture must move when camera pans');
doc.camera.zoom*=1.5;
assert.notDeepEqual(use(transform(),...p),moved,'texture must scale with zoom');
doc.camera.bearing=45;
const rotated=use(transform(),...p);
assert.notDeepEqual(rotated,moved,'texture must rotate with map');
// Four full texture repeats cover the entire 360° world. Crossing the
// antimeridian changes the matrix by an integral number of tile periods.
doc.camera={center_lon:-179,center_lat:0,zoom:3,bearing:30};
const atMinus=transform();doc.camera.center_lon=181;
const atPlus=transform();
const tileOrigin=use(atMinus,0,0),wrapTile=use(atPlus,4*img.naturalWidth,0);
close(tileOrigin[0],wrapTile[0]);close(tileOrigin[1],wrapTile[1]);
// Export tiles use the same full-frame matrix and apply tile offset to the
// canvas itself. One global pixel should have the same material sample
// whether painted in a full PNG or a cropped ZIP tile.
const inverse=(t,x,y)=>{
 const dx=x-t.e,dy=y-t.f,det=t.a*t.d-t.b*t.c;
 return [(t.d*dx-t.c*dy)/det,(-t.b*dx+t.a*dy)/det];
};
const t=transform(),screen=[876,523],tile=[800,500];
const full=inverse(t,...screen);
const cropped=inverse(t,screen[0]-tile[0]+tile[0],screen[1]-tile[1]+tile[1]);
close(full[0],cropped[0]);close(full[1],cropped[1]);
const renderer=readFileSync(new URL('../assets/scene-renderer.js',import.meta.url),'utf8');
assert.match(renderer,/materialPatternTransform\(\{w,h,k,/);
assert.match(renderer,/pattern\.setTransform\(transform\)/);
assert.match(renderer,/const materialPatternCache=new WeakMap\(\)/);
for(const key of ['surface_material','ocean_material','land_material','cartographic_finish'])assert.match(renderer,new RegExp('paintMaterial\\(ctx,images,doc,\x27'+key+'\x27'));
assert.match(renderer,/const masks=materialMasks\(doc,countries,images,w,h\)/,'land and ocean masks must remain geographic');
assert.match(renderer,/ctx\.translate\(-tile\.x,-tile\.y\)/,'export tile offset must be preserved');
console.log('WGS84 MATERIAL PASS: pan, zoom, bearing, world wrap, export tile coordinates and cached patterns');
