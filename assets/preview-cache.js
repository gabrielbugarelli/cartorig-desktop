/* Immutable atlas bitmap reused while only selection handles change.
   This is editor-only; exports bypass the cache and use native resolution. */
export function previewBackingScale(width,height,dpr=1,maxPixels=1800000){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 1;
 const density=Math.max(1,Math.min(Number.isFinite(dpr)?dpr:1,2));
 return Math.min(density,Math.sqrt(maxPixels/(width*height)));
}
export function createPreviewCache({createCanvas=()=>document.createElement('canvas')}={}){
 let buffer=null,bufferCtx=null,documentRef=null,revision=null,soloId=null,assetsRevision=null,width=0,height=0;
 const stats={baseRenders:0,baseHits:0,baseRenderMs:0,maxBaseRenderMs:0};
 function paint(target,{doc,w,h,solo=null,assetsVersion=0,drawBase,drawOverlay,now=()=>performance.now()}){
  if(typeof drawBase!=='function'||typeof drawOverlay!=='function')throw Error('Preview draw functions required');
  const refresh=!buffer||documentRef!==doc||revision!==doc.revision||width!==w||height!==h||
    soloId!==solo||assetsRevision!==assetsVersion;
  if(refresh){
   if(!buffer){buffer=createCanvas();bufferCtx=buffer.getContext('2d');if(!bufferCtx)throw Error('Preview 2D context unavailable');}
   if(buffer.width!==w)buffer.width=w;
   if(buffer.height!==h)buffer.height=h;
   documentRef=null; // a failed render must not leave a stale valid cache
   const start=now();
   drawBase(bufferCtx);
   const elapsed=Math.max(0,now()-start);
   stats.baseRenders++;stats.baseRenderMs=elapsed;
   stats.maxBaseRenderMs=Math.max(stats.maxBaseRenderMs,elapsed);
   documentRef=doc;revision=doc.revision;width=w;height=h;soloId=solo;assetsRevision=assetsVersion;
  }else stats.baseHits++;
  target.save();target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,w,h);target.drawImage(buffer,0,0);target.restore();
  drawOverlay(target);
 }
 function invalidate(){documentRef=null;}
 function getStats(){return {...stats,width,height,valid:documentRef!==null};}
 return {paint,invalidate,getStats};
}
