/* Frame-coalesced Canvas2D preview lifecycle, independent of UI and Wails.
   Hidden windows retain the latest invalidation without allocating a canvas. */
export function createPreviewScheduler({draw,measure,requestFrame,cancelFrame,now=()=>performance.now(),initiallyVisible=true}){
 if(typeof draw!=='function'||typeof measure!=='function'||typeof requestFrame!=='function'||typeof cancelFrame!=='function')throw Error('Preview scheduler dependencies required');
 let visible=!!initiallyVisible,dirty=false,frame=null,lastSize=null,settleOnResume=false,settleSample=null;
 const stats={renders:0,invalidations:0,coalesced:0,resizeEvents:0,skippedHidden:0,invalidSizes:0,pauses:0,resumes:0,lastRenderMs:0,maxRenderMs:0,totalRenderMs:0};
 const same=(a,b)=>!!a&&!!b&&Math.abs(a.width-b.width)<.5&&Math.abs(a.height-b.height)<.5;
 const valid=s=>s&&Number.isFinite(s.width)&&Number.isFinite(s.height)&&s.width>48&&s.height>48;
 function schedule(){if(!visible||!dirty||frame!==null)return;frame=requestFrame(tick);}
 function tick(){
  frame=null;
  if(!visible||!dirty){if(!visible)stats.skippedHidden++;return;}
  const size=measure();
  if(!valid(size)){stats.invalidSizes++;return;} // wait for resize/restore, don't spin
  // The first frame after a tray restore is often an intermediate WebView2 size.
  // Require two consecutive equal sizes, preserving the pending invalidation.
  if(settleOnResume){
   if(!same(settleSample,size)){settleSample={...size};schedule();return;}
   settleOnResume=false;
   settleSample=null;
  }
  dirty=false;
  const start=now();
  try{
   draw();
  }finally{
   const elapsed=Math.max(0,now()-start);
   stats.renders++;
   stats.lastRenderMs=elapsed;
   stats.maxRenderMs=Math.max(stats.maxRenderMs,elapsed);
   stats.totalRenderMs+=elapsed;
   lastSize={...size};
   schedule(); // an invalidation may have arrived during drawing
  }
 }
 function invalidate(){
  stats.invalidations++;
  if(dirty)stats.coalesced++;
  dirty=true;
  if(visible)schedule();else stats.skippedHidden++;
 }
 function onResize(){
  stats.resizeEvents++;
  const size=measure();
  if(!valid(size))return;
  if(!dirty&&same(size,lastSize))return;
  invalidate();
 }
 function setVisible(next){
  next=!!next;
  if(next===visible)return;
  visible=next;
  if(!visible){
   stats.pauses++;
   if(frame!==null){cancelFrame(frame);frame=null;}
   dirty=true; // force one fresh render on the next restore
   settleOnResume=false;settleSample=null;
  }else{
   stats.resumes++;
   settleOnResume=true;settleSample=null;
   dirty=true;
   schedule();
  }
 }
 return {
  invalidate,onResize,setVisible,
  getStats:()=>({...stats,visible,dirty,framePending:frame!==null,lastSize:lastSize?{...lastSize}:null})
 };
}
