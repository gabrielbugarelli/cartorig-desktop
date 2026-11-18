/* Creative Engine 1.3 acceptance; GeographicLib WGS84 independently generated reference. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inverseGeodesic,directGeodesic,curvedSamples,geodesicSamples,routeSamples,MARKER_SYMBOLS,validateCreative,normLon} from '../assets/creative-engine.js';
import {SceneStore,madeObject,newDocument} from '../assets/scene-core.js';
const data=JSON.parse(readFileSync(new URL('geodesic_reference.json',import.meta.url)));
let maxDistanceError=0,maxEndpointError=0;
for(let [i,{a,b,meters,azimuth}] of data.entries()){
 const result=inverseGeodesic(a,b);assert.ok(Number.isFinite(result.meters)&&Number.isFinite(result.azimuth),`Nonfinite inverse ${i}`);
 maxDistanceError=Math.max(maxDistanceError,Math.abs(result.meters-meters));assert.ok(Math.abs(result.meters-meters)<1,`Geodesic distance ${i}: ${result.meters-meters}m`);
 const to=directGeodesic(a,result.azimuth,result.meters);const error=Math.max(Math.abs(to.lat-b.lat),Math.abs(normLon(to.lon-b.lon)));
 maxEndpointError=Math.max(maxEndpointError,error);assert.ok(error<1e-6,`Endpoint ${i}: ${error}°`);
 const curve=geodesicSamples(a,b,10);assert.ok(curve.length>=17&&curve.length<=2049);
}
let a={lon:2,lat:10},b={lon:5,lat:20};let positive=curvedSamples(a,b,1),negative=curvedSamples(a,b,-1);
assert.equal(positive[0].lon,a.lon);assert.equal(positive.at(-1).lon,b.lon);
assert.notEqual(positive[32].lon,negative[32].lon);
assert.equal(MARKER_SYMBOLS.length,10);
const doc=newDocument();const state=new SceneStore(doc),marker=madeObject('Marker','Brasília',{symbol:'Circle',anchor:{lon:-47.9,lat:-15.8}});
assert.ok(state.execute({type:'CreateObject',object:marker}));
const route=madeObject('Route','Brazil to Argentina',{path_type:'Custom',from:{lon:-47.9,lat:-15.8,linked_object_id:marker.id},to:{lon:-58.38,lat:-34.6},waypoints:[{lon:-51,lat:-24},{lon:-54,lat:-28},{lon:-56,lat:-30},{lon:-57,lat:-33}]});
assert.ok(state.execute({type:'CreateObject',object:route}));
assert.equal(routeSamples(state.doc,route).length,6);
assert.ok(state.execute({type:'SetProperty',id:marker.id,path:'anchor',value:{lon:-46,lat:-15.8}}));
assert.equal(routeSamples(state.doc,route)[0].lon,-46);
assert.throws(()=>state.execute({type:'DeleteObject',id:marker.id}),/Freeze Links/);
assert.ok(state.execute({type:'DeleteObject',id:marker.id,freeze:true}));
assert.equal(state.doc.objects[route.id].from.lon,-46);assert.equal(state.doc.objects[route.id].from.linked_object_id,null);
assert.ok(state.undo());assert.equal(state.doc.objects[route.id].from.linked_object_id,marker.id);
assert.ok(state.redo());assert.equal(state.doc.objects[route.id].from.linked_object_id,null);
const poly=madeObject('Shape','Polygon',{shape_kind:'Polygon',coordinate_space:'screen',points:[{x:.2,y:.2},{x:.3,y:.2},{x:.35,y:.35},{x:.2,y:.4}],editorial:true});
assert.ok(state.execute({type:'CreateObject',object:poly}));
let previous=JSON.stringify(state.doc);
assert.throws(()=>state.execute({type:'SetProperty',id:poly.id,path:'points',value:[{x:0,y:0},{x:1,y:1},{x:0,y:1},{x:1,y:0}]}),/Self-intersecting|zero area/);
assert.equal(JSON.stringify(state.doc),previous,'Invalid shape must roll back');
assert.equal(validateCreative(poly),undefined);
console.log(`Creative WGS84/reference PASS · ${data.length} GeographicLib endpoints · max distance ${maxDistanceError.toFixed(5)}m · max endpoint ${maxEndpointError.toExponential(2)}° · Curved ±1, custom, links/Freeze/Undo and polygon safety`);
