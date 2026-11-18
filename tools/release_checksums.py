#!/usr/bin/env python3
"""Fail release if binaries, source archive or evidence are incomplete."""
from pathlib import Path
import hashlib
import sys
import json
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
files=['CartoRig-2.0.4.1-Portable-Windows-x64.exe','CartoRig-2.0.4.1-Setup-Windows-x64.exe','CartoRig-2.0.4.1-Source-Complete-Offline.zip']
records=[]
for name in files:
 p=dist/name
 assert p.is_file() and p.stat().st_size>10000000, 'RELEASE BLOCKED: missing/truncated '+name
 b=p.read_bytes()
 if p.suffix=='.exe':assert b[:2]==b'MZ','RELEASE BLOCKED: not PE '+name
 records.append({'name':name,'size_bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
geo=json.loads((root/'assets/geodata/offline_integrity.json').read_text())
assert geo['datasets']['admin1']['feature_count']==4596
assert geo['datasets']['cities']['feature_count']==7342
native_e2e=(dist/'tests'/'real_world_transparent.png').is_file()
allow_crossbuild='--cross-build' in sys.argv
assert native_e2e or allow_crossbuild,'RELEASE BLOCKED: real-world Windows E2E evidence missing'
manifest={'version':'2.0.4.1','os':'Windows x64','offline_global_geodata':True,'real_world_e2e':native_e2e,'real_geodata_embedded_browser_e2e':(dist/'local-real-e2e'/'cartorig-real-geodata-transparent.png').is_file(),'native_windows_homologated':native_e2e and not allow_crossbuild,'files':records,
          'datasets':geo['datasets']}
(dist/'CartoRig-2.0.4.1-Release-Checksums.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
(dist/'SHA256SUMS.txt').write_text(''.join(f'{r["sha256"]}  {r["name"]}\n' for r in records))
for r in records:print(r['sha256'],r['name'],flush=True)
print('RELEASE CHECKSUMS GENERATED; Windows E2E:',native_e2e,'crossbuild:',allow_crossbuild,flush=True)
