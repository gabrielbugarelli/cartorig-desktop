#!/usr/bin/env python3
"""Create full-source ZIP including the complete immutable Natural Earth data."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib
root=Path(__file__).resolve().parents[1]
dist=root/'dist';dist.mkdir(exist_ok=True)
out=dist/'CartoRig-2.0.4.1-Source-Complete-Offline.zip'
required=['assets/geodata/admin1_world.geojson','assets/geodata/cities_world_full.geojson','assets/geodata/offline_integrity.json']
for name in required:
 assert (root/name).is_file(),f'RELEASE BLOCKED: missing {name}'
files=[]
for file in root.rglob('*'):
 if not file.is_file():continue
 rel=file.relative_to(root)
 if rel.parts[0] in ('.git','dist','installer_payload') or '__pycache__' in rel.parts:continue
 if file.suffix.lower() in ('.pyc','.png','.zip','.cartorig','.exe') and rel.parts[0]=='tests':continue
 files.append(file)
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
 for file in files:z.write(file,'CartoRig-2.0.4.1-Source/'+file.relative_to(root).as_posix())
with ZipFile(out) as z:
 assert z.testzip() is None
 members=z.namelist()
 for name in required:assert 'CartoRig-2.0.4.1-Source/'+name in members
print('SOURCE ZIP VERIFIED',out,out.stat().st_size,'bytes',len(files),'files',flush=True)
