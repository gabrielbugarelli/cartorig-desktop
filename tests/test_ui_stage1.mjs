import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('assets/index.html');
const app=read('assets/app.js');
const studio=read('assets/production-studio.js');
const css=read('assets/ux-layout.css');
const workflow=read('.github/workflows/cartorig-wails3-portable.yml');

for(const id of ['productionProjects','projTabProjects','projTabRecovery','projTabTemplates',
 'projPanelProjects','projPanelRecovery','projPanelTemplates','prodSave','prodSaveAs',
 'prodSaveTemplate','prodRecent','prodRecoveries','prodRecoverySection',
 'prodRecoveryDelete','prodRecoveryDeleteAll','projRecoveryCount','prodRecoveryEmpty',
 'addPlaceFromScene','newGroup','duplicate','delete','resetMap']){
 const occurrences=[...html.matchAll(/id="([^"]+)"/g)].filter(m=>m[1]===id).length;
 assert.equal(occurrences,1,id+' must have exactly one DOM node');
}
assert.match(html,/role="tablist" aria-label="Project Manager sections"/);
for(const [tab,panel] of [['projTabProjects','projPanelProjects'],['projTabRecovery','projPanelRecovery'],['projTabTemplates','projPanelTemplates']]){
 assert.match(html,new RegExp('id="'+tab+'"[^>]*role="tab"[^>]*aria-controls="'+panel+'"'));
 assert.match(html,new RegExp('id="'+panel+'"[^>]*role="tabpanel"[^>]*aria-labelledby="'+tab+'"'));
}
assert.ok(html.indexOf('id="resetMap"')<html.indexOf('id="saveProject"'),'Reset must be in File menu, not the main action bar');
assert.match(studio,/function setProjectManagerTab\(/);
assert.match(studio,/function bindProjectManagerTabs\(/);
assert.match(studio,/tab\.onkeydown=event=>/);
assert.match(studio,/setProjectManagerTab\(projectTabs\[next\]\[0\],\{focus:true\}\)/);
assert.match(studio,/\$\('prodRecoveryEmpty'\)\.hidden=!!items\.length/);
assert.match(studio,/badge\.hidden=!items\.length/);
assert.match(studio,/openModal\('productionProjects'\)/);
assert.match(studio,/No saved projects yet/);
assert.match(studio,/No custom templates yet/);
assert.match(studio,/return projects\('templates'\)/);
assert.match(studio,/async function deleteRecoveries\(all=false\)/);
assert.match(studio,/async function renderRecoveries\(\)/);
assert.match(app,/function layerActionIcon\(name\)/);
assert.match(app,/layerActionIcon\(o\.visible\?'eye':'eye-off'\)/);
assert.match(app,/layerActionIcon\(o\.locked\?'lock':'unlock'\)/);
assert.match(app,/\$\('addPlaceFromScene'\)\.onclick=/);
assert.doesNotMatch(app,/Find a place to add to your map/,'remove Geography onboarding card');
assert.doesNotMatch(app,/Build your first map layer/,'remove Scene onboarding card');
assert.doesNotMatch(app,/Browse countries/,'remove initial geography browse buttons');
assert.match(app,/No matching places/);
assert.match(app,/Clear search and filters/);
assert.match(app,/No matching layers/);
assert.match(app,/Nothing selected/);
assert.match(app,/setTab\('layers'\);setRightTab\('inspector'\)/);
assert.match(css,/\.ux-pm-panel\[hidden\]/);
assert.match(css,/\.ux-pm-tabs/);
assert.match(css,/\.ux-scene-primary/);
assert.match(css,/\.ux-empty-state/);
assert.match(css,/\.country-result\.geo-result/);
assert.match(css,/\.tree-row \.node-actions svg/);
assert.match(workflow,/runs-on: windows-2022/);
assert.match(workflow,/github\.event\.repository\.private == false/);
assert.match(workflow,/on:\s*\n\s*workflow_dispatch:/);
assert.doesNotMatch(workflow,/\n\s*push:/,'UI development should not auto-trigger paid builds');
assert.deepEqual([...workflow.matchAll(/retention-days:\s*(\d+)/g)].map(x=>Number(x[1])),[3,3]);
console.log('UI STAGE 1 PASS: project tabs, empty states, clear actions, preserved recovery controls and free manual CI');
