/* CartoRig 2.0 built-in project templates use the same SceneDocument schema.
   All geographic objects reference existing offline Natural Earth features. */
import {newDocument,madeObject} from './scene-core.js';
export const PROJECT_TEMPLATES=[
 {id:'world',name:'World Map Blank',description:'Uncluttered map with all base layers'},
 {id:'country',name:'Country Highlight',description:'Brazil highlight, ready to frame and style'},
 {id:'political',name:'Regional Political',description:'Brazil geopolitical starting scene'},
 {id:'tactical',name:'Tactical Map',description:'Tactical base map with editorial markers and route'},
 {id:'terrain',name:'Documentary Terrain',description:'Documentary textured relief composition'}
];
export function createTemplate(key){
 const d=newDocument();const cfg=PROJECT_TEMPLATES.find(x=>x.id===key);if(!cfg)throw Error('Unknown template');d.name=cfg.name;
 const add=(type,name,opts)=>{let o=madeObject(type,name,opts);d.objects[o.id]=o;d.scene.root_ids.push(o.id);return o};
 if(key==='country'||key==='political'){
  add('Region','Brazil',{region_kind:'Country',source:{dataset_id:'ne_admin0_110m',feature_id:'BRA'},style:{fill_color:key==='country'?'#ce815c':'#dc6658',fill_opacity:.85,stroke_width:2}});
  d.camera={...d.camera,center_lon:-53,center_lat:-12,zoom:2.8};
 }
 if(key==='political')d.theme.id='dark';
 if(key==='tactical'){
  d.theme.id='tactical';d.camera={...d.camera,center_lon:-53,center_lat:-26,zoom:2.0};
  add('Marker','Brasília',{symbol:'Strategic',anchor:{lon:-47.8825,lat:-15.7942},style:{symbol_size:14}});
  add('Route','Brazil–Argentina',{from:{lon:-47.8825,lat:-15.7942},to:{lon:-58.3816,lat:-34.6037},path_type:'Geodesic',style:{stroke_color:'#e9c66c',stroke_width:3}});
 }
 if(key==='terrain'){
  d.theme.id='terrain';d.camera={...d.camera,center_lon:9,center_lat:47,zoom:3.5};
 }
 return d;
}
