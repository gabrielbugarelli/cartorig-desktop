"""CartoRig 2.0.1 UI contract: navigation, progressive disclosure, 36 looks, keyboard, classic outputs.
Uses the same full app module source, actual bundled geographic JSON and a virtual API bridge.
"""
from pathlib import Path
import json, re, sys
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle

BASE = Path(__file__).resolve().parents[1]
A = BASE/'assets'
html = re.sub(r'<script type="module" src="/assets/app\.js"></script>', '', (A/'index.html').read_text())
paths = ['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data = {x:json.loads((A/x).read_text()) for x in paths}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,
                        args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
    page=b.new_page(viewport={'width':1600,'height':920},accept_downloads=True)
    errors=[]
    page.set_default_timeout(8000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html)
    page.add_style_tag(content=(A/'style.css').read_text())
    page.add_style_tag(content=(A/'ux-layout.css').read_text())
    page.evaluate('''data=>{
      window.__audit={requests:[],outputs:[]};
      window.fetch=async (u,opts={})=>{
        let endpoints={'/api/session':{token:'ux-contract'},'/api/styles':[],
          '/api/geo-packs':[],'/api/v2/recovery':[],
          '/api/admin1/status':{installed:false},'/api/cities/status':{installed:false},
          '/api/geodata/verify':{global_offline_ready:false,datasets:[]}};
        if(endpoints[u]!==undefined)return new Response(JSON.stringify(endpoints[u]));
        if(u.startsWith('/assets/') && data[u.slice(8)]!==undefined)return new Response(JSON.stringify(data[u.slice(8)]));
        if(u==='/api/scene-bundle') {window.__audit.outputs.push('legacy-zip');return new Response(new Blob(['legacy-zip'],{type:'application/zip'}));}
        if(u==='/api/v2/project/save'){window.__audit.requests.push('save');return new Response('{"ok":true}',{status:200});}
        if(u==='/api/v2/project/recent'||u==='/api/v2/project/templates')return new Response('[]');
        if(opts.method==='POST')return new Response('{"ok":true}',{status:200});
        throw Error('Unexpected API: '+u);
      };
    }''',data)
    page.add_script_tag(content=browser_bundle(A))
    page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)

    assert page.locator('#openProduction').is_visible()
    assert page.locator('#saveProject').is_visible()
    assert not page.locator('#exportImage').is_visible()
    assert not page.locator('#exportLayers').is_visible()
    assert page.locator('#openStyleStudio').count()==0
    assert page.locator('#tabStyles').inner_text()=='Looks'
    assert page.locator('#panelStyles .style14-hero').count()==0
    assert page.locator('#panelStyles .style14-quick').count()==0
    assert page.locator('#presets [data-style]').count()==36
    assert not page.locator('#uxCanvasOptions').evaluate('(x)=>x.open')
    assert not page.locator('#style14CustomizeView').is_visible()
    assert not page.locator('[data-theme-field="relief_strength"]').is_visible()
    assert page.locator('#sceneLookSearch').is_visible()
    # Appearance: an active preset remains selected and gallery DOM stable.
    first=page.locator('#presets [data-style="dark"]')
    total=page.locator('#presets [data-style]').count()
    page.locator('#presets [data-style="atlas"]').click()
    assert page.evaluate('CartoRig.scene.theme.id')=='atlas'
    assert page.locator('#presets [data-style]').count()==total
    assert page.locator('#presets [data-style="atlas"]').get_attribute('aria-pressed')=='true'
    # Appearance's advanced property controls are accessible on demand.
    page.locator('#style14ModeCustomize').click()
    page.locator('.style14-group > summary',has_text='RELIEF ART DIRECTION').click()
    assert page.locator('[data-theme-field="relief_strength"]').is_visible()
    page.locator('#style14ModeChoose').click()
    # File menu keeps all commands, including project manager and quit.

    page.locator('#fileMenu > summary').click()
    assert page.locator('#newProject').is_visible()
    assert page.locator('#openProject').is_visible()
    assert page.locator('#openProjects').is_visible()
    assert page.locator('#quitApp').is_visible()

    page.locator('#openProjects').click()
    page.locator('#productionProjects').wait_for(state='visible',timeout=8000)
    page.locator('#prodProjectsClose').click()
    assert not page.locator('#fileMenu').evaluate('(x)=>x.open')
    # Export Studio remains default; quick exports are secondary, not deleted.

    page.locator('#openProduction').click()
    assert page.locator('#productionExport').is_visible()
    assert page.locator('#prodFormat').is_visible()
    page.locator('#prodClose').click()
    page.locator('#exportMenu > summary').click()
    assert page.locator('#exportImage').is_visible()
    assert page.locator('#exportLayers').is_visible()
    # Classic one-click PNG still produces a download.

    with page.expect_download(timeout=25000) as download_info:
        page.locator('#exportImage').click()
    assert download_info.value.suggested_filename.endswith('.png')
    # Legacy layers ZIP shortcut still invokes the same algorithm.

    page.keyboard.press('Control+Shift+e')
    page.wait_for_function("window.__audit.outputs.includes('legacy-zip')", timeout=20000)
    # Canvas tool options must be contextual.

    page.locator('#toolRoute').click()
    assert page.locator('#routeType').is_visible()
    assert not page.locator('#markerSymbol').is_visible()
    page.locator('#toolMarker').click()
    assert page.locator('#markerSymbol').is_visible()
    assert not page.locator('#routeType').is_visible()
    page.locator('#toolShape').click()
    assert page.locator('#shapeType').is_visible()
    assert page.locator('#shapeSpace').is_visible()
    page.locator('#toolSelect').click()
    assert not page.locator('#shapeType').is_visible()
    # Geography places daily search above filters/diagnostics; technical capabilities stay accessible.

    page.locator('#tabGeography').click()
    assert page.locator('#countrySearch').is_visible()
    assert not page.locator('#geoFilters').evaluate('(x)=>x.open')
    assert not page.locator('#geoDiagnosticsPanel').evaluate('(x)=>x.open')
    page.locator('#geoFilters > summary').click()
    assert page.locator('#geoCountry').is_visible()
    page.locator('#geoDiagnosticsPanel > summary').click()
    assert page.locator('#verifyGeoData').is_visible()
    assert page.locator('#importDataset').is_visible()
    assert page.locator('#installWorldAdmin1').count()==1
    # Collapse/expand the panels to make more Canvas space without modifying the project.
    project_id=page.evaluate('CartoRig.scene.project_id')

    page.locator('#toggleScene').click()
    assert not page.locator('.sidebar.left').is_visible()

    page.locator('#toggleScene').click()
    assert page.locator('.sidebar.left').is_visible()
    page.locator('#toggleInspector').click()
    assert not page.locator('#rightSidebar').is_visible()
    page.locator('#toggleInspector').click()
    assert page.locator('#rightSidebar').is_visible()
    assert page.evaluate('CartoRig.scene.project_id')==project_id
    # Capture the actual app layout with gallery present.
    page.locator('#tabStyles').click()
    page.locator('#tabLayers').click()
    (BASE/'dist/tests').mkdir(parents=True,exist_ok=True)
    # The virtual backend cannot serve image URLs; load the exact bundled PNG bytes for this screenshot only.
    import base64
    previews={x.stem:'data:image/png;base64,'+base64.b64encode(x.read_bytes()).decode('ascii') for x in (A/'look-previews').glob('*.png')}
    page.evaluate('''mapping=>{for(const img of document.querySelectorAll('#presets img[data-native-look]'))if(mapping[img.dataset.nativeLook])img.src=mapping[img.dataset.nativeLook];document.querySelector('#toast').hidden=true;}''',previews)
    page.locator('#presets [data-style=dark]').click()
    page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.1-UX-Redesign.png'),full_page=False)
    assert not errors,errors
    print('PASS 2.0.2 compatibility UI: navigation, file/project/export access, quick PNG, layers ZIP shortcut, filters, effects disclosure, contextual tools, 36 looks, pane toggles, no JS errors')
    b.close()
