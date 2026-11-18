/* CartoRig 1.4 — alpha-derived object effects and bounded offscreen surfaces. MIT. */
const makeCanvas=(w,h)=>{let c=document.createElement('canvas');c.width=w;c.height=h;return c;};
// Active viewport is temporary during synchronous tiled render. Geometric
// coordinates still use full output pixels; offscreens only allocate one tile.
let activeTile=null;
export function setRenderTile(tile){const previous=activeTile;activeTile=tile;return previous;}

export const blending={normal:'source-over',multiply:'multiply',screen:'screen',overlay:'overlay'};
export function withIsolatedSurface(ctx,w,h,draw,{opacity=1,blend_mode='normal',forceIsolation=false,shadow_enabled=false,glow_enabled=false,shadow_color='#000000',shadow_opacity=.35,shadow_blur=12,shadow_distance=4,shadow_angle=45,glow_color='#8ac7ff',glow_intensity=.5,glow_radius=16,glow_mix=1}={}){
 // Fast path avoids allocations for the vast majority of normal objects.
 if(!forceIsolation&&!shadow_enabled&&!glow_enabled&&blend_mode==='normal'){
  ctx.save();ctx.globalAlpha*=opacity;draw(ctx);ctx.restore();return;
 }
 const tile=activeTile,W=tile?tile.width:w,H=tile?tile.height:h;
 const cv=makeCanvas(W,H),off=cv.getContext('2d');if(tile)off.translate(-tile.x,-tile.y);draw(off);
 const pixScale=h/1080;
 ctx.save();ctx.globalCompositeOperation=blending[blend_mode]||'source-over';ctx.globalAlpha*=opacity;
 if(shadow_enabled&&shadow_opacity>0){
  const shadow=makeCanvas(W,H),s=shadow.getContext('2d');
  // Draw the source as a shadow-casting alpha mask. Copy only the shadow: never
  // draw the original from this pass, otherwise the fill would be duplicated.
  s.shadowColor=shadow_color;s.shadowBlur=shadow_blur*pixScale;
  let theta=shadow_angle*Math.PI/180;s.shadowOffsetX=Math.cos(theta)*shadow_distance*pixScale;s.shadowOffsetY=Math.sin(theta)*shadow_distance*pixScale;
  s.drawImage(cv,0,0);
  s.globalCompositeOperation='destination-out';s.drawImage(cv,0,0);
  ctx.save();ctx.globalAlpha*=shadow_opacity;ctx.drawImage(shadow,tile?tile.x:0,tile?tile.y:0);ctx.restore();shadow.width=0;shadow.height=0;
 }
 if(glow_enabled&&glow_mix>0&&glow_intensity>0){
  const glow=makeCanvas(W,H),g=glow.getContext('2d');
  g.shadowColor=glow_color;g.shadowBlur=glow_radius*pixScale;g.shadowOffsetX=0;g.shadowOffsetY=0;
  g.drawImage(cv,0,0);
  // Glow must not simply duplicate the solid fill. Use blur-derived halo by
  // masking original alpha out of the pass (edge halo can extend outward).
  g.globalCompositeOperation='destination-out';g.drawImage(cv,0,0);
  ctx.save();ctx.globalAlpha*=Math.min(1,glow_mix*glow_intensity);ctx.drawImage(glow,tile?tile.x:0,tile?tile.y:0);ctx.restore();glow.width=0;glow.height=0;
 }
 ctx.drawImage(cv,tile?tile.x:0,tile?tile.y:0);ctx.restore();cv.width=0;cv.height=0;
}
export function applyAtmosphere(ctx,w,h,over){let vignette=over?.atmosphere_vignette??0,tint=over?.atmosphere_tint||'#000000',mix=over?.atmosphere_tint_mix??0;if(mix>0){ctx.save();ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=mix;ctx.fillStyle=tint;ctx.fillRect(0,0,w,h);ctx.restore();}if(vignette>0){ctx.save();let gr=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.14,w/2,h/2,Math.max(w,h)*.75);gr.addColorStop(0,'#00000000');gr.addColorStop(1,'#000000');ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=vignette*.8;ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);ctx.restore();}}
