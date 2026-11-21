import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORKSPACE_LAYOUT_KEY,WORKSPACE_LIMITS,workspaceDefaultWidths,
 fitWorkspaceWidths,setupWorkspaceLayout} from '../assets/workspace-layout.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('assets/index.html'),css=read('assets/ux-layout.css');
const nav=read('assets/navigation-ui.js'),app=read('assets/app.js');
for(const id of ['uxResizeLeft','uxResizeRight','resetWorkspaceLayout']){
 assert.equal([...html.matchAll(/id="([^"]+)"/g)].filter(x=>x[1]===id).length,1,id+' appears once');
}
assert.match(html,/role="separator" tabindex="0" aria-orientation="vertical"/);
assert.match(html,/aria-controls="leftSidebar" aria-valuemin="205"/);
assert.match(html,/aria-controls="rightSidebar" aria-valuemin="245"/);
assert.match(css,/@media\(min-width:981px\)/);
assert.match(css,/grid-template-columns:var\(--ux-resize-left\) minmax\(0,1fr\) var\(--ux-resize-right\)/);
assert.match(css,/@media\(max-width:980px\)/);
assert.match(css,/\.ux-left-collapsed \.ux-pane-resizer\[data-side="left"\]/);
assert.match(nav,/setupWorkspaceLayout\(\{body,compact\}\)/);
assert.match(app,/new ResizeObserver\(\(\)=>previewScheduler\.onResize\(\)\)\.observe\(wrap\)/,
 'Canvas preview continues to own its own resize scheduling');
assert.deepEqual(workspaceDefaultWidths(1920),{left:255,right:315});
assert.deepEqual(workspaceDefaultWidths(1366),{left:225,right:300});
assert.deepEqual(workspaceDefaultWidths(1100),{left:222,right:285});
for(const width of [981,1024,1100,1366,1920,2560]){
 for(const preferred of [{left:900,right:900},{left:-40,right:0},{left:320,right:500},{left:Infinity,right:NaN}]){
  const fitted=fitWorkspaceWidths(preferred,width);
  assert.ok(fitted.left>=WORKSPACE_LIMITS.leftMin&&fitted.left<=WORKSPACE_LIMITS.leftMax);
  assert.ok(fitted.right>=WORKSPACE_LIMITS.rightMin&&fitted.right<=WORKSPACE_LIMITS.rightMax);
  assert.ok(width-fitted.left-fitted.right>=WORKSPACE_LIMITS.centerMin,
   `Map width must stay >= ${WORKSPACE_LIMITS.centerMin} at ${width}px`);
 }
}

function environment(width=1366,stored=null){
 let currentWidth=width;
 const values=new Map(stored?[[WORKSPACE_LAYOUT_KEY,JSON.stringify(stored)]]:[]);
 const style=new Map(),events=new Map(),classes=new Set();
 const body={classList:{
  contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),
  toggle:(x,p)=>{if(p)classes.add(x);else classes.delete(x);}
 }};
 const mock=id=>{
  let held=new Set(),listeners=new Map(),attrs={};
  return {
   id,tabIndex:0,attributes:attrs,handlers:listeners,
   addEventListener:(type,handler)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(handler);},
   emit(type,event={}){for(const listener of listeners.get(type)||[])listener(event);},
   setAttribute:(name,value)=>{attrs[name]=value;},
   setPointerCapture:id=>held.add(id),releasePointerCapture:id=>held.delete(id),
   hasPointerCapture:id=>held.has(id),focus(){this.focused=true;}
  };
 };
 const left=mock('uxResizeLeft'),right=mock('uxResizeRight'),reset=mock('resetWorkspaceLayout');
 const workspace={getBoundingClientRect:()=>({left:0,right:currentWidth,width:currentWidth})};
 globalThis.localStorage={
  getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),
  removeItem:key=>values.delete(key)
 };
 globalThis.document={
  body,documentElement:{style:{setProperty:(name,val)=>style.set(name,val)}},
  querySelector:selector=>selector==='.workspace'?workspace:null,
  getElementById:id=>({uxResizeLeft:left,uxResizeRight:right,resetWorkspaceLayout:reset})[id]
 };
 globalThis.window={
  innerWidth:width,addEventListener:(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},
  dispatchEvent:e=>{for(const fn of events.get(e.type)||[])fn(e);},
  CartoRigNavigation:{
   setLeft(open){body.classList.toggle('ux-left-collapsed',!open);window.dispatchEvent({type:'resize'});},
   setRight(open){body.classList.toggle('ux-right-collapsed',!open);window.dispatchEvent({type:'resize'});}
  }
 };
 globalThis.matchMedia=()=>({matches:currentWidth<=980});
 const api=setupWorkspaceLayout({body,compact:()=>currentWidth<=980});
 return {left,right,reset,body,api,style,values,
  resize(w){currentWidth=w;window.innerWidth=w;window.dispatchEvent({type:'resize'});}
 };
}
const event=(extra={})=>({
 button:0,pointerId:5,clientX:0,
 preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){},
 ...extra
});
let env=environment();
assert.deepEqual(env.api.widths,{left:225,right:300});
assert.equal(env.left.attributes['aria-valuenow'],'225');
assert.equal(env.right.attributes['aria-valuenow'],'300');
assert.equal(env.left.attributes['aria-disabled'],'false');
env.left.emit('pointerdown',event({clientX:225}));
env.left.emit('pointermove',event({clientX:365}));
assert.equal(env.api.widths.left,365);
assert.equal(env.values.has(WORKSPACE_LAYOUT_KEY),false,'Save drag preference only on pointer up');
assert.ok(env.body.classList.contains('ux-workspace-resizing'));
env.left.emit('pointerup',event({clientX:365}));
assert.ok(!env.body.classList.contains('ux-workspace-resizing'));
assert.equal(JSON.parse(env.values.get(WORKSPACE_LAYOUT_KEY)).left,365);
const cameraIndependent=env.api.widths.right;
assert.equal(cameraIndependent,300);
env.right.emit('pointerdown',event({clientX:1366-300}));
env.right.emit('pointermove',event({clientX:1366-470}));
env.right.emit('pointerup',event({clientX:1366-470}));
assert.equal(env.api.widths.right,470);
assert.equal(env.api.widths.left,365);
let oldWidth=env.api.widths.right;
env.right.emit('keydown',event({key:'ArrowRight'})); // Right grip moves right: right panel shrinks.
assert.equal(env.api.widths.right,oldWidth-16);
env.right.emit('keydown',event({key:'ArrowLeft',shiftKey:true}));
assert.equal(env.api.widths.right,oldWidth+16);
env.left.emit('keydown',event({key:'Home'}));
assert.equal(env.api.widths.left,205);
env.left.emit('keydown',event({key:'End'}));
assert.equal(env.api.widths.left,450);
env.left.emit('dblclick',event({}));
assert.equal(env.api.widths.left,225,'Double-click resets only that panel');
const saved=JSON.parse(env.values.get(WORKSPACE_LAYOUT_KEY));
env=environment(1366,saved);
assert.equal(env.api.widths.right,486,'Saved right pane width survives restart');
assert.equal(env.api.widths.left,225);
// Width shrinking should not corrupt the persisted desktop preference.
env.resize(981);
assert.ok(981-env.api.widths.left-env.api.widths.right>=420);
assert.equal(JSON.parse(env.values.get(WORKSPACE_LAYOUT_KEY)).right,486);
env.resize(1920);
assert.equal(env.api.widths.right,486);
env.resize(780);
assert.equal(env.left.tabIndex,-1);
assert.equal(env.right.tabIndex,-1);
env.left.emit('pointerdown',event({clientX:350}));
env.left.emit('pointermove',event({clientX:410}));
assert.equal(env.api.widths.left,225,'compact drawer should never be draggable');
env.resize(1366);
env.body.classList.add('ux-left-collapsed');
env.api.refresh();
assert.equal(env.left.tabIndex,-1);
env.body.classList.remove('ux-left-collapsed');
env.api.refresh();
assert.equal(env.left.tabIndex,0);
// Escape cancels active drag and avoids overwriting saved geometry.
env.left.emit('pointerdown',event({clientX:225}));
env.left.emit('pointermove',event({clientX:380}));
env.left.emit('keydown',event({key:'Escape'}));
assert.equal(env.api.widths.left,225);
assert.equal(JSON.parse(env.values.get(WORKSPACE_LAYOUT_KEY)).left,225);
env.body.classList.add('ux-left-collapsed');
env.body.classList.add('ux-right-collapsed');
env.reset.emit('click');
assert.deepEqual(env.api.widths,workspaceDefaultWidths(1366));
assert.equal(env.values.has(WORKSPACE_LAYOUT_KEY),false,'Reset should remove saved preference');
assert.equal(env.body.classList.contains('ux-left-collapsed'),false,'Reset reopens desktop left');
assert.equal(env.body.classList.contains('ux-right-collapsed'),false,'Reset reopens desktop right');
console.log('UI STAGE 2.1 PASS: responsive limits, pointer/keyboard, local persistence, compact drawers, cancel and reset');
