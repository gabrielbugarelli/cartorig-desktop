"""Production export regression for name overlays: PNG, layered ZIP and SVG."""
from pathlib import Path
import json,re,sys
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
BASE=Path(__file__).resolve().parents[1]; A=BASE/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(A/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson','geodata/map_labels.json']
data={x:json.loads((A/x).read_text()) for x in paths}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1450,'height':900},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.set_default_timeout(15000)
 page.set_content(html);page.add_style_tag(content=(A/'style.css').read_text());page.add_style_tag(content=(A/'ux-layout.css').read_text())
 page.evaluate('''data=>{
 window.__entries=[];
 window.fetch=async(url,opts={})=>{
  const fixed={'/api/session':{token:'map-label-production'},'/api/styles':[],'/api/geo-packs':[],'/api/v2/recovery':[],'/api/admin1/status':{installed:false},'/api/cities/status':{installed:false}};
  if(fixed[url]!==undefined)return new Response(JSON.stringify(fixed[url]));
  if(url.startsWith('/assets/')&&data[url.slice(8)])return new Response(JSON.stringify(data[url.slice(8)]));
  if(url==='/api/v2/export/session'&&opts.method==='POST')return new Response('{"id":"label-export-qa"}');
  if(url.includes('/api/v2/export/session/label-export-qa/entry?')){
   const payload=opts.body;
   window.__entries.push({name:new URL('https://local.test'+url).searchParams.get('name'),size:payload.size,text:payload.type==='image/svg+xml'?await payload.text():null});
   return new Response('{}');
  }
  if(url.includes('/api/v2/export/session/label-export-qa/finish'))return new Response('{}');
  if(url.includes('/api/v2/export/session/label-export-qa'))return new Response('{}');
  if(url.includes('/api/v2/export/download/label-export-qa'))return new Response(new Blob(['test ZIP']));
  if(url==='/api/v2/project/recent'||url==='/api/v2/project/templates')return new Response('[]');
  if(opts.method==='POST')return new Response('{}');
  throw Error('Unexpected '+url);
 };}''',data)
 page.add_script_tag(content=browser_bundle(A));page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
 page.locator('#openProduction').click();page.locator('#prodResolution').select_option('1920x1080')
 page.locator('#prodFormat').select_option('svg');page.locator('#prodRun').click()
 page.wait_for_function('window.__entries.some(e=>e.name==="scene.svg")',timeout=45000)
 txt=page.evaluate('window.__entries.find(e=>e.name==="scene.svg").text')
 assert '<text data-map-label="countries"' in txt
 assert 'UNITED STATES OF AMERICA' in txt or 'CANADA' in txt
 assert not errors,errors
 page.evaluate('window.__entries=[]')
 page.locator('#prodFormat').select_option('png');page.locator('#prodRun').click()
 page.wait_for_function('window.__entries.some(e=>e.name==="final.png")',timeout=45000)
 size=page.evaluate('window.__entries.find(e=>e.name==="final.png").size')
 assert size>20000,size
 page.evaluate('window.__entries=[]')
 page.locator('#prodFormat').select_option('layered');page.locator('#prodRun').click()
 page.wait_for_function('window.__entries.some(e=>e.name==="Map_Labels.png")',timeout=45000)
 page.wait_for_function('window.__entries.some(e=>e.name==="final.png")',timeout=45000)
 assert page.evaluate('window.__entries.find(e=>e.name==="Map_Labels.png").size')>1000
 assert not errors,errors
 b.close()
print('PASS 2.0.3 export: SVG vector names, production PNG and standalone Map_Labels.png')
