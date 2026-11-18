"""Browser Canvas 2D alpha, group isolation, holes and effect pixel tests (M4)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json,sys
from module_loader import browser_bundle
assets=Path(__file__).resolve().parents[1]/'assets'
html=re.sub(r'<script type="module" src="/assets/app\.js"></script>','',(assets/'index.html').read_text())
geo_files=['countries.json','geodata/localities.json','geodata/admin1-names.json','geodata/continents.json','geodata/br_states.geojson','geodata/cities_world.geojson']
data={p:json.loads((assets/p).read_text()) for p in geo_files}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=b.new_page(viewport={'width':1450,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(assets/'style.css').read_text())
 page.evaluate('''d=>{window.fetch=async(u,opts={})=>{if(u==='/api/session')return new Response('{"token":"t"}');if(u==='/api/styles')return new Response('[]');if(u==='/api/geo-packs')return new Response('[]');if(u==='/api/admin1/status'||u==='/api/cities/status')return new Response('{"installed":false}');if(u==='/api/admin1/install'||u==='/api/cities/install')return new Response('offline',{status:503});if(u==='/api/geodata/verify')return new Response('{"global_offline_ready":false,"datasets":[]}');if(u.startsWith('/assets/')&&d[u.slice(8)])return new Response(JSON.stringify(d[u.slice(8)]));throw Error('Unhandled '+u);};}''',data)
 page.add_script_tag(content=browser_bundle(assets));page.wait_for_function('CartoRig.ready===true')
 out=page.evaluate('''()=>{
  const d=newDocument();d.canvas.transparent=true;d.camera.center_lon=5;d.camera.center_lat=5;d.camera.zoom=10;
  for(const o of Object.values(d.objects))o.visible=false;
  const geometry={type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]]};
  const region=madeObject('Region','Hole',{region_kind:'State',source:{feature_id:'hole-test'},embedded_geometry:geometry,style:{fill_color:'#ff0000',fill_opacity:1,stroke_width:0}});
  d.objects[region.id]=region;d.scene.root_ids.push(region.id);
  let cv=document.createElement('canvas');cv.width=400;cv.height=200;
  const ctx=cv.getContext('2d');let images={_geo:null};
  const sample=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
  const render=()=>renderScene(ctx,d,[],images,400,200);
  render();let hole=sample(200,100),outer=sample(155,100);
  region.style.shadow_enabled=true;region.style.shadow_color='#000000';region.style.shadow_opacity=.7;region.style.shadow_blur=12;region.style.shadow_distance=9;region.style.shadow_angle=45;region.style.glow_enabled=true;region.style.glow_color='#f9b700';region.style.glow_radius=12;region.style.glow_intensity=1;render();
  let holeFX=sample(200,100),outerFX=sample(155,100),alphaHist=[0,0];const pixels=ctx.getImageData(0,0,400,200).data;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>0&&pixels[i]<255)alphaHist[0]++;if(pixels[i]===255)alphaHist[1]++;}
  region.style.shadow_enabled=false;region.style.glow_enabled=false;region.style.fill_opacity=1;
  const group=madeObject('Group','Overlay',{children:[region.id],opacity:.5});
  d.objects[group.id]=group;d.scene.root_ids=d.scene.root_ids.filter(id=>id!==region.id);d.scene.root_ids.push(group.id);region.parent_id=group.id;
  let second=madeObject('Region','Above',{region_kind:'State',source:{feature_id:'hole-test'},embedded_geometry:geometry,style:{fill_color:'#00ff00',fill_opacity:1,stroke_width:0},parent_id:group.id});
  group.children.push(second.id);d.objects[second.id]=second;
  render();let grouped=sample(155,100);
  const blue=madeObject('Region','Background',{region_kind:'State',source:{feature_id:'hole-test'},embedded_geometry:geometry,style:{fill_color:'#0000ff',fill_opacity:1,stroke_width:0}});
  d.objects[blue.id]=blue;d.scene.root_ids.unshift(blue.id);
  render();let normalBlend=sample(155,100);
  group.style={blend_mode:'multiply'};render();let blended=sample(155,100);
  // Cache expected: same WGS84 geometry + same view -> hit on every style-only redraw.
  const cacheHits=polygonCacheStats.hits,cacheMisses=polygonCacheStats.misses;
  region.style.fill_color='#ae1133';render();const cacheReused=polygonCacheStats.hits>cacheHits;
  d.camera.zoom=11;render();const cacheInvalidated=polygonCacheStats.misses>cacheMisses;
  // Pixel isolation for the exact same render with and without UI selection.
  return {hole,outer,holeFX,outerFX,alphaHist,grouped,normalBlend,blended,cacheReused,cacheInvalidated};
 }''')
 assert out['hole'][3]==0,out
 assert out['outer'][3]==255,out
 assert out['holeFX'][3]<50,out # no opaque rectangle filling polygon hole
 assert out['outerFX'][3]>100,out
 assert out['alphaHist'][0]>0,out
 assert 120<=out['grouped'][3]<=136,out # two overlapping layers, only one group opacity
 assert out['normalBlend'][3]==out['blended'][3]==255,out
 assert out['normalBlend'][1]>out['blended'][1]+50,out
 assert out['cacheReused'] and out['cacheInvalidated'],out
 assert not errors,errors
 print('M4 pixels: evenodd polygon hole, alpha shadow/glow, transparent outside, isolated group opacity and blend: PASS',out)
 b.close()
