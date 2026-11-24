/* CartoRig UI/UX Stage 2.4 — data-only Quick adjustments definitions.
 * All writes continue through SetThemeProperty/SetSurfaceTextureVisibility;
 * no new document fields or styling logic are introduced.
 */
import {texturesEnabled} from './scene-core.js';
import {themeValue} from './style-resolver.js';

export const QUICK_LOOK_FIELDS=Object.freeze([
 Object.freeze({key:'land_material_strength',label:'Land texture intensity',kind:'strength',surface:'land',min:0,max:1,step:.05}),
 Object.freeze({key:'ocean_material_strength',label:'Ocean texture intensity',kind:'strength',surface:'ocean',min:0,max:1,step:.05}),
 Object.freeze({key:'relief_strength',label:'Relief intensity',kind:'strength',surface:'land',min:0,max:1,step:.05}),
 Object.freeze({key:'land_color',label:'Land color',kind:'color'}),
 Object.freeze({key:'ocean_color',label:'Ocean color',kind:'color'})
]);
export const QUICK_LOOK_KEYS=Object.freeze(QUICK_LOOK_FIELDS.map(x=>x.key));
export const quickLookField=key=>QUICK_LOOK_FIELDS.find(x=>x.key===key)||null;
export function lookFieldStatus(doc,key){
 const overridden=Object.hasOwn(doc?.theme?.overrides||{},key)&&doc.theme.overrides[key]!==null;
 const configured=quickLookField(key);
 const disabled=!!configured?.surface&&!texturesEnabled(doc,configured.surface);
 return disabled?'disabled':overridden?'customized':'inherited';
}
export function countLookCustomizations(doc){
 const over=doc?.theme?.overrides||{};
 const changed=Object.entries(over).filter(([key,value])=>value!==null&&value!==undefined).length;
 const categories=Object.values(doc?.theme?.type_defaults||{}).reduce((sum,fields)=>sum+Object.values(fields||{}).filter(v=>v!==null&&v!==undefined).length,0);
 return changed+categories;
}
export function quickLookValue(doc,key){
 return themeValue(doc,key);
}
export function quickLookPercent(doc,key){
 const field=quickLookField(key);
 if(field?.kind!=='strength')return null;
 const value=quickLookValue(doc,key);
 return Number.isFinite(value)?Math.round(100*value):0;
}
export function validateQuickValue(key,value){
 const field=quickLookField(key);
 if(!field)return false;
 if(field.kind==='color')return typeof value==='string'&&/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
 return typeof value==='number'&&Number.isFinite(value)&&value>=field.min&&value<=field.max;
}
