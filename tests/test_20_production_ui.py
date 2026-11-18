"""M5 production UI: real Canvas, virtualized loopback API to avoid Chromium network policy."""
from pathlib import Path
import re,json,sys
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
A=Path(__file__).resolve().parents[1]/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(A/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={p:json.loads((A/p).read_text()) for p in paths}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(A/'style.css').read_text());page.add_style_tag(content=(A/'ux-layout.css').read_text())
 page.evaluate('''d=>{
  window.__records={requests:[],entries:[]};
  window.fetch=async(u,opts={})=>{
   if(u==='/api/session')return new Response('{"token":"test-token"}',{status:200});
   if(u==='/api/styles'||u==='/api/geo-packs'||u==='/api/v2/recovery')return new Response('[]',{status:200});
   if(u==='/api/admin1/status'||u==='/api/cities/status')return new Response('{"installed":false}',{status:200});
   if(u==='/api/admin1/install'||u==='/api/cities/install')return new Response('not available',{status:503});
   if(u==='/api/geodata/verify')return new Response('{"global_offline_ready":false,"datasets":[]}',{status:200});
   if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]),{status:200});
   const r=window.__records;
   if(u==='/api/v2/project/save'){let j=JSON.parse(opts.body);r.requests.push({type:'save',id:j.project_id});return new Response(JSON.stringify({ok:true,project_id:j.project_id,revision:j.revision}),{status:200})}
   if(u==='/api/v2/export/session'){let j=JSON.parse(opts.body);r.requests.push({type:'start',width:j.width,height:j.height});return new Response('{"id":"test-session"}',{status:201})}
   if(u.includes('/entry?')){r.entries.push({name:new URL('http://local'+u).searchParams.get('name'),bytes:opts.body.size});return new Response('{"ok":true}',{status:201})}
   if(u.endsWith('/finish')){r.requests.push({type:'finish'});return new Response('{"complete":true}',{status:200})}
   if(u.includes('/api/v2/export/download/')){r.requests.push({type:'download'});return new Response(new Blob(['zip'],{type:'application/zip'}),{status:200})}
   if(u.startsWith('/api/v2/export/session/')&&opts.method==='DELETE')return new Response('{"canceled":true}',{status:200});
   throw Error('Unexpected API: '+u);
  };
 }''',data)
 page.add_script_tag(content=browser_bundle(A))
 page.wait_for_function('window.CartoRig?.ready===true',timeout=25000)
 page.click('#saveProject');page.wait_for_function("window.__records.requests.some(x=>x.type==='save')",timeout=8000)
 page.click('#openProduction');assert page.locator('#productionExport').is_visible()
 (A.parent/'dist/tests').mkdir(parents=True,exist_ok=True);page.screenshot(path=str(A.parent/'dist/tests'/'CartoRig-2.0.1-Export-Studio.png'),full_page=False)
 page.select_option('#prodFormat','png');page.select_option('#prodResolution','1920x1080')
 page.click('#prodRun');page.wait_for_function("window.__records.requests.some(x=>x.type==='download')",timeout=25000)
 records=page.evaluate('window.__records');assert records['entries'][0]['name']=='final.png',records
 assert records['entries'][0]['bytes']>500,records
 assert records['requests'][-1]['type']=='download',records
 assert not errors,errors
 print('M5 UI browser: Save, Export Studio, preflight, Canvas PNG, incremental session, download: PASS',records)
 b.close()
