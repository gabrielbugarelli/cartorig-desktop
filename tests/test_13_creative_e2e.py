"""CartoRig 1.3 browser tests. Real bundled Brazil state polygons and city locations; no fabricated worldwide geometry."""
from pathlib import Path
import json,re,tempfile,sys
from PIL import Image
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
base=Path(__file__).resolve().parents[1]; assets=base/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
files=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={f:json.loads((assets/f).read_text()) for f in files}
js=browser_bundle(assets)
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1600,'height':980},accept_downloads=True)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
 page.evaluate('''d=>{window.fetch=async(u,opts)=>{
 if(u==='/api/v2/project/save'){window._lastProductionSaved=JSON.parse(opts.body);return new Response(JSON.stringify({project_id:window._lastProductionSaved.project_id,ok:true}));}
 if(u==='/api/v2/project/open')return new Response(new TextDecoder().decode(opts.body),{headers:{'Content-Type':'application/json'}});
 if(u==='/api/v2/recovery')return new Response('[]');
 if(u==='/api/v2/autosave')return new Response('{"ok":true}');
 if(u==='/api/session')return new Response(JSON.stringify({token:'test-token'}));
 if(u==='/api/geo-packs')return new Response('[]');
 if(u==='/api/admin1/status'||u==='/api/cities/status')return new Response(JSON.stringify({installed:false}));
 if(u==='/api/admin1/install'||u==='/api/cities/install')return new Response('offline test',{status:503});
 if(u==='/api/geodata/verify')return new Response(JSON.stringify({global_offline_ready:false,datasets:[]}));
 if(u==='/api/scene-bundle')return new Response(new Blob(['mock zip'],{type:'application/zip'}));
 if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]));
 throw Error('Unhandled '+u);
 };}''',data)
 page.add_script_tag(content=js)
 page.wait_for_function('window.CartoRig?.ready===true',timeout=30000)
 assert not errs,errs
 def create(tp,kwargs):
  return page.evaluate('''({tp,kwargs})=>{let id="test-"+Math.random().toString(36).slice(2);return CartoRig.execute({type:'CreateObject',object:{id,type:tp,name:kwargs.name||tp,visible:true,locked:false,opacity:1,parent_id:null,style:{},...kwargs}})?id:null;}''',{'tp':tp,'kwargs':kwargs})
 route=create('Route',{'name':'South America route','from':{'lon':-47,'lat':-15},'to':{'lon':-58,'lat':-34},'path_type':'Straight','waypoints':[],'style':{'stroke_color':'#dca941','arrowheads':'End'}})
 assert route,errs
 for kind in ('Curved','Geodesic','Custom'):
  assert page.evaluate('''({id,kind})=>CartoRig.execute({type:'SetProperty',id,path:'path_type',value:kind})''',{'id':route,'kind':kind})
 assert page.evaluate('''id=>CartoRig.execute({type:'SetProperties',id,values:{path_type:'Custom',waypoints:[{lon:-49,lat:-20},{lon:-52,lat:-25},{lon:-55,lat:-30},{lon:-56,lat:-32}]}})''',route)
 marker=create('Marker',{'name':'Brasília','anchor':{'lon':-47.9,'lat':-15.8},'symbol':'Flag','style':{'symbol_size':18}})
 assert marker
 assert page.evaluate('''({route,marker})=>CartoRig.execute({type:'SetProperty',id:route,path:'from',value:{lon:-47.9,lat:-15.8,source_kind:'marker link',linked_object_id:marker}})''',{'route':route,'marker':marker})
 assert page.evaluate('''id=>CartoRig.execute({type:'SetProperty',id,path:'anchor',value:{lon:-46,lat:-15.7}})''',marker)
 assert page.evaluate('''({route,marker})=>{let r=CartoRig.scene.objects[route],m=CartoRig.scene.objects[marker];return r.from.linked_object_id===marker&&m.anchor.lon===-46}''',{'route':route,'marker':marker})
 label=create('Label',{'name':'São Paulo — Brasil','text':'São Paulo — Brasil\nLinha 2','anchor':{'lon':-46.64,'lat':-23.55},'position_mode':'geo','typography':{'font_size':27,'font_family':'Segoe UI'},'style':{'halo_width':4}})
 assert label
 assert page.evaluate('''id=>CartoRig.execute({type:'SetProperties',id,values:{position_mode:'screen',screen_pos:{x:.42,y:.33}}})''',label)
 # A missing font is diagnosed; the Label remains renderable via fallback.
 assert page.evaluate('''id=>CartoRig.execute({type:'SetProperty',id,path:'typography.font_family',value:'CartoRigFontThatNeverExists_7ac5'})''',label)
 page.locator('.tree-row[data-id="'+label+'"]').click()
 assert 'Font unavailable' in page.locator('#inspector').inner_text()
 # Marker duplication must never move the route link to the new UUID.
 selection_before=page.evaluate('id=>CartoRig.scene.objects[id].from.linked_object_id',route)
 assert page.evaluate("id=>CartoRig.execute({type:'DuplicateObject',id})",marker)
 assert page.evaluate('id=>CartoRig.scene.objects[id].from.linked_object_id',route)==selection_before
 shape=create('Shape',{'name':'Editorial Polygon','shape_kind':'Polygon','coordinate_space':'geo','points':[{'lon':-40,'lat':-20},{'lon':-35,'lat':-20},{'lon':-36,'lat':-15}],'editorial':True,'style':{'stroke_color':'#ffffff','fill_color':'#ff000077'}})
 assert shape
 callout=create('Shape',{'name':'Callout','shape_kind':'Callout','coordinate_space':'geo','points':[{'lon':-47,'lat':-15},{'lon':-42,'lat':-15}],'callout_box':{'x':.55,'y':.3},'text':'Attention','style':{'stroke_color':'#ffffff'}})
 distance=create('Shape',{'name':'Measure','shape_kind':'Distance','coordinate_space':'geo','points':[{'lon':0,'lat':0},{'lon':1,'lat':0}],'style':{}})
 assert shape and callout and distance
 # Locked objects must never be modified.
 assert page.evaluate('''id=>CartoRig.execute({type:'SetLock',id,value:true})''',shape)
 assert not page.evaluate('''id=>CartoRig.execute({type:'SetProperty',id,path:'points',value:[]})''',shape)
 page.locator('#tabStyles').click();page.locator('#uxCanvasOptions').evaluate('(e)=>e.open=true');page.locator('#resolution').select_option('1920x1080');page.locator('#transparent').check()
 page.locator('#exportMenu').evaluate('(e)=>e.open=true')
 with page.expect_download(timeout=60000) as d:page.locator('#exportImage').click()
 image=Path(tmp)/'scene.png';d.value.save_as(image)
 assert Image.open(image).size==(1920,1080)
 # Exported objects should all share the full-resolution coordinates.
 page.locator('#saveProject').click()
 page.wait_for_function('Boolean(window._lastProductionSaved)')
 saved=Path(tmp)/'cartorig13.cartorig'
 saved.write_text(json.dumps(page.evaluate('window._lastProductionSaved')),encoding='utf-8')
 parsed=json.loads(saved.read_text());assert parsed['objects'][route]['waypoints'][0]['lon']==-49
 assert parsed['objects'][shape]['editorial'] is True
 page.locator('#fileMenu').evaluate('(e)=>e.open=true')
 with page.expect_file_chooser() as d:page.locator('#openProject').click()
 d.value.set_files(str(saved));page.wait_for_timeout(300)
 assert page.evaluate('''({label,shape})=>CartoRig.scene.objects[label].position_mode==='screen'&&CartoRig.scene.objects[shape].points.length===3''',{'label':label,'shape':shape})
 # Deleting linked Marker must require freeze and preserve valid anchor.
 assert not page.evaluate("id=>CartoRig.execute({type:'DeleteObject',id})",marker)
 assert page.evaluate("id=>CartoRig.execute({type:'DeleteObject',id,freeze:true})",marker)
 assert page.evaluate('''id=>{let p=CartoRig.scene.objects[id].from;return p.linked_object_id===null&&p.lon===-46&&p.lat===-15.7}''',route)
 # Actual canvas toolbar interaction: tool click, multi-vertex draft and Enter.
 def canvas_click(lon,lat):
  q=page.evaluate('''([lon,lat])=>{let c=document.querySelector('#mapCanvas'),d=CartoRig.scene,[x,y]=project(d,lon,lat,c.width,c.height),r=c.getBoundingClientRect();return {x:r.left+x*r.width/c.width,y:r.top+y*r.height/c.height};}''',[lon,lat]);page.mouse.click(q['x'],q['y'])
 page.locator('#worldView').click()
 page.locator('#toolRoute').click()
 page.locator('#routeType').select_option('Curved')
 canvas_click(-25,30);canvas_click(25,30)
 assert any(o['type']=='Route' and o['path_type']=='Curved' for o in page.evaluate('Object.values(CartoRig.scene.objects)'))
 page.locator('#toolShape').click();page.locator('#shapeType').select_option('Polygon')
 canvas_click(-40,30);canvas_click(-30,30);canvas_click(-35,22)
 page.keyboard.press('Enter')
 assert any(o.get('shape_kind')=='Polygon' for o in page.evaluate('Object.values(CartoRig.scene.objects)'))
 # Cancelled draft must not persist a half route.
 initial=page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Route').length")
 page.locator('#toolRoute').click();canvas_click(10,10);page.keyboard.press('Escape')
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(x=>x.type==='Route').length")==initial
 page.locator('#toolLabel').click();canvas_click(20,-20)
 assert page.locator('.creative-text-editor').count()==1
 page.locator('.creative-text-editor').fill('Título — Привет\nSegunda linha')
 page.locator('.creative-text-editor').press('Control+Enter')
 assert any(o['type']=='Label' and 'Привет' in o['text'] for o in page.evaluate('Object.values(CartoRig.scene.objects)'))
 # Full UI marker symbol selection, independent from route anchors.
 page.locator('#toolMarker').click();page.locator('#markerSymbol').select_option('Airport');canvas_click(20,25)
 assert any(o['type']=='Marker' and o['symbol']=='Airport' for o in page.evaluate('Object.values(CartoRig.scene.objects)'))
 # SVG sanitizer rejects scripts, external resources and active content.
 assert page.evaluate('''()=>{try{sanitizeSVG('<svg><script>alert(1)</script></svg>');return false}catch(e){return true}}''')
 assert page.evaluate('''()=>{try{sanitizeSVG('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');return false}catch(e){return true}}''')
 assert page.evaluate('''()=>sanitizeSVG('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1" fill="#fff"/></svg>').includes('<path')''')
 # Dragging a route handle must preserve UUID and create exactly one undo unit.
 page.locator('#tabLayers').click()
 route_row=page.locator('.tree-row[data-id="'+route+'"]');route_row.click()
 page.locator('#inspector button',has_text='Edit handles on canvas').first.click()
 start=page.evaluate('''id=>{let o=CartoRig.scene.objects[id],c=document.querySelector('#mapCanvas'),[x,y]=project(CartoRig.scene,o.from.lon,o.from.lat,c.width,c.height),r=c.getBoundingClientRect();return {x:r.left+x*r.width/c.width,y:r.top+y*r.height/c.height};}''',route)
 before_anchor=page.evaluate('id=>CartoRig.scene.objects[id].from',route)
 undo_before=page.evaluate('CartoRig.history.undo')
 page.mouse.move(start['x'],start['y']);page.mouse.down();page.mouse.move(start['x']+32,start['y']+12,steps=5);page.mouse.up()
 new_anchor=page.evaluate('id=>CartoRig.scene.objects[id].from',route)
 assert new_anchor['lon']!=before_anchor['lon'],(new_anchor,before_anchor)
 assert page.evaluate('CartoRig.history.undo')==undo_before+1
 page.locator('#undo').click()
 assert page.evaluate('id=>CartoRig.scene.objects[id].from',route)==before_anchor
 page.locator('#redo').click()
 assert page.evaluate('id=>CartoRig.scene.objects[id].from',route)==new_anchor
 # Screen-pinned label is invariant under changes to the map camera.
 pinned_before=page.evaluate('''id=>{let o=CartoRig.scene.objects[id];return creativeHandles(CartoRig.scene,o,1920,1080,project)[0].xy}''',label)
 page.locator('#worldView').click()
 pinned_after=page.evaluate('''id=>{let o=CartoRig.scene.objects[id];return creativeHandles(CartoRig.scene,o,1920,1080,project)[0].xy}''',label)
 assert pinned_before==pinned_after,(pinned_before,pinned_after)
 # Export isolated Shape onto a full-size canvas: transparent outside shape.
 result=page.evaluate('''id=>{let cv=document.createElement('canvas');cv.width=1920;cv.height=1080;renderScene(cv.getContext('2d'),CartoRig.scene,window.__test_countries||[],{_geo:CartoRig.geoCatalog},1920,1080,{onlyIds:[id]});let data=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let a0=data[3],count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;return [a0,count,cv.width,cv.height]}''',shape)
 assert result[0]==0 and result[1]>0 and result[2:]==[1920,1080],result
 # 8K isolated image on the same full-frame geo/camera coordinate system.
 eight=page.evaluate('''async id=>{let cv=document.createElement('canvas');cv.width=7680;cv.height=4320;let cx=cv.getContext('2d');renderScene(cx,CartoRig.scene,[],{_geo:CartoRig.geoCatalog},7680,4320,{onlyIds:[id]});let b=await new Promise(ok=>cv.toBlob(ok,'image/png'));let result=[cv.width,cv.height,b?.size||0];cv.width=0;cv.height=0;return result;}''',route)
 assert eight[0:2]==[7680,4320] and eight[2]>0,eight
 assert not errs,errs
 print('Canvas toolbars, curved click route, polygon 3 vertices, Esc cancel, inline Unicode, marker symbol and SVG sanitization: PASS',flush=True)
 assert not errs,errs
 print('CartoRig 1.3: edit, linked markers, 4 route modes, custom waypoints, UTF-8 multi-line, Screen Pinned, editorial shape, callout, distance, alpha PNG, save/reopen and Freeze Links: PASS',flush=True)
 b.close()
