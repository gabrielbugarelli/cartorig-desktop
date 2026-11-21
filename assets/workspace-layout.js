/* CartoRig UI/UX Stage 2.1 — workspace-only pane sizing.
 * Pane widths are device preferences, never .cartorig document properties.
 * Canvas resize is already handled by the preview ResizeObserver.
 */
export const WORKSPACE_LAYOUT_KEY='cartorig.workspace.layout.v1';
export const WORKSPACE_LIMITS=Object.freeze({
 leftMin:205,leftMax:450,rightMin:245,rightMax:520,centerMin:420
});
export function workspaceDefaultWidths(width){
 return width<1221?{left:222,right:285}:
  width<1400?{left:225,right:300}:{left:255,right:315};
}
const within=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
export function fitWorkspaceWidths(requested,width){
 const maxWidth=Number.isFinite(width)&&width>0?width:1280;
 const d=workspaceDefaultWidths(maxWidth);
 let left=within(Number.isFinite(requested?.left)?requested.left:d.left,WORKSPACE_LIMITS.leftMin,WORKSPACE_LIMITS.leftMax);
 let right=within(Number.isFinite(requested?.right)?requested.right:d.right,WORKSPACE_LIMITS.rightMin,WORKSPACE_LIMITS.rightMax);
 const room=Math.max(WORKSPACE_LIMITS.leftMin+WORKSPACE_LIMITS.rightMin,Math.floor(maxWidth-WORKSPACE_LIMITS.centerMin));
 if(left+right>room){
  // Keep at least 420px for the canvas without changing the saved widths.
  // Distribute constrained space in proportion to the pane's extra width.
  const leftExtra=left-WORKSPACE_LIMITS.leftMin,rightExtra=right-WORKSPACE_LIMITS.rightMin;
  const spare=room-WORKSPACE_LIMITS.leftMin-WORKSPACE_LIMITS.rightMin;
  const share=leftExtra+rightExtra;
  left=WORKSPACE_LIMITS.leftMin+(share?Math.floor(spare*leftExtra/share):0);
  right=room-left;
 }
 return {left:Math.round(left),right:Math.round(right)};
}

