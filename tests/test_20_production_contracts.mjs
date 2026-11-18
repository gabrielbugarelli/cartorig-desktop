import assert from 'node:assert/strict';
import {createTemplate,PROJECT_TEMPLATES} from '../assets/production-templates.js';
import {newDocument,validateDocument,SceneStore,madeObject} from '../assets/scene-core.js';
import {serializeVectorScene} from '../assets/production-vector.js';
import {readFileSync} from 'node:fs';
assert.equal(PROJECT_TEMPLATES.length,5);
for(const t of PROJECT_TEMPLATES){const d=createTemplate(t.id);validateDocument(d);assert.equal(d.name,t.name);assert.ok(d.project_id);}
const d=newDocument(),store=new SceneStore(d);assert.equal(store.execute({type:'SetExportPresets',presets:[{id:'preset-x',name:'4K',config:{fmt:'layered',resolution:'3840x2160'}}]}),true);assert.equal(store.doc.export_presets.length,1);store.undo();assert.equal(store.doc.export_presets.length,0);store.redo();assert.equal(store.doc.export_presets.length,1);
const countries=JSON.parse(readFileSync(new URL('../assets/countries.json',import.meta.url),'utf8'));
const t=createTemplate('country'),region=Object.values(t.objects).find(o=>o.type==='Region');assert.ok(region);
const svg=serializeVectorScene(t,countries,null,800,450,{onlyIds:[region.id]});assert.ok(svg.svg.includes('<path'));assert.ok(svg.svg.includes('viewBox="0 0 800 450"'));
assert.ok(!svg.svg.includes('<script'));
console.log('M5 production contracts: 5 validated templates, reversible export presets, real Region SVG projection: PASS');
