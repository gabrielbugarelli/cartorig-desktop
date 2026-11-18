"""Generate deterministic, seamless offline artistic material tiles.

These are PAPER/INK/WATER/PRINT *visual* textures, never fictitious geographic
contours, DEM, sounding depths or historical political boundaries. No network.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/look-materials'
DEST.mkdir(exist_ok=True)
SIZE = 256
Y, X = np.mgrid[:SIZE, :SIZE]

# Palette is neutral: the underlying look controls the dominant colors.
SPEC = {
 'paper_clean':((118,92,56),'paper',24),
 'paper_aged':((104,72,36),'aged',43),
 'paper_foxed':((123,72,31),'foxed',55),
 'paper_fibrous':((93,72,49),'fiber',42),
 'archival_sheet':((53,48,38),'archive',38),
 'canvas_weave':((65,57,43),'weave',32),
 'engraving_lines':((35,32,30),'engraving',45),
 'copperplate':((92,45,25),'engraving',45),
 'ink_grain':((35,35,34),'ink',38),
 'print_plate':((48,42,38),'plate',42),
 'contour_etch':((42,49,44),'contour',43),
 'watercolor_wash':((71,85,86),'wash',37),
 'marine_noise':((24,74,96),'marine',40),
 'marine_waves':((36,86,104),'waves',45),
 'deep_sea':((18,51,75),'deep',43),
 'document_wear':((60,54,42),'wear',44),
 'tactical_noise':((27,74,50),'tactical',34),
 'dark_grain':((75,90,106),'dark',25),
 'mineral_grit':((66,62,55),'mineral',43),
 'dry_brush':((61,53,47),'brush',40),
 'linen':((65,62,55),'fiber',29),
}

def tile(name, rgb, mode, amplitude):
 rng = np.random.default_rng(int(hashlib.sha256(name.encode()).hexdigest()[:12],16))
 noise = rng.standard_normal((SIZE,SIZE)).astype('float32')
 smooth = gaussian_filter(noise, sigma=9, mode='wrap'); smooth /= max(1e-4,float(smooth.std()))
 medium = gaussian_filter(noise, sigma=2.5, mode='wrap'); medium /= max(1e-4,float(medium.std()))
 fine = noise / max(1e-4,float(noise.std()))
 # Use periodic functions for tiling: 256x256 texture must not have hard seams.
 sx=np.sin(2*np.pi*X/SIZE); sy=np.sin(2*np.pi*Y/SIZE)
 waves=np.sin(2*np.pi*(Y/16 + .25*np.sin(2*np.pi*X/64)))
 ink=0.5*medium+0.34*fine
 if mode=='paper': shape=.42*smooth+.16*fine
 elif mode=='aged': shape=.65*smooth+.22*medium+.18*fine
 elif mode=='foxed': shape=.7*smooth+.19*fine+1.9*(smooth>1.3).astype('float32')
 elif mode=='fiber': shape=.25*smooth+.2*fine+.40*np.sin(2*np.pi*X/5)+.4*np.sin(2*np.pi*Y/7)
 elif mode=='archive': shape=.6*smooth+.26*fine+.35*np.cos(2*np.pi*Y/64)
 elif mode=='weave': shape=.4*smooth+.6*np.sin(2*np.pi*X/7)*np.sin(2*np.pi*Y/7)
 elif mode=='engraving': shape=.4*smooth+.5*np.sin(2*np.pi*(X+Y)/10)+.15*fine
 elif mode=='ink': shape=ink+.3*(medium>1.0)
 elif mode=='plate': shape=.35*ink+.6*(np.sin(2*np.pi*X/11)>0.82).astype('float32')
 elif mode=='contour': shape=.22*smooth+.65*(np.sin(2*np.pi*(X/30+Y/64+smooth*.21))>.78).astype('float32')
 elif mode=='wash': shape=.92*smooth+.19*medium
 elif mode=='marine': shape=.5*smooth+.23*fine+.2*waves
 elif mode=='waves': shape=.15*fine+.52*waves+.2*medium
 elif mode=='deep': shape=.6*smooth+.42*np.sin(2*np.pi*Y/26)+.15*fine
 elif mode=='wear': shape=.34*medium+.36*fine+.7*(smooth>1.4).astype('float32')
 elif mode=='tactical': shape=.27*medium+.13*fine+.48*(np.sin(2*np.pi*Y/6)>.85).astype('float32')
 elif mode=='dark': shape=.15*smooth+.28*fine
 elif mode=='mineral': shape=.5*medium+.38*fine+.2*smooth
 elif mode=='brush': shape=.34*medium+.42*fine+.36*np.sin(2*np.pi*Y/4)
 else: raise ValueError(mode)
 # Blend opacity is limited. Art material is not an opaque basemap.
 alpha=np.uint8(np.clip(12+amplitude*(shape+.45),0,105))
 pixels=np.empty((SIZE,SIZE,4),dtype=np.uint8)
 pixels[:,:,:3]=rgb
 pixels[:,:,3]=alpha
 out=DEST/(name+'.png')
 Image.fromarray(pixels,'RGBA').save(out,optimize=True)
 return {'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'mode':mode}

def main():
 manifest={name:tile(name,*spec) for name,spec in SPEC.items()}
 (DEST/'manifest.json').write_text(json.dumps({'schema_version':1,'generator':'tools/generate_look_materials.py','materials':manifest,'license':'Original procedurally generated textures; MIT'},sort_keys=True,indent=2)+'\n')
 print('Created',len(manifest),'deterministic material textures;',sum(v['bytes'] for v in manifest.values()),'bytes')

if __name__=='__main__': main()
