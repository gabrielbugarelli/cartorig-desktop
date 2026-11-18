"""Real offline Go HTTP integration: save, reopen, autosave, PNG ZIP session, download.
Run with --executable path/to/CartoRig-console (native build, no browser).
"""
import argparse,subprocess,os,re,json,tempfile,urllib.request,io,zipfile,time,sys
from PIL import Image
parser=argparse.ArgumentParser();parser.add_argument('--executable',required=True);args=parser.parse_args()
with tempfile.TemporaryDirectory(prefix='CartoRig_Prod_E2E_') as root:
 env={**os.environ,'CARTORIG_DATA_DIR':root}
 proc=subprocess.Popen([args.executable,'--no-browser'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
 try:
  line=proc.stdout.readline().strip();match=re.search(r'http://127\.0\.0\.1:\d+',line)
  assert match, f'Go HTTP server failed to start: {line}'
  base=match.group(0)
  def req(path,method='GET',data=None,token=None,ctype='application/json'):
   headers={}
   if token:headers['X-CartoRig-Token']=token
   if data is not None:headers['Content-Type']=ctype
   r=urllib.request.Request(base+path,method=method,data=data,headers=headers)
   with urllib.request.urlopen(r,timeout=35) as reply:return reply.read()
  token=json.loads(req('/api/session'))['token'];assert len(token)>=32
  project={'format':'cartorig-project','schema_version':'2.0.0','project_id':'e53517e4-4ce8-49fb-bceb-49dc9665a186','name':'Real-HTTP-Production','revision':3,'canvas':{'width':64,'height':64,'transparent':False},'camera':{'projection':'equirectangular','center_lat':0,'center_lon':0,'zoom':1,'bearing':0},'scene':{'root_ids':['world']},'objects':{'world':{'id':'world','type':'WorldMap','name':'WorldMap','visible':True,'parent_id':None}},'theme':{'id':'dark','overrides':{}},'asset_refs':[]}
  raw=json.dumps(project).encode()
  ack=json.loads(req('/api/v2/project/save','POST',raw,token));assert ack['ok']
  loaded=json.loads(req('/api/v2/project/load?id='+project['project_id'],token=token));assert loaded==project
  project['revision']=4;raw=json.dumps(project).encode();assert json.loads(req('/api/v2/autosave','POST',raw,token))['ok'];rec=json.loads(req('/api/v2/recovery',token=token));assert rec[0]['revision']==4
  resp=json.loads(req('/api/v2/export/session','POST',json.dumps({'width':64,'height':64,'project':project}).encode(),token));sid=resp['id']
  image=Image.new('RGBA',(64,64),(0,0,0,0));image.putpixel((20,20),(255,33,88,255));buf=io.BytesIO();image.save(buf,format='PNG');data=buf.getvalue()
  assert json.loads(req('/api/v2/export/session/'+sid+'/entry?name=final.png','POST',data,token,'image/png'))['ok']
  assert json.loads(req('/api/v2/export/session/'+sid+'/finish','POST',b'',token))['complete']
  zipdata=req('/api/v2/export/download/'+sid,token=token)
  with zipfile.ZipFile(io.BytesIO(zipdata)) as z:
   assert z.read('CartoRig/final.png')==data
   assert 'CartoRig/project.cartorig' in z.namelist()
   assert 'CartoRig/data/source-manifest.json' in z.namelist()
   assert json.loads(z.read('CartoRig/manifest.json'))['width']==64
  assert json.loads(req('/api/v2/export/session/'+sid,'DELETE',token=token))['canceled']
  print('M5 real Go HTTP: Save/Open, Recovery, validated PNG, incremental ZIP, project package, cancel: PASS')
 finally:
  try:req('/api/quit','POST',b'',token if 'token' in locals() else None)
  except Exception:pass
  try:proc.wait(timeout=4)
  except subprocess.TimeoutExpired:proc.kill()
