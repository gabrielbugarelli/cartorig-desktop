import assert from 'node:assert/strict';
import {createFilteredTextureCache,PREVIEW_TEXTURE_MAX_PIXELS,visibleRasterShifts} from '../assets/texture-cache.js';
const surfaces=[];
const createCanvas=()=>{const canvas={width:0,height:0,calls:[],getContext(){
 return {filter:'none',imageSmoothingQuality:'low',drawImage(image,x,y,w,h){
  canvas.calls.push({source:image,width:w,height:h,filter:this.filter});
 }};}};surfaces.push(canvas);return canvas;};
let clock=0;
const cache=createFilteredTextureCache({createCanvas,maxPixels:4000000,budgetPixels:8000000,now:()=>++clock});
const relief={complete:true,naturalWidth:10800,naturalHeight:5400};
const grade='grayscale(1) contrast(1.45)';
const first=cache.get(relief,grade);
assert.ok(first.width*first.height<=PREVIEW_TEXTURE_MAX_PIXELS+10000);
assert.equal(first.calls[0].filter,grade);
assert.equal(first.calls[0].source,relief);
assert.equal(cache.get(relief,grade),first,'cache hit must not recolor large source');
assert.equal(first.calls.length,1,'repeated preview drawings reuse filtered source');
assert.equal(cache.getStats().hits,1);
const second=cache.get(relief,'grayscale(1) contrast(2)');
assert.notEqual(second,first,'a new look must produce new graded source');
const ocean={complete:true,naturalWidth:5400,naturalHeight:2700};
const third=cache.get(ocean,'contrast(1) saturate(1)');
assert.ok(third.width*third.height<=4000000+10000);
assert.ok(cache.getStats().evictions>=1,'LRU must cap retained pixels');
assert.ok(cache.getStats().livePixels<=8000000);
assert.equal(cache.get({complete:false,naturalWidth:100,naturalHeight:100}),null);
assert.deepEqual(visibleRasterShifts({width:1758,height:1114,k:1758/360,center_lon:0,center_lat:0,bearing:0}),[0]);
assert.deepEqual(visibleRasterShifts({width:1758,height:1114,k:1758/360,center_lon:100,center_lat:0,bearing:0}),[0,1]);
const rotated=visibleRasterShifts({width:1758,height:1114,k:1758/360,center_lon:0,center_lat:0,bearing:42});
assert.ok(rotated.includes(0));
const minZoom=visibleRasterShifts({width:1758,height:1114,k:1758/360*.35,center_lon:0,center_lat:0,bearing:0});
assert.ok(minZoom.length>=1&&minZoom.length<=3);
// Regression: 10000 x 8000 rounds to 4,000,204 pixels with Math.round.
// Three such filtered layers would thrash a 12 MP cache on every frame.
const threeLayers=createFilteredTextureCache({createCanvas,maxPixels:4000000,budgetPixels:12000000,now:()=>++clock});
const layers=Array.from({length:3},()=>({complete:true,naturalWidth:10000,naturalHeight:8000}));
for(const [index,layer] of layers.entries()){
 const bitmap=threeLayers.get(layer,'contrast('+(index+1)+')');
 assert.ok(bitmap.width*bitmap.height<=4000000,'prepared texture must obey the exact pixel cap');
}
assert.equal(threeLayers.getStats().entries,3,'three atlas layers must fit together');
assert.equal(threeLayers.getStats().evictions,0,'preview layers must not evict each other');
for(const [index,layer] of layers.entries())assert.ok(threeLayers.get(layer,'contrast('+(index+1)+')'));
assert.equal(threeLayers.getStats().hits,3,'redraw must reuse all three filtered layers');
assert.equal(threeLayers.getStats().evictions,0,'redraw must not force cache churn');
const tightBudget=createFilteredTextureCache({createCanvas,maxPixels:4000000,budgetPixels:1000000,now:()=>++clock});
const tightBitmap=tightBudget.get(relief,grade);
assert.ok(tightBitmap.width*tightBitmap.height<=1000000,'single texture must respect a smaller total budget');
assert.ok(tightBudget.getStats().livePixels<=1000000);

cache.clear();assert.equal(cache.getStats().livePixels,0);assert.equal(cache.getStats().entries,0);
console.log('TEXTURE CACHE PASS: graded JPEG reused / bounded GPU memory / wrapped-image culling');
