"""Extra M1 regression tests: ordering, lock, undo and 4K image export."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re,struct
assets=Path(__file__).resolve().parents[1]/'assets';out=Path(__file__).resolve().parent
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
from module_loader import browser_bundle
js=browser_bundle(assets if 'assets' in globals() else root/'assets')
data={f:json.loads((assets/f).read_text()) for f in ['countries.json','geodata/cities_world.geojson','geodata/br_states.geojson','geodata/localities.json','geodata/continents.json','geodata/admin1-names.json']}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1500,'height':890},accept_downloads=True)
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
 page.evaluate('''data=>{window.fetch=async u=>{if(u==='/api/session')return new Response(JSON.stringify({token:'test'}));if(u==='/api/cities/status'||u==='/api/admin1/status')return new Response(JSON.stringify({installed:false}));if(u==='/api/cities/install'||u==='/api/admin1/install')return new Response('Offline test',{status:503});if(u==='/api/geo-packs')return new Response('[]');if(u.startsWith('/assets/')&&data[u.slice(8)])return new Response(JSON.stringify(data[u.slice(8)]));throw Error('unhandled '+u);}}''',data)
 page.add_script_tag(content=js);page.wait_for_function('CartoRig.ready===true')
 page.evaluate('''()=>{for(let [iso,c] of [['BRA','#ff0000'],['ARG','#00ff00'],['CHL','#0000ff']]){
 CartoRig.execute({type:'CreateObject',object:{id:uuid(),type:'Region',name:iso,visible:true,locked:false,opacity:1,parent_id:null,style:{fill_color:c,fill_opacity:1},source:{feature_id:iso}}});}
 }''')
 ids=page.evaluate("Object.values(CartoRig.scene.objects).filter(o=>o.type==='Region').map(o=>o.id)")
 assert len(ids)==3
 # Move top layer to start of the author-owned portion: only structural map layers remain below.
 page.evaluate('''ids=>CartoRig.execute({type:'MoveObject',id:ids[2],parent_id:null,index:3})''',ids)
 order=page.evaluate("CartoRig.scene.scene.root_ids.slice(3)")
 assert order==[ids[2],ids[0],ids[1]],order
 page.evaluate('''ids=>CartoRig.execute({type:'SetLock',id:ids[0],value:true})''',ids)
 before=page.evaluate('CartoRig.scene.objects')
 assert page.evaluate('''ids=>CartoRig.execute({type:'RenameObject',id:ids[0],name:'Must Fail'})''',ids)==False
 assert page.evaluate('CartoRig.scene.objects')==before
 page.evaluate('''ids=>CartoRig.execute({type:'SetLock',id:ids[0],value:false})''',ids)
 page.evaluate('''ids=>CartoRig.execute({type:'GroupSelection',ids:ids.slice(0,2)})''',ids)
 assert page.evaluate("Object.values(CartoRig.scene.objects).filter(o=>o.type==='Group').length")==1
 # A group with zero opacity must not alter member styles.
 g=page.evaluate("Object.values(CartoRig.scene.objects).find(o=>o.type==='Group').id")
 page.evaluate("id=>CartoRig.execute({type:'SetProperty',id,path:'opacity',value:0.5})",g)
 assert page.evaluate('CartoRig.scene.objects')[ids[0]]['style']['fill_color']=='#ff0000'
 page.locator('#tabStyles').click();page.locator('#resolution').select_option('3840x2160')
 with page.expect_download(timeout=120000) as res: page.locator('#exportImage').click()
 file=out/'m1-4k.png';res.value.save_as(file)
 assert struct.unpack('>II',file.read_bytes()[16:24])==(3840,2160)
 print('4K PNG valid:',round(file.stat().st_size/1024/1024,2),'MB')
 print('Reorder, lock, rollback, group opacity tests passed')
 b.close()
