"""Focused UI/UX acceptance of CartoRig 2.0.2 revised composition hierarchy.
Actual app + real bundled geodata under offline Chromium virtual HTTP bridge.
"""
from pathlib import Path
import base64, json, re, sys
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
BASE=Path(__file__).resolve().parents[1]
A=BASE/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(A/'index.html').read_text())
data={x:json.loads((A/x).read_text()) for x in ['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1600,'height':920},accept_downloads=True)
 page.set_default_timeout(10000); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(A/'style.css').read_text());page.add_style_tag(content=(A/'ux-layout.css').read_text())
 page.evaluate('''data=>{
  window.fetch=async (url,opts={})=>{
   const endpoints={'/api/session':{token:'ux-revision'},'/api/styles':[], '/api/geo-packs':[], '/api/v2/recovery':[], '/api/admin1/status':{installed:false}, '/api/cities/status':{installed:false}};
   if(endpoints[url]!==undefined)return new Response(JSON.stringify(endpoints[url]));
   if(url.startsWith('/assets/')&&data[url.slice(8)]!==undefined)return new Response(JSON.stringify(data[url.slice(8)]));
   if(url==='/api/scene-bundle')return new Response(new Blob(['zip'],{type:'application/zip'}));
   if(url==='/api/v2/project/recent'||url==='/api/v2/project/templates')return new Response('[]');
   if(opts.method==='POST')return new Response('{"ok":true}',{status:200});
   throw Error('Unexpected API '+url);
  }
 }''',data)
 page.add_script_tag(content=browser_bundle(A))
 try: page.wait_for_function('window.CartoRig?.ready===true',timeout=12000)
 except Exception as e:
  print('STARTUP ERROR',errors,'READY?',page.evaluate('window.CartoRig?.ready'),flush=True)
  raise
 # The user-marked duplicated current look card is gone; 36 looks remain.
 assert page.locator('.ux-active-look').count()==0
 assert page.locator('#style14EditCurrent').count()==0
 assert page.locator('#presets [data-style]').count()==36
 assert page.locator('#style14GalleryView').is_visible()
 page.locator('#style14ModeCustomize').click()
 assert page.locator('#style14CustomizeView').is_visible()
 assert page.locator('#uxCanvasOptions').count()==0
 assert page.locator('#uxMapBoundaries').count()==1
 assert page.locator('#uxMapBoundaries').is_visible()
 summaries=page.locator('#style14CustomizeView .style14-group > summary').all_inner_texts()
 assert summaries[:4]==['BORDERS & GRID','LAND & OCEAN','ATMOSPHERE','DEFAULT TYPOGRAPHY'],summaries
 assert summaries.index('OBJECT TYPE DEFAULTS & EFFECTS')<summaries.index('SURFACES & MATERIALS')
 assert page.locator('.ux-settings-divider').first.inner_text()=='GLOBAL COMPOSITION'
 assert page.locator('#uxMapDisplayTitle').inner_text()=='MAP DISPLAY'
 assert page.locator('#sceneTexturesEnabled').is_visible()
 assert page.locator('#showBrazilStates').is_visible()
 page.locator('#showBrazilStates').check()
 assert page.evaluate('CartoRig.scene.theme.overrides.show_state_boundaries') is True
 page.locator('.style14-group > summary',has_text='BORDERS & GRID').click()
 inp=page.locator('[data-theme-field="border_width"]');assert inp.is_visible()
 inp.fill('2.5');inp.press('Tab')
 assert page.evaluate('CartoRig.scene.theme.overrides.border_width')==2.5
 page.locator('#style14ModeChoose').click()
 page.locator('#presets [data-style="atlas"]').click()
 assert page.evaluate('CartoRig.scene.theme.id')=='atlas'
 assert page.locator('#presets [data-style="atlas"]').get_attribute('aria-pressed')=='true'
 # Diagnostic clutter is completely removed; GeoJSON import is accessible.
 page.locator('#tabGeography').click()
 for selector in ['#geoDiagnosticsPanel','#geoDiagnostics','#verifyGeoData','#datasetStatus','#geoStatusOpen','details.ux-help']:
  assert page.locator('#panelGeography '+selector).count()==0,selector
 assert page.locator('#geoImportPanel').count()==0
 assert page.locator('#panelGeography .section-head',has_text='RESULTS').count()==0
 assert page.locator('#countryResults').inner_text()==''
 page.locator('#fileMenu > summary').click()
 page.locator('#fileImportGeoJSON').click()
 assert page.locator('#geoImportDialog').is_visible()
 assert page.locator('#datasetType').is_visible()
 assert page.locator('#importDataset').is_visible()
 page.locator('#datasetType').select_option('Lake')
 assert page.locator('#datasetType').input_value()=='Lake'
 page.keyboard.press('Escape')
 assert not page.locator('#geoImportDialog').is_visible()
 (BASE/'dist/tests').mkdir(parents=True,exist_ok=True)
 page.evaluate("document.querySelector('#toast').hidden=true")
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UX-Revised-Geography.png'))
 # Export Studio distinguishes per-export controls from saved Quick PNG / ZIP defaults.
 page.locator('#openProduction').click()
 assert page.locator('#productionExport').is_visible()
 assert page.locator('#prodResolution').is_visible()
 assert page.locator('#prodTransparent').is_visible()
 assert not page.locator('#resolution').is_visible()
 assert page.locator('#uxExportCanvasDefaults').count()==1
 page.locator('#uxExportCanvasDefaults > summary').click()
 assert page.locator('#resolution').is_visible()
 page.locator('#resolution').select_option('1920x1080')
 assert page.evaluate('CartoRig.scene.canvas.width')==1920
 page.locator('#transparent').check()
 assert page.evaluate('CartoRig.scene.canvas.transparent') is True
 assert page.locator('#prodResolution').input_value()=='3840x2160' # independent per-export settings
 page.locator('#prodFormat').select_option('project')
 assert not page.locator('#prodResolution').is_visible()
 assert page.locator('#resolution').is_visible() # scene defaults still available separately
 page.locator('#prodFormat').select_option('png')
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UX-Revised-Export.png'))
 page.keyboard.press('Escape')
 assert not page.locator('#productionExport').is_visible()
 assert page.evaluate('document.activeElement?.id')=='openProduction'
 # Map settings are Undo/Redo-aware.
 page.evaluate("CartoRig.execute({type:'SetThemeProperty',key:'atmosphere_vignette',value:.4})")
 assert page.evaluate('CartoRig.scene.theme.overrides.atmosphere_vignette')==.4
 page.locator('#undo').click()
 assert page.evaluate('CartoRig.scene.theme.overrides.atmosphere_vignette')!=.4
 # Capture real app for UI review; image previews are bundled in production.
 page.locator('#tabLayers').click();page.locator('#tabStyles').click();page.locator('#style14ModeCustomize').click()
 page.evaluate("document.querySelector('#toast').hidden=true")
 if page.locator('.style14-group:has(> summary:text-is("BORDERS & GRID"))').evaluate('(x)=>x.open'):
  page.locator('.style14-group > summary',has_text='BORDERS & GRID').click()
 (BASE/'dist/tests').mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UX-Revised-Settings.png'))
 page.locator('#style14ModeChoose').click()
 mapping={x.stem:'data:image/png;base64,'+base64.b64encode(x.read_bytes()).decode('ascii') for x in (A/'look-previews').glob('*.png')}
 page.evaluate("mapping=>{for(const img of document.querySelectorAll('#presets img[data-native-look]'))if(mapping[img.dataset.nativeLook])img.src=mapping[img.dataset.nativeLook]}",mapping)
 page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UX-Revised-Desktop.png'))
 for width in [1100,790,550,390]:
  page.set_viewport_size({'width':width,'height':780})
  page.evaluate('CartoRigNavigation.setRight(false);CartoRigNavigation.setLeft(false)')
  page.locator('#toggleInspector').click();assert page.locator('#rightSidebar').is_visible(),width
  page.locator('#toggleInspector').click();assert not page.locator('#rightSidebar').is_visible(),width
  page.locator('#toggleScene').click();assert page.locator('.sidebar.left').is_visible(),width
  page.locator('#toggleScene').click();assert not page.locator('.sidebar.left').is_visible(),width
  if width==390:page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-UX-Revised-Compact.png'))
 assert not errors,errors
 print('PASS: redundant card removed; global controls prioritized; export defaults relocated; Geography simplified; styles/undo responsive',flush=True)
 b.close()
