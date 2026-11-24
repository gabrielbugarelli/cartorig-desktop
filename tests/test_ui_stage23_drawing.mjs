/* UI/UX 2.3: real pure drawing helpers + app command path and scene history. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 DRAWING_TOOLS,POINTER_HIT_RADIUS,creativeGuide,isContinuousDraft,
 minimumDraftPoints,normalizedDraftPoints,canCommitCreativeDraft,
 handleHit,handleRole,drawHandle,drawDraftGuides,drawPlacementPreview
} from '../assets/creative-interaction.js';
import {SceneStore,newDocument,madeObject} from '../assets/scene-core.js';
import {creativeHandles} from '../assets/creative-renderer.js';
import {project} from '../assets/scene-renderer.js';

const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=src('assets/app.js'),html=src('assets/index.html'),renderer=src('assets/scene-renderer.js'),css=src('assets/ux-layout.css');
assert.deepEqual(DRAWING_TOOLS,['region','route','label','marker','shape']);
assert.equal(POINTER_HIT_RADIUS,18);
assert.match(html,/id="modeTag"[^>]+role="status" aria-live="polite"/);
assert.match(css,/\.ux-creative-guide/);
assert.match(app,/drawPlacementPreview\(ctx,doc,tool,creativeCursor/,'Marker and Label ghost on the map');
assert.match(app,/drawDraftGuides\(ctx,doc,creativeDraft/,'In-progress geometry indicators');
assert.match(app,/if\(e\.key==='Backspace'&&creativeDraft\)/,'Draft backspace must not delete selected scene objects');
assert.match(app,/if\(e\.key==='Enter'&&creativeDraft\)/,'Enter commits supported multipoint drafts');
assert.match(app,/if\(creativeDraft&&isContinuousDraft\(creativeDraft\)\)/,'Double click on multipoint drawings finishes instead of editing underlying objects');
assert.match(app,/canvas\.addEventListener\('pointerleave'/,'Cursor preview must disappear when leaving canvas');
assert.match(app,/handleHit\(creativeHandles\(/,'Larger hit target for edit controls');
assert.match(renderer,/handleRole\(o,handle.index,handles.length\)/,'Semantic selected anchors');
assert.match(app,/setTool\('select'\);editHandles=true;editOffset=false;\s*updateCreativeGuidance/,'Editing mode guidance');
assert.match(app,/if\(creativeDraft\|\|editHandles\|\|DRAWING_TOOLS\.includes\(tool\)\)e\.preventDefault\(\)/,'Escape cancels current drawing');
for(const kind of ['Callout','Polygon','Rectangle','Ellipse','Distance','Freehand']){
 assert.ok(creativeGuide({tool:'shape',shapeType:kind}).message.length>10);
}
assert.match(creativeGuide({tool:'shape',shapeType:'Callout'}).message,/geographic anchor/);
assert.match(creativeGuide({tool:'shape',draft:{type:'Shape',shape_kind:'Callout',points:[{lon:1,lat:2}]}}).message,/text box/);
assert.match(creativeGuide({tool:'route',draft:{type:'Route',path_type:'Custom',points:[{lon:1,lat:2}]}}).message,/Enter or double-click/);
assert.match(creativeGuide({tool:'shape',draft:{type:'Shape',shape_kind:'Polygon',points:[{lon:1,lat:2}]}}).help,/Backspace/);
assert.match(creativeGuide({tool:'marker'}).message,/preview follows/);
assert.match(creativeGuide({tool:'label'}).message,/Ctrl\+Enter/);
assert.match(creativeGuide({tool:'select',editMode:true,editOffset:true}).message,/offset handle/);
assert.equal(creativeGuide({tool:'select'}),null);
assert.equal(isContinuousDraft({type:'Route',path_type:'Custom'}),true);
assert.equal(isContinuousDraft({type:'Route',path_type:'Straight'}),false);
assert.equal(isContinuousDraft({type:'Shape',shape_kind:'Polygon'}),true);
assert.equal(isContinuousDraft({type:'Shape',shape_kind:'Callout'}),false);
assert.equal(minimumDraftPoints({type:'Shape',shape_kind:'Polygon'}),3);
assert.equal(minimumDraftPoints({type:'Shape',shape_kind:'Callout'}),2);
const a={lon:-52,lat:-12},b={lon:-42,lat:-4},c={lon:-36,lat:-9};
assert.equal(canCommitCreativeDraft({type:'Route',path_type:'Custom',points:[a]}),false);
assert.equal(canCommitCreativeDraft({type:'Route',path_type:'Custom',points:[a,a]}),false);
assert.equal(canCommitCreativeDraft({type:'Shape',shape_kind:'Polygon',points:[a,b]}),false);
assert.equal(canCommitCreativeDraft({type:'Shape',shape_kind:'Polygon',points:[a,b,c]}),true);
assert.equal(normalizedDraftPoints({points:[a,a,b,b,c]}).length,3);
assert.equal(handleRole({type:'Route'},0,3),'anchor');
assert.equal(handleRole({type:'Route'},1,3),'waypoint');
assert.equal(handleRole({type:'Route'},2,3),'anchor');
assert.equal(handleRole({type:'Shape',shape_kind:'Callout'},1,2),'box');
assert.equal(handleRole({type:'Shape',shape_kind:'Callout'},0,2),'anchor');
assert.equal(handleRole({type:'Shape',shape_kind:'Polygon'},1,3),'vertex');
assert.equal(handleRole({type:'Marker',offset_x:3},0,1),'offset');
assert.equal(handleRole({type:'Label'},0,1),'anchor');
assert.equal(handleHit([{index:0,xy:[100,100]}],117,100)?.index,0);
assert.equal(handleHit([{index:0,xy:[100,100]}],120,100),null);
assert.equal(handleHit([{index:1,xy:[100,100]},{index:2,xy:[106,100]}],105,100)?.index,2);

// Canvas-only ghost rendering must not mutate the project or history.
const calls=[];
const ctx=new Proxy({
 calls,globalAlpha:1,
 measureText:t=>({width:String(t).length*10}),
 setLineDash:v=>calls.push(['dash',v]),
 save:()=>calls.push(['save']),restore:()=>calls.push(['restore']),
 beginPath:()=>calls.push(['begin']),
 arc:(...v)=>calls.push(['arc',...v]),
 rect:(...v)=>calls.push(['rect',...v]),
 fillText:(...v)=>calls.push(['text',...v]),
 fill:()=>calls.push(['fill']),stroke:()=>calls.push(['stroke'])
},{get(t,k){if(k in t)return t[k];if(typeof k==='symbol')return undefined;return (...args)=>calls.push([String(k),...args]);}});
const store=new SceneStore(newDocument()),doc=store.doc;
const initial=JSON.stringify(doc);
drawPlacementPreview(ctx,doc,'marker',{x:400,y:300},800,500,project,()=>({lon:-50,lat:-10}),{symbol:'Pin'});
assert.ok(calls.some(x=>x[0]==='arc'),'Marker ghost draws anchor ring');
calls.length=0;
drawPlacementPreview(ctx,doc,'label',{x:420,y:320},800,500,project,()=>({lon:-50,lat:-10}));
assert.ok(calls.some(x=>x[0]==='text'&&x[1]==='Text'),'Label ghost draws label caption');
calls.length=0;
drawDraftGuides(ctx,doc,{type:'Shape',shape_kind:'Callout',coordinate_space:'geo',points:[a]},
 {x:510,y:290},800,500,project,()=>b);
assert.ok(calls.some(x=>x[0]==='stroke'),'Callout anchor and pending box are guided visually');
assert.equal(JSON.stringify(doc),initial,'drawing previews must not touch serialized project');
assert.equal(store.undoStack.length,0,'drawing previews cannot create history');

const begin=app.indexOf('function commitCreativeDraft(){');
const end=app.indexOf('\nfunction creativePreviewObject(',begin);
assert.ok(begin>0&&end>begin,'Real app commit implementation must be extractable');
const added=[],messages=[];
let scene=store;
const make=new Function('insertNode','setTool','showToast','updateCreativeGuidance',
 'minimumDraftPoints','normalizedDraftPoints','canCommitCreativeDraft',
 'let creativeDraft=null;'+app.slice(begin,end)+
 '\nreturn {setDraft:d=>{creativeDraft=d;},getDraft:()=>creativeDraft,commit:commitCreativeDraft};');
const fixture=make((type,fields)=>{
 const o=madeObject(type,fields.name||type,fields);
 assert.ok(scene.execute({type:'CreateObject',object:o}));
 added.push(o.id);
 return o.id;
},name=>{if(name==='select')fixture.setDraft(null)},(msg,err)=>messages.push({msg,err}),()=>{},
 minimumDraftPoints,normalizedDraftPoints,canCommitCreativeDraft);
fixture.setDraft({type:'Shape',shape_kind:'Callout',coordinate_space:'geo',points:[a,b]});
assert.equal(fixture.commit(),true,'Two-click Callout commits once');
assert.equal(store.undoStack.length,1,'One Undo for entire new Callout');
assert.equal(store.doc.objects[added.at(-1)].callout_box,undefined,'New Callout must follow map');
assert.ok(store.undo());
assert.ok(!store.doc.objects[added.at(-1)],'Undo deletes the entire Callout');
assert.ok(store.redo());
assert.ok(store.doc.objects[added.at(-1)],'Redo restores the Callout');
fixture.setDraft({type:'Shape',shape_kind:'Polygon',coordinate_space:'geo',points:[a,b]});
assert.equal(fixture.commit(),false,'Polygon needs at least three points');
assert.equal(added.length,1,'Invalid draft must not create objects');
fixture.setDraft({type:'Shape',shape_kind:'Polygon',coordinate_space:'geo',points:[a,b,c,c]});
assert.equal(fixture.commit(),true);
assert.equal(store.doc.objects[added.at(-1)].points.length,3,'Consecutive duplicate vertices removed');
fixture.setDraft({type:'Route',path_type:'Custom',points:[a,b,c]});
assert.equal(fixture.commit(),true);
const route=store.doc.objects[added.at(-1)];
assert.equal(route.waypoints.length,1);
assert.deepEqual(route.from,a);assert.deepEqual(route.to,c);
assert.equal(store.undoStack.length,3,'Each finalized drawing creates exactly one history entry');
assert.equal(messages.filter(x=>x.err).length,1,'Invalid drafts produce a clear error');
const realHandles=creativeHandles(store.doc,route,800,500,project);
assert.equal(realHandles.length,3);
assert.equal(handleRole(route,realHandles[1].index,realHandles.length),'waypoint');
console.log('UI STAGE 2.3 PASS: guidance, keyboard contract, marker/label ghosts, distinct handles, draft validation, Callout/Polygon/Route single-step undo');
