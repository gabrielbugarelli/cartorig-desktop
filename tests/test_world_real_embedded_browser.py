"""Real-source browser rendering test when Chromium localhost navigation is administratively blocked.

Uses the exact 4596/7342 official GeoJSON files. Only the HTTP fetch transport
is stubbed in Chromium, never the underlying geometry. Windows acceptance tests
must additionally execute test_world_real_e2e.py against the actual Windows Go server.
"""
from pathlib import Path
import io,json,re,gzip,base64
from zipfile import ZipFile
from playwright.sync_api import sync_playwright
from PIL import Image
root=Path(__file__).resolve().parents[1]
out=root/'dist'/'local-real-e2e';out.mkdir(exist_ok=True,parents=True)
assets=root/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
from module_loader import browser_bundle
js=browser_bundle(assets if 'assets' in globals() else root/'assets')

def bridge_data(filename,variable,expected,page):
    packed=base64.b64encode(gzip.compress((assets/'geodata'/filename).read_bytes(),compresslevel=1)).decode('ascii')
    n=page.evaluate('''async({data,name})=>{
      const gz=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
      const contents=await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      window[name]=JSON.parse(contents);return window[name].features.length;
    }''',{'data':packed,'name':variable})
    assert n==expected,(filename,n,expected)
    print('Real-world file transferred to Chromium:',filename,n,'features',flush=True)
