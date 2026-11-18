"""Tests world Admin1 UI against SYNTHETIC polygons; NOT a real geodata test."""
from pathlib import Path
import json, tempfile, re, os
from playwright.sync_api import sync_playwright
from PIL import Image
root=Path(__file__).resolve().parents[1]

def dataset():
    samples=[('Ontario','Canada',-87,50),('Quebec','Canada',-72,50),('California','United States of America',-119,35),('Bayern','Germany',11.2,49),('Queensland','Australia',145,-22),('Maharashtra','India',75,19)]
    feat=[]
    for i in range(int(os.environ.get('CARTORIG_WORLD_TEST_COUNT','3500'))):
        if i<len(samples): n,a,x,y=samples[i]
        else: n,a,x,y='Test Region '+str(i),'Test Nation '+str(i%170),float(i%120*2-160),float(i//120%40*2-60)
        feat.append({'type':'Feature','properties':{'name':n,'name_en':n,'admin':a,'iso_3166_2':f'TEST-{i:05d}','ne_id':i+100000},'geometry':{'type':'Polygon','coordinates':[[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]}})
    return {'type':'FeatureCollection','features':feat}

html=(root/'assets/index.html').read_text()
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',html)
files=('scene-core.js','geo-catalog.js','scene-renderer.js','app.js')
from module_loader import browser_bundle
js=browser_bundle(assets if 'assets' in globals() else root/'assets')

data={f:json.loads((root/'assets'/f).read_text()) for f in ('countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson')}
data['world']=dataset()

with tempfile.TemporaryDirectory() as td, sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1580,'height':980},accept_downloads=True)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html);page.add_style_tag(content=(root/'assets/style.css').read_text())
    page.evaluate('''(d)=>{window.fetch=async(url,opts)=>{
        if(url==='/api/v2/project/save'){window._lastProductionSaved=JSON.parse(opts.body);return new Response(JSON.stringify({project_id:window._lastProductionSaved.project_id,ok:true}));}
 if(url==='/api/v2/project/open')return new Response(new TextDecoder().decode(opts.body),{headers:{'Content-Type':'application/json'}});
 if(url==='/api/v2/recovery')return new Response('[]');
 if(url==='/api/v2/autosave')return new Response('{"ok":true}');
 if(url==='/api/session')return new Response(JSON.stringify({token:'test-token'}),{status:200});
        if(url==='/api/geo-packs')return new Response('[]',{status:200});
        if(url==='/api/cities/status')return new Response(JSON.stringify({installed:false}),{status:200});
        if(url==='/api/cities/install')return new Response('Offline fixture',{status:503});
        if(url==='/api/admin1/status')return new Response(JSON.stringify({installed:true,source:'cached'}),{status:200});
        if(url==='/api/admin1/data')return new Response(JSON.stringify(d.world),{status:200});
        if(url.startsWith('/assets/')){let value=d[url.slice(8)];if(value)return new Response(JSON.stringify(value),{status:200});}
        throw Error('unknown test URL '+url);
     };}''',data)
    page.add_script_tag(content=js)
    page.wait_for_function(f"window.CartoRig?.geoDatasets?.some(d=>d.count==={len(data['world']['features'])})",timeout=40000)
    page.locator('#tabGeography').click()
    for name,parent in [('Ontario','Canada'),('Quebec','Canada'),('California','United States of America'),('Bayern','Germany'),('Queensland','Australia'),('Maharashtra','India'),('Mato Grosso','Brazil')]:
        page.locator('#countrySearch').fill(name)
        page.wait_for_timeout(250)
        found=page.locator('.geo-result').filter(has_text=name)
        assert found.count()>0, f'No {name}'
        row=found.filter(has_text=parent).first
        assert row.count()==1, f'No parent for {name}'
        assert 'Polygon' in row.inner_text(), f'No polygon for {name}'
        assert row.locator('button[title="Add independent Region"]').is_enabled()
        print('FOUND',name,parent)
    for name in ['Ontario','California']:
        page.locator('#countrySearch').fill(name)
        page.locator('.geo-result button[title="Add independent Region"]').first.click()
        page.locator('#tabGeography').click()
    states=page.evaluate('Object.values(CartoRig.scene.objects).filter(o=>o.region_kind==="State")')
    assert len(states)==2 and all(o['embedded_geometry'] for o in states)
    page.locator('#tabLayers').click()
    page.locator('.tree-row[data-id="'+states[0]['id']+'"] .node-name').click()
    page.locator('#focusSelected').click()
    page.locator('#tabStyles').click()
    page.locator('#resolution').select_option('1920x1080')
    with page.expect_download(timeout=60000) as handle:page.locator('#exportImage').click()
    image=Path(td)/'test.png';handle.value.save_as(image)
    assert Image.open(image).size==(1920,1080)
    page.locator('#saveProject').click()
    page.wait_for_function('Boolean(window._lastProductionSaved)')
    project=Path(td)/'test.cartorig'
    project.write_text(json.dumps(page.evaluate('window._lastProductionSaved')),encoding='utf-8')
    d=json.loads(project.read_text());assert sum(o.get('region_kind')=='State' for o in d['objects'].values())==2
    with page.expect_file_chooser() as handle:page.locator('#openProject').click()
    handle.value.set_files(str(project));page.wait_for_timeout(300)
    assert page.evaluate('Object.values(CartoRig.scene.objects).filter(o=>o.region_kind==="State").length')==2
    assert not errors,errors
    print('World Admin1 UI, independent layers, save/reopen and PNG export: PASS')
    browser.close()
