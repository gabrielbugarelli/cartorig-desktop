import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInspectorSections,INSPECTOR_SECTIONS} from '../assets/inspector-layout.js';
import {creativeInspector} from '../assets/creative-inspector.js';
import {renderAdvancedInspector} from '../assets/style-inspector.js';
import {newDocument,madeObject,SceneStore} from '../assets/scene-core.js';
import {resolveStyle} from '../assets/style-resolver.js';

class FakeEl{
 constructor(tag='div'){
  this.tagName=tag;this.children=[];this.attrs={};this.listeners={};
  this.hidden=false;this.value='';this.textContent='';this.tabIndex=-1;
  this.classList={toggle:(name,on)=>{this.classes??=new Set();if(on)this.classes.add(name);else this.classes.delete(name);},contains:name=>this.classes?.has(name)??false};
 }
 append(...children){this.children.push(...children);return this;}
 add(...children){return this.append(...children);}
 setAttribute(key,value){this.attrs[key]=String(value);}
 addEventListener(key,fn){(this.listeners[key]??=[]).push(fn);}
 dispatch(key,event={}){for(const fn of this.listeners[key]||[])fn(event);}
 replaceChildren(...children){this.children=[...children];}
 focus(){this.focused=true;}
 getContext(){const m={measureText:()=>({width:100}),canvas:this};return new Proxy(m,{get:(target,key)=>key in target?target[key]:(()=>{})});}
}
globalThis.document={createElement:tag=>new FakeEl(tag),createTextNode:value=>{const el=new FakeEl('#text');el.textContent=value;return el;}};
globalThis.Option=function(label,value){const o=new FakeEl('option');o.textContent=label;o.value=value;return o;};
globalThis.confirm=()=>true;
const collect=(node,fn,into=[])=>{if(fn(node))into.push(node);for(const child of node?.children||[])if(child instanceof FakeEl)collect(child,fn,into);return into;};
const words=(node)=>collect(node,n=>typeof n.textContent==='string'&&n.textContent.length>0).map(n=>n.textContent).join(' | ');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('assets/app.js'),css=read('assets/ux-layout.css'),studio=read('assets/style-inspector.js');
assert.deepEqual(INSPECTOR_SECTIONS.map(x=>x.id),['basic','position','appearance','advanced']);
assert.match(app,/createInspectorSections\(root,\{active:activeInspectorSection/);
assert.match(app,/selectionKey!==lastInspectorSelection/);
assert.match(app,/layout\.finish\(\)/);
assert.match(css,/\.ux-inspector-nav/);
assert.match(css,/\.ux-inspector-section\[hidden\]\{display:none!important\}/);
assert.doesNotMatch(studio,/control\(appearance,'Text color'/,'Advanced must not duplicate Label and Callout text colors');

const keyEvent=key=>({key,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){}});
let root=new FakeEl(),lastActive=null;
let layout=createInspectorSections(root,{active:'basic',onSelect:v=>{lastActive=v;}});
layout.group('basic','IDENTITY');layout.group('appearance','COLORS');
layout.group('position','COORDINATES');layout.group('advanced','EFFECTS');
assert.deepEqual(layout.finish(),['basic','position','appearance','advanced']);
assert.equal(layout.tabs.get('basic').attrs['aria-selected'],'true');
assert.equal(layout.panels.get('position').hidden,true);
layout.tabs.get('basic').dispatch('keydown',keyEvent('ArrowRight'));
assert.equal(layout.active,'position');assert.equal(lastActive,'position');assert.equal(layout.tabs.get('position').focused,true);
layout.tabs.get('position').dispatch('keydown',keyEvent('End'));
assert.equal(layout.active,'advanced');
layout.tabs.get('advanced').dispatch('keydown',keyEvent('ArrowRight'));
assert.equal(layout.active,'basic','keyboard navigation wraps');
layout.tabs.get('basic').dispatch('click');
assert.equal(layout.panels.get('basic').hidden,false);
layout.tabs.get('basic').dispatch('keydown',keyEvent('Home'));
assert.equal(layout.active,'basic');
root=new FakeEl();layout=createInspectorSections(root,{active:'position'});
layout.group('basic','IDENTITY');
assert.deepEqual(layout.finish(),['basic']);
assert.equal(root.children[0].hidden,true,'no redundant tab strip for single-section objects');
assert.equal(layout.panels.get('basic').hidden,false);

const doc=newDocument();
function exercise(obj){
 const calls=[],root=new FakeEl(),layout=createInspectorSections(root,{active:'basic'});
 const field=(where,label,value,onChange)=>{
  const item=new FakeEl('label');item.textContent=label;
  const input=new FakeEl('input');input.value=value;input.onchange=onChange;item.append(input);where.append(item);return input;
 };
 const check=(where,label,value,onChange)=>field(where,label,value,onChange);
 const group=(ignored,title,category='advanced')=>layout.group(category,title);
 doc.objects[obj.id]=obj;
 creativeInspector(root,obj,doc,{
  exec:cmd=>{calls.push(cmd);return true;},field,check,group,locked:false,toast:()=>{},
  editText:()=>calls.push({type:'EditText'}),importImage:()=>calls.push({type:'ImportImage'}),
  editPath:()=>calls.push({type:'EditHandles'}),editOffset:()=>calls.push({type:'EditOffset'}),
  findCities:()=>[],representative:()=>({lon:0,lat:0}),
  convertShape:()=>calls.push({type:'ConvertShape'}),
  setCalloutBoxMode:()=>calls.push({type:'CalloutMode'}),
  geoPoint:()=>({x:.5,y:.5})
 });
 renderAdvancedInspector(layout.panels.get('advanced'),obj,doc,{
  exec:cmd=>{calls.push(cmd);return true;},field,check,
  group:(where,title)=>{const g=new FakeEl('div');g.textContent=title;where.append(g);return g;},
  locked:false,toast:()=>{}
 });
 const sections=layout.finish(),texts=Object.fromEntries(sections.map(id=>[id,words(layout.panels.get(id))]));
 return {calls,layout,texts};
}
const callout=madeObject('Shape','Brasil',{
 shape_kind:'Callout',coordinate_space:'geo',points:[{lon:-52,lat:-12},{lon:-42,lat:-4}],
 text:'Brasil',style:{stroke_color:'#eab766',text_color:'#ffffff'}
});
let result=exercise(callout);
assert.deepEqual(Object.keys(result.texts),['basic','position','appearance','advanced']);
assert.match(result.texts.basic,/Shape kind.*Callout text/);
assert.doesNotMatch(result.texts.basic,/Stroke width|Text color|Edit handles/);
assert.match(result.texts.position,/Coordinate space|Text box follows|Linked marker|Edit handles/);
assert.match(result.texts.appearance,/Stroke color|Stroke width|Text color|Box background/);
assert.match(result.texts.advanced,/EDIT VERTICES|SHADOW|GLOW|BLEND MODE/);
assert.equal((result.texts.appearance.match(/Text color/g)||[]).length,1);
assert.ok(!result.texts.advanced.includes('Text color'),'Advanced must avoid duplicate color input');
let textField=collect(result.layout.panels.get('basic'),n=>n.textContent==='Callout text')[0];
assert.ok(textField?.children?.[0]);
textField.children[0].onchange('Brasil revisado');
assert.ok(result.calls.some(x=>x.type==='SetProperty'&&x.path==='text'&&x.value==='Brasil revisado'));
let box=collect(result.layout.panels.get('appearance'),n=>n.textContent==='Text color')[0];
assert.ok(box?.children?.[0]);
box.children[0].onchange('#ff0000');
assert.ok(result.calls.some(x=>x.type==='SetProperty'&&x.path==='style.text_color'&&x.value==='#ff0000'));

const label=madeObject('Label','Capital',{anchor:{lon:-47,lat:-15},text:'Brasília',typography:{font_family:'sans-serif',font_size:27,font_weight:700}});
result=exercise(label);
assert.match(result.texts.basic,/Text \(Unicode and multiple lines\)|Edit inline on canvas/);
assert.match(result.texts.position,/Position mode|Geo anchor|Linked Marker/);
assert.match(result.texts.appearance,/Font family|Font weight|Size \(logical px\)|Text color/);
const route=madeObject('Route','São Paulo — Brasília',{from:{lon:-46,lat:-23},to:{lon:-47,lat:-15},path_type:'Straight'});
result=exercise(route);
assert.match(result.texts.basic,/Path type/);
assert.match(result.texts.position,/GEOGRAPHIC ENDPOINTS|Edit route handles on canvas/);
assert.match(result.texts.appearance,/LINE & ARROWS|Stroke width|Arrowheads/);
assert.match(result.texts.advanced,/WAYPOINTS & ROUTE TOOLS|SHADOW/);
const marker=madeObject('Marker','Pin',{anchor:{lon:-47,lat:-15},symbol:'Circle'});
result=exercise(marker);
assert.match(result.texts.basic,/MARKER SYMBOL/);
assert.match(result.texts.position,/GEO ANCHOR & OFFSET|Offset X|Offset Y/);
assert.match(result.texts.appearance,/SYMBOL APPEARANCE|Symbol size/);
assert.match(result.texts.advanced,/ICON ASSETS|Import SVG\/PNG icon/);

// Existing scene commands and Undo/Redo remain unchanged by the UI reshuffle.
const store=new SceneStore(newDocument());
assert.ok(store.execute({type:'CreateObject',object:callout}));
assert.ok(store.execute({type:'SetProperty',id:callout.id,path:'text',value:'Brasil revisado'}));
assert.equal(store.doc.objects[callout.id].text,'Brasil revisado');
assert.ok(store.undo());
assert.equal(store.doc.objects[callout.id].text,'Brasil');
assert.ok(store.redo());
assert.equal(store.doc.objects[callout.id].text,'Brasil revisado');
assert.equal(resolveStyle(store.doc,store.doc.objects[callout.id]).text_color,'#ffffff');
console.log('STAGE 2.2 INSPECTOR PASS: accessible contextual tabs, Callout/Label/Route/Marker grouping, edits and Undo/Redo');
