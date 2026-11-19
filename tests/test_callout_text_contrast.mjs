/* Regression for a user report using the built-in Atlas theme:
 * the Inspector showed a white Callout swatch while the renderer inherited
 * brown map typography on a navy box. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SceneStore,newDocument,madeObject,COLORS} from '../assets/scene-core.js';
import {resolveStyle} from '../assets/style-resolver.js';
import {drawCreative} from '../assets/creative-renderer.js';
import {project} from '../assets/scene-renderer.js';

const store=new SceneStore(newDocument());
store.execute({type:'ApplyTheme',id:'atlas'});
const box=madeObject('Shape','Callout',{
 shape_kind:'Callout',coordinate_space:'geo',
 points:[{lon:-48.7,lat:-13.2},{lon:-44.76,lat:-7.31}],
 text:'Callout',callout_box:null,
 style:{stroke_color:'#eab766',stroke_width:3,stroke_style:'Solid',
        fill_color:'#eab76644',arrowheads:'End'}
});
assert.ok(store.execute({type:'CreateObject',object:box}));
assert.notEqual(COLORS.atlas.text,'#ffffff','Atlas typography should remain dark');
let resolved=resolveStyle(store.doc,store.doc.objects[box.id]);
assert.equal(resolved.text_color,'#ffffff','Callout defaults to white text, not map label color');
assert.equal(resolved.background_color,undefined,'background should use dark box fallback');
let calls=[];
const ctx={
 save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
 setLineDash(){},fillRect(){},strokeRect(){},
 fillText(text,x,y){calls.push({text,color:this.fillStyle,x,y});},
 textBaseline:'',textAlign:'',font:'',fillStyle:'',strokeStyle:'',globalAlpha:1
};
function render(){
 calls=[];const o=store.doc.objects[box.id],style=resolveStyle(store.doc,o);
 drawCreative(ctx,store.doc,{...o,style},1000,600,project);
 return calls;
}
assert.equal(render()[0].color,'#ffffff');
assert.equal(render()[0].text,'Callout');
assert.ok(store.execute({type:'SetProperty',id:box.id,path:'text',value:'Brasil'}));
assert.equal(render()[0].text,'Brasil');
assert.equal(render()[0].color,'#ffffff','renaming the Callout must not change text contrast');
assert.ok(store.execute({type:'SetProperty',id:box.id,path:'style.text_color',value:'#ff0000'}));
assert.equal(render()[0].color,'#ff0000','explicit red color must keep working');
assert.ok(store.undo());assert.equal(render()[0].color,'#ffffff');
const saved=JSON.parse(JSON.stringify(store.doc));
const loaded=new SceneStore(saved);
assert.equal(resolveStyle(loaded.doc,loaded.doc.objects[box.id]).text_color,'#ffffff');
const inspector=readFileSync(new URL('../assets/creative-inspector.js',import.meta.url),'utf8');
assert.match(inspector,/resolveStyle\(doc,obj\)\.text_color/,'Inspector color swatch must use the same resolved style as the canvas');
const luminance=hex=>{
 const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255)
  .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
};
const ratio=(luminance('#ffffff')+.05)/(luminance('#12273d')+.05);
assert.ok(ratio>=7,'default white label on navy must meet enhanced contrast');
console.log('CALLOUT TEXT PASS: Atlas default contrast, Inspector/render synchronization, rename, explicit override, Undo and saved project');
