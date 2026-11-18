"""CartoRig 1.2.3 Chromium functional test; Admin1 world polygons are SYNTHETIC fixtures.
Bundled city coordinates and Brazilian subdivisions are from real source files.
"""
import json, re, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
root=Path(__file__).resolve().parents[1]
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(root/'assets/index.html').read_text())
from module_loader import browser_bundle
js=browser_bundle(assets if 'assets' in globals() else root/'assets')

files=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((root/'assets'/f).read_text()) for f in files}
features=[]
for i in range(3500):
 if i==0:name='Bayern';english='Bavaria';country='Germany';x,y=11.3,49
 elif i==1:name='Ontario';english=name;country='Canada';x,y=-86,50
 elif i==2:name='Québec';english='Quebec';country='Canada';x,y=-73,48
 elif i==3:name='California';english=name;country='United States of America';x,y=-120,36
 else:name=f'Test Geo {i}';english=name;country='Test Country '+str(i%165);x,y=((i%100)*3)-150,((i//100)%45)*2-75
 features.append({'type':'Feature','properties':{'name':name,'name_en':english,'admin':country,'iso_3166_2':'TEST-'+str(i),'ne_id':1000+i},'geometry':{'type':'Polygon','coordinates':[[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]}})
data['world']={'type':'FeatureCollection','features':features}
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1520,'height':980},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(root/'assets/style.css').read_text())
 page.evaluate('''(d)=>{window.fetch=async(url,opts)=>{
 if(url==='/api/v2/project/save'){window._lastProductionSaved=JSON.parse(opts.body);return new Response(JSON.stringify({project_id:window._lastProductionSaved.project_id,ok:true}));}
 if(url==='/api/v2/project/open')return new Response(new TextDecoder().decode(opts.body),{headers:{'Content-Type':'application/json'}});
 if(url==='/api/v2/recovery')return new Response('[]');
 if(url==='/api/v2/autosave')return new Response('{"ok":true}');
 if(url==='/api/session')return new Response(JSON.stringify({token:'test-token'}),{status:200});
 if(url==='/api/geo-packs')return new Response('[]',{status:200});
 if(url==='/api/admin1/status')return new Response(JSON.stringify({installed:true,source:'cached'}),{status:200});
 if(url==='/api/admin1/data')return new Response(JSON.stringify(d.world),{status:200});
 if(url==='/api/cities/status')return new Response(JSON.stringify({installed:false}),{status:200});
 if(url==='/api/cities/install')return new Response('Offline fixture: expanded city package intentionally unavailable',{status:503});
 if(url.startsWith('/assets/')){let value=d[url.slice(8)];if(value)return new Response(JSON.stringify(value),{status:200});}
 throw Error('unknown test URL '+url);
 };}''',data)
 page.add_script_tag(content=js)
 page.wait_for_function("CartoRig.geoDatasets.some(d=>d.count===3500)",timeout=30000)
 print('Loaded: 3500 synthetic worldwide Admin1 polygons plus bundled real cities',flush=True)
 page.locator('#tabGeography').click()
 for query,expected in [('Munique','Munique (München)'),('München','Munique (München)'),('Munich','Munique (München)'),('Baviera','Baviera (Bayern)'),('Bayern','Baviera (Bayern)'),('Bavaria','Baviera (Bayern)'),('Ontário','Ontário'),('Quebec','Quebec')]:
  page.locator('#countrySearch').fill(query)
  page.wait_for_timeout(250)
  assert page.locator('.geo-result').filter(has_text=expected).count()>=1,(query,page.locator('#countryResults').inner_text())
 print('Multilingual alias search: PASS',flush=True)
 page.locator('#countrySearch').fill('Munich')
 page.locator('.geo-result button[title="Add city marker"]').first.click()
 page.locator('#tabGeography').click()
 page.locator('#countrySearch').fill('Baviera')
 page.locator('.geo-result button[title="Add independent Region"]').first.click()
 page.locator('#tabGeography').click()
 page.locator('#countrySearch').fill('Mato Grosso')
 page.locator('.geo-result button[title="Add independent Region"]').first.click()
 objects=page.evaluate("Object.values(CartoRig.scene.objects).map(x=>({name:x.name,type:x.type,region_kind:x.region_kind,geometry:!!x.embedded_geometry}))")
 assert any(x['name']=='Munich' and x['type']=='Marker' for x in objects),objects
 assert any(x['name']=='Bavaria' and x['geometry'] for x in objects),objects
 assert any(x['name']=='Mato Grosso' and x['geometry'] for x in objects),objects
 print('City marker, international and Brazilian polygon layers: PASS',flush=True)
 page.locator('#tabLayers').click()
 page.locator('#tabStyles').click()
 page.locator('#resolution').select_option('1920x1080')
 with page.expect_download(timeout=60000) as d:page.locator('#exportImage').click()
 image=Path(tmp)/'scene.png';d.value.save_as(image)
 assert Image.open(image).size==(1920,1080)
 print('1920x1080 PNG export: PASS',flush=True)
 page.locator('#saveProject').click()
 page.wait_for_function('Boolean(window._lastProductionSaved)')
 project=Path(tmp)/'test.cartorig'
 project.write_text(json.dumps(page.evaluate('window._lastProductionSaved')),encoding='utf-8')
 saved=json.loads(project.read_text());assert sum(x.get('region_kind')=='State' for x in saved['objects'].values())==2
 with page.expect_file_chooser(timeout=30000) as fc:page.locator('#openProject').click()
 fc.value.set_files(str(project));page.wait_for_timeout(400)
 assert sum(x.get('region_kind')=='State' for x in page.evaluate('CartoRig.scene.objects').values())==2
 assert not errors,errors
 print('Save/reopen with embedded polygon geometry: PASS',flush=True)
 browser.close()
