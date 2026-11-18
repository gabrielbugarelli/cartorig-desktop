"""Pixel comparison: one-pass Canvas vs the same scene rendered with tile viewport offsets."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
import sys
assets=Path(__file__).resolve().parents[1]/'assets'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page();page.set_content('<!doctype html><html><body></body></html>');page.add_script_tag(content=browser_bundle(assets,include_app=False))
 result=page.evaluate('''()=>{
 const doc=newDocument();doc.canvas.transparent=true;doc.camera={projection:'equirectangular',center_lon:5,center_lat:5,zoom:13,bearing:9};
 for(const o of Object.values(doc.objects))o.visible=false;
 const geometry={type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]]};
 const region=madeObject('Region','Tile Test',{region_kind:'State',source:{feature_id:'test'},embedded_geometry:geometry,style:{fill_color:'#cc4455',stroke_color:'#ffffff',fill_opacity:.8,stroke_width:3,shadow_enabled:true,shadow_color:'#000000',shadow_opacity:.6,shadow_blur:9,shadow_distance:6,glow_enabled:true,glow_color:'#35aaff',glow_radius:10,glow_intensity:1}});
 doc.objects[region.id]=region;doc.scene.root_ids.push(region.id);
 const W=800,H=450,countries=[],images={};const make=(w,h)=>{let c=document.createElement('canvas');c.width=w;c.height=h;return c};
 const full=make(W,H);renderScene(full.getContext('2d'),doc,countries,images,W,H);
 const assembled=make(W,H),out=assembled.getContext('2d');
 const SIZE=256,PAD=60;
 for(let y=0;y<H;y+=SIZE)for(let x=0;x<W;x+=SIZE){
  let x0=Math.max(0,x-PAD),y0=Math.max(0,y-PAD),x1=Math.min(W,x+SIZE+PAD),y1=Math.min(H,y+SIZE+PAD);
  const tile={x:x0,y:y0,width:x1-x0,height:y1-y0};const cv=make(tile.width,tile.height);
  renderScene(cv.getContext('2d'),doc,countries,images,W,H,{tile});
  const tw=Math.min(SIZE,W-x),th=Math.min(SIZE,H-y);
  out.drawImage(cv,x-x0,y-y0,tw,th,x,y,tw,th);
 }
 const a=full.getContext('2d').getImageData(0,0,W,H).data,bb=out.getImageData(0,0,W,H).data;
 let errors=0,max=0,sum=0,maxloc=null,stitches=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-bb[i]);if(d){errors++;if(d>max){max=d;maxloc={x:Math.floor(i/4)%W,y:Math.floor(i/4/W),channel:i%4,full:a[i],tile:bb[i]}}sum+=d; if(Math.floor(i/4)%W%256<3||Math.floor(i/4/W)%256<3)stitches++}}
 return {errors,max,sum,maxloc,stitches,pixels:W*H,realAlpha:a.filter((x,i)=>i%4===3&&x>0).length};
 }''')
 print('TILED RENDER:',result)
 assert result['realAlpha']>1000,result
 # Canvas may differ on subpixel antialiasing; require at least 99.5% channel parity.
 assert result['errors']/(result['pixels']*4) < .005 and result['stitches'] < 1000, result
 b.close()
