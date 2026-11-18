"""New family selectors and material controls must be real, editable commands."""
from pathlib import Path
import sys,re,json
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
BASE=Path(__file__).resolve().parents[1];ASSETS=BASE/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(ASSETS/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((ASSETS/f).read_text()) for f in paths}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=browser.new_page(viewport={'width':1680,'height':1100})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(ASSETS/'style.css').read_text());page.add_style_tag(content=(ASSETS/'ux-layout.css').read_text())
 page.evaluate('''data=>{window.fetch=async (u,opts={})=>{
   const api={'/api/session':{token:'test-token'},'/api/styles':[],'/api/geo-packs':[],
   '/api/admin1/status':{installed:false},'/api/cities/status':{installed:false},
   '/api/geodata/verify':{global_offline_ready:false,datasets:[]}};
   if(api[u]!==undefined)return new Response(JSON.stringify(api[u]));
   if(u.startsWith('/assets/')&&data[u.slice(8)])return new Response(JSON.stringify(data[u.slice(8)]));
   if(opts.method==='POST')return new Response('{"ok":true}');throw Error('Unhandled '+u);
 };}''',data)
 page.add_script_tag(content=browser_bundle(ASSETS))
 page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
 selector=page.locator('#sceneLookCategory')
 total=page.locator('#presets [data-style]').count()
 assert total==36,total
 counts={}
 families=['Paper / Parchment','Engraved / Printed','Terrain / Relief','Ocean / Nautical','Documentary / Tactical','Dark / Cinematic']
 for family in families:
  selector.select_option(family)
  cards=page.locator('#presets [data-style]:not([hidden])')
  count=cards.count();assert count>0,(family,count)
  assert all(x==family for x in cards.evaluate_all("xs=>xs.map(x=>x.dataset.lookFamily)")),family
  counts[family]=count
 assert sum(counts.values())==36,counts
 selector.select_option('all')
 page.locator('#presets [data-style="alpine-survey"]').click()
 assert page.evaluate('CartoRig.scene.theme.id')=='alpine-survey'
 page.locator('#style14ModeCustomize').click()
 page.locator('.style14-group > summary',has_text='SURFACES & MATERIALS').click()
 page.locator('.style14-group > summary',has_text='RELIEF ART DIRECTION').click()
 land=page.locator('[data-theme-field="land_material"]')
 land.select_option('paper_aged')
 assert page.evaluate('CartoRig.scene.theme.overrides.land_material')=='paper_aged'
 page.locator('#undo').click()
 assert page.evaluate('CartoRig.scene.theme.overrides.land_material') is None
 strength=page.locator('[data-theme-field="relief_strength"]')
 strength.fill('0.6');strength.dispatch_event('change')
 assert page.evaluate('CartoRig.scene.theme.overrides.relief_strength')==.6
 assert not errors,errors
 print('PASS Scene Looks 2.0: all 36 family filters, visible material controls, persistent selected look, Undo, relief slider',counts)
 browser.close()
