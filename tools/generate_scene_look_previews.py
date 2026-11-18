"""Build 36 deterministic native Scene Looks previews using the production Canvas renderer.

Development-only dependency: Python Pillow + Playwright Chromium. Output PNGs are
committed into assets and embedded in the Windows EXEs; no browser-time rendering.
"""
from pathlib import Path
import base64, hashlib, io, json, sys
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parents[1]
ASSETS = BASE / 'assets'
DEST = ASSETS / 'look-previews'
DEST.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(BASE / 'tests'))
from module_loader import browser_bundle

LOOKS = ('dark', 'atlas', 'tactical', 'relief', 'satellite', 'night', 'elevation', 'historical', 'terrain') + tuple(json.loads((BASE/'docs/SCENE_LOOKS_REFERENCE_AUDIT.json').read_text(encoding='utf-8'))['looks'][i]['id'] for i in range(27))
# Include every input capable of changing pixels: geographic paths, raster data,
# palette/renderer/effects and shared drawing engine. This lock prevents stale PNGs.
SOURCES = ('countries.json', 'bmng.jpg', 'etopo1.jpg', 'shadedrelief.jpg',
           'scene-core.js', 'reference-looks.js', 'look-materials.js', 'scene-renderer.js', 'style-resolver.js',
           'style-effects.js', 'creative-renderer.js', 'creative-engine.js') + tuple('look-materials/' + name for name in sorted(p.name for p in (ASSETS/'look-materials').glob('*.png')))

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def generate():
    countries = json.loads((ASSETS / 'countries.json').read_text(encoding='utf-8'))
    textures = {}
    for name in ('bmng', 'etopo1', 'shadedrelief'):
        # Preview raster sizes are intentionally bounded; full source textures
        # are still used for normal preview/export at their original resolution.
        with Image.open(ASSETS / (name + '.jpg')) as image:
            image.thumbnail((1800, 900))
            buf = io.BytesIO()
            image.convert('RGB').save(buf, 'JPEG', quality=89, optimize=True)
            textures[name] = base64.b64encode(buf.getvalue()).decode('ascii')
    for file in sorted((ASSETS/'look-materials').glob('*.png')):
        textures['material-'+file.stem] = base64.b64encode(file.read_bytes()).decode('ascii')
    with sync_playwright() as p:
        chromium = p.chromium.launch(headless=True,
            executable_path='/usr/bin/chromium' if sys.platform != 'win32' else None,
            args=['--no-sandbox', '--disable-dev-shm-usage'] if sys.platform != 'win32' else [])
        page = chromium.new_page(viewport={'width': 1280, 'height': 800})
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content('<!doctype html><html><body></body></html>')
        page.add_script_tag(content=browser_bundle(ASSETS, include_app=False))
        result = page.evaluate('''async ({textures, countries, looks}) => {
          const images = {};
          for (const [key,encoded] of Object.entries(textures)) {
            const im = new Image();
            im.src = 'data:image/' + (key.startsWith('material-')?'png':'jpeg') + ';base64,' + encoded;
            await im.decode();
            images[key] = im;
          }
          const doc = newDocument();
          doc.canvas.transparent = false;
          doc.camera.center_lat = 12;
          doc.camera.center_lon = 0;
          doc.camera.zoom = 1.15;
          const canvas = document.createElement('canvas');
          canvas.width = 288; canvas.height = 162;
          const ctx = canvas.getContext('2d');
          const result = {};
          for (const key of looks) {
            doc.theme = { id:key, overrides:{}, type_defaults:{} };
            renderScene(ctx, doc, countries, images, canvas.width, canvas.height);
            result[key] = canvas.toDataURL('image/png').split(',')[1];
          }
          return result;
        }''', {'textures': textures, 'countries': countries, 'looks': LOOKS})
        if errors: raise RuntimeError('Browser errors generating Scene Looks: ' + repr(errors))
        chromium.close()
    previews = {}
    for key in LOOKS:
        image = DEST / (key + '.png')
        image.write_bytes(base64.b64decode(result[key], validate=True))
        with Image.open(image) as im:
            if im.size != (288, 162): raise RuntimeError(f'Bad {key} thumbnail dimensions')
        previews[key] = {'path': 'look-previews/' + key + '.png',
                         'sha256': digest(image), 'width':288, 'height':162}
    manifest = {
      'schema_version':1,
      'generator':'tools/generate_scene_look_previews.py',
      'description':'Static native look thumbnails. Built from bundled assets via production Canvas renderer.',
      'sources': {name:digest(ASSETS / name) for name in SOURCES},
      'previews': previews,
      'counts': {'original':9,'references':27,'total':len(LOOKS)},
    }
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print('Generated', len(LOOKS), 'offline Scene Looks preview PNGs: total',
          sum((DEST/(key+'.png')).stat().st_size for key in LOOKS), 'bytes')

if __name__ == '__main__': generate()
