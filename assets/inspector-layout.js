/* CartoRig UI/UX Stage 2.2 — contextual inspector navigation.
 * UI-only: no project/schema mutations. Selection changes reset to Basic,
 * editing a property preserves its active tab through renderInspector().
 */
export const INSPECTOR_SECTIONS=Object.freeze([
 {id:'basic',title:'Basic'},
 {id:'position',title:'Position'},
 {id:'appearance',title:'Appearance'},
 {id:'advanced',title:'Advanced'}
]);

export function createInspectorSections(root,{active='basic',onSelect=()=>{}}={}){
 const nav=document.createElement('div');nav.className='ux-inspector-nav';
 nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Object properties');
 const tabs=new Map(),panels=new Map();
 for(const {id,title} of INSPECTOR_SECTIONS){
  const tab=document.createElement('button');tab.type='button';tab.className='ux-inspector-tab';
  tab.id='inspectorTab'+title;tab.textContent=title;
  tab.setAttribute('role','tab');tab.setAttribute('aria-controls','inspectorSection'+title);
  tab.setAttribute('aria-selected','false');tab.tabIndex=-1;nav.append(tab);tabs.set(id,tab);
 }
 root.append(nav);
 for(const {id,title} of INSPECTOR_SECTIONS){
  const panel=document.createElement('section');panel.className='ux-inspector-section';
  panel.id='inspectorSection'+title;panel.setAttribute('role','tabpanel');
  panel.setAttribute('aria-labelledby','inspectorTab'+title);
  panel.tabIndex=0;panel.hidden=true;root.append(panel);panels.set(id,panel);
 }
 const visible=()=>INSPECTOR_SECTIONS.filter(x=>!tabs.get(x.id).hidden).map(x=>x.id);
 let current='basic';
 function activate(section,{focus=false,notify=true}={}){
  const ids=visible(),id=ids.includes(section)?section:ids[0];
  if(!id)return;
  current=id;
  for(const {id:key} of INSPECTOR_SECTIONS){
   const tab=tabs.get(key),selected=key===id;
   tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
   tab.classList.toggle('active',selected);
   panels.get(key).hidden=!selected;
  }
  if(notify)onSelect(id);
  if(focus)tabs.get(id).focus();
 }
 for(const {id} of INSPECTOR_SECTIONS){
  const tab=tabs.get(id);
  tab.addEventListener('click',()=>activate(id));
  tab.addEventListener('keydown',event=>{
   const ids=visible(),index=ids.indexOf(id);
   let next=event.key==='Home'?0:event.key==='End'?ids.length-1:
    event.key==='ArrowRight'?(index+1)%ids.length:
    event.key==='ArrowLeft'?(index-1+ids.length)%ids.length:-1;
   if(next<0)return;
   event.preventDefault();event.stopPropagation();
   activate(ids[next],{focus:true});
  });
 }
 function group(section,title){
  const parent=panels.get(section)||panels.get('advanced');
  const el=document.createElement('div');el.className='inspector-group';
  const heading=document.createElement('h3');heading.textContent=title;
  el.append(heading);parent.append(el);return el;
 }
 function finish(){
  for(const {id} of INSPECTOR_SECTIONS){
   const hasControls=panels.get(id).children.length>0;
   tabs.get(id).hidden=!hasControls;
  }
  activate(active,{notify:false});
  // A one-tab inspector doesn't need a tab bar.
  nav.hidden=visible().length<2;
  return visible();
 }
 return {group,finish,activate,panels,tabs,get active(){return current;}};
}
