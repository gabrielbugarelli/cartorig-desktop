"""CartoRig 2.0.2 UI/UX regression: task-based looks, contextual export, keyboard and drawers.
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

    # All 36 native preview cards remain present and ready to apply.
    assert page.locator('#presets [data-style]').count()==36
    assert page.locator('.ux-active-look').count()==0
    assert page.locator('#style14GalleryView').is_visible()
    assert not page.locator('#style14CustomizeView').is_visible()
    page.locator('#style14ModeCustomize').click()
    page.locator('.style14-group > summary',has_text='LAND & OCEAN').click()
    assert page.locator('#style14CustomizeView').is_visible()
    assert not page.locator('#style14GalleryView').is_visible()
    assert page.locator('[data-theme-field=land_color]').is_visible()
    assert page.locator('#uxMapBoundaries').count()==1
    assert page.locator('#uxExportCanvasDefaults').count()==1
    page.locator('.style14-group > summary',has_text='RELIEF ART DIRECTION').click()
    assert page.locator('[data-theme-field=relief_strength]').is_visible()
    # Applying styles keeps everything in CommandBus and updates the look summary.
    page.locator('#style14ModeChoose').click()
    page.locator('#presets [data-style="atlas"]').click()
    assert page.evaluate('CartoRig.scene.theme.id')=='atlas'
    assert page.locator('#presets [data-style=atlas]').get_attribute('aria-pressed')=='true'
    assert page.locator('#presets [data-style]').count()==36
    page.locator('#style14ModeCustomize').click()
    assert page.locator('[data-theme-field=land_color]').is_visible()
    # Tabs expose correct accessible roles and support directional keyboard navigation.
    page.locator('#tabStyles').focus()
    page.keyboard.press('ArrowLeft')
    assert page.locator('#tabInspector').get_attribute('aria-selected')=='true'
    page.keyboard.press('ArrowRight')
    assert page.locator('#tabStyles').get_attribute('aria-selected')=='true'
    assert page.locator('#tabStyles').get_attribute('role')=='tab'
    assert page.locator('#panelStyles').get_attribute('role')=='tabpanel'
    page.locator('#tabLayers').click()
    tree=page.locator('#layerTree [role=treeitem]')
    assert tree.count()>=3
    tree.first.focus()
    page.keyboard.press('ArrowDown')
    assert page.locator('#layerTree').evaluate('(el)=>el.contains(document.activeElement)')
    assert page.locator('#layerTree [tabindex="0"]').count()>=1
    assert page.locator('#layerTree [role=treeitem] button[aria-label^="Lock "]').count()>0
    # Draw a real marker with the original command path to inspect its controls.
    page.evaluate('''() => CartoRig.execute({type:'CreateObject',object:{id:"11111111-2222-4333-8444-555555555555",type:'Marker',name:'UX Marker',symbol:'Circle',anchor:{lon:0,lat:0},visible:true,locked:false,opacity:1,style:{fill_color:'#e5b467'}}})''')
    page.locator('#layerTree .tree-row',has_text='UX Marker').click()
    assert page.locator('.ux-inspector-object').is_visible()
    assert page.locator('.ux-inspector-object strong').inner_text()=='UX Marker'
    assert page.locator('.marker-library').is_visible()
    assert page.locator('.marker-library-item').count()>0
    assert page.locator('#inspector .ux-inspector-advanced').count()==1
    assert not page.locator('#inspector .ux-inspector-advanced').evaluate('(x)=>x.open')
    page.locator('#inspector .ux-inspector-advanced > summary').click()
    assert page.locator('#inspector .ux-inspector-advanced').evaluate('(x)=>x.open')
    # Production export format-dependent options are in DOM but only pertinent ones appear.
    page.locator('#openProduction').click()
    assert page.locator('#productionExport').is_visible()
    assert page.locator('#prodGranularity').is_visible()
    assert not page.locator('#prodMaskOpaque').is_visible()
    page.locator('#prodFormat').select_option('mask')
    assert page.locator('#prodMaskOpaque').is_visible()
    assert not page.locator('#prodGranularity').is_visible()
    assert not page.locator('#prodIncludeBackground').is_visible()
    page.locator('#prodFormat').select_option('project')
    assert not page.locator('#prodResolution').is_visible()
    assert not page.locator('#prodScope').is_visible()
    assert page.locator('#prodRun').inner_text()=='Save and download project'
    page.keyboard.press('Escape')
    assert not page.locator('#productionExport').is_visible()
    assert page.evaluate('document.activeElement?.id')=='openProduction'
    # Build representative screenshots from a live Chromium layout.
    page.locator('#tabStyles').click()
    page.locator('#style14ModeChoose').click()
    (BASE/'dist/tests').mkdir(parents=True,exist_ok=True)
    import base64
    previews={x.stem:'data:image/png;base64,'+base64.b64encode(x.read_bytes()).decode('ascii') for x in (A/'look-previews').glob('*.png')}
    page.evaluate('''mapping=>{for(const img of document.querySelectorAll('#presets img[data-native-look]'))if(mapping[img.dataset.nativeLook])img.src=mapping[img.dataset.nativeLook];document.querySelector('#toast').hidden=true;}''',previews)
    page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-Workspace-1600.png'))
    for width in [1100,790,550,390]:
        page.set_viewport_size({'width':width,'height':780})
        # Ensure a clean closed drawer, then verify one-click re-opening in compact sizes.
        page.evaluate("CartoRigNavigation.setRight(false);CartoRigNavigation.setLeft(false)")
        page.locator('#toggleInspector').click()
        assert page.locator('#rightSidebar').is_visible(),f'right panel should open at {width}'
        assert page.locator('#toggleInspector').get_attribute('aria-pressed')=='true'
        page.locator('#toggleInspector').click()
        assert not page.locator('#rightSidebar').is_visible(),f'right panel should close at {width}'
        assert page.locator('#toggleInspector').get_attribute('aria-pressed')=='false'
        page.locator('#toggleScene').click()
        assert page.locator('.sidebar.left').is_visible(),f'left panel should open at {width}'
        page.locator('#toggleScene').click()
        assert not page.locator('.sidebar.left').is_visible()
        rect=page.locator('#mapCanvas').bounding_box()
        assert rect and rect['width']>min(300,width*.64),f'map too small at {width}: {rect}'
        if width==390:
            page.screenshot(path=str(BASE/'dist/tests/CartoRig-2.0.2-Workspace-390.png'))
    assert not errors,errors
    print('PASS CartoRig 2.0.2 UX: 36 looks, 1-click personalization, inspector, tree, tabs, export context, modal focus, responsive panels and canvas',len(errors))
    b.close()
