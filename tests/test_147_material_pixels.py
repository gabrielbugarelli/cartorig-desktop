"""Visual contract for Scene Looks 2.0 with the production Canvas renderer.
Checks world-space masking, transparency, relief, determinism and real PNGs.
"""
from pathlib import Path
import base64,sys
from playwright.sync_api import sync_playwright
from module_loader import browser_bundle
BASE=Path(__file__).resolve().parents[1];ASSETS=BASE/'assets'
materials={p.stem:base64.b64encode(p.read_bytes()).decode() for p in (ASSETS/'look-materials').glob('*.png')}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if sys.platform!='win32' else None,args=['--no-sandbox','--disable-dev-shm-usage'] if sys.platform!='win32' else [])
    page=browser.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<html><body></body></html>')
    page.add_script_tag(content=browser_bundle(ASSETS,include_app=False))
    r=page.evaluate('''async ({materials})=>{
      let images={};
      for(let [key,png] of Object.entries(materials)){
       let image=new Image();image.src='data:image/png;base64,'+png;
       await image.decode();images['material-'+key]=image;
      }
      const doc=newDocument();
      doc.scene.root_ids=doc.scene.root_ids.filter(id=>doc.objects[id].type==='WorldMap');
      doc.objects=Object.fromEntries(Object.entries(doc.objects).filter(([id,o])=>o.type==='WorldMap'));
      doc.theme={id:'atlas',type_defaults:{},overrides:{
        texture_source:'solid',ocean_mode:'solid',land_color:'#bdac91',ocean_color:'#466a88',
        border_width:0,terrain_enabled:false,surface_material:'none',land_material:'none',
        ocean_material:'none',cartographic_finish:'none',relief_profile:'none',
        surface_strength:0,land_material_strength:0,ocean_material_strength:0,finish_strength:0,relief_strength:0,
        atmosphere_vignette:0,atmosphere_tint_mix:0
      }};
      const countries=[{iso:'TEST',geometry:{type:'Polygon',coordinates:[[[-38,-32],[38,-32],[38,32],[-38,32],[-38,-32]]]}}];
      const w=320,h=180,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      function sample(){renderScene(ctx,doc,countries,images,w,h);return new Uint8ClampedArray(ctx.getImageData(0,0,w,h).data);}
      function difference(a,b){let land=0,water=0,nl=0,nw=0;
       for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const k=(y*w+x)*4,inside=(x>140&&x<180&&y>74&&y<107);
        const delta=Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2])+Math.abs(a[k+3]-b[k+3]);
        if(inside){land+=delta;nl++;}else if(x<80||x>240){water+=delta;nw++;}
       }return {land:land/nl,water:water/nw};
      }
      const plain=sample(),same=sample();const deterministic=difference(plain,same);
      doc.theme.overrides.land_material='paper_foxed';doc.theme.overrides.land_material_strength=1;
      const landOnly=sample(),ld=difference(plain,landOnly);
      doc.theme.overrides.land_material='none';doc.theme.overrides.land_material_strength=0;
      doc.theme.overrides.ocean_material='marine_waves';doc.theme.overrides.ocean_material_strength=1;
      const oceanOnly=sample(),od=difference(plain,oceanOnly);
      doc.theme.overrides.ocean_material='none';doc.theme.overrides.ocean_material_strength=0;
      doc.theme.overrides.surface_material='paper_aged';doc.theme.overrides.surface_strength=.9;
      const surface=sample(),sd=difference(plain,surface);
      doc.theme.overrides.surface_material='none';doc.theme.overrides.surface_strength=0;
      doc.theme.overrides.cartographic_finish='ink_grain';doc.theme.overrides.finish_strength=1;
      const finish=sample(),fd=difference(plain,finish);
      // Actual Atlas default: turning on textures should alter only land.
      // The sea remains flat because ocean_material is 'none' by default.
      const priorTheme=doc.theme,priorOptions=doc.render_options;
      doc.theme={id:'atlas',type_defaults:{},overrides:{}};
      doc.render_options={textures_enabled:false};
      const atlasWithout=sample();
      doc.render_options.textures_enabled=true;
      const atlasWith=sample(),atlasDiff=difference(atlasWithout,atlasWith);
      doc.theme=priorTheme;doc.render_options=priorOptions;
      // A country overlay must be immune to the base map's art texture.
      const region=madeObject('Region','Test',{region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:'TEST'},style:{fill_color:'#c30000',fill_opacity:1,stroke_width:0}});
      doc.objects[region.id]=region;doc.scene.root_ids.push(region.id);
      const after=sample(),center=(90*w+160)*4,overlaid=[...after.slice(center,center+4)];
      return {deterministic,ld,od,sd,fd,atlasDiff,overlaid};
    }''', {'materials':materials})
    assert not errors,errors
    assert r['deterministic']['land']==0 and r['deterministic']['water']==0,r
    assert r['ld']['land']>2 and r['ld']['water']<.01,r
    assert r['od']['water']>2 and r['od']['land']<.01,r
    assert r['sd']['land']>0.5 and r['sd']['water']<.01,r
    assert r['fd']['land']>0.5 and r['fd']['water']<.01,r
    assert r['atlasDiff']['land']>0.5 and r['atlasDiff']['water']<.01,r
    assert r['overlaid'][:3]==[195,0,0] and r['overlaid'][3]==255,r
    print('PASS: land-only paper/print / distinct ocean material / deterministic output / intact country overrides:',r)
    browser.close()
