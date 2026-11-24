/* CartoRig UI/UX Stage 2.3 — shared guidance and canvas-only feedback.
 * All drawing/drag state is ephemeral. Only the existing SceneStore commands
 * commit changes so project schema, exports and Undo/Redo remain unchanged.
 */
import {drawCreative} from './creative-renderer.js';

export const DRAWING_TOOLS=Object.freeze(['region','route','label','marker','shape']);
export const MULTIPOINT_SHAPES=Object.freeze(['Polygon']);
export const POINTER_HIT_RADIUS=18;

export function isContinuousDraft(draft){
 return draft?.type==='Route'&&draft.path_type==='Custom'
  ||draft?.type==='Shape'&&MULTIPOINT_SHAPES.includes(draft.shape_kind);
}
export function minimumDraftPoints(draft){
 return draft?.type==='Shape'&&draft.shape_kind==='Polygon'?3:2;
}
const samePoint=(a,b)=> a&&b&&(a.lon!==undefined&&b.lon!==undefined?
 Math.abs(a.lon-b.lon)<1e-9&&Math.abs(a.lat-b.lat)<1e-9:
 a.x!==undefined&&b.x!==undefined&&Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9);
export function normalizedDraftPoints(draft){
 const points=[];
 for(const point of draft?.points||[])if(!samePoint(points.at(-1),point))points.push({...point});
 return points;
}
export function canCommitCreativeDraft(draft){
 const pts=normalizedDraftPoints(draft);
 if(pts.length<minimumDraftPoints(draft))return false;
 if(draft?.type==='Route'){
  return pts[0].lon!==pts.at(-1).lon||pts[0].lat!==pts.at(-1).lat;
 }
 return true;
}
export function creativeGuide({tool='select',draft=null,routeType='Straight',shapeType='Line',editMode=false,editOffset=false}={}){
 if(editMode)return {step:'EDIT',message:editOffset?
  'Drag the offset handle to adjust the marker · Esc exits editing':
  'Drag the colored handles to edit the selected object · Esc exits editing',help:'Esc: exit'};
 const points=draft?.points?.length||0;
 if(tool==='route'){
  const kind=draft?.path_type||routeType;
  if(!points)return {step:'1',message:'Click the route starting point',help:'Esc: cancel'};
  if(kind==='Custom')return {step:String(points+1),message:`Click to add a waypoint (${points} placed) · Enter or double-click finishes`,help:'Backspace: remove point · Esc: cancel'};
  return {step:'2/2',message:'Click the destination to finish the route',help:'Esc: cancel'};
 }
 if(tool==='shape'){
  const kind=draft?.shape_kind||shapeType;
  if(kind==='Freehand')return {step:'DRAW',message:'Press, drag and release to draw a freehand line',help:'Esc: cancel'};
  if(!points)return {step:'1',message:kind==='Callout'?'Click the geographic anchor for the Callout':`Click the first point of the ${kind}`,help:'Esc: cancel'};
  if(kind==='Polygon')return {step:String(points+1),message:`Click to add vertices (${points} placed) · Enter or double-click finishes`,help:'Backspace: remove point · Esc: cancel'};
  return {step:'2/2',message:kind==='Callout'?'Click to position the Callout text box on the map':
   kind==='Distance'?'Click the second point to measure the distance':
   `Click the second point to finish the ${kind}`,help:'Esc: cancel'};
 }
 if(tool==='label')return {step:'1/1',message:'Click to position text · Ctrl+Enter confirms the editor',help:'Esc: cancel'};
 if(tool==='marker')return {step:'1/1',message:'Click to place the marker · preview follows the cursor',help:'Esc: cancel'};
 if(tool==='region')return {step:'1/1',message:'Click a country or province to add it',help:'Esc: cancel'};
 return null;
}
export function handleRole(obj,index,total){
 if(obj?.type==='Route')return index===0||index===total-1?'anchor':'waypoint';
 if(obj?.type==='Marker')return (obj.offset_x||obj.offset_y)?'offset':'anchor';
 if(obj?.type==='Label')return 'anchor';
 if(obj?.type==='Shape'&&obj.shape_kind==='Callout')return index===total-1?'box':'anchor';
 return 'vertex';
}
export function handleHit(handles,x,y,radius=POINTER_HIT_RADIUS){
 let best=null,dist=radius;
 for(const h of handles||[]){
  const d=Math.hypot(h.xy[0]-x,h.xy[1]-y);
  if(d<=dist){best=h;dist=d;}
 }
 return best;
}
export function drawHandle(ctx,x,y,role='vertex',{active=false,draft=false}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const size=active?7:5.5;
 const fill=role==='anchor'?'#f3bd68':role==='box'?'#a9e58e':role==='waypoint'?'#9bc6ff':'#74bbeb';
 ctx.save();
 ctx.setLineDash([]);
 ctx.lineWidth=2;
 ctx.strokeStyle='#102432';ctx.fillStyle=fill;
 ctx.beginPath();
 if(role==='anchor'||role==='waypoint'){
  if(typeof ctx.arc==='function')ctx.arc(x,y,role==='waypoint'?size-1:size,0,Math.PI*2);
  else ctx.rect(x-size,y-size,2*size,2*size);
 }else if(role==='box'||role==='offset'){
  ctx.moveTo(x,y-size-1);ctx.lineTo(x+size+1,y);
  ctx.lineTo(x,y+size+1);ctx.lineTo(x-size-1,y);ctx.closePath();
 }else ctx.rect(x-size,y-size,2*size,2*size);
 ctx.fill();ctx.stroke();
 if(active||draft){
  ctx.strokeStyle=role==='box'?'#bff89e':'#f4e0b2';
  ctx.lineWidth=1;ctx.beginPath();
  if(typeof ctx.arc==='function')ctx.arc(x,y,size+5,0,Math.PI*2);
  else ctx.rect(x-size-5,y-size-5,2*(size+5),2*(size+5));
  ctx.stroke();
 }
 ctx.restore();
}
export function drawDraftGuides(ctx,doc,draft,cursor,w,h,project,pointAt){
 if(!draft?.points?.length)return;
 const points=draft.points.map(p=>p.lon!==undefined?project(doc,p.lon,p.lat,w,h):[p.x*w,p.y*h]);
 ctx.save();
 ctx.strokeStyle='#ffd187';ctx.lineWidth=Math.max(1.5,h/800);
 ctx.setLineDash([6,5]);
 if(cursor&&points.length){
  ctx.beginPath();const first=points.at(-1);
  ctx.moveTo(first[0],first[1]);ctx.lineTo(cursor.x,cursor.y);ctx.stroke();
 }
 ctx.restore();
 // Freehand can have hundreds of samples; avoid drawing hundreds of handles.
 const indices=draft.shape_kind==='Freehand'&&points.length>2?[0,points.length-1]:
  points.map((_,i)=>i);
 for(const i of indices){
  drawHandle(ctx,...points[i],draft.type==='Shape'&&draft.shape_kind==='Callout'?
   (i===0?'anchor':'box'):draft.type==='Route'?
   (i===0?'anchor':'waypoint'):'vertex',{draft:i===0});
 }
 if(cursor){
  const point=pointAt(cursor.x,cursor.y,draft.coordinate_space||'geo');
  if(point?.lon!==undefined||point?.x!==undefined){
   const xy=point.lon!==undefined?project(doc,point.lon,point.lat,w,h):
    [point.x*w,point.y*h];
   drawHandle(ctx,...xy,draft.type==='Shape'&&draft.shape_kind==='Callout'?'box':'vertex',{draft:true});
  }
 }
}
export function drawPlacementPreview(ctx,doc,tool,cursor,w,h,project,pointAt,{symbol='Circle'}={}){
 if(!cursor||!['marker','label'].includes(tool))return;
 const point=pointAt(cursor.x,cursor.y,'geo');
 if(!point||!Number.isFinite(point.lon)||!Number.isFinite(point.lat))return;
 const object=tool==='marker'?{
  type:'Marker',anchor:point,symbol,offset_x:0,offset_y:0,
  style:{fill_color:'#e5b467',stroke_color:'#ffffff',stroke_width:2,symbol_size:12}
 }:{
  type:'Label',anchor:point,text:'Text',position_mode:'geo',
  typography:{font_size:27,font_family:'Segoe UI',font_weight:700,line_height:1.2},
  style:{text_color:'#ffffff',halo_color:'#08111e',halo_width:4}
 };
 ctx.save();ctx.globalAlpha*=.58;
 drawCreative(ctx,doc,object,w,h,project);
 ctx.restore();
 drawHandle(ctx,cursor.x,cursor.y,'anchor',{draft:true});
}
