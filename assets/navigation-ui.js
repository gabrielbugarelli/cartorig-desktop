/* CartoRig 2.0.2 — single owner of panel state and compact drawers. */
export function setupNavigation(){
 const file=document.getElementById('fileMenu'),exports=document.getElementById('exportMenu');
 const menus=[file,exports].filter(Boolean),body=document.body;
 function closeMenus(except=null){for(const menu of menus)if(menu!==except)menu.open=false;}
 for(const menu of menus){
  menu.addEventListener('toggle',()=>{if(menu.open)closeMenus(menu);});
  menu.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false;});
 }
 document.addEventListener('pointerdown',e=>{if(!menus.some(menu=>menu.contains(e.target)))closeMenus();});
 const left=document.getElementById('toggleScene'),right=document.getElementById('toggleInspector');
 const compact=()=>matchMedia('(max-width:980px)').matches;
 // Start with the map unobstructed in narrow windows. Users may reopen either drawer.
 if(compact())body.classList.add('ux-right-collapsed');
 if(matchMedia('(max-width:760px)').matches)body.classList.add('ux-left-collapsed');
 function sync(){
  const leftOpen=!body.classList.contains('ux-left-collapsed'),rightOpen=!body.classList.contains('ux-right-collapsed');
  left?.setAttribute('aria-pressed',String(leftOpen));right?.setAttribute('aria-pressed',String(rightOpen));
  left?.setAttribute('aria-expanded',String(leftOpen));right?.setAttribute('aria-expanded',String(rightOpen));
  document.getElementById('rightSidebar')?.setAttribute('aria-hidden',String(!rightOpen));
  document.querySelector('.sidebar.left')?.setAttribute('aria-hidden',String(!leftOpen));
  body.classList.toggle('ux-right-open',rightOpen);
  body.classList.toggle('ux-left-open',leftOpen);
 }
 function setLeft(open){body.classList.toggle('ux-left-collapsed',!open);if(open&&compact())body.classList.add('ux-right-collapsed');sync();window.dispatchEvent(new Event('resize'));}
 function setRight(open){body.classList.toggle('ux-right-collapsed',!open);if(open&&compact())body.classList.add('ux-left-collapsed');sync();window.dispatchEvent(new Event('resize'));}
 left?.addEventListener('click',()=>setLeft(body.classList.contains('ux-left-collapsed')));
 right?.addEventListener('click',()=>setRight(body.classList.contains('ux-right-collapsed')));
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||document.querySelector('dialog[open]'))return;
  const opened=menus.find(menu=>menu.open);
  if(opened){e.preventDefault();e.stopImmediatePropagation();closeMenus();opened.querySelector('summary')?.focus();return;}
  if(compact()&&!body.classList.contains('ux-right-collapsed')){e.preventDefault();e.stopImmediatePropagation();setRight(false);right?.focus();return;}
  if(compact()&&!body.classList.contains('ux-left-collapsed')){e.preventDefault();e.stopImmediatePropagation();setLeft(false);left?.focus();}
 },true);
 document.addEventListener('pointerdown',e=>{
  if(!compact())return;
  if(!body.classList.contains('ux-right-collapsed')&&!e.target.closest('#rightSidebar,#toggleInspector'))setRight(false);
  else if(!body.classList.contains('ux-left-collapsed')&&!e.target.closest('.sidebar.left,#toggleScene'))setLeft(false);
 });
 sync();
 // File owns imports and reusable style files. Dialogs are native modal
 // top-layer surfaces, so their focus does not leak into the map canvas.
 for(const [triggerId,dialogId,closeId] of [
   ['fileImportGeoJSON','geoImportDialog','geoImportClose'],
   ['fileMapStyles','mapStylesDialog','mapStylesClose']
 ]){
  const trigger=document.getElementById(triggerId),dialog=document.getElementById(dialogId),closer=document.getElementById(closeId);
  if(!trigger||!dialog)continue;
  trigger.addEventListener('click',()=>{closeMenus();dialog.showModal();});
  closer?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>file?.querySelector('summary')?.focus());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 }
 const api={setLeft,setRight,compact};window.CartoRigNavigation=api;return api;
}
