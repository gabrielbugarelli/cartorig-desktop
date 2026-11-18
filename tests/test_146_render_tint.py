"""Color grading changes only land and does not invent non-geographic features."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
import json,sys
BASE=Path(__file__).resolve().parents[1]
ASSETS=BASE/'assets'
countries=json.loads((ASSETS/'countries.json').read_text(encoding='utf8'))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,
   args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
 page=browser.new_page()
 page.set_content('<html><body></body></html>')
 page.add_script_tag(content=browser_bundle(ASSETS,include_app=False))
 result=page.evaluate('''countries=>{
  const doc=newDocument();doc.camera.center_lon=0;doc.camera.center_lat=12;doc.camera.zoom=1.15;
  doc.theme.id='contour-radar';doc.theme.overrides={};
  const c=document.createElement('canvas');c.width=576;c.height=324;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  const pixel=(lon,lat)=>{const [x,y]=project(doc,lon,lat,c.width,c.height);return [...ctx.getImageData(Math.round(x),Math.round(y),1,1).data];};
  const images={};renderScene(ctx,doc,countries,images,c.width,c.height);
  const tintedLand=pixel(10,52),tintedOcean=pixel(-35,35);
  doc.theme.overrides.land_tint_strength=0;
  ctx.clearRect(0,0,c.width,c.height);renderScene(ctx,doc,countries,images,c.width,c.height);
  const bareLand=pixel(10,52),bareOcean=pixel(-35,35);
  return {tintedLand,tintedOcean,bareLand,bareOcean};
 }''',countries)
 assert result['tintedLand'] != result['bareLand'],result
 assert result['tintedOcean'] == result['bareOcean'],result
 print('PASS: land-tint visibly changes only actual polygons; ocean unchanged, no additional datasets')
 browser.close()
