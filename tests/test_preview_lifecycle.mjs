import assert from 'node:assert/strict';
import {createPreviewScheduler} from '../assets/preview-scheduler.js';
import {SceneStore,newDocument,madeObject} from '../assets/scene-core.js';

let sequence=0,queue=new Map(),draws=0,clock=0,size={width:1180,height:730},hiddenDraws=0;
const requestFrame=fn=>{const id=++sequence;queue.set(id,fn);return id;};
const cancelFrame=id=>{queue.delete(id);};
const next=()=>{const calls=[...queue.values()];queue.clear();clock+=16;for(const fn of calls)fn();};
const scheduler=createPreviewScheduler({
 draw:()=>{draws++;if(!scheduler.getStats().visible)hiddenDraws++;clock+=7;},
 measure:()=>size,requestFrame,cancelFrame,now:()=>clock
});
for(let i=0;i<50;i++)scheduler.invalidate();
assert.equal(queue.size,1,'50 invalidations must queue one frame');
next();assert.equal(draws,1);
assert.equal(scheduler.getStats().coalesced,49);
assert.equal(scheduler.getStats().lastRenderMs,7);
for(let i=0;i<6;i++)scheduler.onResize();
assert.equal(queue.size,0,'unchanged dimensions should not rerender');
size={width:1300,height:800};
for(let i=0;i<15;i++)scheduler.onResize();
assert.equal(queue.size,1);
next();assert.equal(draws,2);
scheduler.invalidate();
scheduler.setVisible(false);
assert.equal(queue.size,0,'hiding must cancel pending frame');
for(let i=0;i<30;i++)scheduler.invalidate();
for(let i=0;i<10;i++)scheduler.onResize();
assert.equal(queue.size,0,'hidden invalidations must never schedule');
assert.equal(hiddenDraws,0);
size={width:0,height:0};
scheduler.setVisible(true);
next();assert.equal(draws,2,'invalid dimensions must not render');
size={width:200,height:120};
scheduler.onResize();next();assert.equal(draws,2,'first restored size must settle');
size={width:1300,height:800};
scheduler.onResize();next();assert.equal(draws,2,'transient size cannot render');
next();assert.equal(draws,3,'stable restored size renders once');
assert.equal(queue.size,0);
scheduler.setVisible(true);assert.equal(queue.size,0,'repeated show signal must not render');
scheduler.invalidate();scheduler.invalidate();next();assert.equal(draws,4);
assert.equal(scheduler.getStats().pauses,1);
assert.equal(scheduler.getStats().resumes,1);
assert.equal(scheduler.getStats().lastSize.width,1300);

const store=new SceneStore(newDocument());
assert.equal(store.dirty,false);
const obj=madeObject('Region','France',{region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:'FRA'}});
assert.equal(store.execute({type:'CreateObject',object:obj}),true);
assert.equal(store.dirty,true);
store.markSaved();assert.equal(store.dirty,false);
store.setSelection([]);assert.equal(store.dirty,false);
assert.equal(store.execute({type:'SetProjectName',name:'Edited atlas'}),true);
assert.equal(store.dirty,true);
assert.equal(store.undo(),true);assert.equal(store.dirty,false);
assert.equal(store.redo(),true);assert.equal(store.dirty,true);
store.markSaved();assert.equal(store.dirty,false);
store.replace(newDocument());assert.equal(store.dirty,false);
console.log('PREVIEW LIFECYCLE PASS: coalescing / hide / restore / invalid size / cached dirty');
