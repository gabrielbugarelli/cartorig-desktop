"""Real bundled raster files must generate meaningfully different pixels for Relief and Terrain looks."""
from pathlib import Path
import sys,re,json,base64,io
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
base=Path(__file__).resolve().parents[1];assets=base/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((assets/f).read_text()) for f in paths}
output=base/'dist'/'tests';output.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
    page=b.new_page(viewport={'width':1480,'height':960})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
    page.evaluate('''d=>{window.fetch=async(u,opts={})=>{
      if(u==='/api/session')return new Response('{"token":"t"}');
      if(u==='/api/styles')return new Response('[]');
      if(u==='/api/geo-packs')return new Response('[]');
      if(u==='/api/admin1/status'||u==='/api/cities/status')return new Response('{"installed":false}');
      if(u==='/api/admin1/install'||u==='/api/cities/install')return new Response('offline',{status:503});
      if(u==='/api/geodata/verify')return new Response('{"global_offline_ready":false,"datasets":[]}');
      if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]));
      throw Error('Unhandled '+u);
    };}''',data)
    page.add_script_tag(content=browser_bundle(assets));page.wait_for_function('window.CartoRig?.ready===true',timeout=60000)
    src={}
    for name in ('shadedrelief','etopo1'):
        # Downsample real shipped raster pixels to keep Chromium CI bounded.
        with Image.open(assets/(name+'.jpg')) as im:
            im.thumbnail((1800,900));buf=io.BytesIO();im.convert('RGB').save(buf,'JPEG',quality=88)
            src[name]=base64.b64encode(buf.getvalue()).decode()
    out=page.evaluate('''async ({src,countries})=>{
      const images={};for(const [name,b64] of Object.entries(src)){let img=new Image();img.src='data:image/jpeg;base64,'+b64;await img.decode();images[name]=img;}
      const doc=newDocument();doc.canvas.transparent=false;doc.camera.center_lat=12;doc.camera.center_lon=0;doc.camera.zoom=1.55;
      const cv=document.createElement('canvas');cv.width=800;cv.height=450;
      const results={};for(const id of ['relief','terrain']){
        doc.theme={id,overrides:{},type_defaults:{}};
        renderScene(cv.getContext('2d',{willReadFrequently:true}),doc,countries,images,cv.width,cv.height);
        results[id]=cv.toDataURL('image/png').split(',')[1];
      }
      return results;
    }''',{'src':src,'countries':data['countries.json']})
    for k,v in out.items():(output/f'CartoRig-1.4.3-{k}-look.png').write_bytes(base64.b64decode(v))
    a=Image.open(output/'CartoRig-1.4.3-relief-look.png').convert('RGB');c=Image.open(output/'CartoRig-1.4.3-terrain-look.png').convert('RGB')
    diff=ImageChops.difference(a,c);stat=ImageStat.Stat(diff);mae=sum(stat.mean)/3
    changed=sum(1 for px in diff.get_flattened_data() if max(px)>=24)/float(a.width*a.height)
    print(f'Shaded Relief / Terrain Cinematic actual raster differences: MAE {mae:.1f}, changed {changed:.1%}; generated {a.size} pixels')
    assert mae>=16,mae
    assert changed>=.30,changed
    assert not errors,errors
    b.close()
