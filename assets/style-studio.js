import {MATERIAL_IDS,RELIEF_PROFILES,LOOK_MATERIAL_RECIPES,LOOK_FAMILIES} from './look-materials.js';
/* CartoRig 1.4 — Style Studio, strictly driven by CommandBus. MIT. */
import {COLORS,MAP_LABEL_KINDS,MAP_LABEL_SIZES,texturesEnabled} from './scene-core.js';
import {REFERENCE_LOOKS} from './reference-looks.js';
import {paletteFor,styleToFile,themeValue,parseStylePreset,EFFECT_DEFAULTS,styleDefaults,BLEND_MODES} from './style-resolver.js';
const $=id=>document.getElementById(id);
const groups=[
 ['LAND & OCEAN',[
  ['land_color','Land fill','color'],['land_opacity','Land opacity','number',0,1,.05],
  ['ocean_color','Ocean fill','color'],['ocean_opacity','Ocean opacity','number',0,1,.05],
  ['texture_source','Map texture','select',['auto','solid','shadedrelief','bmng','etopo1']],
  ['ocean_mode','Texture over ocean','select',['raster','solid']]]],
 ['BORDERS & GRID',[
  ['border_color','Border color','color'],['border_width','Border width (px)','number',0,40,.5],
  ['border_opacity','Border opacity','number',0,1,.05],
  ['border_style','Border stroke','select',['Solid','Dashed','Dotted']],
  ['grid_color','Grid color','color'],['grid_opacity','Grid opacity','number',0,1,.05],
  ['grid_interval','Grid interval (0=auto, degrees)','number',0,90,1],
  ['grid_labels','Draw grid coordinates','checkbox'],
  ['grid_label_size','Grid label size (px)','number',8,36,1]]],
 ['SURFACES & MATERIALS',[
  ['surface_material','Map support material','select',MATERIAL_IDS],
  ['surface_strength','Support texture intensity','number',0,1,.05],
  ['land_material','Land surface','select',MATERIAL_IDS],
  ['land_material_strength','Land material intensity','number',0,1,.05],
  ['ocean_material','Ocean surface','select',MATERIAL_IDS],
  ['ocean_material_strength','Ocean material intensity','number',0,1,.05],
  ['cartographic_finish','Print / engraving finish','select',MATERIAL_IDS],
  ['finish_strength','Finish intensity','number',0,1,.05]]],
 ['RELIEF ART DIRECTION',[
  ['relief_profile','Relief treatment','select',RELIEF_PROFILES],
  ['relief_strength','Relief contrast/intensity','number',0,1,.05]]],
 ['TERRAIN & TEXTURE',[
  ['terrain_enabled','Texture shading (not DEM)','checkbox'],
  ['terrain_source','Shading texture','select',['shadedrelief','bmng','etopo1']],
  ['terrain_contrast','Texture contrast','number',0,2,.1],
  ['terrain_saturation','Texture saturation','number',0,2,.1],
  ['terrain_strength','Texture shading strength','number',0,1,.05],
  ['land_tint_color','Land texture tint','color'],['land_tint_strength','Land texture tint strength','number',0,1,.05]]],
 ['ATMOSPHERE',[
  ['atmosphere_vignette','Vignette','number',0,1,.05],
  ['atmosphere_tint','Tint color','color'],
  ['atmosphere_tint_mix','Tint strength','number',0,1,.05]]],
 ['DEFAULT TYPOGRAPHY',[
  ['typography_color','Default label color','color']]]
];
const CATEGORY_FIELDS={
 Region:['fill_color','fill_opacity','stroke_color','stroke_width','stroke_opacity','stroke_style','shadow_enabled','shadow_color','shadow_opacity','shadow_blur','shadow_distance','shadow_angle','glow_enabled','glow_color','glow_intensity','glow_radius','glow_mix','blend_mode'],
 Route:['stroke_color','stroke_width','stroke_opacity','stroke_style','shadow_enabled','shadow_color','shadow_opacity','shadow_blur','glow_enabled','glow_color','glow_intensity','glow_radius','glow_mix','blend_mode'],
 Marker:['fill_color','stroke_color','stroke_width','shadow_enabled','shadow_color','shadow_opacity','shadow_blur','glow_enabled','glow_color','glow_intensity','glow_radius','glow_mix','blend_mode'],
 Label:['text_color','halo_color','halo_width','font_family','shadow_enabled','shadow_color','shadow_opacity','shadow_blur','glow_enabled','glow_color','glow_intensity','glow_radius','glow_mix','blend_mode'],
 Shape:['fill_color','stroke_color','stroke_width','stroke_style','text_color','shadow_enabled','shadow_color','shadow_opacity','shadow_blur','glow_enabled','glow_color','glow_intensity','glow_radius','glow_mix','blend_mode']
};
const DEFAULT_NUMERIC={fill_opacity:[0,1,.05],stroke_opacity:[0,1,.05],stroke_width:[0,40,.5],halo_width:[0,100,1],shadow_opacity:[0,1,.05],shadow_blur:[0,100,1],shadow_distance:[0,200,1],shadow_angle:[0,360,1],glow_intensity:[0,2,.1],glow_radius:[0,100,1],glow_mix:[0,1,.05]};
function el(tag,cls,txt){const d=document.createElement(tag);if(cls)d.className=cls;if(txt!==undefined)d.textContent=txt;return d;}
const colorVal=s=>typeof s==='string'&&/^#[0-9a-f]{6}/i.test(s)?s.slice(0,7):'#000000';
// Single owner of Scene Looks thumbnail presentation. Native looks are real,
// pre-rendered and version-locked PNG assets from the production renderer.
// These sources are never swapped by app.js or regenerated on reload.
const ORIGINAL_LOOKS=[['dark','Cinematic Dark'],['atlas','Vintage Atlas'],['tactical','Tactical Ops'],['relief','Shaded Relief'],['satellite','Satellite Earth'],['night','Nightfall'],['elevation','Elevation ETOPO'],['historical','Historical Atlas'],['terrain','Terrain Cinematic']];
const NATIVE_LOOKS=new Set([...ORIGINAL_LOOKS.map(([key])=>key),...REFERENCE_LOOKS.map(x=>x.id)]);
const LOOK_INFO=new Map(REFERENCE_LOOKS.map(x=>[x.id,x]));
function presetButton(key,name,selected,palette,apply){
 const b=el('button','preset style14-preset'+(selected?' active':''));b.dataset.style=key;
 if(key==='relief')b.title='Neutral Shaded Relief: natural relief colors and original shaded-relief raster, without dramatic grading';
 if(key==='terrain')b.title='Terrain Cinematic: dark ocean, desaturated high-contrast ETOPO terrain, texture shading and vignette';
 const reference=LOOK_INFO.get(key);
 if(reference){b.title=reference.description+'\n'+reference.limitation;b.dataset.lookCategory=reference.category;b.dataset.lookGroup='reference';}
 else if(NATIVE_LOOKS.has(key)){b.dataset.lookGroup='original';}
 b.dataset.lookFamily=LOOK_MATERIAL_RECIPES[key]?.family||'Other';
 let thumb;
 if(NATIVE_LOOKS.has(key)){
  thumb=el('img','style14-preview');
  thumb.src='/assets/look-previews/'+key+'.png';
  thumb.width=288;thumb.height=162;thumb.alt='';
  thumb.loading='eager';thumb.decoding='async';thumb.draggable=false;
  thumb.dataset.nativeLook=key;
 }else{
  // Custom presets have a persistent palette swatch, not an asynchronous
  // placeholder awaiting replacement by another module.
  thumb=el('i','style14-custom-swatch');
  thumb.style.background=`linear-gradient(135deg,${palette.ocean} 0%,${palette.ocean} 38%,${palette.land} 39%,${palette.land} 73%,${palette.accent||palette.border} 74%)`;
 }
 b.append(thumb,document.createTextNode(name));
 b.onclick=()=>apply({type:'ApplyTheme',id:key});return b;
}
export function setupStyleStudio({getDoc,getSelection=()=>[],exec,toast,downloadable,getToken}){
 const root=$('styleStudio14');if(!root)return {sync(){}};
 let globalStyles=[],openGroups=new Set();let selectedType='Region',selectedDefaultField='fill_color';
 let mapLabelsOpen=false,mapLabelAppearanceOpen=false,selectedMapLabelKind='countries';
 // All 36 built-in look cards are a persistent view; only their selection state
 // changes. Preview PNGs are bundled by the build, with no async replacements.
 const builtInLooks=[...ORIGINAL_LOOKS,...REFERENCE_LOOKS.map(x=>[x.id,x.name])];

 const presetBox=el('div','presets style14-preset-grid');presetBox.id='presets';

 const galleryTools=el('div','style14-gallery-tools');
 const galleryCategory=el('select','control compact');galleryCategory.id='sceneLookCategory';galleryCategory.setAttribute('aria-label','Filter Scene Looks');
 for(const [key,label] of [['all','All looks'],['original','Original (9)'],['reference','Reference Collection (27)'],...LOOK_FAMILIES.map(f=>[f,f]),...([...new Set(REFERENCE_LOOKS.map(x=>x.category))].sort().map(v=>[v,v]))]){const option=el('option','',label);option.value=key;galleryCategory.append(option);}
 const gallerySearch=el('input','control compact');gallerySearch.type='search';gallerySearch.id='sceneLookSearch';gallerySearch.placeholder='Search looks…';gallerySearch.setAttribute('aria-label','Search Scene Looks');
 const galleryCount=el('small','style14-gallery-count');galleryTools.append(galleryCategory,gallerySearch,galleryCount);
 const labelFor=new Map(builtInLooks);
 function filterGallery(){const cat=galleryCategory.value,q=gallerySearch.value.trim().toLocaleLowerCase();let visible=0;
  for(const card of presetBox.children){const key=card.dataset.style,info=LOOK_INFO.get(key);
   const matchesCategory=cat==='all'||(cat==='original'&&!info)||(cat==='reference'&&!!info)||info?.category===cat||card.dataset.lookFamily===cat;
   const searchText=[key,labelFor.get(key),info?.category,card.dataset.lookFamily,info?.description].filter(Boolean).join(' ').toLocaleLowerCase();
   const matches=matchesCategory&&(!q||searchText.includes(q));card.hidden=!matches;visible+=matches?1:0;
  }galleryCount.textContent=(cat==='all'&&!q)?'':(visible+' of '+builtInLooks.length+' looks');
 }
 galleryCategory.onchange=filterGallery;gallerySearch.oninput=filterGallery;
 // Two task-based views keep advanced editing one click away, without traversing 36 cards.
 const controlsArea=el('div','style14-controls-area');
 const mapControls=$('uxMapBoundaries');
 const viewSwitch=el('div','ux-look-switch');viewSwitch.setAttribute('role','group');viewSwitch.setAttribute('aria-label','Appearance view');
 const chooseButton=el('button','active','Choose look');chooseButton.id='style14ModeChoose';
 const customizeButton=el('button','','Personalize');customizeButton.id='style14ModeCustomize';
 viewSwitch.append(chooseButton,customizeButton);
 const galleryView=el('div','ux-look-view');galleryView.id='style14GalleryView';
 const customizeView=el('div','ux-look-view');customizeView.id='style14CustomizeView';
 const libraryHost=$('mapStylesList');
 galleryView.append(galleryTools,presetBox);
 customizeView.append(controlsArea);
 root.replaceChildren(viewSwitch,galleryView,customizeView);
 let activeView='choose';
 function setView(which){
  activeView=which==='customize'?'customize':'choose';
  galleryView.hidden=activeView!=='choose';customizeView.hidden=activeView!=='customize';
  for(const [button,value] of [[chooseButton,'choose'],[customizeButton,'customize']]){
   const current=activeView===value;button.classList.toggle('active',current);button.setAttribute('aria-pressed',String(current));
  }
  const sidebar=$('rightSidebar');if(sidebar)sidebar.scrollTop=0;
 }
 chooseButton.onclick=()=>setView('choose');customizeButton.onclick=()=>setView('customize');
 setView('choose');
 for(const [key,name] of builtInLooks)presetBox.append(presetButton(key,name,false,COLORS[key],exec));
 filterGallery();
 function updateLookSelection(currentId){
  for(const card of presetBox.querySelectorAll('[data-style]')){
   const selected=card.dataset.style===currentId;
   card.classList.toggle('active',selected);
   card.setAttribute('aria-pressed',String(selected));
  }
 }

 async function loadGlobal(){try{const res=await fetch('/api/styles');if(!res.ok)throw Error('Unavailable');const all=await res.json();if(Array.isArray(all)){globalStyles=all.slice(0,100);draw();}}catch{/* Standalone browser tests and portable legacy servers may not have the endpoint. */}}
 async function persistGlobal(removedId=null){try{const byID=new Map(globalStyles.filter(x=>x.id!==removedId).map(x=>[x.id,x]));for(let s of getDoc().style_library||[])byID.set(s.id,s);globalStyles=[...byID.values()].slice(0,100);let res=await fetch('/api/styles',{method:'POST',headers:{'X-CartoRig-Token':getToken(),'Content-Type':'application/json'},body:JSON.stringify(globalStyles)});if(!res.ok)throw Error('HTTP '+res.status);}catch(e){console.warn('User style library not persisted:',e.message);}}
 const MAP_LABEL_NAMES={countries:'Countries',states:'States / provinces',national_capitals:'National capitals',regional_capitals:'Regional capitals',cities:'Cities',continents:'Continents',oceans:'Oceans',seas:'Seas'};
 function buildMapLabels(doc,palette){
  const settings=doc.map_labels||{enabled:{},sizes:{},colors:{}};
  const section=el('details','style14-group ux-map-labels');section.id='mapLabels';section.open=mapLabelsOpen;
  section.addEventListener('toggle',()=>{mapLabelsOpen=section.open;});
  section.append(el('summary','','MAP LABELS'));
  const inner=el('div','ux-map-labels-body');
  const toggles=el('div','ux-map-label-grid');
  for(const kind of MAP_LABEL_KINDS){
   const label=el('label','ux-map-label-check');
   const checkbox=el('input','');checkbox.type='checkbox';checkbox.dataset.mapLabelKind=kind;
   checkbox.checked=!!settings.enabled?.[kind];
   checkbox.setAttribute('aria-label','Show '+MAP_LABEL_NAMES[kind]);
   checkbox.onchange=()=>exec({type:'SetMapLabelOption',section:'enabled',key:kind,value:checkbox.checked});
   label.append(checkbox,document.createTextNode(MAP_LABEL_NAMES[kind]));toggles.append(label);
  }
  inner.append(toggles);
  const advanced=el('details','ux-map-label-advanced');advanced.open=mapLabelAppearanceOpen;
  advanced.addEventListener('toggle',()=>{mapLabelAppearanceOpen=advanced.open;});
  advanced.append(el('summary','','Typography & density'));
  const area=el('div','ux-map-label-appearance');
  const kindLabel=el('label','field-label','Category');
  const select=el('select','control compact');select.id='mapLabelAppearanceKind';
  for(const kind of MAP_LABEL_KINDS){const opt=el('option','',MAP_LABEL_NAMES[kind]);opt.value=kind;select.append(opt);}
  select.value=selectedMapLabelKind;
  kindLabel.append(select);area.append(kindLabel);
  const sizeLabel=el('label','field-label','Font size');const size=el('input','control compact');size.type='number';size.min='8';size.max='60';size.step='1';size.id='mapLabelFontSize';
  sizeLabel.append(size);area.append(sizeLabel);
  const colorLabel=el('label','field-label','Text color');const color=el('input','control compact');color.type='color';color.id='mapLabelColor';
  colorLabel.append(color);area.append(colorLabel);
  const resetColor=el('button','ux-label-reset','Use look color');resetColor.id='mapLabelResetColor';area.append(resetColor);
  const fontLabel=el('label','field-label','Font');const font=el('select','control compact');font.id='mapLabelFont';for(const [val,name] of [['sans','Sans serif'],['serif','Serif']]){const o=el('option','',name);o.value=val;font.append(o);}
  font.value=settings.font||'sans';font.onchange=()=>exec({type:'SetMapLabelOption',section:'settings',key:'font',value:font.value});fontLabel.append(font);area.append(fontLabel);
  const densityLabel=el('label','field-label','Label density');const density=el('select','control compact');density.id='mapLabelDensity';for(const [value,name] of [['sparse','Sparse'],['balanced','Balanced'],['detailed','Detailed']]){const o=el('option','',name);o.value=value;density.append(o);}
  density.value=settings.density||'balanced';density.onchange=()=>exec({type:'SetMapLabelOption',section:'settings',key:'density',value:density.value});densityLabel.append(density);area.append(densityLabel);
  const haloLabel=el('label','field-label','Outline (px)');const halo=el('input','control compact');halo.type='number';halo.min='0';halo.max='6';halo.step='.5';halo.id='mapLabelHalo';halo.value=settings.halo??2.5;
  halo.onchange=()=>{const value=Number(halo.value);if(halo.value.trim()!==''&&Number.isFinite(value)&&value>=0&&value<=6)exec({type:'SetMapLabelOption',section:'settings',key:'halo',value});else toast('Invalid outline width',true);};haloLabel.append(halo);area.append(haloLabel);
  function syncCategory(){const kind=selectedMapLabelKind;size.value=settings.sizes?.[kind]??MAP_LABEL_SIZES[kind];color.value=settings.colors?.[kind]||colorVal(palette.text);resetColor.hidden=!settings.colors?.[kind];}
  select.onchange=()=>{selectedMapLabelKind=select.value;syncCategory();};
  size.onchange=()=>{const value=Number(size.value);if(size.value.trim()!==''&&Number.isFinite(value)&&value>=8&&value<=60)exec({type:'SetMapLabelOption',section:'sizes',key:selectedMapLabelKind,value});else toast('Font size must be from 8 to 60',true);};
  color.onchange=()=>exec({type:'SetMapLabelOption',section:'colors',key:selectedMapLabelKind,value:color.value});
  resetColor.onclick=()=>exec({type:'SetMapLabelOption',section:'colors',key:selectedMapLabelKind,value:null});
  syncCategory();advanced.append(area);inner.append(advanced);section.append(inner);return section;
 }
 function draw(){
  let doc=getDoc(),palette=paletteFor(doc),over=doc.theme.overrides||{};
  const focusedLook=document.activeElement?.closest?.('#presets [data-style]')?.dataset.style;
  const sidebar=$('rightSidebar'),scrollPosition=sidebar?.scrollTop;
  controlsArea.replaceChildren();
  // Object-specific effects live solely in the Inspector; the Looks panel only edits scene appearance.
  updateLookSelection(doc.theme.id);
  // Global controls are first, artistic finish second; all remain CommandBus-backed.
  const globalHeading=el('div','ux-settings-divider','GLOBAL COMPOSITION');
  const artisticHeading=el('div','ux-settings-divider ux-artistic-divider','ARTISTIC FINISH');
  controlsArea.append(globalHeading);
  // Texture visibility is a project-level rendering option, not a look override.
  const textureToggle=el('label','check ux-texture-toggle');
  const textureInput=el('input');textureInput.type='checkbox';textureInput.id='sceneTexturesEnabled';
  textureInput.checked=texturesEnabled(doc);
  textureInput.onchange=()=>exec({type:'SetTextureVisibility',enabled:textureInput.checked});
  textureToggle.append(textureInput,document.createTextNode('Show textures'));
  controlsArea.append(textureToggle);
  if(mapControls)controlsArea.append(mapControls);
  controlsArea.append(buildMapLabels(doc,palette));
  const priority=['BORDERS & GRID','LAND & OCEAN','ATMOSPHERE','DEFAULT TYPOGRAPHY'];
  const orderedGroups=[...priority.map(name=>groups.find(([heading])=>heading===name)),...groups.filter(([heading])=>!priority.includes(heading))].filter(Boolean);
  for(const [heading,fields] of orderedGroups){
   if(heading==='SURFACES & MATERIALS')controlsArea.append(artisticHeading);
   let section=el('details','style14-group');section.open=openGroups.has(heading);
   section.addEventListener('click',event=>{if(event.target.closest('summary')){if(section.open)openGroups.delete(heading);else openGroups.add(heading);}});
   section.append(el('summary','',heading));
   for(const [key,label,type,lo,hi,step] of fields){
    const wrap=el('label',type==='checkbox'?'check':'field-label',type==='checkbox'?'':label);
    const overridden=Object.hasOwn(over,key)&&over[key]!==null;
    const input=type==='select'?el('select','control compact'):el('input',type==='checkbox'?'':'control compact');
    let value=themeValue(doc,key);input.dataset.themeField=key;
    if(type==='select'){for(const val of lo){const opt=el('option','',val);opt.value=val;input.append(opt);}input.value=value;}
    else if(type==='number'){input.type='number';input.min=lo;input.max=hi;input.step=step;input.value=value;}
    else if(type==='checkbox'){input.type='checkbox';input.checked=!!value;}
    else {input.type='color';input.value=colorVal(value);}
    if(type==='checkbox')wrap.append(input,document.createTextNode(label));else wrap.append(input);
    input.onchange=()=>{
     const next=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;
     if(type==='number'&&(!Number.isFinite(next)||input.value.trim()===''||next<lo||next>hi)){
      toast('Invalid '+label,true);draw();return;
     }
     exec({type:'SetThemeProperty',key,value:next});
    };section.append(wrap);
    if(type==='number'){
     const range=el('input','style14-range');range.type='range';range.min=lo;range.max=hi;range.step=step;range.value=value;
     range.setAttribute('aria-label',label+' slider');range.oninput=()=>input.value=range.value;
     range.onchange=()=>exec({type:'SetThemeProperty',key,value:Number(range.value)});section.append(range);
    }
    if(type==='color'){
     const hex=el('input','control compact style14-hex');hex.value=value;hex.setAttribute('aria-label',label+' hexadecimal');hex.maxLength=9;
     hex.onchange=()=>{if(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex.value))exec({type:'SetThemeProperty',key,value:hex.value});else toast('Invalid hexadecimal color',true);};section.append(hex);
    }
    if(overridden){const reset=el('button','style14-reset','Revert '+label);reset.dataset.revertTheme=key;
     reset.title='Restore the currently selected theme default without changing other fields';
     reset.onclick=()=>exec({type:'SetThemeProperty',key,value:null});section.append(reset);}
   }
   controlsArea.append(section);
  }
  const sect=el('details','style14-group');sect.open=openGroups.has('OBJECT TYPE DEFAULTS');
  sect.addEventListener('click',event=>{if(event.target.closest('summary')){if(sect.open)openGroups.delete('OBJECT TYPE DEFAULTS');else openGroups.add('OBJECT TYPE DEFAULTS');}});
  sect.append(el('summary','','OBJECT TYPE DEFAULTS & EFFECTS'));
  const pick=el('select','control compact');pick.id='style14Category';
  for(const kind of Object.keys(CATEGORY_FIELDS)){let op=el('option','',kind);op.value=kind;pick.append(op);}pick.value=selectedType;
  sect.append(pick);
  const fieldPick=el('select','control compact');fieldPick.id='style14DefaultField';
  const controlContainer=el('div','style14-default-control');
  const paintFields=()=>{
   fieldPick.replaceChildren();for(const name of CATEGORY_FIELDS[selectedType]){const option=el('option','',name.replace(/_/g,' '));option.value=name;fieldPick.append(option);}
   if(!CATEGORY_FIELDS[selectedType].includes(selectedDefaultField))selectedDefaultField=CATEGORY_FIELDS[selectedType][0];
   fieldPick.value=selectedDefaultField;
   controlContainer.replaceChildren();const key=selectedDefaultField;
   const original=doc.theme.type_defaults?.[selectedType]?.[key];const inherited={...EFFECT_DEFAULTS,...styleDefaults[selectedType]};
   let effective=original??inherited[key];
   if(effective==null)effective=key.endsWith('_color')?'#ffffff':key==='font_family'?'Segoe UI':key==='stroke_style'?'Solid':key==='blend_mode'?'normal':key.endsWith('_enabled')?false:DEFAULT_NUMERIC[key]?.[0]||0;
   controlContainer.append(el('small','',original===undefined?'Inherited default':'Custom category default'));
   let entry;
   if(key.endsWith('_color')){entry=el('input','control compact');entry.type='color';entry.value=colorVal(effective);}
   else if(key.endsWith('_enabled')){entry=el('input','');entry.type='checkbox';entry.checked=!!effective;}
   else if(key==='stroke_style'||key==='blend_mode'){
    entry=el('select','control compact');for(const val of key==='blend_mode'?BLEND_MODES:['Solid','Dashed','Dotted']){let option=el('option','',val);option.value=val;entry.append(option);}entry.value=effective;
   }else{entry=el('input','control compact');entry.type=key==='font_family'?'text':'number';entry.value=effective;
    if(entry.type==='number'){let [min,max,step]=DEFAULT_NUMERIC[key]||[0,100,1];entry.min=min;entry.max=max;entry.step=step;}}
   entry.id='style14DefaultValue';controlContainer.append(entry);
   const apply=el('button','',`Set ${selectedType} default`);apply.onclick=()=>{
    let value=entry.type==='checkbox'?entry.checked:entry.type==='number'?Number(entry.value):entry.value;
    if(entry.type==='number'&&(!Number.isFinite(value)||entry.value.trim()===''||value<Number(entry.min)||value>Number(entry.max))){toast('Invalid category value',true);return;}
    exec({type:'SetCategoryStyle',object_type:selectedType,key,value});
   };controlContainer.append(apply);
   if(original!==undefined){const reset=el('button','style14-reset','Revert '+key+' default');
    reset.onclick=()=>exec({type:'SetCategoryStyle',object_type:selectedType,key,value:null});controlContainer.append(reset);}
  };
  pick.onchange=()=>{selectedType=pick.value;selectedDefaultField=CATEGORY_FIELDS[selectedType][0];paintFields();};
  fieldPick.onchange=()=>{selectedDefaultField=fieldPick.value;paintFields();};
  sect.append(fieldPick,controlContainer);paintFields();
  const resetCategory=el('button','style14-reset','Reset ALL '+selectedType+' defaults');
  resetCategory.onclick=()=>{if(confirm('Reset defaults for '+selectedType+'?'))exec({type:'ResetCategoryStyle',object_type:selectedType});};
  pick.addEventListener('change',()=>resetCategory.textContent='Reset ALL '+selectedType+' defaults');
  sect.append(resetCategory);controlsArea.insertBefore(sect,artisticHeading);
  const library=el('div','style14-library');
  const create=el('button','','Save Current Style');create.id='style14Save';create.onclick=()=>{const name=prompt('Style name','My Cinematic Style');if(name?.trim())exec({type:'SaveUserStyle',name:name.trim()});};library.append(create);
  const imp=el('button','','Import .cartorigstyle');imp.id='style14Import';imp.onclick=()=>$('style14File').click();library.append(imp);
  const active=[...(doc.style_library||[]),...globalStyles.filter(x=>!(doc.style_library||[]).some(y=>y.id===x.id))];for(const s of active){const row=el('div','style14-library-row');row.append(presetButton(s.id,s.name,doc.theme.id===s.id,s.palette,cmd=>{if((doc.style_library||[]).some(x=>x.id===s.id))exec(cmd);else {
    const missing=(s.asset_refs||[]).filter(ref=>!(getDoc().asset_refs||[]).some(a=>(a.asset_id||a.id)===ref.asset_id&&a.sha256===ref.sha256));
    if(missing.length){toast('Style assets missing from the current project; cannot apply safely',true);return;}
    exec({type:'ApplyUserStyle',id:s.id,content:styleToFile(s)});
   }}));const actions=el('div','style14-library-actions');let exp=el('button','','Export');exp.onclick=()=>downloadable(new Blob([styleToFile(s)],{type:'application/json'}),s.name.replace(/[^a-z0-9_-]+/gi,'_')+'.cartorigstyle');actions.append(exp);let dup=el('button','','Duplicate');dup.onclick=()=>{const content=JSON.parse(styleToFile(s));content.name=(s.name+' Copy').slice(0,90);exec({type:'ImportUserStyle',content:JSON.stringify(content),on_conflict:'duplicate'});};actions.append(dup);let ren=el('button','','Rename');ren.onclick=()=>{let name=prompt('New name',s.name);if(!name?.trim())return;
    // Global entries must be attached to a project first to participate in
    // CommandBus history rather than failing with "Style not found".
    if(!(getDoc().style_library||[]).some(x=>x.id===s.id)){
     if(!exec({type:'ImportUserStyle',content:styleToFile(s)}))return;
    }
    exec({type:'RenameUserStyle',id:s.id,name:name.trim()});
   };actions.append(ren);
   let del=el('button','','Delete');del.onclick=()=>{
    if(!confirm('Remove style "'+s.name+'" from the library?'))return;
    if(!(getDoc().style_library||[]).some(x=>x.id===s.id)){
     // Attach then delete through the same audited CommandBus transaction path.
     if(!exec({type:'ImportUserStyle',content:styleToFile(s)}))return;
    }
    exec({type:'DeleteUserStyle',id:s.id});
   };actions.append(del);row.append(actions);library.append(row);}
  libraryHost.replaceChildren(library);
  if(focusedLook)presetBox.querySelector(`[data-style="${focusedLook}"]`)?.focus({preventScroll:true});
  if(sidebar&&scrollPosition!==undefined)sidebar.scrollTop=scrollPosition;
 }
 $('style14File').onchange=async ev=>{const f=ev.target.files?.[0];ev.target.value='';if(!f)return;if(f.size>120_000){toast('Style file exceeds 120 KB',true);return;}try{let content=await f.text();const parsed=parseStylePreset(content);
 const missing=(parsed.asset_refs||[]).filter(ref=>!(getDoc().asset_refs||[]).some(a=>(a.asset_id||a.id)===ref.asset_id&&a.sha256===ref.sha256));
 if(missing.length){toast(`Style has ${missing.length} missing asset(s). Install or import them into the project before importing this style.`,true);return;}
 const conflict=[...(getDoc().style_library||[]),...globalStyles].some(x=>x.id===parsed.id);
 const cmd={type:'ImportUserStyle',content};
 if(conflict){if(!confirm('This style already exists. Import a duplicate with a new ID?'))return;cmd.on_conflict='duplicate';}
 if(exec(cmd))toast('Style imported into this project');}catch(e){toast('Style import failed: '+e.message,true);}};
 let last='';return {loadGlobal,persistGlobal,sync(){const doc=getDoc(),sig=JSON.stringify([doc.theme,doc.style_library,getSelection(),doc.render_options]);if(sig!==last){last=sig;draw();}}};
}
