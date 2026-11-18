#!/usr/bin/env python3
"""Fetch/validate real Natural Earth GeoJSON and install immutable offline assets.

This tool deliberately rejects truncated or fabricated sample fixtures and pins the
exact source Git blob hashes from the original upstream repositories. It requires
Internet when source paths are not provided. Python 3.10+, stdlib only.

Usage: python tools/prepare_offline_datasets.py
       python tools/prepare_offline_datasets.py --admin1 path/to/admin1.geojson --cities path/to/places.geojson
       python tools/prepare_offline_datasets.py --verify-only
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
GEODATA=ROOT/'assets'/'geodata'
LOCK=json.loads((GEODATA/'SOURCE_LOCK.json').read_text(encoding='utf-8'))['sources']
DEST={'admin1':GEODATA/'admin1_world.geojson','cities':GEODATA/'cities_world_full.geojson'}

def die(message):raise RuntimeError(message)

def normalize(text):
 import unicodedata
 return ''.join(c for c in unicodedata.normalize('NFKD',str(text or '')) if not unicodedata.combining(c)).casefold()

def blob_sha(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()

def geometry_vertices(coords):
 if isinstance(coords,list) and len(coords)>=2 and all(isinstance(q,(int,float)) for q in coords[:2]):
  return 1,coords[0],coords[1]
 if not isinstance(coords,list):die('Invalid GeoJSON coordinates nesting')
 n=0
 for row in coords:
  q,_,_=geometry_vertices(row);n+=q
 return n,0,0

def validate_geometry(geometry,kind,index):
 if not isinstance(geometry,dict):die(f'{kind} feature #{index} lacks geometry')
 ty=geometry.get('type');coords=geometry.get('coordinates')
 if kind=='cities':
  if ty!='Point' or not isinstance(coords,list) or len(coords)<2:die(f'City #{index} has invalid point geometry')
  x,y=coords[:2]
  if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (x,y)) or not -180<=x<=180 or not -90<=y<=90:
   die(f'City #{index} has invalid longitude/latitude')
  return 1,False
 if ty not in ('Polygon','MultiPolygon') or not isinstance(coords,list):die(f'Admin1 #{index} lacks Polygon/MultiPolygon')
 polys=[coords] if ty=='Polygon' else coords
 if not polys:die(f'Admin1 #{index} is empty')
 vertices=0;has_holes=False
 for poly in polys:
  if not isinstance(poly,list) or not poly:die(f'Admin1 #{index} polygon is empty')
  has_holes=has_holes or len(poly)>1
  for ring in poly:
   if not isinstance(ring,list) or len(ring)<4 or ring[0][:2]!=ring[-1][:2]:die(f'Admin1 #{index} has unclosed/short ring')
   for p in ring:
    if not isinstance(p,list) or len(p)<2 or any(not isinstance(q,(int,float)) or not math.isfinite(q) for q in p[:2]):die(f'Admin1 #{index} has a malformed vertex')
    x,y=p[:2]
    if not -180.001<=x<=180.001 or not -90.001<=y<=90.001:die(f'Admin1 #{index} has out-of-range coordinates')
    vertices+=1
 return vertices,has_holes

def verify_real_data(name,raw):
 spec=LOCK[name]
 expected=spec['git_blob_sha1'];actual=blob_sha(raw)
 if actual!=expected:die(f'{name}: source Git blob mismatch; expected {expected}, got {actual}. DO NOT publish changed/unverified data.')
 try:data=json.loads(raw)
 except Exception as exc:die(f'{name}: invalid JSON: {exc}')
 feats=data.get('features') if data.get('type')=='FeatureCollection' else None
 if not isinstance(feats,list) or len(feats)!=spec['feature_count']:
  die(f'{name}: expected EXACTLY {spec["feature_count"]} features, got {len(feats) if isinstance(feats,list) else "invalid"}')
 parents=set();records=[];vertices=0;holes=0;multi=0;names=set();related=[];types={};unnamed=[]
 for i,feat in enumerate(feats):
  if not isinstance(feat,dict) or feat.get('type')!='Feature':die(f'{name} feature #{i} invalid')
  p=feat.get('properties') or {};geo=feat.get('geometry')
  primary=p.get('name') or p.get('NAME')
  parent=p.get('admin') if name=='admin1' else p.get('adm0name')
  if not parent:parent=p.get('ADM0NAME')
  if not isinstance(parent,str) or not parent.strip():die(f'{name} #{i}: missing parent')
  if not isinstance(primary,str) or not primary.strip():
   if name!='admin1':die(f'{name} #{i}: missing city name')
   code=p.get('iso_3166_2') or p.get('adm1_code') or p.get('ne_id')
   if code is None:die(f'{name} #{i}: unnamed polygon with no source ID')
   unnamed.append({'feature_index':i,'iso_3166_2':p.get('iso_3166_2'),'adm1_code':p.get('adm1_code'),'parent':parent})
   primary=str(code)
  v,h=validate_geometry(geo,name,i);vertices+=v;holes+=int(h)
  types[geo['type']]=types.get(geo['type'],0)+1
  multi+=int(geo['type']=='MultiPolygon')
  parents.add(parent);norm=normalize(primary);names.add(norm)
  if name=='admin1':
   ne=normalize(p.get('name_en') or p.get('NAME_EN') or '')
   if norm in ('bayern','bavaria') or ne=='bavaria' or norm in ('ontario','california','mato grosso','quebec'):
    related.append({'name':primary,'name_en':p.get('name_en'),'parent':parent})
 if len(parents)<70:die(f'{name} has only {len(parents)} parent countries')
 if name=='cities' and not ('munich' in names or 'munchen' in names):die('Munich missing from worldwide city catalogue')
 if name=='admin1':
  required={'bavaria':False,'ontario':False,'california':False,'mato grosso':False}
  for v in related:
   n=normalize(v['name']);ne=normalize(v.get('name_en'))
   if n in ('bavaria','bayern') or ne=='bavaria':required['bavaria']=True
   for key in ('ontario','california','mato grosso'):
    if n==key or ne==key:required[key]=True
  if not all(required.values()):die(f'Global Admin 1 missing expected real subdivisions: {required}')
 return {'dataset_id':'ne_10m_'+('admin1_world' if name=='admin1' else 'populated_places_world'),'scale':'10m',
   'source_url':spec['url'],'source_repository':spec['repository'],'source_path':spec['path'],
   'git_blob_sha1':actual,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),
   'feature_count':len(feats),'country_count':len(parents),'geometry_types':types,'vertex_count':vertices,
   'features_with_holes':holes,'multipolygons':multi,'unnamed_features':unnamed,'coverage':'global as represented by Natural Earth',
   'license':'Natural Earth public domain; third-party Admin1 metadata redistribution terms should be checked',
   'status':'installed','integrity':'verified','file':DEST[name].name,'sample_features':related[:12]}

def download(url):
 req=Request(url,headers={'User-Agent':'CartoRig-1.2.3-Offline-Builder/1.0','Accept':'application/json'})
 with urlopen(req,timeout=180) as resp:
  if resp.status!=200:die(f'HTTP {resp.status} from {url}')
  b=resp.read(128<<20)
  if len(b)>125<<20:die('Dataset too large')
  return b

def atomic_write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True)
 fd,temporary=tempfile.mkstemp(prefix='.'+path.stem+'-',suffix='.tmp',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.replace(temporary,path)
 finally:
  if os.path.exists(temporary):os.unlink(temporary)

def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--admin1',type=Path,help='Previously downloaded official Admin1 GeoJSON')
 ap.add_argument('--cities',type=Path,help='Previously downloaded official 10m Populated Places GeoJSON')
 ap.add_argument('--verify-only',action='store_true',help='Do not download: verify existing bundled datasets')
 a=ap.parse_args();records={}
 for name in ('admin1','cities'):
  if a.verify_only:raw=DEST[name].read_bytes()
  elif getattr(a,name):raw=getattr(a,name).read_bytes()
  else:raw=download(LOCK[name]['url'])
  record=verify_real_data(name,raw)
  if not a.verify_only:atomic_write(DEST[name],raw)
  records[name]=record
  print(f'{name}: {record["feature_count"]} real features, {record["country_count"]} countries, {record["bytes"]:,} bytes, SHA-256 {record["sha256"]}',flush=True)
 out=GEODATA/'offline_integrity.json'
 manifest={'schema':'cartorig-offline-integrity-v1','app_version':'1.2.3',
   'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'sources_locked':True,'datasets':records}
 if not a.verify_only:atomic_write(out,(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n').encode())
 else:
  recorded=json.loads(out.read_text(encoding='utf-8'))
  for k in records:
   if recorded['datasets'][k]['sha256']!=records[k]['sha256']:die(f'Manifest mismatch for {k}')
 print('OFFLINE DATA: VERIFIED',flush=True)

if __name__=='__main__':
 try:main()
 except Exception as exc:print('RELEASE BLOCKED:',exc,file=sys.stderr);sys.exit(1)
