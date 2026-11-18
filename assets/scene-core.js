import {validateStyleField,validateThemeField,parseStylePreset,makeStylePreset} from './style-resolver.js';
import {validateCreative} from './creative-engine.js';
import {REFERENCE_LOOKS} from './reference-looks.js';
/* CartoRig Scene Foundation — pure document model, migration and command history. MIT. */
export const clone = value => structuredClone(value);
export const uuid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{let r=Math.random()*16|0;return (c==='x'?r:r&3|8).toString(16)});
export const clamp = (x,min,max) => Math.max(min,Math.min(max,Number(x)));
export const COLORS = {
 dark:{ocean:'#0d1a27',land:'#273746',border:'#8596a7',grid:'#6888a3',text:'#e9edf2',accent:'#db7657'},
 atlas:{ocean:'#c4d1ca',land:'#e3d6b8',border:'#756c5c',grid:'#948c78',text:'#352e26',accent:'#aa5e48'},
 tactical:{ocean:'#0b1719',land:'#1e3834',border:'#678e7d',grid:'#638878',text:'#d4e7d4',accent:'#d8b475'},
 relief:{ocean:'#1a4053',land:'#8c9c81',border:'#3e5552',grid:'#d3e6de',text:'#f1f6ec',accent:'#d7684f',texture:'shadedrelief'},
 satellite:{ocean:'#112c49',land:'#748c68',border:'#bbd5c0',grid:'#bedbc6',text:'#f1f6f7',accent:'#e47a58',texture:'bmng'},
 night:{ocean:'#040912',land:'#111d2b',border:'#47667e',grid:'#394f64',text:'#e5edf8',accent:'#e8a153'},
 elevation:{ocean:'#325979',land:'#9b9775',border:'#687a6b',grid:'#c6d3c7',text:'#f6f2e8',accent:'#e28664',texture:'etopo1'},
 historical:{ocean:'#c2b8a2',land:'#dac9a4',border:'#755a46',grid:'#9b8068',text:'#4b3228',accent:'#a54f3d'},
 terrain:{ocean:'#081725',land:'#a69a7d',border:'#bd9b71',grid:'#526f7e',text:'#f4e7cf',accent:'#e9ac62',texture:'etopo1'},
 ...Object.fromEntries(REFERENCE_LOOKS.map(look=>[look.id,look.palette]))
};
// Geographic name overlays belong to the project, not the selected artistic look.
// Older .cartorig documents without this optional field keep labels off.
export const MAP_LABEL_KINDS=Object.freeze(['countries','states','national_capitals','regional_capitals','cities','continents','oceans','seas']);
export const MAP_LABEL_SIZES=Object.freeze({countries:26,states:17,national_capitals:17,regional_capitals:14,cities:14,continents:34,oceans:30,seas:21});
export const texturesEnabled=doc=>doc?.render_options?.textures_enabled!==false;
export const DEFAULT_MAP_LABELS=Object.freeze({enabled:{countries:true,states:false,national_capitals:true,regional_capitals:false,cities:false,continents:false,oceans:true,seas:true},sizes:{},colors:{},font:'sans',density:'balanced',halo:2.5});
export function validateMapLabels(labels){
 if(labels===undefined)return true; // backward-compatible projects
 if(!labels||typeof labels!=='object'||Array.isArray(labels))throw Error('Invalid map labels');
 if(Object.keys(labels).some(key=>!['enabled','sizes','colors','font','density','halo'].includes(key)))throw Error('Unknown map label option');
 for(const section of ['enabled','sizes','colors']){
  const values=labels[section]||{};
  if(typeof values!=='object'||Array.isArray(values))throw Error('Invalid map label category');
  for(const [key,value] of Object.entries(values)){
   if(!MAP_LABEL_KINDS.includes(key))throw Error('Unknown label category');
   if(section==='enabled'&&typeof value!=='boolean')throw Error('Invalid label visibility');
   if(section==='sizes'&&(!Number.isFinite(value)||value<8||value>60))throw Error('Invalid label size');
   if(section==='colors'&&(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)))throw Error('Invalid label color');
  }
 }
 if(labels.font!==undefined&&!['sans','serif'].includes(labels.font))throw Error('Invalid label font');
 if(labels.density!==undefined&&!['sparse','balanced','detailed'].includes(labels.density))throw Error('Invalid label density');
 if(labels.halo!==undefined&&(!Number.isFinite(labels.halo)||labels.halo<0||labels.halo>6))throw Error('Invalid label halo');
 return true;
}
export const madeObject=(type,name,extra={})=>({id:uuid(),type,name,visible:true,locked:false,opacity:1,parent_id:null,style:{},...extra});
export function newDocument(){
 const objects={},root_ids=[];
 for(let [type,name] of [['WorldMap','World Map'],['Grid','Geographic Grid'],['Borders','Political Borders']]){
  let o=madeObject(type,name);objects[o.id]=o;root_ids.push(o.id);
 }
 return {format:'cartorig-project',schema_version:'2.0.0',project_id:uuid(),revision:0,name:'Untitled Map',canvas:{width:3840,height:2160,design_height:1080,transparent:false},camera:{projection:'equirectangular',center_lon:0,center_lat:10,zoom:1,bearing:0},theme:{id:'dark',overrides:{border_color:'#8c9aad',border_width:1.2},type_defaults:{}},map_labels:clone(DEFAULT_MAP_LABELS),render_options:{textures_enabled:true},scene:{root_ids},objects,asset_refs:[],style_library:[],saved_views:[],export_presets:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
}
export function migrateLegacy(legacy){
 if(!legacy || legacy.version!==1 || !Array.isArray(legacy.highlights) || !legacy.view) throw Error('Not a Map Composer v1 project');
 let d=newDocument();d.name=String(legacy.name||'Imported Map');d.theme.id=COLORS[legacy.style]?legacy.style:'dark';
 d.theme.overrides.border_color=legacy.borderColor||'#8c9aad';d.theme.overrides.border_width=Number(legacy.borderWidth)||1.2;
 d.camera={...d.camera,center_lon:Number(legacy.view.cx)||0,center_lat:Number(legacy.view.cy)||0,zoom:Number(legacy.view.zoom)||1};
 if(/^\d+x\d+$/.test(legacy.resolution||'')){let [width,height]=legacy.resolution.split('x').map(Number);d.canvas.width=width;d.canvas.height=height;}
 d.canvas.transparent=!!legacy.transparent;
 for(let type of ['WorldMap','Grid','Borders']){let o=Object.values(d.objects).find(x=>x.type===type);o.visible=legacy.layers?.[{WorldMap:'background',Grid:'grid',Borders:'borders'}[type]]!==false;}
 if(legacy.layers?.highlights!==false) for(let h of legacy.highlights){let c=madeObject('Region',String(h.iso||'Unknown'),{source:{dataset_id:'ne_admin0_110m',feature_id:String(h.iso||'')},region_kind:'Country',style:{fill_color:h.color||legacy.highlightColor||'#d86c52',fill_opacity:clamp((legacy.highlightOpacity??80)/100,0,1)}});d.objects[c.id]=c;d.scene.root_ids.push(c.id);}
 if(legacy.layers?.routes!==false)for(let r of legacy.routes||[]){let o=madeObject('Route','Legacy Route',{from:{lon:r.from[0],lat:r.from[1]},to:{lon:r.to[0],lat:r.to[1]},path_type:'Straight',style:{stroke_color:r.color||'#efb95c',stroke_width:3,dashed:true}});d.objects[o.id]=o;d.scene.root_ids.push(o.id);}
 if(legacy.layers?.labels!==false)for(let l of legacy.labels||[]){let o=madeObject('Label',String(l.text||'Label'),{text:String(l.text||''),position_mode:'geo',anchor:{lon:l.point[0],lat:l.point[1]},typography:{font_size:Number(l.size)||27},style:{text_color:l.color||'#f3eee7'}});d.objects[o.id]=o;d.scene.root_ids.push(o.id);}
 return d;
}
function listFor(doc,parent){if(parent===null)return doc.scene.root_ids;let p=doc.objects[parent];if(!p||p.type!=='Group')throw Error('Invalid group');return p.children;}
export function treeIds(doc,parent=null){let out=[];for(let id of listFor(doc,parent)){let o=doc.objects[id];if(!o)continue;out.push(id);if(o.type==='Group')out.push(...treeIds(doc,id));}return out;}
export function descendants(doc,id){let o=doc.objects[id];if(!o)return [];return o.type==='Group'?o.children.flatMap(k=>[k,...descendants(doc,k)]):[];}
export function ancestors(doc,id){let out=[];for(let p=doc.objects[id]?.parent_id;p;p=doc.objects[p]?.parent_id){if(out.includes(p))throw Error('Cycle detected');out.push(p)}return out;}
export const isLocked=(doc,id)=> !!doc.objects[id] && [id,...ancestors(doc,id)].some(k=>doc.objects[k]?.locked);
export const isVisible=(doc,id)=> !!doc.objects[id] && [id,...ancestors(doc,id)].every(k=>doc.objects[k]?.visible!==false);
export function normalizeSelection(doc,ids){let set=new Set(ids.filter(id=>doc.objects[id]));return [...set].filter(id=>!ancestors(doc,id).some(p=>set.has(p)));}
export function validateDocument(doc){
 if(doc?.format!=='cartorig-project'||doc.schema_version!=='2.0.0')throw Error('Unsupported project schema');
 if(!doc.scene||!Array.isArray(doc.scene.root_ids)||!doc.objects||typeof doc.objects!=='object')throw Error('Malformed scene');
 let seen=new Set(),walk=(list,parent)=>{if(!Array.isArray(list))throw Error('Malformed object list');for(let id of list){let obj=doc.objects[id];if(!obj||obj.id!==id||seen.has(id)||obj.parent_id!==parent)throw Error('Invalid scene tree');seen.add(id);if(obj.type==='Group')walk(obj.children,id);}};
 walk(doc.scene.root_ids,null);
 if(seen.size!==Object.keys(doc.objects).length)throw Error('Orphan objects in project');
 if(Object.values(doc.objects).filter(x=>x.type==='WorldMap').length!==1)throw Error('Exactly one World Map required');
 if(!Number.isFinite(doc.camera?.zoom)||doc.camera.zoom<=0)throw Error('Invalid camera');
 validateMapLabels(doc.map_labels);
 if(doc.render_options!==undefined){
  if(!doc.render_options||typeof doc.render_options!=='object'||Array.isArray(doc.render_options)||Object.keys(doc.render_options).some(k=>k!=='textures_enabled')||typeof doc.render_options.textures_enabled!=='boolean')throw Error('Invalid texture visibility');
 }
 if(!Array.isArray(doc.style_library??[])||(doc.style_library?.length||0)>100)throw Error('Invalid style library');
 if(!Array.isArray(doc.export_presets??[])||(doc.export_presets?.length||0)>50)throw Error('Invalid export presets');
 for(const [key,value] of Object.entries(doc.theme?.overrides||{}))validateThemeField(key,value);
 for(const [kind,fields] of Object.entries(doc.theme?.type_defaults||{})){if(!['Region','Route','Marker','Label','Shape','Group'].includes(kind)||typeof fields!=='object'||!fields)throw Error('Invalid type defaults');for(const [key,value] of Object.entries(fields))validateStyleField(key,value);}
 for(const preset of doc.style_library||[])parseStylePreset(JSON.stringify(preset));
 const point=p=>p&&typeof p==='object'&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&p.lon>=-180&&p.lon<=180&&p.lat>=-90&&p.lat<=90;
 for(let o of Object.values(doc.objects)){
  if(o.type==='Region' && !o.source?.feature_id)throw Error('Region without source geometry');
  if((o.type==='Label'||o.type==='Marker')&&!point(o.anchor))throw Error('Invalid marker or label coordinates');
  if(o.type==='Route'&&(!point(o.from)||!point(o.to)||!o.path_type))throw Error('Invalid route coordinates');
  if(['Route','Marker','Label','Shape'].includes(o.type))validateCreative(o);
  if(!Number.isFinite(o.opacity??1)||o.opacity<0||o.opacity>1)throw Error('Invalid object opacity');
  for(const [key,value] of Object.entries(o.style||{}))if(key!=='child_defaults')validateStyleField(key,value);
  if(o.type==='Group'&&o.style?.child_defaults)for(const [key,value] of Object.entries(o.style.child_defaults))validateStyleField(key,value);
 }
 return true;
}
export class SceneStore{
 constructor(doc=newDocument(),onChange=()=>{}){validateDocument(doc);this.doc=clone(doc);this.undoStack=[];this.redoStack=[];this.onChange=onChange;this.maxHistory=120;this.savedSnapshot=JSON.stringify(this.doc);this.currentSnapshot=this.savedSnapshot;this.selection=[];}
 get dirty(){return this.currentSnapshot!==this.savedSnapshot;}
 markSaved(){this.savedSnapshot=this.currentSnapshot;this.onChange('saved');}
 setSelection(ids){this.selection=[...new Set(ids)].filter(id=>this.doc.objects[id]);this.onChange('selection');}
 replace(doc){validateDocument(doc);this.doc=clone(doc);this.undoStack=[];this.redoStack=[];this.selection=[];this.savedSnapshot=JSON.stringify(this.doc);this.currentSnapshot=this.savedSnapshot;this.onChange('replace');}
 execute(cmd){const before=clone(this.doc),selected=[...this.selection];try{
  const d=this.doc,objs=d.objects;let obj=objs[cmd.id];let mutable=()=>{if(!obj)throw Error('Object not found');if(isLocked(d,obj.id))throw Error('Object is locked');};
  switch(cmd.type){
   case 'ResetScene':{
    if(cmd.confirm!==true)throw Error('Explicit confirmation required');
    // Reset map to default state but preserve this project's identity and Undo history.
    const clean=newDocument();
    clean.project_id=d.project_id;
    clean.name=d.name;
    clean.created_at=d.created_at;
    for(const key of Object.keys(d))delete d[key];
    Object.assign(d,clean);
    this.selection=[];
    break;
   }
   case 'CreateObject':{let o=clone(cmd.object);if(!o.id)o.id=uuid();if(objs[o.id])throw Error('Duplicate object ID');if(!['Region','Route','Label','Marker','Shape','Group'].includes(o.type))throw Error('Unsupported object type');let parent=cmd.parent_id??null;let list=listFor(d,parent);if(parent!==null&&isLocked(d,parent))throw Error('Parent is locked');o.parent_id=parent;if(o.type==='Group'&&!Array.isArray(o.children))o.children=[];objs[o.id]=o;list.splice(cmd.index==null?list.length:clamp(cmd.index,0,list.length),0,o.id);this.selection=[o.id];break;}
   case 'SetProperty':{mutable();let path=String(cmd.path||''),value=clone(cmd.value);
     if(path==='name')obj.name=String(value).slice(0,140);
     else if(['visible','locked','opacity','text','anchor','from','to','waypoints','points','path_type','curvature','symbol','position_mode','screen_pos','offset_x','offset_y','rotation','coordinate_space','shape_kind','asset_ref','linked_object_id'].includes(path))obj[path]=value;
     else if(/^callout_box\.(x|y)$/.test(path)){obj.callout_box??={x:.65,y:.4};obj.callout_box[path.split('.')[1]]=value;}
     else if(/^screen_pos\.(x|y)$/.test(path)){obj.screen_pos??={x:.5,y:.5};obj.screen_pos[path.split('.')[1]]=value;}
     else if(/^typography\.[a-z_]+$/.test(path)){obj.typography??={};obj.typography[path.slice(11)]=value;}
     else if(/^style\.[a-z_]+$/.test(path)){obj.style??={};obj.style[path.slice(6)]=value;}
     else throw Error('Unsupported property');break;}
   case 'SetProperties':{mutable();let keys=Object.keys(cmd.values||{});if(!keys.length||keys.some(k=>!['from','to','waypoints','points','callout_box','anchor','screen_pos','position_mode','coordinate_space','path_type','curvature','text','typography','style','linked_object_id','offset_x','offset_y','rotation'].includes(k)))throw Error('Invalid combined property update');for(let key of keys)obj[key]=clone(cmd.values[key]);break;}
   case 'SetAssetFavorite':{let a=d.asset_refs?.find(x=>x.id===cmd.asset_id);if(!a)throw Error('Asset not found');a.favorite=!!cmd.value;break;}
   case 'RemoveAssetFromLibrary':{let i=d.asset_refs?.findIndex(x=>x.id===cmd.asset_id);if(i<0)throw Error('Asset not found');let a=d.asset_refs[i];let used=Object.values(objs).some(x=>x.asset_ref===a.id);if(used){if(!cmd.keepEmbedded)throw Error('Asset is used: keep embedded copy or cancel');a.catalog_visible=false;}else d.asset_refs.splice(i,1);break;}
   case 'ImportAssetAndAssign':{mutable();if(obj.type!=='Marker')throw Error('Only markers may have custom icon assets');let a=clone(cmd.asset);if(!a?.id||typeof a.data!=='string'||!/^data:image\/png;base64,/.test(a.data)||a.data.length>8_000_000||d.asset_refs.some(x=>x.id===a.id))throw Error('Invalid imported PNG');d.asset_refs.push(a);obj.asset_ref=a.id;break;}
   case 'ImportAsset':{let a=clone(cmd.asset);if(!a?.id||typeof a.data!=='string'||!a.data.startsWith('data:image/')||a.data.length>8_000_000||d.asset_refs.some(x=>x.id===a.id))throw Error('Invalid imported asset');d.asset_refs.push(a);break;}
   case 'BatchColor':{let ids=normalizeSelection(d,cmd.ids);if(!ids.length)throw Error('No selection');for(let id of ids){if(isLocked(d,id))throw Error('Locked object in selection');let o=objs[id];let key={Region:'fill_color',Route:'stroke_color',Label:'text_color',Marker:'fill_color',Shape:'stroke_color'}[o.type];if(!key)throw Error('Incompatible object type');o.style??={};o.style[key]=cmd.color;}break;}
   case 'BatchSet':{let ids=normalizeSelection(d,cmd.ids);if(!ids.length)throw Error('No selection');for(let id of ids)if(isLocked(d,id))throw Error('Locked object in selection');for(let id of ids){let item=objs[id];if(cmd.path==='opacity'||cmd.path==='visible')item[cmd.path]=cmd.value;else if(cmd.path.startsWith('style.')){item.style??={};item.style[cmd.path.slice(6)]=cmd.value}else throw Error('Invalid batch property');}break;}
   case 'SetVisibility':{mutable();obj.visible=!!cmd.value;break;}
   case 'SetLock':{if(!obj)throw Error('Object not found');if(ancestors(d,obj.id).some(id=>objs[id].locked))throw Error('Parent group is locked');obj.locked=!!cmd.value;break;}
   case 'RenameObject':{mutable();obj.name=String(cmd.name||'').trim().slice(0,140)||obj.name;break;}
   case 'DuplicateObject':{mutable();if(['WorldMap','Grid','Borders'].includes(obj.type))throw Error('Structural layer cannot be duplicated');let map=new Map();function copy(id,parent){let n=clone(objs[id]);n.id=uuid();map.set(id,n.id);n.name=id===cmd.id?n.name+' Copy':n.name;n.parent_id=parent;if(n.type==='Group')n.children=n.children.map(child=>copy(child,n.id));objs[n.id]=n;return n.id;}
     let id=copy(obj.id,obj.parent_id);
     for(let newId of map.values()){let n=objs[newId];for(let k of ['linked_object_id','from_link','to_link'])if(map.has(n[k]))n[k]=map.get(n[k]);}
     let list=listFor(d,obj.parent_id);list.splice(list.indexOf(obj.id)+1,0,id);this.selection=[id];break;}
   case 'DeleteObject':{mutable();if(['WorldMap','Grid','Borders'].includes(obj.type))throw Error('Structural layer cannot be deleted');
     const removing=new Set([obj.id,...descendants(d,obj.id)]);
     const dependent=Object.values(objs).filter(o=>!removing.has(o.id)&&(
       (o.linked_object_id&&removing.has(o.linked_object_id))||
       (o.from?.linked_object_id&&removing.has(o.from.linked_object_id))||
       (o.to?.linked_object_id&&removing.has(o.to.linked_object_id))||
       (o.from_link&&removing.has(o.from_link))||(o.to_link&&removing.has(o.to_link))));
     if(dependent.length&&!cmd.freeze)throw Error(`Linked objects: ${dependent.map(x=>x.name).join(', ')}. Confirm Freeze Links.`);
     for(const linked of dependent){
       for(let key of ['from','to'])if(removing.has(linked[key]?.linked_object_id)){
         const anchor=objs[linked[key].linked_object_id]?.anchor;
         if(anchor){linked[key].lon=anchor.lon;linked[key].lat=anchor.lat;}
         linked[key].linked_object_id=null;linked[key].source_kind='free coordinate';
       }
       if(removing.has(linked.linked_object_id)){
         const anchor=objs[linked.linked_object_id]?.anchor;
         if(anchor&&linked.anchor)linked.anchor={lon:anchor.lon,lat:anchor.lat};
         if(anchor&&linked.type==='Shape'&&linked.shape_kind==='Callout'&&linked.coordinate_space==='geo'&&linked.points?.length)linked.points[0]={lon:anchor.lon,lat:anchor.lat};
         linked.linked_object_id=null;
       }
       for(let key of ['from_link','to_link'])if(removing.has(linked[key]))linked[key]=null;
     }
     let list=listFor(d,obj.parent_id);list.splice(list.indexOf(obj.id),1);for(let id of removing)delete objs[id];this.selection=this.selection.filter(id=>!removing.has(id));break;}
   case 'MoveObject':{mutable();if(['WorldMap','Grid','Borders'].includes(obj.type))throw Error('Structural layers cannot be moved');let parent=cmd.parent_id??null;if(parent===obj.id||descendants(d,obj.id).includes(parent))throw Error('Cannot nest a group inside itself');if(parent!==null&&isLocked(d,parent))throw Error('Destination locked');let dest=listFor(d,parent);let source=listFor(d,obj.parent_id),oldIndex=source.indexOf(obj.id);source.splice(oldIndex,1);let index=Number.isInteger(cmd.index)?cmd.index:dest.length;if(source===dest&&oldIndex<index)index--;index=clamp(index,0,dest.length);dest.splice(index,0,obj.id);obj.parent_id=parent;break;}
   case 'GroupSelection':{let ids=normalizeSelection(d,cmd.ids);if(!ids.length)throw Error('No objects to group');let parent=objs[ids[0]].parent_id;if(ids.some(id=>objs[id].parent_id!==parent||isLocked(d,id)||['WorldMap','Grid','Borders'].includes(objs[id].type)))throw Error('Group only unlocked peers, excluding structural layers');let list=listFor(d,parent),ordered=list.filter(id=>ids.includes(id)),index=list.indexOf(ordered[0]);list.splice(0,list.length,...list.filter(id=>!ids.includes(id)));let g=madeObject('Group','New Group',{children:ordered,parent_id:parent});objs[g.id]=g;for(let id of ordered)objs[id].parent_id=g.id;list.splice(index,0,g.id);this.selection=[g.id];break;}
   case 'Ungroup':{mutable();if(obj.type!=='Group')throw Error('Select a group');let list=listFor(d,obj.parent_id),i=list.indexOf(obj.id);list.splice(i,1,...obj.children);for(let id of obj.children)objs[id].parent_id=obj.parent_id;delete objs[obj.id];this.selection=[...obj.children];break;}
   case 'SetCameraPose':{d.camera={...d.camera,...cmd.pose};d.camera.zoom=clamp(d.camera.zoom,.35,80);d.camera.center_lat=clamp(d.camera.center_lat,-90,90);break;}
   case 'ApplyStyle':case 'ApplyTheme':{if(!COLORS[cmd.id]&&!d.style_library?.some(x=>x.id===cmd.id))throw Error('Unknown style');d.theme.id=cmd.id;let preset=d.style_library?.find(x=>x.id===cmd.id);
    // Selecting a scene look starts from that look. Object overrides remain
    // untouched. Preserve global overrides ONLY on explicit request.
    d.theme.overrides=cmd.keep_global_overrides?clone(d.theme.overrides||{}):clone(preset?.overrides||{});
    d.theme.type_defaults=clone(preset?.defaults||{});break;}
   case 'SetObjectStyle':{mutable();let patch=cmd.values||{};if(!Object.keys(patch).length)break;for(const [key,value] of Object.entries(patch)){validateStyleField(key,value);if(value===null)delete obj.style[key];else obj.style[key]=clone(value);}break;}
   case 'ReplaceRegionGeography':{mutable();if(obj.type!=='Region')throw Error('Not a region');let geo=cmd.geo;if(!geo||!['Country','State','Continent'].includes(geo.region_kind)||!geo.source?.feature_id)throw Error('Invalid replacement geography');if(!geo.geometry||!['Polygon','MultiPolygon'].includes(geo.geometry.type)||!Array.isArray(geo.geometry.coordinates)||!geo.geometry.coordinates.length)throw Error('Polygon source unavailable');obj.region_kind=geo.region_kind;obj.source=clone(geo.source);obj.embedded_geometry=clone(geo.geometry);obj.geo_source_info=clone(geo.geo_source_info||{});break;}
   case 'ResetStyleProperty':{mutable();if(!/^[a-z_]+$/.test(cmd.key))throw Error('Invalid style property');delete obj.style[cmd.key];break;}
   case 'ResetObjectStyle':{mutable();obj.style={};break;}
   case 'ResetCategoryStyle':{if(!['Region','Route','Marker','Label','Shape','Group'].includes(cmd.object_type))throw Error('Invalid object category');d.theme.type_defaults??={};delete d.theme.type_defaults[cmd.object_type];break;}
   case 'SetCategoryStyle':{if(!['Region','Route','Marker','Label','Shape','Group'].includes(cmd.object_type))throw Error('Invalid object category');validateStyleField(cmd.key,cmd.value);d.theme.type_defaults??={};d.theme.type_defaults[cmd.object_type]??={};if(cmd.value===null)delete d.theme.type_defaults[cmd.object_type][cmd.key];else d.theme.type_defaults[cmd.object_type][cmd.key]=clone(cmd.value);break;}
   case 'SetGroupChildStyle':{mutable();if(obj.type!=='Group')throw Error('Not a group');validateStyleField(cmd.key,cmd.value);obj.style??={};obj.style.child_defaults??={};if(cmd.value===null)delete obj.style.child_defaults[cmd.key];else obj.style.child_defaults[cmd.key]=clone(cmd.value);break;}
   case 'ResetAllObjectOverrides':{if(cmd.confirm!==true)throw Error('Explicit confirmation required');for(const item of Object.values(objs))if(!['WorldMap','Borders','Grid'].includes(item.type)){if(isLocked(d,item.id))throw Error('Locked object blocks global reset');item.style={};}break;}
   case 'SaveUserStyle':{const p=makeStylePreset(d,cmd.name);d.style_library??=[];if(d.style_library.length>=100)throw Error('Style library full');d.style_library.push(p);break;}
   case 'ImportUserStyle':{const p=parseStylePreset(cmd.content);d.style_library??=[];if(d.style_library.length>=100)throw Error('Style library full');
    if(cmd.on_conflict==='duplicate'){
     // A user-requested duplicate must ALWAYS own a new UUID, including when
     // the source preset only exists in the global library.
     p.id=uuid();p.name=(p.name.endsWith(' Copy')?p.name:p.name+' Copy').slice(0,90);
    }else if(d.style_library.some(x=>x.id===p.id)){
     throw Error('Style UUID already exists. Choose Duplicate to import as a separate style.');
    }
    d.style_library.push(p);break;}
   case 'ApplyUserStyle':{const p=parseStylePreset(cmd.content);if(typeof cmd.id!=='string'||!/^[0-9a-f-]{36}$/i.test(cmd.id))throw Error('Invalid style UUID');d.style_library??=[];if(!d.style_library.some(x=>x.id===cmd.id)){if(d.style_library.length>=100)throw Error('Style library full');p.id=cmd.id;d.style_library.push(p);}const chosen=d.style_library.find(x=>x.id===cmd.id);d.theme.id=chosen.id;d.theme.overrides=clone(chosen.overrides||{});d.theme.type_defaults=clone(chosen.defaults||{});break;}
   case 'RenameUserStyle':{const p=d.style_library?.find(x=>x.id===cmd.id);if(!p)throw Error('Style not found');const name=String(cmd.name||'').trim();if(!name||name.length>90)throw Error('Invalid style name');p.name=name;break;}
   case 'DeleteUserStyle':{if(d.theme.id===cmd.id)throw Error('Select another theme first');const index=d.style_library?.findIndex(x=>x.id===cmd.id);if(index==null||index<0)throw Error('Style not found');d.style_library.splice(index,1);break;}
   case 'SetMapLabelOption':{
    const section=String(cmd.section||''),key=String(cmd.key||'');
    if(!['enabled','sizes','colors','settings'].includes(section))throw Error('Invalid label section');
    d.map_labels??={enabled:{},sizes:{},colors:{}};
    if(section==='settings'){
     if(!['font','density','halo'].includes(key))throw Error('Invalid label setting');
     d.map_labels[key]=cmd.value;
    }else{
     if(!MAP_LABEL_KINDS.includes(key))throw Error('Invalid label category');
     d.map_labels[section]??={};
     if(cmd.value===null&&section!=='enabled')delete d.map_labels[section][key];
     else d.map_labels[section][key]=cmd.value;
    }
    validateMapLabels(d.map_labels);break;
   }
   case 'SetTextureVisibility':{
    if(typeof cmd.enabled!=='boolean')throw Error('Texture visibility must be boolean');
    d.render_options??={};d.render_options.textures_enabled=cmd.enabled;break;
   }
   case 'SetCanvas':{d.canvas={...d.canvas,...cmd.canvas};break;}
   case 'SetExportPresets':{if(!Array.isArray(cmd.presets)||cmd.presets.length>50)throw Error('Invalid export presets');d.export_presets=clone(cmd.presets);break;}
   case 'SetProjectName':{d.name=String(cmd.name||'Untitled Map').slice(0,180);break;}
   case 'SetThemeProperty':{validateThemeField(cmd.key,cmd.value);d.theme.overrides??={};if(cmd.value===null)delete d.theme.overrides[cmd.key];else d.theme.overrides[cmd.key]=clone(cmd.value);break;}
   default:throw Error('Unknown command');
  }
  validateDocument(d);const old=this.currentSnapshot,now=JSON.stringify(d);if(old===now)return false;
  d.revision=(before.revision||0)+1;d.updated_at=new Date().toISOString();this.currentSnapshot=JSON.stringify(d);this.undoStack.push({doc:before,selection:selected});if(this.undoStack.length>this.maxHistory)this.undoStack.shift();this.redoStack=[];this.onChange('change');return true;
 }catch(e){this.doc=before;this.selection=selected;this.currentSnapshot=JSON.stringify(before);throw e;}}
 undo(){if(!this.undoStack.length)return false;this.redoStack.push({doc:clone(this.doc),selection:[...this.selection]});let prev=this.undoStack.pop();this.doc=prev.doc;this.selection=prev.selection;this.currentSnapshot=JSON.stringify(this.doc);this.onChange('change');return true;}
 redo(){if(!this.redoStack.length)return false;this.undoStack.push({doc:clone(this.doc),selection:[...this.selection]});let next=this.redoStack.pop();this.doc=next.doc;this.selection=next.selection;this.currentSnapshot=JSON.stringify(this.doc);this.onChange('change');return true;}
}
