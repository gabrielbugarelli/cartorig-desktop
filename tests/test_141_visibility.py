"""1.4.1 hotfix: visible Cinematic Styles on launch, quick FX and alpha-safe atmosphere."""
from pathlib import Path
import json,re,sys
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
base=Path(__file__).resolve().parents[1]
assets=base/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((assets/f).read_text()) for f in paths}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=browser.new_page(viewport={'width':1680,'height':980})
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
 page.evaluate('''d=>{window.fetch=async(u,opts={})=>{if(u==='/api/session')return new Response('{"token":"t"}');if(u==='/api/styles')return new Response('[]');if(u==='/api/geo-packs')return new Response('[]');if(u==='/api/admin1/status'||u==='/api/cities/status')return new Response('{"installed":false}');if(u==='/api/admin1/install'||u==='/api/cities/install')return new Response('offline',{status:503});if(u==='/api/geodata/verify')return new Response('{"global_offline_ready":false,"datasets":[]}');if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]));throw Error('Unhandled '+u);};}''',data)
 page.add_script_tag(content=browser_bundle(assets));page.wait_for_function('window.CartoRig?.ready === true',timeout=45000)
 assert page.locator('#panelStyles').is_visible(),'Style Studio is not visible on launch'
 assert page.locator('#style14Save').count()==1
 assert page.locator('#presets [data-style]').count()==36
 assert page.locator('#openStyleStudio').is_visible()
 out=base/'dist'/'tests';out.mkdir(parents=True,exist_ok=True)
 page.wait_for_timeout(4500)  # allow theme previews and transient diagnostics to settle
 page.screenshot(path=str(out/'CartoRig-1.4.1-Style-Studio-Visible.png'))
 ident=page.evaluate('''()=>{let o=madeObject('Region','Brazil',{region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:'BRA'},style:{fill_color:'#ff0000',fill_opacity:1}});return CartoRig.execute({type:'CreateObject',object:o})?o.id:null;}''')
 assert ident
 page.locator('.tree-row[data-id="'+ident+'"]').click()
 assert page.locator('#panelInspector').is_visible()
 assert page.locator('#inspector h3').first.inner_text().startswith('CINEMATIC EFFECTS')
 page.locator('.style14-inspector-actions button').first.click()
 assert page.evaluate('id=>CartoRig.scene.objects[id].style.glow_enabled',ident)
 page.locator('#focusSelected').click()
 page.screenshot(path=str(out/'CartoRig-1.4.1-Quick-Effects.png'))
 alpha=page.evaluate('''()=>{let cv=document.createElement('canvas');cv.width=cv.height=100;let c=cv.getContext('2d');c.fillStyle='#ff0000';c.fillRect(35,35,30,30);applyAtmosphere(c,100,100,{atmosphere_vignette:1,atmosphere_tint:'#00ffcc',atmosphere_tint_mix:0.9});return {corner:c.getImageData(0,0,1,1).data[3],center:c.getImageData(50,50,1,1).data[3]};}''')
 assert alpha['corner']==0 and alpha['center']==255,alpha
 assert not errors,errors
 print('1.4.1 visible Style Studio, 36 presets, Inspector quick Glow and transparent atmosphere: PASS',alpha)
 browser.close()
