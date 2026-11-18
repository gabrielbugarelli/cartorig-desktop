"""Browser E2E: File owns GeoJSON and map styles; Geography and Looks stay uncluttered."""
from pathlib import Path
import base64,json,re,sys,tempfile
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
BASE=Path(__file__).resolve().parents[1];A=BASE/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(A/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={x:json.loads((A/x).read_text()) for x in paths}
with tempfile.TemporaryDirectory() as temp,sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1600,'height':900},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept('Demo Style'))
 page.set_default_timeout(10000)
 page.set_content(html)
 page.add_style_tag(content=(A/'style.css').read_text());page.add_style_tag(content=(A/'ux-layout.css').read_text())
 page.evaluate('''data=>{window.__packs=[];window.__styles=[];window.fetch=async (url,opts={})=>{
  const endpoints={'/api/session':{token:'r2-ui'},'/api/v2/recovery':[], '/api/admin1/status':{installed:false},'/api/cities/status':{installed:false}};
  if(endpoints[url]!==undefined)return new Response(JSON.stringify(endpoints[url]));
  if(url==='/api/geo-packs'){
   if(opts.method==='POST'){window.__packs.push(JSON.parse(opts.body));return new Response(JSON.stringify({id:'geopack-aabbccddeeff'}));}
   return new Response(JSON.stringify([]));
  }
  if(url==='/api/styles'){
   if(opts.method==='POST'){window.__styles=JSON.parse(opts.body);return new Response('{"ok":true}');}
   return new Response(JSON.stringify(window.__styles));
  }
  if(url.startsWith('/assets/')&&data[url.slice(8)]!==undefined)return new Response(JSON.stringify(data[url.slice(8)]));
  if(url==='/api/v2/project/recent'||url==='/api/v2/project/templates')return new Response('[]');
  if(opts.method==='POST')return new Response('{"ok":true}');
  throw Error('Unexpected '+url);
 };}''',data)
 page.add_script_tag(content=browser_bundle(A))
 page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
 assert page.locator('#panelGeography strong',has_text='RESULTS').count()==0
 assert page.locator('#geoImportPanel').count()==0
 assert page.locator('#panelGeography #importDataset').count()==0
 assert page.locator('#panelStyles .style14-library').count()==0
 assert page.locator('#panelStyles summary',has_text='About these looks').count()==0
 assert page.locator('#style14GalleryView .ux-help').count()==0
 assert page.locator('#presets [data-style]').count()==36
 # No empty information box on initial load.
 page.locator('#tabGeography').click()
 assert page.locator('#countryResults').inner_text().strip()==''
 assert not page.locator('#countryResults').is_visible()
 # Filtering and actual geographic result selection remain operational.
 page.locator('#countrySearch').fill('Brazil')
 page.wait_for_timeout(500)
 assert page.locator('#countryResults .country-result').count()>=1
 assert page.locator('#resultCount').get_attribute('aria-live')=='polite'
 page.locator('#countrySearch').fill('this-is-not-a-place-at-all-9281')
 page.wait_for_timeout(500)
 assert page.locator('#countryResults').inner_text().strip()=='No matches'
 page.locator('#countrySearch').fill('');page.wait_for_timeout(250)
 assert not page.locator('#countryResults').is_visible()
 # Import GeoJSON is only reachable from File, with all geometry kinds retained.
 page.locator('#fileMenu > summary').click();page.locator('#fileImportGeoJSON').click()
 assert page.locator('#geoImportDialog').is_visible()
 assert not page.locator('#fileMenu').evaluate('(e)=>e.open')
 assert page.locator('#datasetType option').count()==7
 page.locator('#datasetType').select_option('Lake')
 assert page.locator('#datasetType').input_value()=='Lake'
 with page.expect_file_chooser() as chooser:page.locator('#importDataset').click()
 geo_file=Path(temp)/'test_lakes.geojson'
 geo_file.write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'Test Lake'},'geometry':{'type':'Polygon','coordinates':[[[0,0],[1,0],[1,1],[0,0]]]}}]}))
 chooser.value.set_files(str(geo_file));page.wait_for_timeout(450)
 assert page.evaluate('window.__packs.length')==1
 assert page.evaluate('window.__packs[0].kind')=='Lake'
 page.keyboard.press('Escape');assert not page.locator('#geoImportDialog').is_visible()
 assert page.evaluate('document.activeElement?.id')=='fileMenu' or page.evaluate('document.activeElement?.tagName')=='SUMMARY'
 # The File menu owns all style file actions and library item management.
 page.locator('#fileMenu > summary').click();page.locator('#fileMapStyles').click()
 assert page.locator('#mapStylesDialog').is_visible()
 assert page.locator('#mapStylesDialog #style14Save').is_visible()
 assert page.locator('#mapStylesDialog #style14Import').is_visible()
 page.locator('#mapStylesDialog #style14Save').click()
 assert page.evaluate('CartoRig.scene.style_library.length')==1
 assert page.locator('#mapStylesDialog .style14-library-row').count()==1
 with page.expect_download() as d:page.locator('#mapStylesDialog .style14-library-actions button',has_text='Export').first.click()
 stylefile=Path(temp)/'demo.cartorigstyle';d.value.save_as(stylefile)
 assert json.loads(stylefile.read_text())['format']=='cartorig-style'
 with page.expect_file_chooser() as c:page.locator('#mapStylesDialog #style14Import').click()
 c.value.set_files(str(stylefile));page.wait_for_timeout(200)
 assert page.evaluate('CartoRig.scene.style_library.length')==2
 page.locator('#undo').click(force=True) if False else page.evaluate('CartoRig.execute({type:"DeleteUserStyle",id:CartoRig.scene.style_library[1].id})')
 assert page.evaluate('CartoRig.scene.style_library.length')==1
 page.locator('#mapStylesDialog .style14-library-actions button',has_text='Duplicate').first.click()
 assert page.evaluate('CartoRig.scene.style_library.length')==2
 page.locator('#mapStylesClose').click()
 assert not page.locator('#mapStylesDialog').is_visible()
 # Custom look selection is available through the library dialog, no need for Looking panel.
 page.locator('#tabStyles').click();assert page.locator('#presets [data-style]').count()==36
 assert page.locator('#style14ModeCustomize').is_visible()
 (BASE/'dist/tests').mkdir(parents=True,exist_ok=True)
 mapping={x.stem:'data:image/png;base64,'+base64.b64encode(x.read_bytes()).decode('ascii') for x in (A/'look-previews').glob('*.png')}
 page.evaluate('''mapping=>{for(const img of document.querySelectorAll('#presets img[data-native-look]'))if(mapping[img.dataset.nativeLook])img.src=mapping[img.dataset.nativeLook];document.querySelector('#toast').hidden=true;}''',mapping)
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Polish-R2-Looks.png'))
 page.locator('#tabGeography').click();page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Polish-R2-Geography.png'))
 page.locator('#fileMenu > summary').click();page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Polish-R2-File.png'))
 page.locator('#fileMapStyles').click();page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UI-Polish-R2-Map-Styles.png'))
 page.locator('#mapStylesClose').click()
 for w in [390,550,790,1100,1600]:
  page.set_viewport_size({'width':w,'height':780})
  # File menu/dialog remains reachable even when compact sidebars collapse.
  page.locator('#fileMenu > summary').click();page.locator('#fileImportGeoJSON').click()
  assert page.locator('#geoImportDialog').is_visible(),w
  assert page.locator('#datasetType').is_visible(),w
  page.keyboard.press('Escape');assert not page.locator('#geoImportDialog').is_visible(),w
 assert not errors,errors
 print('PASS UI polish R2: no RESULTS/about/card, 36 looks, File GeoJSON persisted, styles save/import/export/duplicate, dialogs & compact',flush=True)
 b.close()
