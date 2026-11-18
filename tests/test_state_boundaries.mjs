import assert from 'node:assert/strict';
import {createStateBoundaryPreview,stateBoundaryTolerance,simplifyStateRing,visibleStateCopies} from '../assets/state-boundaries.js';

const ring=Array.from({length:400},(_,i)=>{
 const theta=i*Math.PI*2/400;
 return [12+5*Math.cos(theta),-7+3*Math.sin(theta)];
});
ring.push([...ring[0]]);
const original=JSON.stringify(ring);
const simplified=simplifyStateRing(ring,.05);
assert.ok(simplified.length<ring.length/2,'preview must remove subpixel source vertices');
assert.ok(simplified.length>=3);
assert.equal(JSON.stringify(ring),original,'source geography must remain untouched');
assert.equal(stateBoundaryTolerance(20),.01);
assert.equal(stateBoundaryTolerance(2),.1);
assert.equal(stateBoundaryTolerance(1000),.0003);
const fakePath=()=>({commands:[],moveTo(x,y){this.commands.push(['M',x,y]);},lineTo(x,y){this.commands.push(['L',x,y]);},closePath(){this.commands.push(['Z']);}});
let created=0,clock=0;
const renderer=createStateBoundaryPreview({createPath:()=>{created++;return fakePath();},now:()=>++clock});
const geometries=[
 {type:'Polygon',coordinates:[ring]},
 {type:'Polygon',coordinates:[[[178,-5],[-179,-5],[-179,5],[178,5],[178,-5]]]},
 {type:'Polygon',coordinates:[[[60,-5],[62,-5],[62,5],[60,5],[60,-5]]]}
];
const states=geometries.map(geometry=>({geometry}));
const box={minX:178,maxX:181,minY:-5,maxY:5};
const opts={w:1200,h:800,k:10,lon:-179,lat:0,bearing:0};
assert.deepEqual(visibleStateCopies(box,opts),[-360],'dateline must render the wrapped copy');
assert.deepEqual(visibleStateCopies(box,{...opts,lon:179}),[0]);
assert.deepEqual(visibleStateCopies(box,{...opts,lon:0,k:15}),[],'offscreen copies must be culled');
assert.deepEqual(visibleStateCopies(box,{...opts,lon:-179,bearing:40}),[-360]);
const ctx={
 lineWidth:1.5,strokes:[],transform:[],
 save(){this.transform.push('save');},restore(){this.transform.push('restore');},
 translate(x,y){this.transform.push(['translate',x,y]);},
 rotate(t){this.transform.push(['rotate',t]);},scale(x,y){this.transform.push(['scale',x,y]);},
 stroke(path){this.strokes.push({path,lineWidth:this.lineWidth});}
};
const document={camera:{center_lon:-179,center_lat:0,zoom:2,bearing:0}};
assert.equal(renderer.draw(ctx,document,states,1200,800,10),true);
assert.equal(created,3);
let metrics=renderer.getStats();
assert.equal(metrics.misses,3);
assert.ok(metrics.lastCulled>0);
assert.ok(metrics.lastCopies>0);
assert.ok(metrics.drawnPoints<metrics.originalPoints);
const firstStrokes=ctx.strokes.length;
assert.equal(renderer.draw(ctx,document,states,1200,800,10),true);
metrics=renderer.getStats();
assert.equal(metrics.hits,3,'camera-stable redraw must reuse all geographic paths');
assert.equal(metrics.misses,3);
assert.equal(created,3,'no rebuilding Path2D for repeated preview');
assert.equal(ctx.strokes.length,firstStrokes*2);
document.camera.center_lon=179;document.camera.bearing=35;
renderer.draw(ctx,document,states,1200,800,10);
assert.equal(created,3,'camera rotation and pan must not rebuild paths');
assert.equal(renderer.getStats().hits,6);
renderer.draw(ctx,document,states,1200,800,1000);
assert.equal(created,6,'high zoom should receive a finer geographic path');
assert.equal(renderer.getStats().misses,6);
renderer.draw(ctx,document,states,1200,800,10);
assert.equal(created,6,'two levels of detail remain cached');
assert.equal(JSON.stringify(ring),original,'the export geometry is never modified');
assert.ok(ctx.strokes.every(x=>x.lineWidth>0));
console.log('STATE BOUNDARIES PREVIEW PASS: cached paths / progressive detail / dateline / culling / export source');
