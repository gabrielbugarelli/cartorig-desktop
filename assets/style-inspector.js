/* CartoRig 1.4 — granular, reversible appearance controls for all visual objects. */
import {resolveStyle,inheritedValue,BLEND_MODES} from './style-resolver.js';
const fullHex=value=>/^#[0-9a-f]{3}$/i.test(value)?'#'+[...value.slice(1)].map(c=>c+c).join(''):String(value||'#000000').slice(0,7);
function choice(g,name,values,selected,act,disabled){let l=document.createElement('label');l.className='field-label';l.textContent=name;let s=document.createElement('select');s.className='control compact';s.disabled=disabled;for(const v of values){let opt=document.createElement('option');opt.value=v;opt.textContent=v;s.append(opt);}s.value=selected;s.onchange=()=>act(s.value);l.append(s);g.append(l);}
export function renderAdvancedInspector(root,obj,doc,{exec,field,check,group,locked,toast}){
 const id=obj.id,style=resolveStyle(doc,obj);
 const set=(key,value)=>exec({type:'SetObjectStyle',id,values:{[key]:value}});
 const grp=(title)=>group(root,title),control=(g,label,key,kind='number',min=0,max=100,step=1)=>{
  let owned=obj.style&&obj.style[key]!==null&&obj.style[key]!==undefined;
  const value=kind==='number'?style[key]:fullHex(style[key]);
  const input=field(g,label+(owned?' · overridden':' · inherited'),value,v=>set(key,v),{type:kind,min:kind==='number'?min:undefined,max:kind==='number'?max:undefined,step:kind==='number'?step:undefined,disabled:locked});
  if(kind==='number'){const slider=document.createElement('input');slider.type='range';slider.className='style14-range';slider.min=min;slider.max=max;slider.step=step;slider.value=value;slider.disabled=locked;slider.setAttribute('aria-label',label+' slider');slider.oninput=()=>{input.value=slider.value;};slider.onchange=()=>set(key,Number(slider.value));g.append(slider);}
  else {const hex=document.createElement('input');hex.className='control compact style14-hex';hex.value=value;hex.maxLength=9;hex.disabled=locked;hex.setAttribute('aria-label',label+' hexadecimal');hex.onchange=()=>{if(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex.value)){set(key,hex.value);input.value=fullHex(hex.value);}else{toast('Invalid hexadecimal color',true);hex.value=fullHex(style[key]);}};g.append(hex);}
  if(owned){const b=document.createElement('button');b.textContent='Revert '+label+' to inherited';b.className='style14-reset';b.disabled=locked;b.onclick=()=>exec({type:'ResetStyleProperty',id,key});g.append(b);}
 };
 const appearance=grp('ADVANCED APPEARANCE');
 if(['Region','Marker','Shape'].includes(obj.type)){control(appearance,'Fill color','fill_color','color');if(obj.type==='Region')control(appearance,'Fill opacity','fill_opacity','number',0,1,.05);}
 if(['Region','Route','Marker','Shape'].includes(obj.type)){
  control(appearance,'Stroke color','stroke_color','color');control(appearance,'Stroke width (logical px)','stroke_width','number',0,40,.5);
  if(['Region','Route','Shape'].includes(obj.type)){control(appearance,'Stroke opacity','stroke_opacity','number',0,1,.05);choice(appearance,'Stroke style',['Solid','Dashed','Dotted'],style.stroke_style||'Solid',v=>set('stroke_style',v),locked);}
 }
 if(['Label','Shape'].includes(obj.type))control(appearance,'Text color','text_color','color');
 const fx=grp('SHADOW');check(fx,'Enable shadow',style.shadow_enabled,v=>set('shadow_enabled',v),locked);control(fx,'Color','shadow_color','color');control(fx,'Opacity','shadow_opacity','number',0,1,.05);control(fx,'Blur (logical px)','shadow_blur','number',0,100,1);control(fx,'Distance (logical px)','shadow_distance','number',0,200,1);control(fx,'Angle (degrees)','shadow_angle','number',0,360,1);
 const gl=grp('GLOW');check(gl,'Enable glow',style.glow_enabled,v=>set('glow_enabled',v),locked);control(gl,'Color','glow_color','color');control(gl,'Intensity','glow_intensity','number',0,2,.1);control(gl,'Radius (logical px)','glow_radius','number',0,100,1);control(gl,'Mix','glow_mix','number',0,1,.05);
 const comp=grp('BLEND MODE');choice(comp,'Blend mode',BLEND_MODES,style.blend_mode||'normal',v=>set('blend_mode',v),locked);
 const reset=document.createElement('button');reset.textContent='Reset Object Style';reset.disabled=locked;reset.onclick=()=>{if(confirm('Reset ONLY appearance overrides for '+obj.name+'?'))exec({type:'ResetObjectStyle',id});};comp.append(reset);
 if(obj.type==='Group'){
  const ch=grp('GROUP INHERITED DEFAULTS');
  const c=document.createElement('input');c.className='control compact';c.type='color';c.value=(obj.style?.child_defaults?.fill_color||'#db7657').slice(0,7);
  const l=document.createElement('label');l.className='field-label';l.textContent='Default child fill color';l.append(c);ch.append(l);
  c.disabled=locked;c.onchange=()=>exec({type:'SetGroupChildStyle',id,key:'fill_color',value:c.value});
  if(obj.style?.child_defaults?.fill_color){let b=document.createElement('button');b.textContent='Revert group child fill';b.onclick=()=>exec({type:'SetGroupChildStyle',id,key:'fill_color',value:null});ch.append(b);}
 }
}
