"""Canvas2D + UI regression: real Historical Atlas PNG material assets, fully offline."""
from pathlib import Path
import json,re,sys,base64,hashlib
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
BASE=Path(__file__).resolve().parents[1]; A=BASE/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(A/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson','geodata/map_labels.json']
data={f:json.loads((A/f).read_text()) for f in paths}
materials={name:'data:image/png;base64,'+base64.b64encode((A/'look-materials'/f'{name}.png').read_bytes()).decode('ascii') for name in ['paper_aged','paper_fibrous','marine_noise','ink_grain']}
# Transparent 1x1 PNG represents irrelevant materials in this historical-only visual check.
blank='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8R/1sAAAAASUVORK5CYII='
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1600,'height':950},accept_downloads=True)
 page.set_default_timeout(25000)
 page.on('dialog',lambda dlg:dlg.accept())
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(A/'style.css').read_text());page.add_style_tag(content=(A/'ux-layout.css').read_text())
 page.evaluate('''({data,materials,blank})=>{
   const src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
   Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,
    get(){return src.get.call(this)},set(path){
      const match=String(path).match(/^\\/assets\\/look-materials\\/([\\w-]+)\\.png$/);
      src.set.call(this,match?(materials[match[1]]||blank):String(path).startsWith('/assets/')?blank:path);
    }});
   window.__textureExports=[];
   window.fetch=async(u,opts={})=>{
    if(u==='/api/v2/export/session'&&opts.method==='POST')return new Response('{"id":"texture-export"}');
    if(u.includes('/api/v2/export/session/texture-export/entry?')){
      const bytes=new Uint8Array(await opts.body.arrayBuffer());let h=2166136261;
      for(const x of bytes){h=Math.imul(h^x,16777619)>>>0;}
      window.__textureExports.push({name:new URL('https://local.test'+u).searchParams.get('name'),size:bytes.length,hash:h});
      return new Response('{}');
    }
    if(u.includes('/api/v2/export/session/texture-export'))return new Response('{}');
    if(u.includes('/api/v2/export/download/texture-export'))return new Response(new Blob(['test ZIP']));
    const endpoints={'/api/session':{token:'texture-test'},'/api/styles':[],'/api/geo-packs':[],'/api/v2/recovery':[],'/api/admin1/status':{installed:false},'/api/cities/status':{installed:false}};
    if(endpoints[u]!==undefined)return new Response(JSON.stringify(endpoints[u]));
    if(u.startsWith('/assets/')&&data[u.slice(8)]!==undefined)return new Response(JSON.stringify(data[u.slice(8)]));
    if(u==='/api/v2/project/recent'||u==='/api/v2/project/templates')return new Response('[]');
    if(opts.method==='POST')return new Response('{"id":"ok"}');
    throw Error('Unexpected URL: '+u);
   };
 }''',{'data':data,'materials':materials,'blank':blank})
 page.add_script_tag(content=browser_bundle(A));page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
 page.wait_for_timeout(1000)
 # Hide dynamic map labels so the difference isolates surface textures.
 for kind in ['countries','states','national_capitals','regional_capitals','cities','continents','oceans','seas']:
  page.evaluate('(kind)=>CartoRig.execute({type:"SetMapLabelOption",section:"enabled",key:kind,value:false})',kind)
 page.evaluate('CartoRig.execute({type:"ApplyTheme",id:"historical"})')
 page.locator('#style14ModeCustomize').click()
 ctl=page.locator('#sceneTexturesEnabled')
 assert ctl.count()==1 and ctl.is_checked()
 assert page.locator('#style14CustomizeView').is_visible()
 assert page.locator('text=Show textures').count()==1
 assert page.evaluate('CartoRig.scene.theme.id')=='historical'
 palette_before=page.evaluate('JSON.stringify(CartoRig.scene.theme)')
 def canvas_bytes():
  value=page.locator('#mapCanvas').evaluate('(c)=>c.toDataURL("image/png")')
  return base64.b64decode(value.split(',')[1])
 saved_dir=BASE/'dist/tests';saved_dir.mkdir(parents=True,exist_ok=True)
 before=canvas_bytes();page.locator('#mapCanvas').screenshot(path=str(saved_dir/'CartoRig-2.0.4-Historical-Textures-On.png'))
 ctl.uncheck()
 assert page.evaluate('CartoRig.scene.render_options.textures_enabled') is False
 assert page.evaluate('JSON.stringify(CartoRig.scene.theme)')==palette_before
 plain=canvas_bytes();page.locator('#mapCanvas').screenshot(path=str(saved_dir/'CartoRig-2.0.4-Historical-Textures-Off.png'))
 assert hashlib.sha256(before).digest()!=hashlib.sha256(plain).digest(),'Historical Atlas should visibly lose paper materials'
 page.locator('#undo').click()
 assert ctl.is_checked() and canvas_bytes()==before,'Undo restores checked UI state and original textured pixels'
 page.locator('#redo').click()
 assert not ctl.is_checked() and canvas_bytes()==plain,'Redo restores unchecked UI state and flat pixels'
 ctl.check();assert canvas_bytes()==before,'Re-enabling restores the exact original pixels'
 ctl.uncheck()
 page.evaluate('CartoRig.execute({type:"ApplyTheme",id:"atlas"})')
 assert not ctl.is_checked(),'Texture switch must survive look selection'
 page.evaluate('CartoRig.execute({type:"ApplyTheme",id:"historical"})')
 assert not ctl.is_checked() and canvas_bytes()==plain,'Palette and texture preference remain separate'
 # Production PNG must observe the exact same project-level setting as preview.
 page.locator('#openProduction').click()
 page.evaluate('''() => {const select=document.querySelector('#prodResolution');
  select.add(new Option('QA 640x360','640x360'));select.value='640x360';
  select.dispatchEvent(new Event('change',{bubbles:true}));}''')
 page.locator('#prodFormat').select_option('png')
 page.locator('#prodRun').click()
 page.wait_for_function('window.__textureExports.some(x=>x.name==="final.png")',timeout=40000)
 flat_export=page.evaluate('window.__textureExports.find(x=>x.name==="final.png")')
 assert flat_export['size']>12000,flat_export
 page.locator('#prodClose').click()
 ctl.check()
 page.locator('#openProduction').click()
 page.locator('#prodRun').click()
 page.wait_for_function('window.__textureExports.filter(x=>x.name==="final.png").length===2',timeout=40000)
 textured_export=page.evaluate('window.__textureExports.filter(x=>x.name==="final.png")[1]')
 assert textured_export['size']>flat_export['size'],'paper texture adds image detail to production output'
 assert textured_export['hash']!=flat_export['hash'],'production export must reflect toggle'
 page.locator('#prodClose').click()
 assert not errors,errors
 print('PASS 2.0.4: real PNG materials / Canvas2D, clean control, exact restoration, undo/redo, look independence',flush=True)
 b.close()
