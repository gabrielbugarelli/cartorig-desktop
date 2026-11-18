#!/usr/bin/env python3
"""Derive small, offline map-label anchors from the bundled Natural Earth datasets.

No remote sources, runtime geometry parsing, or fabricated political features.
Water/continent name anchors are editorial placements (not polygon evidence).
"""
from pathlib import Path
import json
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1] / 'assets'
geo = ROOT / 'geodata'
read = lambda p: json.loads(p.read_text(encoding='utf-8'))


def coords(g):
    if not g: return None
    try:
        sh = shape(g)
        if sh.is_empty: return None
        if sh.geom_type == 'MultiPolygon':
            sh = max(sh.geoms, key=lambda p: p.area)
        point = sh.centroid
        if not sh.covers(point): point = sh.representative_point()
        if not (-180 <= point.x <= 180 and -90 <= point.y <= 90): return None
        return [round(point.x, 4), round(point.y, 4)]
    except Exception: return None

countries=[]
for f in read(ROOT/'countries.json'):
    pos=coords(f.get('geometry'))
    if pos and f.get('name'):
        # approximate visual importance from territorial area; not geopolitical ranking
        area=round(abs(shape(f['geometry']).area),2)
        countries.append([f['name'],*pos,area])
countries.sort(key=lambda r:-r[3])

states=[]
for f in read(geo/'admin1_world.geojson')['features']:
    p=f.get('properties') or {}
    name=p.get('name_en') or p.get('name')
    if not name: continue
    lon=p.get('longitude');lat=p.get('latitude')
    if not isinstance(lon,(int,float)) or not isinstance(lat,(int,float)):
        pos=coords(f.get('geometry'))
    else:pos=[lon,lat]
    if not pos or abs(pos[0])>180 or abs(pos[1])>90:continue
    rank=p.get('labelrank') or p.get('scalerank') or 5
    states.append([str(name),round(pos[0],4),round(pos[1],4),int(rank)])
states.sort(key=lambda r:r[3])

national=[];regional=[];cities=[]
for f in read(geo/'cities_world_full.geojson')['features']:
    p=f.get('properties') or {};g=f.get('geometry') or {}
    pos=g.get('coordinates') if g.get('type')=='Point' else None
    if not pos or len(pos)<2:continue
    name=p.get('NAME_EN') or p.get('NAME') or p.get('NAMEASCII')
    if not name: continue
    rank=p.get('LABELRANK')
    if not isinstance(rank,(int,float)):rank=p.get('SCALERANK') or 8
    pop=p.get('POP_MAX') or 0
    row=[str(name),round(pos[0],4),round(pos[1],4),int(rank),int(pop) if isinstance(pop,(int,float)) else 0]
    cl=str(p.get('FEATURECLA') or '').lower()
    if p.get('ADM0CAP')==1 or cl.startswith('admin-0 capital'):
        national.append(row)
    elif 'admin-1' in cl and 'capital' in cl:
        regional.append(row)
    elif 'populated' in cl:
        cities.append(row)
# Draw the most populated places first; low label-rank micro-capitals must not
# displace major capitals such as Paris, Berlin or Warsaw.
for rows in (national,regional,cities):rows.sort(key=lambda r:(-r[4],r[3]))

# Editorial geographical name placements; not a claim of exact hydrological boundaries.
continents=[['Africa',19,4],['Europe',18,54],['Asia',95,41],['North America',-101,41],['South America',-61,-15],['Oceania',135,-23],['Antarctica',10,-80]]
oceans=[['Atlantic Ocean',-35,1],['North Atlantic Ocean',-40,33],['South Atlantic Ocean',-21,-33],['Pacific Ocean',-142,5],['North Pacific Ocean',-160,37],['South Pacific Ocean',-130,-31],['Indian Ocean',77,-24],['Arctic Ocean',0,81],['Southern Ocean',-20,-62]]
seas=[['Mediterranean Sea',18,36],['Black Sea',34.5,43],['Baltic Sea',20.5,57.5],['North Sea',3,56],['Caspian Sea',51,41.5],['Adriatic Sea',16,42.8],['Aegean Sea',25,39],['Ionian Sea',19,37],['Tyrrhenian Sea',11.3,40.6],['Sea of Marmara',28,40.7],['Norwegian Sea',3,67],['Barents Sea',42,74],['White Sea',36,65.4],['Kara Sea',74,75],['Laptev Sea',123,74],['East Siberian Sea',157,72],['Bering Sea',-176,59],['Sea of Okhotsk',149,55],['Sea of Japan',135,41],['East China Sea',125,29],['South China Sea',115,15],['Philippine Sea',132,22],['Coral Sea',155,-19],['Tasman Sea',160,-39],['Arabian Sea',65,17],['Red Sea',39,20],['Persian Gulf',51,26],['Bay of Bengal',88,15],['Andaman Sea',95,11],['Caribbean Sea',-73,16],['Gulf of Mexico',-91,24],['Gulf of Guinea',2,1],['Gulf of Aden',48,12],['Bay of Biscay',-6,46],['English Channel',-2.4,50],['Irish Sea',-5.2,53.5],['Gulf of Bothnia',21.8,63.3],['Ligurian Sea',9.4,43.5],['Labrador Sea',-53,59],['Greenland Sea',-7,74],['Sargasso Sea',-52,29],['Hudson Bay',-85,59],['Baffin Bay',-68,74],['Beaufort Sea',-143,73],['Celebes Sea',122,3],['Java Sea',112,-5],['Timor Sea',128,-11],['Arafura Sea',136,-9]]
# Deduplicate repeated capitals where source provides multiple editorial name records.
for key,rows in [('national_capitals',national),('regional_capitals',regional),('cities',cities)]:
    seen=set();out=[]
    for x in rows:
        index=(x[0].casefold(),round(x[1],2),round(x[2],2))
        if index in seen:continue
        seen.add(index);out.append(x[:4])
    if key=='national_capitals':national=out
    elif key=='regional_capitals':regional=out
    else:cities=out
catalog={
 'version':1,'sources':{'political':'Bundled Natural Earth Admin 0 / Admin 1','populated':'Bundled Natural Earth Populated Places','water':'Editorial sea/ocean name anchor locations'},
 'countries':countries,'states':states,'national_capitals':national,'regional_capitals':regional,'cities':cities,'continents':continents,'oceans':oceans,'seas':seas
}
output=geo/'map_labels.json';output.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Created',output,format(output.stat().st_size,','),'bytes')
for k,v in catalog.items():
 if isinstance(v,list):print(k,len(v))
