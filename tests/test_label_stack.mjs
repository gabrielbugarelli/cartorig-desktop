import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const renderer=read('assets/scene-renderer.js');
const vector=read('assets/production-vector.js');
const app=read('assets/app.js');
const studio=read('assets/production-studio.js');

const drawAll=renderer.indexOf('drawList(doc.scene.root_ids,ctx);');
const labelDraw=renderer.indexOf('paintMapLabels(ctx,doc,images._labels,w,h,project,paletteFor(doc));');
const atmosphere=renderer.indexOf("ctx.globalCompositeOperation='source-atop';applyAtmosphere");
assert.ok(drawAll>0,'the renderer must draw all map and authored layers');
assert.ok(labelDraw>drawAll,'geographic labels must paint after country region fills');
assert.ok(labelDraw<atmosphere,'label overlay must remain inside the final scene compositing');
assert.doesNotMatch(renderer,/drawList\(roots\.slice\(overlayAt\),ctx\)/,
 'a later region pass must not obscure geographic names');
assert.match(renderer,/if\(\(!allowed\|\|includeMapLabels\)&&!soloId\)paintMapLabels/,
 'production final composites must include geographic labels');
const vectorGeoLabels=vector.indexOf('if(includeMapLabels&&doc.map_labels&&labels');
const vectorShapes=vector.indexOf("for(const id of treeIds(doc))");
assert.ok(vectorGeoLabels>vectorShapes,'SVG geographic labels must follow region paths');
assert.match(app,/renderScene\(context,doc,countries,images,cv.width,cv.height\);form.append\('final'/,
 'classic layered ZIP final composite must use corrected renderer');
assert.match(studio,/includeMapLabels:useLabels/,
 'production exports must keep the name-overlay option');
console.log('MAP LABEL STACK PASS: place names above region overlays in preview, PNG, ZIP and SVG');