export function setupWorkspaceLayout({body=document.body,compact=()=>matchMedia('(max-width:980px)').matches}={}){
 const workspace=document.querySelector('.workspace'),root=document.documentElement;
 const handles={
  left:document.getElementById('uxResizeLeft'),
  right:document.getElementById('uxResizeRight')
 };
 const reset=document.getElementById('resetWorkspaceLayout');
 if(!workspace||!handles.left||!handles.right)return null;
 const workspaceWidth=()=>workspace.getBoundingClientRect().width||window.innerWidth;
 function load(){
  try{
   const v=JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_KEY)||'null');
   if(v?.version===1&&Number.isFinite(v.left)&&Number.isFinite(v.right))
    return {left:v.left,right:v.right};
  }catch{/* Browser storage may be blocked. Keep a functional session. */}
  return workspaceDefaultWidths(workspaceWidth());
 }
 let desired=load(),active=null;
 function sizes(){return fitWorkspaceWidths(desired,workspaceWidth());}
 function paint(){
  const {left,right}=sizes();
  root.style.setProperty('--ux-resize-left',left+'px');
  root.style.setProperty('--ux-resize-right',right+'px');
  for(const side of ['left','right']){
   const handle=handles[side],other=side==='left'?'right':'left';
   const max=Math.min(WORKSPACE_LIMITS[side+'Max'],
    Math.max(WORKSPACE_LIMITS[side+'Min'],Math.floor(workspaceWidth()-WORKSPACE_LIMITS.centerMin-(side==='left'?right:left))));
   const disabled=compact()||body.classList.contains('ux-'+side+'-collapsed');
   handle.tabIndex=disabled?-1:0;
   handle.setAttribute('aria-valuemin',String(WORKSPACE_LIMITS[side+'Min']));
   handle.setAttribute('aria-valuemax',String(max));
   handle.setAttribute('aria-valuenow',String(side==='left'?left:right));
   handle.setAttribute('aria-valuetext',(side==='left'?left:right)+' pixels');
   handle.setAttribute('aria-disabled',String(disabled));
  }
  return {left,right};
 }
 function persist(){
  try{localStorage.setItem(WORKSPACE_LAYOUT_KEY,JSON.stringify({version:1,...desired}));}
  catch{/* Layout still works when localStorage is disabled. */}
 }
 function setWidth(side,pixels,save=true){
  if(!['left','right'].includes(side)||!Number.isFinite(pixels))return sizes();
  const current=sizes(),other=side==='left'?'right':'left';
  const max=Math.min(WORKSPACE_LIMITS[side+'Max'],
   workspaceWidth()-WORKSPACE_LIMITS.centerMin-current[other]);
  const value=Math.round(within(pixels,WORKSPACE_LIMITS[side+'Min'],Math.max(WORKSPACE_LIMITS[side+'Min'],max)));
  // When resizing one pane, retain the other pane's real rendered width.
  desired={...current,[side]:value};
  const result=paint();if(save)persist();return result;
 }
 function cancel(){
  if(!active)return;
  const {handle,previous,pointerId}=active;active=null;
  desired=previous;
  body.classList.remove('ux-workspace-resizing');
  if(handle.hasPointerCapture?.(pointerId))handle.releasePointerCapture(pointerId);
  paint();
 }
 function finish(event){
  if(!active||event.pointerId!==active.pointerId)return;
  const handle=active.handle,pointerId=active.pointerId;
  active=null;body.classList.remove('ux-workspace-resizing');
  if(handle.hasPointerCapture?.(pointerId))handle.releasePointerCapture(pointerId);
  persist();
 }
 function pointerValue(side,event){
  const rect=workspace.getBoundingClientRect();
  return side==='left'?event.clientX-rect.left:rect.right-event.clientX;
 }
 for(const side of ['left','right']){
  const handle=handles[side];
  handle.addEventListener('pointerdown',e=>{
   if(e.button!==0||compact()||body.classList.contains('ux-'+side+'-collapsed'))return;
   e.preventDefault();
   active={handle,pointerId:e.pointerId,previous:{...desired},side};
   handle.setPointerCapture(e.pointerId);
   handle.focus();
   body.classList.add('ux-workspace-resizing');
  });
  handle.addEventListener('pointermove',e=>{
   if(!active||active.handle!==handle||e.pointerId!==active.pointerId)return;
   setWidth(side,pointerValue(side,e),false);
  });
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',cancel);
  handle.addEventListener('lostpointercapture',()=>{
   if(active?.handle===handle)cancel();
  });
  handle.addEventListener('dblclick',e=>{
   if(compact())return;
   e.preventDefault();
   setWidth(side,workspaceDefaultWidths(workspaceWidth())[side]);
  });
  handle.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&active){
    e.preventDefault();e.stopImmediatePropagation();cancel();return;
   }
   if(compact())return;
   const step=e.shiftKey?32:16;
   const current=sizes()[side];
   let next=e.key==='Home'?WORKSPACE_LIMITS[side+'Min']:
    e.key==='End'?WORKSPACE_LIMITS[side+'Max']:
    e.key==='ArrowLeft'?current+(side==='left'?-step:step):
    e.key==='ArrowRight'?current+(side==='left'?step:-step):null;
   if(next===null)return;
   e.preventDefault();e.stopPropagation();
   setWidth(side,next);
  });
 }
 function resetLayout(){
  if(active)cancel();
  desired=workspaceDefaultWidths(workspaceWidth());
  try{localStorage.removeItem(WORKSPACE_LAYOUT_KEY);}catch{}
  paint();
  // Restore the standard three-pane desktop arrangement without opening
  // obstructing drawer overlays on compact windows.
  if(!compact()){
   window.CartoRigNavigation?.setLeft(true);
   window.CartoRigNavigation?.setRight(true);
  }
 }
 reset?.addEventListener('click',resetLayout);
 window.addEventListener('resize',()=>{if(active)cancel();paint();});
 paint();
 const api={refresh:paint,reset:resetLayout,setWidth,get widths(){return sizes();},get preferred(){return {...desired};}};
 window.CartoRigWorkspaceLayout=api;
 return api;
}
