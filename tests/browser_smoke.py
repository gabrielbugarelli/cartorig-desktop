"""Browser integration test without live navigation (restricted Chromium environment)."""
from playwright.sync_api import sync_playwright
import json,sys,re,zipfile
from pathlib import Path
from PIL import Image
assets=Path(__file__).resolve().parents[1]/'assets';out=Path(__file__).resolve().parent
html=(assets/'index.html').read_text();html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',html)
from module_loader import browser_bundle
js=browser_bundle(assets if 'assets' in globals() else root/'assets')

data=json.loads((assets/'countries.json').read_text()); br_states=json.loads((assets/'geodata/br_states.geojson').read_text()); cities=json.loads((assets/'geodata/cities_world.geojson').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1600,'height':950},accept_downloads=True)
 page=c.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
 # Stub only network fetch, preserving Canvas, DOM, pointer and download execution.
 page.evaluate('''(datasets)=>{let countries=datasets.countries;let br_states=datasets.br_states;let cities=datasets.cities;window.__exportCalls=[];window.fetch=async(url,opts)=>{
 if(url==='/api/session')return new Response(JSON.stringify({token:'test-session'}),{status:200});
 if(url==='/assets/countries.json')return new Response(JSON.stringify(countries),{status:200});
 if(url==='/api/cities/status')return new Response(JSON.stringify({installed:false}),{status:200});
 if(url==='/api/cities/install')return new Response('Offline fixture',{status:503});
 if(url==='/assets/geodata/cities_world.geojson')return new Response(JSON.stringify(cities),{status:200});
 if(url==='/assets/geodata/br_states.geojson')return new Response(JSON.stringify(br_states),{status:200});
 if(url==='/api/scene-bundle'){let files=[...opts.body.entries()].map(([k,v])=>({key:k,name:v.name||'',size:v.size||0}));window.__exportCalls.push(files);return new Response(new Blob(['stub zip'],{type:'application/zip'}),{status:200});}
 if(url==='/api/quit')return new Response('{}',{status:200});
 throw Error('Network unsupported '+url);
 };}''',{'countries':data,'br_states':br_states,'cities':cities})
 page.add_script_tag(content=js)
 page.wait_for_function('window.CartoRig?.ready===true')
 print('loaded countries',page.evaluate('CartoRig.countryCount'))
 page.screenshot(path=str(out/'m1-editor.png'))
 page.locator('#tabGeography').click();page.locator('#countrySearch').fill('Brasil')
 page.locator('.country-result').first.wait_for(state='visible')
 page.locator('.country-result button[title="Add independent Region"]').first.click()
 page.locator('#tabGeography').click();page.locator('#countrySearch').fill('Brasil')
 page.locator('.country-result button[title="Add independent Region"]').first.click()
 ids=page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Region').map(x=>x.id)")
 print('region ids',ids);assert len(ids)==2 and ids[0]!=ids[1]
 page.locator('#tabLayers').click()
 page.locator('.tree-row[data-id="'+ids[0]+'"] .node-name').click()
 page.locator('#inspector label').filter(has_text='Fill color').locator('input').fill('#35dd44')
 colors=page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Region').map(x=>x.style.fill_color)")
 print('colors',colors);assert colors[0]!=colors[1]
 page.locator('#duplicate').click()
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Region').length")==3
 page.locator('#undo').click();assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Region').length")==2
 page.locator('#redo').click();assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Region').length")==3
 page.locator('#undo').click()
 page.locator('.tree-row[data-id="'+ids[0]+'"] .node-name').click()
 page.locator('.tree-row[data-id="'+ids[1]+'"] .node-name').click(modifiers=['Control'])
 assert len(page.evaluate('CartoRig.selection'))==2
 page.locator('#group').click()
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Group').length")==1
 page.locator('#undo').click();assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Group').length")==0
 page.locator('#redo').click()
 with page.expect_download() as result:page.locator('#saveProject').click()
 savepath=out/'m1-saved.cartorig';result.value.save_as(savepath)
 exported=json.loads(savepath.read_text());assert exported['schema_version']=='2.0.0';assert len(exported['objects'])>=5
 with page.expect_file_chooser() as chooser:page.locator('#openProject').click()
 chooser.value.set_files(str(savepath));page.wait_for_timeout(200)
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Group').length")==1
 print('round trip OK')
 page.locator('#tabStyles').click();page.locator('#resolution').select_option('1920x1080')
 with page.expect_download(timeout=60000) as result: page.locator('#exportImage').click()
 png=out/'m1-final.png';result.value.save_as(png)
 import struct
 assert png.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n';print('png',struct.unpack('>II',png.read_bytes()[16:24]))
 with page.expect_download(timeout=120000) as result:page.locator('#exportLayers').click()
 zpath=out/'m1-layered-placeholder.zip';result.value.save_as(zpath)
 exportedFiles=page.evaluate('window.__exportCalls.at(-1)')
 print('layer export files',[(x['key'],x['name']) for x in exportedFiles]);assert sum(1 for x in exportedFiles if x['key']=='layer')>=5
 page.locator('#tabInspector').click();page.screenshot(path=str(out/'m1-with-group.png'))
 v1={'version':1,'name':'Legacy test','style':'dark','view':{'cx':10,'cy':15,'zoom':1},'highlights':[{'iso':'BRA','color':'#ff2211'}], 'labels':[{'text':'Hello','point':[-47,-15],'size':28}], 'routes':[{'from':[-47,-15],'to':[-58,-34],'color':'#ffdd00'}], 'layers':{'background':True,'borders':True,'grid':True,'highlights':True,'routes':True,'labels':True},'resolution':'1920x1080','transparent':False}
 legacy=out/'v1.mapcomposer.json';legacy.write_text(json.dumps(v1))
 with page.expect_file_chooser() as chooser:page.locator('#openProject').click()
 chooser.value.set_files(str(legacy));page.wait_for_timeout(200)
 assert page.evaluate("CartoRig.scene.name")=='Legacy test'
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Region').length")==1
 print('migration OK')
 page.evaluate("for(let i=0;i<100;i++)CartoRig.execute({type:'SetProjectName',name:'100th test '+i})")
 assert page.evaluate('CartoRig.history.undo')>=100
 print('100 command history OK')
 print('JS errors:',errs)
 if errs:sys.exit(1)
 b.close()
