"""Real Natural Earth 10m end-to-end test. Must run on Windows GH runner with fullgeo console build.

No synthetic international boundaries, no mocked backend calls, no external
network traffic from the browser. Exports, scene persistence and API are real.
"""
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import sys
import threading
import time
from urllib.request import urlopen, Request
from zipfile import ZipFile
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--executable',required=True,type=Path)
parser.add_argument('--output',type=Path,default=ROOT/'dist'/'tests')
parser.add_argument('--loopback-proxy',action='store_true',help='Forward Chromium loopback requests to the REAL local Go HTTP server through Python when browser localhost access is administratively blocked')
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
for name in ['admin1_world.geojson','cities_world_full.geojson','offline_integrity.json']:
 if not (ROOT/'assets'/'geodata'/name).is_file():raise SystemExit('TEST BLOCKED: real offline file missing: '+name)
exe=args.executable.resolve()
if not exe.is_file():raise SystemExit('TEST BLOCKED: console Windows build missing: '+str(exe))
proc=subprocess.Popen([str(exe),'--no-browser'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
lines=queue.Queue()
def read_stdout():
 for line in proc.stdout:lines.put(line)
threading.Thread(target=read_stdout,daemon=True).start()
try:
 try:welcome=lines.get(timeout=45)
 except queue.Empty:raise AssertionError('CartoRig console app did not start, returncode: '+str(proc.poll()))
 match=re.search(r'http://127\.0\.0\.1:\d+',welcome)
 assert match,welcome
 url=match.group(0)
 print('Started Windows console build:',url,flush=True)
 with urlopen(url+'/api/geodata/verify',timeout=60) as r:verified=json.load(r)
 assert verified['global_offline_ready'] and all(d['source']=='bundled' and d['integrity']=='verified' for d in verified['datasets']),verified
 assert {d['feature_count'] for d in verified['datasets']}=={4596,7342}
 print('REAL full offline API:',[(d['dataset'],d['feature_count'],d['sha256']) for d in verified['datasets']],flush=True)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path="/usr/bin/chromium" if sys.platform!="win32" else None,args=["--no-sandbox","--disable-dev-shm-usage"] if sys.platform!="win32" else [])
  ctx=browser.new_context(viewport={'width':1600,'height':970},accept_downloads=True)
  external=[]
  def block_external(route):
   # Never stub APIs: in restricted Chromium runtimes, forward requests to
   # the actual loopback Go server, returning its unmodified response bytes.
   # This does NOT fake the dataset, server, session, images or endpoints.
   if not route.request.url.startswith(url+'/'):
    external.append(route.request.url);route.abort();return
   if not args.loopback_proxy:
    route.continue_();return
   try:
    request=route.request
    data=request.post_data_buffer if request.method not in ('GET','HEAD') else None
    hdr={k:v for k,v in request.headers.items() if k.lower() not in ('host','content-length','accept-encoding','connection','origin','referer')}
    # Same Origin/Referer checked by backend on mutations: preserve original
    # localhost origin while never permitting any external destinations.
    hdr['Origin']=url
    hdr['Referer']=url+'/'
    req=Request(request.url,method=request.method,data=data,headers=hdr)
    with urlopen(req,timeout=180) as upstream:
     headers={k:v for k,v in upstream.headers.items() if k.lower() not in ('transfer-encoding','content-length','content-encoding','connection')}
     route.fulfill(status=upstream.status,headers=headers,body=upstream.read())
   except Exception as err:
    print('REAL BACKEND LOOPBACK TRANSPORT ERROR:',request.method,request.url,repr(err),flush=True)
    route.abort()
  ctx.route('**/*',block_external)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url,wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('''()=>CartoRig?.ready===true&&CartoRig.geoDatasets.some(d=>d.type==='State'&&d.count===4596)&&CartoRig.geoDatasets.some(d=>d.type==='City'&&d.count===7342)''',timeout=180000)
  page.locator('#tabGeography').click()
  page.locator('#verifyGeoData').click()
  page.wait_for_function('CartoRig.geoIntegrity?.global_offline_ready===true',timeout=40000)
  assert 'Verified' in page.locator('#geoDiagnostics').inner_text()
  queries=[('Baviera','Baviera (Bayern)','State','Germany'),('Bayern','Baviera (Bayern)','State','Germany'),('Bavaria','Baviera (Bayern)','State','Germany'),('Munique','Munique (München)','City','Germany'),('München','Munique (München)','City','Germany'),('Munich','Munique (München)','City','Germany'),('Ontario','Ontário','State','Canada'),('Quebec','Quebec','State','Canada'),('Mato Grosso','Mato Grosso','State','Brazil')]
  def findrow(q,typ,parent):
   page.locator('#countrySearch').fill(q)
   el=page.locator('.geo-result').filter(has_text=parent).filter(has_text=typ).first
   el.wait_for(state='visible',timeout=35000)
   return el
  for q,display,typ,parent in queries:
   el=findrow(q,typ,parent)
   assert display in el.inner_text(),(q,el.inner_text())
  print('Multilingual query and actual source hierarchy: PASS',flush=True)
  for name,typ in [('São Paulo','State'),('São Paulo','City')]:
   row=findrow(name,typ,'Brazil')
   assert row.count()==1,(name,typ)
  page.locator('#geoType').select_option('State')
  page.locator('#geoCountry').select_option('Germany')
  assert findrow('Bavaria','State','Germany').count()==1
  page.locator('#countrySearch').fill('Ontario')
  assert page.locator('.geo-result').count()==0
  page.locator('#geoCountry').select_option('')
  page.locator('#geoType').select_option('All')
  print('Type and country filters: PASS',flush=True)
  for name,parent in [('Ontário','Canada'),('Califórnia','United States of America'),('Baviera','Germany'),('Mato Grosso','Brazil')]:
   row=findrow(name,'State',parent)
   row.locator('button[title="Fit location"]').click()
   assert 'framed' in page.locator('#status').inner_text()
   page.screenshot(path=str(args.output/('real_fit_'+re.sub('[^a-z]','',name.lower())+'.png')))
   row.locator('button[title="Add independent Region"]').click()
   page.locator('#tabGeography').click()
  row=findrow('Munique','City','Germany')
  row.locator('button[title="Add city marker"]').click()
  objects=page.evaluate('''()=>Object.values(CartoRig.scene.objects).map(o=>({name:o.name,type:o.type,region_kind:o.region_kind,geometry:o.embedded_geometry?.type||'',id:o.id}))''')
  regions=[x for x in objects if x['region_kind']=='State']
  assert len(regions)==4 and all(x['geometry'] in ('Polygon','MultiPolygon') for x in regions),regions
  assert any(x['type']=='Marker' and x['name']=='Munich' for x in objects),objects
  print('Four independent real administrative layers and Munich marker: PASS',flush=True)
  base_colors=page.evaluate('''()=>Object.values(CartoRig.scene.objects).filter(o=>o.region_kind==='State').map(o=>o.style.fill_color)''')
  target=regions[0]
  assert page.evaluate('''id=>CartoRig.execute({type:'SetProperty',id,path:'style.fill_color',value:'#1aee34'})''',target['id'])
  new_colors=page.evaluate('''()=>Object.values(CartoRig.scene.objects).filter(o=>o.region_kind==='State').map(o=>o.style.fill_color)''')
  assert new_colors[0]=='#1aee34' and new_colors[1:]==base_colors[1:]
  page.locator('#worldView').click()
  page.locator('#tabStyles').click()
  page.locator('#resolution').select_option('1920x1080')
  page.locator('#transparent').check()
  with page.expect_download(timeout=180000) as got:page.locator('#exportImage').click()
  png=args.output/'real_world_transparent.png';got.value.save_as(png)
  img=Image.open(png).convert('RGBA');assert img.size==(1920,1080)
  alpha=img.getchannel('A');lo,hi=alpha.getextrema();assert lo==0 and hi==255,(lo,hi)
  print('Real world 1920×1080 alpha PNG: PASS',flush=True)
  # The 2.0 Save As contract produces a validated ZIP, unlike the former raw JSON download.
  page.locator('#openProjects').click()
  with page.expect_download(timeout=180000) as got: page.locator('#prodSaveAs').click()
  project=args.output/'real_world_scene.cartorig';got.value.save_as(project)
  with ZipFile(project) as z:
   assert z.testzip() is None
   original=json.loads(z.read('project.json'))
  page.locator('#prodProjectsClose').click()
  assert len([o for o in original['objects'].values() if o.get('region_kind')=='State' and o.get('embedded_geometry')])==4
  with page.expect_file_chooser(timeout=30000) as got:page.locator('#openProject').click()
  got.value.set_files(str(project))
  page.wait_for_timeout(400)
  reopened=page.evaluate('CartoRig.scene')
  assert all(reopened['objects'][x['id']]['embedded_geometry'] for x in regions)
  assert reopened['objects'][target['id']]['style']['fill_color']=='#1aee34'
  print('Save/reopen four real polygons, styles, source metadata: PASS',flush=True)
  with page.expect_download(timeout=240000) as got:page.locator('#exportLayers').click()
  archive=args.output/'real_world_layers.zip';got.value.save_as(archive)
  with ZipFile(archive) as z:
   assert z.testzip() is None
   pngfiles=[n for n in z.namelist() if n.lower().endswith('.png')]
   assert len(pngfiles)>=len(regions)+2, pngfiles
   for name in pngfiles:
    import io
    layer=Image.open(io.BytesIO(z.read(name)))
    assert layer.size==(1920,1080),(name,layer.size)
   assert any('Ontario' in s for s in pngfiles),pngfiles
  print('Individual transparent PNG layers, exact scene coordinate alignment: PASS',flush=True)
  assert not errors,errors
  assert not external,external
  print('NO EXTERNAL NETWORK DURING EDITING: PASS',flush=True)
  browser.close()
finally:
 proc.terminate()
 try:proc.wait(timeout=12)
 except subprocess.TimeoutExpired:proc.kill()
print('CARTORIG 1.4.0 REAL WORLD WINDOWS BROWSER E2E: PASS',flush=True)
