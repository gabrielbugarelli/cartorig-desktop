import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('assets/index.html');
const app=read('assets/app.js');
const studio=read('assets/style-studio.js');
const css=read('assets/ux-layout.css');

// Both user-rejected first-use cards must be gone, not merely hidden in CSS.
assert.doesNotMatch(app,/Find a place to add to your map|Build your first map layer/);
assert.doesNotMatch(app,/Browse countries|Browse states|Browse cities/);
assert.doesNotMatch(app,/ux-geo-start/);
assert.doesNotMatch(app,/note\.append\(title,hint,browse\)/);
assert.match(app,/if\(!q&&!browsing\)\{\s*count\.textContent='';\s*return;/);
assert.match(app,/No matching places/,'real no-results feedback should remain');
assert.match(app,/No matching layers/,'real search feedback should remain');

// There must be a single visible block with both active map display controls.
assert.equal((html.match(/id="uxMapBoundaries"/g)||[]).length,1);
assert.match(html,/<section class="ux-map-display" id="uxMapBoundaries"[^>]*>/);
assert.match(html,/<h3 id="uxMapDisplayTitle">MAP DISPLAY<\/h3>/);
assert.match(html,/id="uxMapTextureSlot"/);
assert.match(html,/id="showBrazilStates" type="checkbox"/);
assert.doesNotMatch(html,/<summary>STATE BOUNDARIES &amp; GEOGRAPHY<\/summary>/);
assert.match(html,/id="geoPhysicalGroup" hidden/,'disabled future options remain available in markup, but not in main UI');
for(const name of ['showRivers','showLakes','showCoastlines']){
 assert.match(html,new RegExp('id="'+name+'" type="checkbox" disabled'));
}
assert.match(studio,/const textureSlot=mapControls\?\.querySelector\('#uxMapTextureSlot'\)/);
assert.match(studio,/textureSlot\.replaceChildren\(textureToggle\)/,'re-render must not duplicate texture toggle');
assert.match(studio,/controlsArea\.append\(mapControls\)/,'both controls must use the same panel');
assert.match(studio,/textureInput\.checked=texturesEnabled\(doc\)/);
assert.match(studio,/SetTextureVisibility/);
assert.match(app,/\$\('showBrazilStates'\)\.onchange=e=>exec\(\{type:'SetThemeProperty',key:'show_state_boundaries',value:e\.target\.checked\}\)/);
assert.match(app,/\$\('showBrazilStates'\)\.checked=store\.doc\.theme\.overrides\.show_state_boundaries===true/);
assert.match(css,/\.ux-map-display\{display:flex/);
assert.match(css,/#geoPhysicalGroup\[hidden\]\{display:none!important\}/);
console.log('UI MAP DISPLAY PASS: removed onboarding, compact shared section, preserved texture/state handlers');
