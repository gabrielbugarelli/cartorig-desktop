"""Map label UX and export-facing project state, via real Chromium Canvas2D."""
from pathlib import Path
import json,re,sys
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(A/'index.html').read_text())
files=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson','geodata/map_labels.json']
data={f:json.loads((A/f).read_text()) for f in files}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=browser.new_page(viewport={'width':1600,'height':1000},accept_downloads=True)
 page.set_default_timeout(13000)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.set_content(html)
 page.add_style_tag(content=(A/'style.css').read_text());page.add_style_tag(content=(A/'ux-layout.css').read_text())
 page.evaluate('''data=>{window.fetch=async(u,opts={})=>{
   const endpoints={'/api/session':{token:'label-test'},'/api/styles':[],'/api/geo-packs':[],'/api/v2/recovery':[],'/api/admin1/status':{installed:false},'/api/cities/status':{installed:false}};
   if(endpoints[u]!==undefined)return new Response(JSON.stringify(endpoints[u]));
   if(u.startsWith('/assets/')&&data[u.slice(8)])return new Response(JSON.stringify(data[u.slice(8)]));
   if(u==='/api/v2/project/recent'||u==='/api/v2/project/templates')return new Response('[]');
   if(opts.method==='POST')return new Response('{"id":"ok"}');
   throw Error('Unknown URL: '+u);
  };}''',data)
 page.add_script_tag(content=browser_bundle(A));page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
 assert page.evaluate('typeof CartoRig.scene.map_labels')=='object'
 assert page.locator('#style14ModeCustomize').is_visible()
 page.locator('#style14ModeCustomize').click()
 labels=page.locator('#mapLabels')
 assert labels.count()==1
 labels.locator('summary').first.click()
 assert labels.is_visible()
 assert page.locator('#mapLabels [data-map-label-kind]').count()==8
 assert page.locator('#mapLabels [data-map-label-kind="countries"]').is_checked()
 assert not page.locator('#mapLabels [data-map-label-kind="states"]').is_checked()
 page.locator('#mapLabels [data-map-label-kind="states"]').check()
 assert page.evaluate('CartoRig.scene.map_labels.enabled.states')==True
 assert page.locator('#mapLabels [data-map-label-kind="states"]').is_checked()
 page.locator('#undo').click()
 assert page.evaluate('CartoRig.scene.map_labels.enabled.states')==False
 page.locator('#redo').click()
 assert page.evaluate('CartoRig.scene.map_labels.enabled.states')==True
 page.locator('.ux-map-label-advanced > summary').click()
 page.locator('#mapLabelAppearanceKind').select_option('seas')
 page.locator('#mapLabelFontSize').fill('24')
 page.locator('#mapLabelFontSize').press('Tab')
 assert page.evaluate('CartoRig.scene.map_labels.sizes.seas')==24
 page.locator('#mapLabelDensity').select_option('sparse')
 assert page.evaluate('CartoRig.scene.map_labels.density')=='sparse'
 page.locator('#mapLabelFont').select_option('serif')
 assert page.evaluate('CartoRig.scene.map_labels.font')=='serif'
 assert len(errs)==0,errs
 (ROOT/'dist/tests').mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(ROOT/'dist/tests/CartoRig-2.0.3-Map-Labels-Settings.png'))
 # Preview produced by Canvas; visible paint should differ when all label groups off.
 page.evaluate('''() => {
  CartoRig.execute({type:'SetCameraPose',pose:{center_lon:20,center_lat:51,zoom:4}});
 }''')
 before=page.locator('#mapCanvas').evaluate('(c)=>c.toDataURL()')
 for key in ['countries','states','national_capitals','regional_capitals','cities','continents','oceans','seas']:
  page.evaluate('(k)=>CartoRig.execute({type:"SetMapLabelOption",section:"enabled",key:k,value:false})',key)
 after=page.locator('#mapCanvas').evaluate('(c)=>c.toDataURL()')
 assert before!=after,'rótulos devem alterar os pixels do canvas'
 page.screenshot(path=str(ROOT/'dist/tests/CartoRig-2.0.3-Map-Labels-Off.png'))
 page.evaluate('''() => {for(const k of ['countries','states','national_capitals','oceans','seas'])CartoRig.execute({type:'SetMapLabelOption',section:'enabled',key:k,value:true});}''')
 page.screenshot(path=str(ROOT/'dist/tests/CartoRig-2.0.3-Map-Labels-On.png'))
 page.evaluate('''() => {CartoRig.execute({type:'ApplyTheme',id:'atlas'});CartoRig.execute({type:'SetMapLabelOption',section:'enabled',key:'states',value:true});}''')
 assert page.evaluate('CartoRig.scene.map_labels.enabled.states')==True
 page.locator('#mapCanvas').screenshot(path=str(ROOT/'dist/tests/CartoRig-2.0.3-Atlas-Europe.png'))
 assert len(errs)==0,errs
 browser.close()
print('PASS 2.0.3 map labels UI: 8 toggles, styling, undo/redo, real pixels')