manifest=json.loads((assets/'geodata/offline_integrity.json').read_text())
health={'product_version':'1.4.0','global_offline_ready':True,'datasets':[{'dataset_id':k,'dataset':v['dataset_id'],'installed':True,'source':'bundled','scale':'10m','sha256':v['sha256'],'feature_count':v['feature_count'],'integrity':'verified','distribution_complete':True,'source_url':v['source_url'],'source_version':v['git_blob_sha1']} for k,v in manifest['datasets'].items()]}
files={f:json.loads((assets/f).read_text()) for f in ['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1500,'height':950},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGEERROR',str(e),flush=True)));page.on('console',lambda m:print('CONSOLE',m.type,m.text[:160],flush=True) if m.type=='error' else None)
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
 bridge_data('admin1_world.geojson','__world_admin',4596,page)
 bridge_data('cities_world_full.geojson','__world_cities',7342,page)
 page.evaluate('''({files,health})=>{
 window.__fixtures=files;window.__health=health;
 window.fetch=async(u,opts)=>{
  if(u==='/api/session')return new Response(JSON.stringify({token:'test'}));
  if(u==='/api/geo-packs')return new Response('[]');
  if(u==='/api/admin1/status')return new Response(JSON.stringify(health.datasets[0]));
  if(u==='/api/cities/status')return new Response(JSON.stringify(health.datasets[1]));
  if(u==='/api/admin1/data')return new Response(JSON.stringify(window.__world_admin));
  if(u==='/api/cities/data')return new Response(JSON.stringify(window.__world_cities));
  if(u==='/api/geodata/verify')return new Response(JSON.stringify(health));
  if(u==='/api/scene-bundle'){window.__exportLayerForm=opts.body;return new Response(new Blob(['offline browser QA envelope'],{type:'application/zip'}),{status:200});}
  if(u.startsWith('/assets/')){let f=files[u.slice(8)];if(f)return new Response(JSON.stringify(f));}
  throw Error('unexpected browser HTTP request '+u);
 };
 }''',{'files':files,'health':health})
 print('JS injection',len(js),flush=True);page.add_script_tag(content=js);print('injected OK',flush=True)
 page.wait_for_function('''()=>CartoRig?.ready&&CartoRig.geoDatasets.some(d=>d.type==='State'&&d.count===4596)&&CartoRig.geoDatasets.some(d=>d.type==='City'&&d.count===7342)''',timeout=30000)
 print('Real data indexed successfully:',page.evaluate('CartoRig.geoDatasets'),flush=True)
 page.locator('#tabGeography').click()
 # Empty search must not render the old 160-result list or run a broad query.
 assert page.locator('.geo-result').count()==0
 assert 'Type a place' in page.locator('#countryResults').inner_text()
 page.screenshot(path=str(out/'CartoRig-Optimized-Empty-Search.png'))
 # Explicit browsing uses 20 results/page, preserving total and scroll position.
 page.locator('#geoType').select_option('City')
 assert page.locator('.geo-result').count()==20
 assert page.locator('.geo-more').count()==1
 page.locator('.geo-more').click()
 assert page.locator('.geo-result').count()==40
 assert '40 of' in page.locator('#resultCount').inner_text()
 page.locator('#geoType').select_option('All')
 assert page.locator('.geo-result').count()==0
 print('Empty search, filtered browsing and 20-row pagination: PASS',flush=True)
 for q,word,typ,country in [('Baviera','Baviera','State','Germany'),('Bayern','Baviera','State','Germany'),('Bavaria','Baviera','State','Germany'),('Munique','Munique','City','Germany'),('Munich','Munique','City','Germany'),('München','Munique','City','Germany'),('Ontario','Ontário','State','Canada'),('California','Califórnia','State','United States of America'),('Mato Grosso','Mato Grosso','State','Brazil')]:
  page.locator('#countrySearch').fill(q)
  result=page.locator('.geo-result').filter(has_text=typ).filter(has_text=country).first
  result.wait_for(state='visible')
  assert word in result.inner_text(),(q,result.inner_text())
  if q=='Baviera':page.screenshot(path=str(out/'CartoRig-Optimized-Baviera-Search.png'))
 print('Multilingual names and typed source parents: PASS',flush=True)
 for typ in ['State','City']:
  page.locator('#countrySearch').fill('São Paulo')
  page.locator('.geo-result').filter(has_text=typ).filter(has_text='Brazil').first.wait_for(state='visible')
 print('São Paulo state/city distinct: PASS',flush=True)
 for q,parent in [('Ontario','Canada'),('California','United States of America'),('Baviera','Germany'),('Mato Grosso','Brazil')]:
  page.locator('#countrySearch').fill(q)
  row=page.locator('.geo-result').filter(has_text='State').filter(has_text=parent).first
  row.locator('button[title="Fit location"]').click()
  assert 'framed' in page.locator('#status').inner_text()
  row.locator('button[title="Add independent Region"]').click()
  page.locator('#tabGeography').click()
 page.locator('#countrySearch').fill('Munique')
 page.locator('.geo-result').filter(has_text='City').filter(has_text='Germany').first.locator('button[title="Add city marker"]').click()
 ids=page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.region_kind==='State').map(x=>x.id)")
 assert len(ids)==4
 assert page.evaluate("ids=>ids.every(id=>CartoRig.scene.objects[id].embedded_geometry)",ids)
 before=page.evaluate("ids=>ids.map(id=>CartoRig.scene.objects[id].style.fill_color)",ids)
 assert page.evaluate("id=>CartoRig.execute({type:'SetProperty',id,path:'style.fill_color',value:'#33ee55'})",ids[0])
 colors=page.evaluate("ids=>ids.map(id=>CartoRig.scene.objects[id].style.fill_color)",ids)
 assert colors==['#33ee55',*before[1:]]
 print('Four independent polygon layers, fit and style independence: PASS',flush=True)
 page.locator('#worldView').click();page.locator('#tabStyles').click();page.locator('#transparent').check()
 page.locator('#resolution').select_option('1920x1080')
 with page.expect_download(timeout=150000) as d:page.locator('#exportImage').click()
 png=out/'cartorig-real-geodata-transparent.png';d.value.save_as(png)
 im=Image.open(png).convert('RGBA');assert im.size==(1920,1080)
 assert im.getchannel('A').getextrema()==(0,255)
 print('Real polygons rendered to transparent Full HD PNG: PASS',flush=True)
 with page.expect_download(timeout=180000) as d:page.locator('#saveProject').click()
 project=out/'CartoRig-Real-World-Project.cartorig';d.value.save_as(project)
 doc=json.loads(project.read_text());assert sum(1 for x in doc['objects'].values() if x.get('region_kind')=='State' and x.get('embedded_geometry'))==4
 with page.expect_file_chooser() as d:page.locator('#openProject').click()
 d.value.set_files(str(project));page.wait_for_timeout(300)
 assert page.evaluate("ids=>ids.every(id=>CartoRig.scene.objects[id].embedded_geometry)",ids)
 print('Reopened project with all four full-real geometries: PASS',flush=True)
 with page.expect_download(timeout=180000) as zipped:page.locator('#exportLayers').click()
 zipped.value.save_as(out/'layer-browser-QA-transport-stub.zip')
 diagnostics=page.evaluate('''async()=>{
  const list=[];
  for(const [kind,value] of window.__exportLayerForm.entries()){
   if(kind!=='layer'&&kind!=='final')continue;
   const bitmap=await createImageBitmap(value);
   const cv=document.createElement('canvas');cv.width=bitmap.width;cv.height=bitmap.height;
   const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
   const rgba=ctx.getImageData(0,0,cv.width,cv.height).data;
   let nonzero=0,empty=0;for(let i=3;i<rgba.length;i+=4){if(rgba[i])nonzero++;else empty++;}
   list.push({name:value.name,type:kind,width:cv.width,height:cv.height,nonzero,empty});
   cv.width=0;cv.height=0;
  }
  return list;
 }''')
 assert len(diagnostics)>=7,diagnostics
 assert all(d['width']==1920 and d['height']==1080 for d in diagnostics),diagnostics
 for expected in ['Ontario','California','Bavaria','Mato_Grosso']:
  assert any(expected in d['name'] and d['nonzero']>0 and d['empty']>0 for d in diagnostics),diagnostics
 print('True real-polygon PNG layer pixels and common 1920×1080 alignment: PASS',flush=True)
 (out/'layer-browser-pixel-check.json').write_text(json.dumps(diagnostics,indent=2))

 page.locator('#tabGeography').click();page.locator('#countrySearch').fill('Baviera');page.screenshot(path=str(out/'CartoRig-1.2.3-Real-Geodata-Interface.png'))
 assert not errors,errors
 browser.close()
print('REAL N.E. WORLD OFFLINE BROWSER TEST: PASS',flush=True)
