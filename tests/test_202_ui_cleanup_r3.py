"""R3 UX audit: no persistent explanatory cards, all important actions remain reachable."""
from pathlib import Path
import json, re, sys, base64
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
BASE=Path(__file__).resolve().parents[1]; A=BASE/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(A/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((A/f).read_text()) for f in paths}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1600,'height':920},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e: errors.append(str(e))); page.set_default_timeout(12000)
 page.on('dialog',lambda d:d.accept())
 page.set_content(html);page.add_style_tag(content=(A/'style.css').read_text());page.add_style_tag(content=(A/'ux-layout.css').read_text())
 page.evaluate('''data=>{window.__saves=[];window.fetch=async(u,opts={})=>{
  const endpoints={'/api/session':{token:'r3-test'},'/api/styles':[],'/api/geo-packs':[],'/api/v2/recovery':[],'/api/admin1/status':{installed:false},'/api/cities/status':{installed:false}};
  if(endpoints[u]!==undefined)return new Response(JSON.stringify(endpoints[u]));
  if(u==='/api/v2/project/save'){window.__saves.push(JSON.parse(opts.body));return new Response('{"project_id":"demo-r3"}');}
  if(u==='/api/v2/project/download/demo-r3')return new Response(new Blob(['PK-zip'],{type:'application/octet-stream'}));
  if(u.startsWith('/assets/')&&data[u.slice(8)]!==undefined)return new Response(JSON.stringify(data[u.slice(8)]));
  if(u==='/api/v2/project/recent'||u==='/api/v2/project/templates')return new Response('[]');
  if(opts.method==='POST')return new Response('{"id":"ok"}');
  throw Error('Unknown URL '+u);
 };}''',data)
 page.add_script_tag(content=browser_bundle(A));page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
 (BASE/'dist/tests').mkdir(parents=True,exist_ok=True)
 builtin={x.stem:'data:image/png;base64,'+base64.b64encode(x.read_bytes()).decode('ascii') for x in (A/'look-previews').glob('*.png')}
 page.evaluate("m=>{for(const img of document.querySelectorAll('#presets img[data-native-look]'))if(m[img.dataset.nativeLook])img.src=m[img.dataset.nativeLook];}",builtin)
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Cleanup-R3-Launch.png'))
 page.locator('#style14ModeCustomize').click()
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Cleanup-R3-Global-Settings.png'))
 page.locator('#style14ModeChoose').click()
 # Permanent clutter removed
 for text in ['Layer shortcuts','SCENE EXPLORER','PROPERTIES','WGS84 / Equirectangular','Click objects to select','About these looks','Edit properties below','Export check']:
  assert text not in page.locator('body').inner_text(),text
 assert page.locator('#projectName').count()==1
 assert page.locator('#stageName').count()==0
 assert page.locator('#group,#focusSelected').count()==0
 assert page.locator('#newGroup,#centerView,#saveAsProject').count()==3
 assert page.locator('#toolHint,.canvas-corner').count()==0
 assert page.locator('#presets [data-style]').count()==36
 assert not page.locator('#geoPhysicalGroup').is_visible()
 # Project name editable via canvas header, with undo support
 page.locator('#projectName').fill('CartoRig R3 QA');page.locator('#projectName').press('Tab')
 assert page.evaluate('CartoRig.scene.name')=='CartoRig R3 QA'
 page.locator('#undo').click();assert page.evaluate('CartoRig.scene.name')!='CartoRig R3 QA'
 page.locator('#redo').click();assert page.evaluate('CartoRig.scene.name')=='CartoRig R3 QA'
 # New group is a single control for empty group or grouped selection.
 before=page.locator('#layerTree .tree-row').count()
 page.locator('#newGroup').click()
 assert page.locator('#layerTree .tree-row').count()==before+1
 assert page.evaluate('Object.values(CartoRig.scene.objects).some(x=>x.type==="Group"&&x.name==="New Group")')
 page.locator('#layerTree .tree-row',has_text='New Group').click()
 assert page.locator('#tabInspector').get_attribute('aria-selected')=='true'
 assert page.locator('#inspector .ux-inspector-metadata').count()==1
 assert not page.locator('#inspector .ux-inspector-metadata').evaluate('(x)=>x.open')
 assert page.locator('#inspector .ux-inspector-metadata small').is_hidden()
 page.locator('#inspector .ux-inspector-metadata > summary').click()
 assert page.locator('#inspector .ux-inspector-metadata small').is_visible()
 # Region with canonical dataset source and working metadata/replacement.
 regionid=page.evaluate('''() => {const id='20220202-3333-4333-8333-222222222222';return CartoRig.execute({type:'CreateObject',object:{id,type:'Region',name:'Brazil R3 QA',region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:'BRA'},visible:true,locked:false,opacity:1,style:{fill_color:'#cc5500',fill_opacity:1}}})?id:null;}''')
 assert regionid
 page.locator('#layerTree .tree-row',has_text='Brazil R3 QA').click()
 assert page.locator('#inspector .ux-inspector-replace').count()==1
 assert not page.locator('#inspector .ux-inspector-replace').evaluate('(x)=>x.open')
 assert page.locator('#inspector .ux-inspector-metadata').count()>=2
 assert page.locator('#inspector .style14-inspector-actions button').count()==2
 page.locator('#inspector .style14-inspector-actions button').first.click()
 assert page.evaluate('id=>CartoRig.scene.objects[id].style.glow_enabled',regionid)
 page.locator('#undo').click()
 assert not page.evaluate('id=>CartoRig.scene.objects[id].style.glow_enabled',regionid)
 page.locator('#inspector .ux-inspector-replace > summary').click()
 assert page.locator('#inspector .ux-inspector-replace input').is_visible()
 page.locator('#centerView').click()
 # Hidden diagnostic detail exists but is opt-in.
 page.locator('#openProduction').click()
 assert page.locator('#productionExport').is_visible()
 assert not page.locator('#prodPreflight').is_visible()
 assert not page.locator('#prodDiagnostics').evaluate('(x)=>x.open')
 assert page.locator('#prodDetailText').is_hidden()
 assert page.locator('#prodFormat option[value=project]').count()==0
 assert page.locator('#prodGranularity').is_visible()
 page.locator('#prodFormat').select_option('svg')
 assert 'Raster Scene Looks' in page.locator('#prodPreflight').inner_text()
 assert page.locator('#prodGranularity').is_hidden()
 page.locator('#prodFormat').select_option('png')
 assert page.locator('#prodPreflight').is_hidden()
 page.locator('#prodDiagnostics summary').click()
 assert page.locator('#prodDetailText').is_visible()
 page.keyboard.press('Escape');assert not page.locator('#productionExport').is_visible()
 # Portable project package is available from File, not Export Studio.
 page.locator('#fileMenu>summary').click()
 with page.expect_download() as d:page.locator('#saveAsProject').click()
 assert d.value.suggested_filename.endswith('.cartorig')
 assert page.evaluate('window.__saves.length')==1
 # Map display combines the active texture and state-boundary toggles.
 # Unavailable physical datasets are retained internally, not shown as controls.
 page.locator('#tabStyles').click();page.locator('#style14ModeCustomize').click()
 assert page.locator('#uxMapBoundaries').count()==1
 assert page.locator('#uxMapDisplayTitle').inner_text()=='MAP DISPLAY'
 assert page.locator('#sceneTexturesEnabled').is_visible()
 assert page.locator('#showBrazilStates').is_visible()
 assert page.locator('#geoPhysicalGroup').is_hidden()
 # Graphic references from actual app, not generated mockup.
 mapping={x.stem:'data:image/png;base64,'+base64.b64encode(x.read_bytes()).decode('ascii') for x in (A/'look-previews').glob('*.png')}
 page.evaluate('''m=>{for(const img of document.querySelectorAll('#presets img[data-native-look]'))if(m[img.dataset.nativeLook])img.src=m[img.dataset.nativeLook];document.querySelector('#toast').hidden=true;}''',mapping)
 (BASE/'dist/tests').mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Cleanup-R3-Desktop.png'))
 # Compact drawers must remain reachable after removing cards.
 for w in [1100,790,550,390]:
  page.set_viewport_size({'width':w,'height':780})
  page.evaluate('CartoRigNavigation.setRight(false);CartoRigNavigation.setLeft(false)')
  page.locator('#toggleInspector').click();assert page.locator('#rightSidebar').is_visible(),w
  page.locator('#toggleInspector').click();assert not page.locator('#rightSidebar').is_visible(),w
  page.locator('#toggleScene').click();assert page.locator('.sidebar.left').is_visible(),w
  page.locator('#toggleScene').click();assert not page.locator('.sidebar.left').is_visible(),w
  if w==390:page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Cleanup-R3-Compact.png'))
 assert not errors,errors
 print('PASS R3: minimal UI, project name+history, group+region tools, metadados, conditional geography, export validation, File Save As, 36 looks, responsiveness',flush=True)
 b.close()
