"""Validate rendering and loading of example project in isolated Chromium."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re
assets=Path(__file__).resolve().parents[1]/'assets';out=Path(__file__).resolve().parent
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
from module_loader import browser_bundle
js=browser_bundle(assets if 'assets' in globals() else root/'assets')
data={f:json.loads((assets/f).read_text()) for f in ['countries.json','geodata/cities_world.geojson','geodata/br_states.geojson','geodata/localities.json','geodata/continents.json','geodata/admin1-names.json']}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':950},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text());page.evaluate('''data=>{window.fetch=async u=>{if(u==='/api/session')return new Response(JSON.stringify({token:'test'}));if(u==='/api/cities/status'||u==='/api/admin1/status')return new Response(JSON.stringify({installed:false}));if(u==='/api/cities/install'||u==='/api/admin1/install')return new Response('Offline test',{status:503});if(u==='/api/geo-packs')return new Response('[]');if(u.startsWith('/assets/')&&data[u.slice(8)])return new Response(JSON.stringify(data[u.slice(8)]));throw Error('unhandled '+u);}}''',data)
 page.add_script_tag(content=js);page.wait_for_function('CartoRig.ready===true')
 with page.expect_file_chooser() as chooser:page.locator('#openProject').click()
 chooser.value.set_files(str(Path(__file__).resolve().parents[1]/'examples'/'Brazil-Argentina-Example.cartorig'))
 page.wait_for_timeout(300)
 assert page.evaluate('CartoRig.scene.name')=='South America — Brazil & Argentina'
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(o=>o.type==='Label').length")==2
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(o=>o.type==='Route').length")==1
 page.screenshot(path=str(out/'example-preview.png'))
 print('Loaded example scene; screenshot exported; JS exceptions:',errors)
 assert not errors
 b.close()
