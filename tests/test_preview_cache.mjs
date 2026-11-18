import assert from 'node:assert/strict';
import {createPreviewCache,previewBackingScale} from '../assets/preview-cache.js';
function context(){return {ops:[],save(){this.ops.push('save')},restore(){this.ops.push('restore')},setTransform(){this.ops.push('transform')},clearRect(){this.ops.push('clear')},drawImage(){this.ops.push('image')}};}
let created=0;const make=()=>{created++;return {width:0,height:0,getContext:()=>context()}};
const cache=createPreviewCache({createCanvas:make}),screen=context(),doc={revision:1};
let base=0,overlay=0,clock=0;
function paint({docRef=doc,w=1400,h=900,assetsVersion=0,solo=null}={}){
 cache.paint(screen,{doc:docRef,w,h,assetsVersion,solo,drawBase:()=>{base++;clock+=45},drawOverlay:()=>{overlay++;clock++},now:()=>clock});
}
paint();for(let i=0;i<70;i++)paint();
assert.equal(base,1,'selection-only updates cannot redraw atlas');
assert.equal(overlay,71,'selection handles remain live');
assert.equal(cache.getStats().baseHits,70);
assert.equal(cache.getStats().baseRenderMs,45);
doc.revision=2;paint();assert.equal(base,2);
paint({assetsVersion:1});assert.equal(base,3);
paint({assetsVersion:1,solo:'a'});assert.equal(base,4);
paint({assetsVersion:1,solo:'a',w:1300});assert.equal(base,5);
const next={revision:2};paint({docRef:next,assetsVersion:1,solo:'a',w:1300});assert.equal(base,6);
cache.invalidate();paint({docRef:next,assetsVersion:1,solo:'a',w:1300});assert.equal(base,7);
assert.equal(created,1,'single reusable atlas bitmap');
assert.ok(screen.ops.includes('image'));
assert.ok(previewBackingScale(1724,970,2)<1.05);
assert.equal(previewBackingScale(700,400,2),2);
assert.equal(previewBackingScale(0,0,2),1);
const density=previewBackingScale(1800,1200,1.25);
assert.ok(density*density*1800*1200<=1800001);
console.log('PREVIEW CACHE PASS: atlas reuse / live selection / invalidation / resolution cap');
