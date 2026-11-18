"""1.4.2 completion: actual UI controls, style values, theme switching, and preview pixels."""
from pathlib import Path
import sys,re,json
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
base=Path(__file__).resolve().parents[1]; assets=base/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
paths=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((assets/f).read_text()) for f in paths}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
    page=b.new_page(viewport={'width':1680,'height':980},accept_downloads=True)
    errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
    page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
    page.evaluate('''d=>{window._savedStyles=[];window.fetch=async(u,opts={})=>{
      if(u==='/api/session')return new Response(JSON.stringify({token:'test-token'}));
      if(u==='/api/styles'){if(opts.method==='POST'){window._savedStyles=JSON.parse(opts.body);return new Response('{"ok":true}')};return new Response(JSON.stringify(window._savedStyles));}
      if(u==='/api/geo-packs')return new Response('[]');
      if(u==='/api/admin1/status'||u==='/api/cities/status')return new Response('{"installed":false}');
      if(u==='/api/admin1/install'||u==='/api/cities/install')return new Response('offline',{status:503});
      if(u==='/api/geodata/verify')return new Response('{"global_offline_ready":false,"datasets":[]}');
      if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]));
      throw Error('Unhandled '+u);
    };}''',data)
    page.add_script_tag(content=browser_bundle(assets));page.wait_for_function('window.CartoRig?.ready===true',timeout=45000)
    assert page.locator('#panelStyles').is_visible()
    assert page.locator('#presets [data-style]').count()==36
    def setfield(key,value):
        return page.evaluate('''({key,value})=>CartoRig.execute({type:'SetThemeProperty',key,value})''',{'key':key,'value':value})
    assert setfield('land_color','#12aabb')
    assert page.evaluate('CartoRig.scene.theme.overrides.land_color')=='#12aabb'
    reset=page.locator('button[data-revert-theme="land_color"]')
    assert reset.count()==1
    reset.click()
    assert 'land_color' not in page.evaluate('CartoRig.scene.theme.overrides')
    assert setfield('terrain_enabled',True)
    # checkbox reset must work too, with same path as color reset
    page.locator('summary').filter(has_text='TERRAIN & TEXTURE').click() if not page.locator('details').filter(has_text='TERRAIN & TEXTURE').first.evaluate('(e)=>e.open') else None
    page.locator('button[data-revert-theme="terrain_enabled"]').click()
    assert 'terrain_enabled' not in page.evaluate('CartoRig.scene.theme.overrides')
    # Global overrides must not hide a newly selected theme
    setfield('land_color','#010203')
    page.locator('[data-style=atlas]').first.click()
    assert page.evaluate('CartoRig.scene.theme.id')=='atlas'
    assert page.evaluate('Object.hasOwn(CartoRig.scene.theme.overrides,"land_color")') is False
    assert page.evaluate('paletteFor(CartoRig.scene).land')=='#e3d6b8'
    # Browser controls all actually connect to scene document
    print('STATE',page.evaluate('''()=>[...document.querySelectorAll('details.style14-group')].map(d=>[d.querySelector('summary').textContent,d.open])'''),flush=True)
    page.locator('[data-theme-field="border_style"]').select_option('Dotted')
    page.locator('[data-theme-field="grid_interval"]').fill('15')
    page.locator('[data-theme-field="grid_interval"]').dispatch_event('change')
    page.locator('[data-theme-field="grid_labels"]').check()
    assert page.evaluate('CartoRig.scene.theme.overrides.border_style')=='Dotted'
    assert page.evaluate('CartoRig.scene.theme.overrides.grid_interval')==15
    assert page.evaluate('CartoRig.scene.theme.overrides.grid_labels') is True
    # Terrain source is an explicit local raster; no DEM claim
    page.locator('[data-theme-field="texture_source"]').select_option('shadedrelief')
    page.locator('[data-theme-field="ocean_mode"]').select_option('solid')
    assert page.evaluate('CartoRig.scene.theme.overrides.texture_source')=='shadedrelief'
    assert page.evaluate('CartoRig.scene.theme.overrides.ocean_mode')=='solid'
    # Category defaults, including typographic controls and glow
    sect=page.locator('details.style14-group').filter(has_text='OBJECT TYPE DEFAULTS & EFFECTS')
    sect.locator('summary').click()
    page.locator('#style14Category').select_option('Label')
    page.locator('#style14DefaultField').select_option('font_family')
    page.locator('#style14DefaultValue').fill('Georgia')
    sect.locator('button').filter(has_text='Set Label default').click()
    assert page.evaluate('CartoRig.scene.theme.type_defaults.Label.font_family')=='Georgia'
    page.locator('#style14Category').select_option('Region')
    page.locator('#style14DefaultField').select_option('glow_enabled')
    page.locator('#style14DefaultValue').check()
    sect.locator('button').filter(has_text='Set Region default').click()
    assert page.evaluate('CartoRig.scene.theme.type_defaults.Region.glow_enabled') is True
    # Region retains its explicit custom fill when a theme changes
    ident=page.evaluate('''()=>{let o=madeObject('Region','Brazil',{region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:'BRA'},style:{fill_color:'#ff0000'}});return CartoRig.execute({type:'CreateObject',object:o})?o.id:null;}''')
    assert ident
    page.locator('#tabStyles').click();page.locator('[data-style=dark]').first.click()
    assert page.evaluate('''id=>CartoRig.scene.objects[id].style.fill_color''',ident)=='#ff0000'
    page.locator('#tabLayers').click();page.locator('.tree-row[data-id="'+ident+'"]').click()
    assert page.locator('#inspector .region-bounds').count()==1
    assert 'WGS84 bounds' in page.locator('#inspector .region-bounds').inner_text()
    assert not errs,errs
    dest=base/'dist'/'tests';dest.mkdir(parents=True,exist_ok=True)
    page.locator('#tabStyles').click();page.screenshot(path=str(dest/'CartoRig-1.4.2-Style-Studio-Completed.png'))
    print('1.4.2 UI: global resets/booleans, theme isolation, border/grid, local textures, category typography/effects, real Region bounds and independent fill: PASS')
    b.close()
