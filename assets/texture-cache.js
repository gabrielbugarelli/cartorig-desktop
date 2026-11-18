/* CartoRig preview-only texture preparation.
   Large source JPEGs are graded once, at bounded screen-preview resolution.
   Full-resolution PNG/SVG/ZIP exports never use this module's prepared bitmap. */
export const PREVIEW_TEXTURE_MAX_PIXELS=4000000;
export const PREVIEW_TEXTURE_BUDGET_PIXELS=12000000;

export function createFilteredTextureCache({
 createCanvas=()=>document.createElement('canvas'),
 maxPixels=PREVIEW_TEXTURE_MAX_PIXELS,
 budgetPixels=PREVIEW_TEXTURE_BUDGET_PIXELS,
 now=()=>performance.now()
}={}){
 const entries=[];
 const stats={hits:0,misses:0,evictions:0,failures:0,totalPrepareMs:0,lastPrepareMs:0,maxPrepareMs:0};
 let livePixels=0;
 function get(source,filter='none'){
  const sourceWidth=source?.naturalWidth||source?.width||0;
  const sourceHeight=source?.naturalHeight||source?.height||0;
  if(source?.complete===false||!sourceWidth||!sourceHeight)return null;
  filter=filter||'none';
  let index=entries.findIndex(e=>e.source===source&&e.filter===filter);
  if(index>=0){
   const [entry]=entries.splice(index,1);
   entries.push(entry);
   stats.hits++;
   return entry.canvas;
  }
  stats.misses++;
  // Floor both dimensions: rounding up can put a nominal 4 MP image
  // above the limit, causing three atlas layers to evict each other from
  // a 12 MP LRU on every redraw. Never exceed the entire cache budget.
  const pixelLimit=Math.max(1,Math.floor(Math.min(maxPixels,budgetPixels)));
  const fraction=Math.min(1,Math.sqrt(pixelLimit/(sourceWidth*sourceHeight)));
  const width=Math.max(1,Math.floor(sourceWidth*fraction));
  const height=Math.max(1,Math.floor(sourceHeight*fraction));
  let canvas=null;
  try{
   canvas=createCanvas();canvas.width=width;canvas.height=height;
   const context=canvas.getContext('2d');
   if(!context)throw Error('2D canvas unavailable');
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
   context.filter=filter;
   const started=now();
   context.drawImage(source,0,0,width,height);
   const elapsed=Math.max(0,now()-started);
   stats.lastPrepareMs=elapsed;
   stats.maxPrepareMs=Math.max(stats.maxPrepareMs,elapsed);
   stats.totalPrepareMs+=elapsed;
   context.filter='none';
   while(entries.length&&livePixels+width*height>budgetPixels){
    const old=entries.shift();
    livePixels-=old.pixels;
    old.canvas.width=0;old.canvas.height=0;
    stats.evictions++;
   }
   entries.push({source,filter,canvas,pixels:width*height});
   livePixels+=width*height;
   return canvas;
  }catch(error){
   if(canvas){canvas.width=0;canvas.height=0;}
   stats.failures++;
   return null; // preserve the original raster rendering path if preparation fails
  }
 }
 function clear(){
  for(const e of entries){e.canvas.width=0;e.canvas.height=0;}
  entries.length=0;livePixels=0;
 }
 function getStats(){return {...stats,entries:entries.length,livePixels};}
 return {get,clear,getStats};
}

// Cull world-copy rasters whose rotated rectangles cannot touch the viewport.
// This is conservative and identical in pixels to drawing all three copies.
export function visibleRasterShifts({width,height,k,center_lon=0,center_lat=0,bearing=0}){
 if(!(width>0&&height>0&&k>0))return [-1,0,1];
 const angle=bearing*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
 const imageWidth=360*k,imageHeight=180*k;
 const xLeft=-width/2,xRight=width/2,yTop=-height/2,yBottom=height/2;
 const visible=[];
 for(const shift of [-1,0,1]){
  const x=(-180-center_lon+360*shift)*k;
  const y=(center_lat-90)*k;
  let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
  for(const dx of [0,imageWidth])for(const dy of [0,imageHeight]){
   const u=(x+dx)*cos-(y+dy)*sin;
   const v=(x+dx)*sin+(y+dy)*cos;
   loX=Math.min(loX,u);hiX=Math.max(hiX,u);
   loY=Math.min(loY,v);hiY=Math.max(hiY,v);
  }
  // Ignore subpixel edge-only copies: they cannot paint a full preview pixel.
  if(hiX>xLeft+.5&&loX<xRight-.5&&hiY>yTop+.5&&loY<yBottom-.5)visible.push(shift);
 }
 return visible;
}
