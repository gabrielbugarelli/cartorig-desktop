"""M4 real-catalog browser E2E: theme overrides, opacity, effects, style files, save and PNG."""
from pathlib import Path
import json,re,tempfile,sys
from PIL import Image
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
base=Path(__file__).resolve().parents[1];assets=base/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
js=browser_bundle(assets)
files=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((assets/f).read_text()) for f in files}
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1680,'height':1050},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept('My Cinematic Style'))
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
 page.evaluate('''d=>{window._savedStyles=[];window.fetch=async(u,opts={})=>{
  if(u==='/api/v2/project/save'){window._lastProductionSaved=JSON.parse(opts.body);return new Response(JSON.stringify({project_id:window._lastProductionSaved.project_id,ok:true}));}
  if(u==='/api/v2/project/open')return new Response(new TextDecoder().decode(opts.body),{headers:{'Content-Type':'application/json'}});
  if(u==='/api/v2/recovery')return new Response('[]');
  if(u==='/api/v2/autosave')return new Response('{"ok":true}');
  if(u==='/api/session')return new Response(JSON.stringify({token:'test-token'}));
  if(u==='/api/styles'){
    if(opts.method==='POST'){window._savedStyles=JSON.parse(opts.body);return new Response('{"ok":true}')}
    return new Response(JSON.stringify(window._savedStyles));
  }
  if(u==='/api/geo-packs')return new Response('[]');
  if(u==='/api/admin1/status'||u==='/api/cities/status')return new Response(JSON.stringify({installed:false}));
  if(u==='/api/admin1/install'||u==='/api/cities/install')return new Response('offline',{status:503});
  if(u==='/api/geodata/verify')return new Response(JSON.stringify({global_offline_ready:false,datasets:[]}));
  if(u==='/api/scene-bundle')return new Response(new Blob(['mock zip'],{type:'application/zip'}));
  if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]));
  throw Error('Unhandled '+u);
  };}''',data)
 page.add_script_tag(content=js);page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
 assert not errors,errors
 # Real Natural Earth baseline Brazil geometry, not a synthetic placeholder.
 braz=page.evaluate('''()=>{let o=madeObject('Region','Brazil',{region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:'BRA'},style:{fill_color:'#ff0000',fill_opacity:1,stroke_width:0}});return CartoRig.execute({type:'CreateObject',object:o})?o.id:null;}''')
 assert braz
 page.locator('#tabStyles').click();page.locator('.ux-look-options').evaluate('(e)=>e.open=true')
 page.locator('[data-style=atlas]').first.click()
 assert page.evaluate('CartoRig.scene.theme.id')=='atlas'
 assert page.evaluate('id=>CartoRig.scene.objects[id].style.fill_color',braz)=='#ff0000'
 page.locator('[data-style=historical]').first.click()
 assert page.evaluate('CartoRig.scene.theme.id')=='historical'
 (base/'dist'/'tests').mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(base/'dist'/'tests'/'CartoRig-1.4-Style-Studio.png'))
 page.locator('#tabLayers').click();page.locator('.tree-row[data-id="'+braz+'"]').click()
 assert page.locator('#inspector h3').filter(has_text='SHADOW').count()==1
 assert page.locator('#inspector h3').filter(has_text='GLOW').count()==1
 page.screenshot(path=str(base/'dist'/'tests'/'CartoRig-1.4-Region-Inspector.png'))
 page.evaluate('''id=>CartoRig.execute({type:'SetObjectStyle',id,values:{shadow_enabled:true,shadow_color:'#000000',shadow_opacity:.6,shadow_distance:14,shadow_blur:12,glow_enabled:true,glow_color:'#ffd700',glow_intensity:1,glow_radius:14,blend_mode:'normal'}})''',braz)
 assert page.evaluate('id=>CartoRig.scene.objects[id].style.glow_enabled',braz) is True
 # Export transparent Region and check alpha effect outside the country.
 page.locator('#tabStyles').click();page.locator('.ux-look-options').evaluate('(e)=>e.open=true');page.locator('#uxCanvasOptions').evaluate('(e)=>e.open=true');page.locator('#resolution').select_option('1920x1080');page.locator('#transparent').check()
 page.locator('#exportMenu').evaluate('(e)=>e.open=true')
 with page.expect_download(timeout=90000) as d:page.locator('#exportImage').click()
 png=Path(tmp)/'effect.png';d.value.save_as(png);image=Image.open(png).convert('RGBA')
 assert image.size==(1920,1080)
 alpha=image.getchannel('A')
 assert alpha.getextrema()==(0,255),alpha.getextrema()
 assert sum(v for n,v in enumerate(alpha.histogram()) if 0<n<255)>0,'No partial alpha in effects'
 # Isolated output stays transparent outside the Country even when effects are enabled.
 assert image.getpixel((0,0))[3]==0
 # Scoped reset must preserve independently enabled effects.
 page.evaluate('''id=>CartoRig.execute({type:'ResetStyleProperty',id,key:'fill_color'})''',braz)
 assert page.evaluate('id=>!Object.hasOwn(CartoRig.scene.objects[id].style,"fill_color")&&CartoRig.scene.objects[id].style.glow_enabled',braz)
 page.locator('#tabStyles').click();page.locator('.ux-look-options').evaluate('(e)=>e.open=true')
 page.locator('#style14Save').click();page.wait_for_timeout(100)
 assert page.evaluate('CartoRig.scene.style_library.length')==1
 page.wait_for_function('window._savedStyles.length===1')
 with page.expect_download() as d:page.locator('#styleStudio14 button',has_text='Export').click()
 stylefile=Path(tmp)/'custom.cartorigstyle';d.value.save_as(stylefile)
 src=json.loads(stylefile.read_text());assert src['format']=='cartorig-style' and src['schema_version']=='1.0.0'
 # Import creates another unique style ID and is undoable.
 with page.expect_file_chooser() as d:page.locator('#style14Import').click()
 d.value.set_files(str(stylefile));page.wait_for_function('CartoRig.scene.style_library.length===2')
 assert len({s['id'] for s in page.evaluate('CartoRig.scene.style_library')})==2
 page.locator('#undo').click();assert page.evaluate('CartoRig.scene.style_library.length')==1
 # Explicit Duplicate UI creates a separate ID and is independently undoable.
 page.locator('#styleStudio14 button',has_text='Duplicate').first.click()
 assert page.evaluate('CartoRig.scene.style_library.length')==2
 page.locator('#undo').click();assert page.evaluate('CartoRig.scene.style_library.length')==1
 page.locator('#saveProject').click()
 page.wait_for_function('Boolean(window._lastProductionSaved)')
 project=Path(tmp)/'style14.cartorig'
 project.write_text(json.dumps(page.evaluate('window._lastProductionSaved')),encoding='utf-8')
 stored=json.loads(project.read_text());assert stored['objects'][braz]['style']['glow_enabled']
 page.locator('#fileMenu').evaluate('(e)=>e.open=true')
 with page.expect_file_chooser() as d:page.locator('#openProject').click()
 d.value.set_files(str(project));page.wait_for_timeout(200)
 assert page.evaluate('id=>CartoRig.scene.objects[id].style.glow_enabled',braz)
 assert not errors,errors
 print('M4 real Brazil + theme change + overrides + alpha glow/shadow PNG + local style library + import/export + undo + save/open: PASS')
 b.close()
