"""1.4.5: catch first-load thumbnail swapping that the 1.4.4 click-only test missed.

The current sandbox blocks browser navigation. We simulate a full reload with a
new browser page and fresh JavaScript global each time; the unmodified embedded
PNGs are served through Playwright's asset routing. The Windows workflow also
runs actual HTTP/F5 E2E to cover navigation itself.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import json, sys, re, mimetypes
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle

BASE=Path(__file__).resolve().parents[1]
ASSETS=BASE/'assets'
LOOKS=['dark','atlas','tactical','relief','satellite','night','elevation','historical','terrain']+[x['id'] for x in json.loads((BASE/'docs/SCENE_LOOKS_REFERENCE_AUDIT.json').read_text())['looks']]
URL='https://cartorig-preview.test/'
counts={'static_images':0}

def serve(route):
    path=unquote(urlparse(route.request.url).path)
    if not path.startswith('/assets/'):
        route.fulfill(status=404,body='Invalid path');return
    rel=path[len('/assets/'):]
    file=(ASSETS/rel).resolve()
    if not file.is_relative_to(ASSETS.resolve()) or not file.is_file():
        route.fulfill(status=404,body='Missing');return
    if rel.startswith('look-previews/') and rel.endswith('.png'):
        counts['static_images']+=1
    mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
    route.fulfill(status=200,content_type=mime,body=file.read_bytes())

data={f:json.loads((ASSETS/f).read_text()) for f in
      ['countries.json','geodata/localities.json','geodata/admin1-names.json',
       'geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']}
html=(ASSETS/'index.html').read_text()
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',html)
html=html.replace('<head>','<head><base href="'+URL+'">')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,
        executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,
        args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
    context=browser.new_context(viewport={'width':1550,'height':1000})
    context.route('**/*',serve)
    errors=[]
    for iteration in range(4):
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html)
        page.add_style_tag(content=(ASSETS/'style.css').read_text())
        page.evaluate('''d=>{
            window.fetch=async (u,opts={})=>{
                const api={
                    '/api/session':{token:'test-token'},'/api/styles':[],
                    '/api/geo-packs':[], '/api/admin1/status':{installed:false},
                    '/api/cities/status':{installed:false},
                    '/api/geodata/verify':{global_offline_ready:false,datasets:[]}
                };
                if(api[u]!==undefined)return new Response(JSON.stringify(api[u]));
                if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]));
                if(opts.method==='POST')return new Response('{"ok":true}');
                throw Error('Unhandled '+u);
            };
        }''',data)
        page.add_script_tag(content=browser_bundle(ASSETS))
        page.wait_for_function('window.CartoRig?.ready===true',timeout=60000)
        first=page.evaluate('''()=>[...document.querySelectorAll('#presets [data-style]')].map(b=>{
            const img=b.querySelector('img.style14-preview');
            return {key:b.dataset.style,src:img?.getAttribute('src'),
                    fallback:!!b.querySelector('i.style14-custom-swatch')};
        })''')
        assert len(first)==36,first
        assert [x['key'] for x in first]==LOOKS,first
        for x in first:
            assert x['src']==f'/assets/look-previews/{x["key"]}.png',x
            assert not x['fallback'],x
        page.wait_for_function('''()=>[...document.querySelectorAll('#presets img')].every(i=>
            i.complete&&i.naturalWidth===288&&i.naturalHeight===162)''',timeout=30000)
        # Gallery navigation must not mutate or reconstruct any of the 36 cards.
        cat=page.locator('#sceneLookCategory')
        search=page.locator('#sceneLookSearch')
        assert page.locator('#presets .style14-preset:not([hidden])').count()==36
        cat.select_option('reference')
        assert page.locator('#presets .style14-preset:not([hidden])').count()==27
        cat.select_option('original')
        assert page.locator('#presets .style14-preset:not([hidden])').count()==9
        cat.select_option('all')
        search.fill('Alpine Survey')
        assert page.locator('#presets .style14-preset:not([hidden])').count()==1
        assert page.locator('#presets .style14-preset:not([hidden])').first.get_attribute('data-style')=='alpine-survey'
        search.fill('')
        assert page.locator('#presets .style14-preset:not([hidden])').count()==36

        page.evaluate('''()=>{
            window.lookRefs=[...document.querySelectorAll('#presets [data-style]')];
            window.lookImgs=lookRefs.map(x=>x.querySelector('img'));
            window.lookChanges=[];
            new MutationObserver(recs=>recs.forEach(r=>lookChanges.push(r.type+':'+r.attributeName)))
               .observe(document.getElementById('presets'),{
                   childList:true,subtree:true,attributes:true,attributeFilter:['src','srcset','style']
               });
        }''')
        result=page.evaluate('''()=>{
            const seq=['terrain','relief','night','dark','atlas','satellite','elevation','historical','terrain','relief','atlas','dark'];
            for(const key of seq){
                document.querySelector('#presets [data-style="'+key+'"]').click();
                const cards=[...document.querySelectorAll('#presets [data-style]')];
                if(cards.some((b,j)=>b!==lookRefs[j]||b.querySelector('img')!==lookImgs[j]))
                    throw Error('Gallery card recreated');
            }
            return CartoRig.scene.theme.id;
        }''')
        assert result=='dark',result
        page.wait_for_timeout(75)
        state=page.evaluate('''()=>({changes:lookChanges,
            loaded:lookImgs.every(i=>i.complete&&i.naturalWidth===288)})''')
        assert state['loaded'] and not state['changes'],state
        if iteration==0:
            out=BASE/'dist'/'tests'
            out.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(out/'CartoRig-1.4.5-Scene-Looks-Static.png'),full_page=False)
        print('Fresh start',iteration+1,': 36 static PNGs, 12 clicks, zero replacements')
        page.close()
    assert not errors,errors
    assert counts['static_images']>=36,counts
    print('PASS: 4 independent startup cycles, 48 theme changes, unmodified real PNG assets:',counts)
    browser.close()
