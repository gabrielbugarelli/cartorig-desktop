/* UI/UX Stage 2.4: real Looks controller with a minimal DOM and SceneStore. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setupStyleStudio} from '../assets/style-studio.js';
import {QUICK_LOOK_FIELDS,QUICK_LOOK_KEYS,quickLookValue,quickLookPercent,
 lookFieldStatus,countLookCustomizations,validateQuickValue} from '../assets/looks-quick.js';
import {newDocument,SceneStore,texturesEnabled} from '../assets/scene-core.js';
import {themeValue} from '../assets/style-resolver.js';
import {REFERENCE_LOOKS} from '../assets/reference-looks.js';
import {LOOK_MATERIAL_RECIPES,LAND_MATERIAL_IDS,OCEAN_MATERIAL_IDS} from '../assets/look-materials.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const studio=source('assets/style-studio.js'),css=source('assets/ux-layout.css');
assert.deepEqual(QUICK_LOOK_KEYS,[
 'land_material_strength','ocean_material_strength','relief_strength',
 'land_color','ocean_color'
]);
assert.equal(new Set(QUICK_LOOK_KEYS).size,QUICK_LOOK_KEYS.length);
assert.match(css,/\.ux-looks-quick/);
assert.match(studio,/controlsArea\.append\(quickArea,advancedArea\)/);
assert.match(studio,/advancedArea\.append\(el\('summary','','Advanced customization'\),advancedBody\)/);
assert.match(studio,/if\(QUICK_LOOK_KEYS\.includes\(key\)\)continue;/,'No duplicate quick and advanced controls');
assert.match(studio,/quickArea\.append\(mapControls\)/);
assert.match(studio,/quickArea\.append\(buildMapLabels\(doc,palette\)\)/);
assert.match(studio,/SetThemeProperty/);
assert.match(studio,/SetSurfaceTextureVisibility/);
assert.match(studio,/LAND · CONTINENTS ONLY/);
assert.match(studio,/OCEAN · WATER ONLY/);
assert.deepEqual(new Set(REFERENCE_LOOKS.map(x=>x.id)).size,27);
assert.equal(Object.keys(LOOK_MATERIAL_RECIPES).length,36);
assert.equal(QUICK_LOOK_FIELDS.length,5);
for(const [key,recipe] of Object.entries(LOOK_MATERIAL_RECIPES)){
 assert.ok(LAND_MATERIAL_IDS.includes(recipe.land_material),key);
 assert.ok(OCEAN_MATERIAL_IDS.includes(recipe.ocean_material),key);
}
assert.equal(validateQuickValue('land_material_strength',.35),true);
assert.equal(validateQuickValue('land_material_strength',-1),false);
assert.equal(validateQuickValue('ocean_material_strength',Infinity),false);
assert.equal(validateQuickValue('land_color','#aa7788'),true);
assert.equal(validateQuickValue('land_color','red'),false);
assert.equal(validateQuickValue('unknown',.3),false);

class FakeEl{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.className='';this.children=[];
  this.dataset={};this.style={};this.attrs={};this.listeners={};this.hidden=false;
  this.value='';this.textContent='';this.scrollTop=0;this.open=false;
  this.classList={
   toggle:(name,on)=>{this.classes??=new Set();if(on)this.classes.add(name);else this.classes.delete(name);},
   contains:name=>this.classes?.has(name)??false
  };
 }
 append(...items){this.children.push(...items);return this;}
 replaceChildren(...items){this.children=[...items];}
 insertBefore(item,reference){const i=this.children.indexOf(reference);if(i<0)throw Error('insertBefore missing reference');this.children.splice(i,0,item);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){
  const all=[];const visit=node=>{for(const child of node.children||[]){if(child instanceof FakeEl){all.push(child);visit(child);}}};visit(this);
  if(selector==='[data-style]')return all.filter(x=>x.dataset.style!==undefined);
  if(selector==='.style14-preset-custom')return all.filter(x=>x.className.includes('style14-preset-custom'));
  if(selector==='#uxMapTextureSlot')return all.filter(x=>x.id==='uxMapTextureSlot');
  if(selector.startsWith('[data-style="'))return all.filter(x=>x.dataset.style===selector.slice(13,-2));
  throw Error('Unexpected selector: '+selector);
 }
 focus(){}
 click(){this.onclick?.();}
}
const elements={};
for(const id of ['styleStudio14','uxMapBoundaries','mapStylesList','rightSidebar','style14File']){
 const v=new FakeEl();v.id=id;elements[id]=v;
}
const slot=new FakeEl();slot.id='uxMapTextureSlot';
elements.uxMapBoundaries.append(slot);
globalThis.document={
 activeElement:null,
 getElementById:id=>elements[id]||null,
 createElement:tag=>new FakeEl(tag),
 createTextNode:value=>{const el=new FakeEl('#text');el.textContent=String(value);return el;}
};
globalThis.confirm=()=>true;
globalThis.prompt=()=>'';
globalThis.window={};
const store=new SceneStore(newDocument()),commands=[];
const baselineCount=countLookCustomizations(store.doc);
assert.ok(baselineCount>=0);
const controller=setupStyleStudio({
 getDoc:()=>store.doc,getSelection:()=>store.selection,
 exec:cmd=>{commands.push(cmd);return store.execute(cmd);},
 toast:()=>{},downloadable:()=>{},getToken:()=>''});
const all=(node,fn)=>{const output=[];const visit=n=>{if(fn(n))output.push(n);for(const child of n?.children||[])if(child instanceof FakeEl)visit(child);};visit(node);return output;};
const one=(node,fn)=>all(node,fn)[0];
const root=elements.styleStudio14,views=root.children;
const choose=one(root,x=>x.id==='style14ModeChoose');
const personalize=one(root,x=>x.id==='style14ModeCustomize');
assert.ok(choose&&personalize);
const cards=all(root,x=>x.dataset.style!==undefined);
assert.equal(cards.length,36,'All original preview cards must remain');
assert.equal(cards.filter(x=>x.children.some(z=>z.className==='style14-preset-meta')).length,36,'Every look has grounded family metadata');
controller.sync();
personalize.click();assert.equal(personalize.attrs['aria-pressed'],'true');
const quick=one(root,x=>x.id==='style14QuickAdjustments');
const advanced=one(root,x=>x.id==='style14AdvancedCustomization');
assert.ok(quick&&advanced);
assert.equal(advanced.open,false,'Advanced is collapsed by default');
assert.equal(one(quick,x=>x.id==='uxMapTextureSlot'),slot);
assert.equal(all(quick,x=>x.id==='landTexturesEnabled').length,1);
assert.equal(all(quick,x=>x.id==='oceanTexturesEnabled').length,1);
assert.ok(one(quick,x=>x.id==='mapLabels'));
for(const f of QUICK_LOOK_FIELDS){
 assert.equal(all(quick,x=>x.dataset.quickField===f.key).length,1,f.key+' quick row');
 assert.equal(all(advanced,x=>x.dataset.themeField===f.key).length,0,f.key+' should not duplicate');
}
assert.ok(all(advanced,x=>x.dataset.themeField==='ocean_material').length,'Ocean material remains advanced');
assert.ok(all(advanced,x=>x.dataset.themeField==='land_material').length,'Land material remains advanced');
assert.ok(all(advanced,x=>x.dataset.themeField==='texture_source').length,'Geographic raster stays advanced');
const landRow=one(quick,x=>x.dataset.quickField==='land_material_strength');
assert.equal(landRow.dataset.state,'inherited');
const land=one(landRow,x=>x.id==='quick-land_material_strength');
assert.ok(land&&land.type==='range');
land.value='.65';land.onchange();
assert.equal(themeValue(store.doc,'land_material_strength'),.65);
assert.equal(store.doc.theme.overrides.land_material_strength,.65);
controller.sync();
const after=one(root,x=>x.id==='style14QuickAdjustments');
assert.equal(one(after,x=>x.dataset.quickField==='land_material_strength').dataset.state,'customized');
assert.equal(countLookCustomizations(store.doc),baselineCount+1,'Quick edit adds one override to initial border overrides');
assert.equal(cards.filter(x=>x.classList.contains('customized')).length,1);
assert.equal(cards.find(x=>x.classList.contains('customized'))?.dataset.style,store.doc.theme.id);
const revert=one(after,x=>x.dataset.revertTheme==='land_material_strength');
assert.ok(revert,'Quick customization must provide per-field revert');
revert.click();
assert.equal(store.doc.theme.overrides.land_material_strength,undefined);
assert.equal(countLookCustomizations(store.doc),baselineCount,'Restoring one field must keep existing border overrides');
assert.ok(store.undo(),'Undo should restore custom intensity');
assert.equal(themeValue(store.doc,'land_material_strength'),.65);
assert.ok(store.redo(),'Redo should restore inherited intensity');
assert.equal(lookFieldStatus(store.doc,'land_material_strength'),'inherited');

controller.sync();
let q=one(root,x=>x.id==='style14QuickAdjustments');
let ocean=one(q,x=>x.id==='oceanTexturesEnabled');
ocean.checked=false;ocean.onchange();
assert.equal(texturesEnabled(store.doc,'ocean'),false);
assert.equal(texturesEnabled(store.doc,'land'),true);
controller.sync();
q=one(root,x=>x.id==='style14QuickAdjustments');
assert.equal(one(q,x=>x.dataset.quickField==='ocean_material_strength').dataset.state,'disabled');
assert.equal(one(q,x=>x.id==='quick-ocean_material_strength').disabled,true);
assert.equal(one(q,x=>x.id==='quick-land_material_strength').disabled,false);
const landColor=one(q,x=>x.id==='quick-land_color');
landColor.value='#f4a01a';landColor.onchange();
assert.equal(store.doc.theme.overrides.land_color,'#f4a01a');
controller.sync();
q=one(root,x=>x.id==='style14QuickAdjustments');
assert.equal(one(q,x=>x.dataset.quickField==='land_color').dataset.state,'customized');
assert.equal(quickLookValue(store.doc,'land_color'),'#f4a01a');
assert.equal(quickLookPercent(store.doc,'land_color'),null);
const saved=JSON.parse(JSON.stringify(store.doc));
assert.equal(saved.render_options.ocean_textures_enabled,false);
assert.equal(saved.theme.overrides.land_color,'#f4a01a');
choose.click();
const atlas=cards.find(x=>x.dataset.style==='atlas');
atlas.click();
assert.equal(store.doc.theme.id,'atlas');
assert.equal(texturesEnabled(store.doc,'ocean'),false,'Look change cannot toggle ocean back on');
assert.equal(texturesEnabled(store.doc,'land'),true);
controller.sync();
assert.equal(cards.filter(x=>x.attrs['aria-pressed']==='true').length,1);
assert.equal(one(root,x=>x.id==='style14QuickAdjustments').id,'style14QuickAdjustments');
assert.ok(commands.some(x=>x.type==='SetSurfaceTextureVisibility'&&x.surface==='ocean'));
assert.ok(commands.some(x=>x.type==='SetThemeProperty'&&x.value===null));
console.log('STAGE 2.4 LOOKS PASS: 36 previews, Quick/Advanced DOM, inherited/customized/disabled, per-field reset, independent ocean, Undo/Redo and project save');
