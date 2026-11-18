"""Browser smoke test of all bundled 27 state geometries (network blocked: scripted fetch)."""
import json, re, os
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('CARTORIG_TEST_OUTPUT',root/'tests'))
out.mkdir(parents=True,exist_ok=True)
html=(root/'assets/index.html').read_text()
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',html)
files=('scene-core.js','geo-catalog.js','scene-renderer.js','app.js')
from module_loader import browser_bundle
js=browser_bundle(assets if 'assets' in globals() else root/'assets')

data={f:json.loads((root/'assets'/f).read_text()) for f in ('countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson')}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=b.new_context(viewport={'width':1650,'height':950},accept_downloads=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content(html);page.add_style_tag(content=(root/'assets/style.css').read_text())
 page.evaluate('''(datasets)=>{window.fetch=async(url,opts)=>{
   if(url==='/api/v2/project/save'){window._lastProductionSaved=JSON.parse(opts.body);return new Response(JSON.stringify({project_id:window._lastProductionSaved.project_id,ok:true}));}
 if(url==='/api/v2/project/open')return new Response(new TextDecoder().decode(opts.body),{headers:{'Content-Type':'application/json'}});
 if(url==='/api/v2/recovery')return new Response('[]');
 if(url==='/api/v2/autosave')return new Response('{"ok":true}');
 if(url==='/api/session')return new Response(JSON.stringify({token:'test-token'}),{status:200});
   if(url==='/api/cities/status')return new Response(JSON.stringify({installed:false}),{status:200});
   if(url==='/api/cities/install')return new Response('Offline fixture',{status:503});
   if(url==='/api/geo-packs')return new Response('[]',{status:200});
   if(url.startsWith('/assets/')){let data=datasets[url.slice(8)];if(data)return new Response(JSON.stringify(data),{status:200});}
   throw Error('unavailable test URL '+url);
 };}''',data)
 page.add_script_tag(content=js)
 page.wait_for_function('window.CartoRig?.geoDatasets?.some(d=>d.type==="State" && d.count===27)',timeout=30000)
 datasets=page.evaluate('CartoRig.geoDatasets')
 print('Bundled datasets:',datasets)
 assert sum(int(d['count']) for d in datasets if d['type']=='State')>=27
 page.locator('#tabGeography').click();page.locator('#geoType').select_option('State');page.locator('#countrySearch').fill('Mato Grosso')
 page.wait_for_timeout(250)
 rows=page.locator('.geo-result')
 assert rows.count()==2,rows.count()
 row=rows.filter(has_text='Mato Grosso').first
 assert 'Polygon' in row.inner_text() and 'unavailable' not in row.inner_text().lower()
 row.locator('button[title="Add independent Region"]').click()
 regions=page.evaluate('Object.values(CartoRig.scene.objects).filter(o=>o.type==="Region" && o.region_kind==="State")')
 assert len(regions)==1 and regions[0]['embedded_geometry']['coordinates']
 print('Created state layer:',regions[0]['name'],regions[0]['source'])
 page.locator('#tabGeography').click();page.locator('#countrySearch').fill('Distrito Federal')
 page.locator('.geo-result button[title="Add independent Region"]').click()
 regions=page.evaluate('Object.values(CartoRig.scene.objects).filter(o=>o.type==="Region" && o.region_kind==="State")')
 assert len(regions)==2
 page.locator('#tabStyles').click();page.locator('#showBrazilStates').check()
 assert page.evaluate('CartoRig.scene.theme.overrides.show_state_boundaries') is True
 page.locator('#resolution').select_option('1920x1080')
 page.locator('#tabLayers').click()
 page.locator('.tree-row[data-id="'+regions[0]['id']+'"] .node-name').click()
 page.locator('#focusSelected').click()
 page.screenshot(path=str(out/'CartoRig-1.2.1-State-Editor.png'))
 with page.expect_download(timeout=90000) as handle:page.locator('#exportImage').click()
 png=out/'CartoRig-1.2.1-Brazil-States.png';handle.value.save_as(png)
 image=Image.open(png);assert image.size==(1920,1080)
 print('Exported PNG:',image.size,round(png.stat().st_size/1024),'KB')
 page.locator('#saveProject').click()
 page.wait_for_function('Boolean(window._lastProductionSaved)')
 project=out/'CartoRig-1.2.1-States-Example.cartorig'
 project.write_text(json.dumps(page.evaluate('window._lastProductionSaved')),encoding='utf-8')
 doc=json.loads(project.read_text());assert sum(o.get('region_kind')=='State' for o in doc['objects'].values())==2
 with page.expect_file_chooser() as handle:page.locator('#openProject').click()
 handle.value.set_files(str(project));page.wait_for_timeout(180)
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(o=>o.region_kind==='State').length")==2
 print('Saved and reopened independent state layers')
 print('Browser errors:',errors)
 assert not errors,errors
 b.close()
