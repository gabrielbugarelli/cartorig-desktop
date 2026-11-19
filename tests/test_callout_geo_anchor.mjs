/* Geographic Callout regression: the second click defines a map location,
 * while older screen-pinned annotations still load and remain editable. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SceneStore,newDocument,madeObject} from '../assets/scene-core.js';
import {drawCreative,creativeHandles,hitCreative} from '../assets/creative-renderer.js';
import {project} from '../assets/scene-renderer.js';

const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
assert.match(app,/if\(d\.shape_kind==='Callout'\)fields\.text='Callout'/);
assert.doesNotMatch(app,/fields\.callout_box\s*=/,'newly clicked Callouts must not invent a fixed box');
assert.match(app,/setCalloutBoxMode:/,'legacy boxes must have a conversion action');
const store=new SceneStore(newDocument());
const anchor={lon:-52,lat:-12},box={lon:-32,lat:-10};
const plain=madeObject('Shape','Map-linked callout',{
 shape_kind:'Callout',coordinate_space:'geo',points:[anchor,box],text:'Brazil overview',
 style:{stroke_color:'#eab766',stroke_width:3}
});
assert.equal(plain.callout_box,undefined,'new Callout must not have a screen-pinned box');
assert.ok(store.execute({type:'CreateObject',object:plain}));
const W=1280,H=720;
let doc=store.doc;
const initial=creativeHandles(doc,plain,W,H,project);
assert.deepEqual(initial[0].xy,project(doc,anchor.lon,anchor.lat,W,H));
assert.deepEqual(initial[1].xy,project(doc,box.lon,box.lat,W,H));
const ctx={
 calls:[],setLineDash(){},
 save(){},restore(){},beginPath(){},stroke(){},
 moveTo(x,y){this.calls.push(['moveTo',x,y]);},
 lineTo(x,y){this.calls.push(['lineTo',x,y]);},
 fillRect(x,y,w,h){this.calls.push(['fillRect',x,y,w,h]);},
 strokeRect(){},fillText(){},font:'',textBaseline:'',globalAlpha:1
};
drawCreative(ctx,doc,plain,W,H,project);
const beforeLine=ctx.calls.find(x=>x[0]==='lineTo');
const beforeRect=ctx.calls.find(x=>x[0]==='fillRect');
assert.deepEqual(beforeLine.slice(1),initial[1].xy);
assert.deepEqual(beforeRect.slice(1,3),initial[1].xy.map((n,i)=>i===1?n-22*H/1080:n));
const nextPose={center_lon:-28,center_lat:4,zoom:4,bearing:27};
assert.ok(store.execute({type:'SetCameraPose',pose:nextPose}));
doc=store.doc;
let updated=creativeHandles(doc,plain,W,H,project);
assert.deepEqual(updated[0].xy,project(doc,anchor.lon,anchor.lat,W,H));
assert.deepEqual(updated[1].xy,project(doc,box.lon,box.lat,W,H));
assert.notDeepEqual(updated[1].xy,initial[1].xy,'box must move with map pan/zoom/rotation');
ctx.calls.length=0;drawCreative(ctx,doc,plain,W,H,project);
assert.deepEqual(ctx.calls.find(x=>x[0]==='lineTo').slice(1),updated[1].xy);
assert.ok(hitCreative(doc,plain,updated[1].xy[0]+40,updated[1].xy[1],W,H,project),'box must be selectable');
assert.ok(store.undo());assert.deepEqual(creativeHandles(store.doc,plain,W,H,project)[1].xy,initial[1].xy);
assert.ok(store.redo());assert.deepEqual(creativeHandles(store.doc,plain,W,H,project)[1].xy,updated[1].xy);

const legacy=madeObject('Shape','Legacy pinned callout',{
 shape_kind:'Callout',coordinate_space:'geo',points:[anchor,box],callout_box:{x:.7,y:.35},text:'Legacy note',style:{stroke_width:2}
});
assert.ok(store.execute({type:'CreateObject',object:legacy}));
const pinned=creativeHandles(store.doc,legacy,W,H,project)[1].xy;
assert.deepEqual(pinned,[W*.7,H*.35]);
assert.ok(store.execute({type:'SetCameraPose',pose:{center_lon:60,bearing:71,zoom:3}}));
assert.deepEqual(creativeHandles(store.doc,legacy,W,H,project)[1].xy,pinned,'legacy pinned box remains compatible');
assert.ok(hitCreative(store.doc,legacy,pinned[0]+20,pinned[1],W,H,project),'pinned box must be hit-testable');
// Converting an existing pinned Callout to Follow map must be undoable.
const converted={lon:8,lat:3};
assert.ok(store.execute({type:'SetProperties',id:legacy.id,values:{callout_box:null,points:[anchor,converted]}}));
assert.equal(store.doc.objects[legacy.id].callout_box,null);
let handles=creativeHandles(store.doc,store.doc.objects[legacy.id],W,H,project);
assert.deepEqual(handles[1].xy,project(store.doc,converted.lon,converted.lat,W,H));
assert.ok(store.undo());
assert.deepEqual(store.doc.objects[legacy.id].callout_box,{x:.7,y:.35});
assert.deepEqual(creativeHandles(store.doc,store.doc.objects[legacy.id],W,H,project)[1].xy,pinned);
assert.ok(store.redo());
const exported=JSON.parse(JSON.stringify(store.doc));
assert.equal(exported.objects[plain.id].callout_box,undefined);
assert.equal(exported.objects[legacy.id].callout_box,null);
const loaded=new SceneStore(exported);
assert.ok(loaded.doc.objects[plain.id].points.length===2);
assert.ok(loaded.doc.objects[legacy.id].points.length===2);
assert.throws(()=>store.execute({type:'SetProperties',id:legacy.id,values:{callout_box:{x:1.2,y:.2}}}),/Invalid pinned Callout/);
console.log('CALLOUT GEO PASS: two anchors follow map; legacy screen pin; hit testing; Undo/Redo; project serialization');
