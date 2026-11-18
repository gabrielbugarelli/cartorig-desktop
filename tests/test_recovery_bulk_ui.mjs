import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('assets/index.html');
const studio=read('assets/production-studio.js');
const server=read('production.go');
const desktop=read('desktop_http.go');
const css=read('assets/ux-layout.css');

for(const id of ['prodRecoverySection','prodRecoverySelectAll','prodRecoverySelected','prodRecoveryDelete','prodRecoveryDeleteAll','prodRecoveries']){
 assert.ok(html.includes('id="'+id+'"'),'Missing recovery UI control '+id);
}
assert.match(html,/id="prodRecoveryDelete"[^>]*disabled/,'delete selected must be disabled until selection');
assert.match(html,/A exclusão é permanente/,'users must know deletion is irreversible');
assert.match(studio,/checkbox\.onchange=\(\)=>\{/,'individual selection must be independent of restore');
assert.match(studio,/recoverySelected\.add\(item\.id\)/,'individual item selection required');
assert.match(studio,/recoverySelected\.delete\(item\.id\)/,'individual item deselection required');
assert.match(studio,/\$\('prodRecoverySelectAll'\)\.onchange=/,'select all needs change handler');
assert.match(studio,/recoverySelected\.clear\(\)/,'deselect all needed');
assert.match(studio,/\$\('prodRecoveryDelete'\)\.onclick=.*deleteRecoveries\(false\)/,'batch delete button must be live');
assert.match(studio,/\$\('prodRecoveryDeleteAll'\)\.onclick=.*deleteRecoveries\(true\)/,'delete all button must be live');
assert.match(studio,/if\(!confirm\(prompt/,'bulk delete requires explicit confirmation');
assert.match(studio,/method:'DELETE'.*body:JSON\.stringify\(\{ids\}\)/,'delete must send explicit selected IDs');
assert.match(studio,/await renderRecoveries\(\);\s*await recoveryCheck\(\)/,'list and count must refresh after delete');
assert.match(studio,/const recovered=await\(await api\('\/api\/v2\/recovery\/'/,'restore functionality must survive');
assert.match(server,/func recoveryDeleteHandler\(/,'new delete route required');
assert.match(server,/if r\.Method == http\.MethodDelete \{\s*recoveryDeleteHandler/,'recovery endpoint must support DELETE');
assert.match(server,/info\.Mode\(\)&os\.ModeSymlink != 0/,'symlink guard for deletion');
assert.match(server,/\[\]string\{"latest\.json", "latest\.json\.bak"\}/,'only autosave files must be removed');
assert.match(server,/filepath\.Join\(root, id\)/,'recoveries are scoped under Autosaves');
assert.match(desktop,/r\.Method == http\.MethodDelete/,'native WebView delete requests require token');
assert.match(css,/prod-recovery-toolbar/,'bulk actions must be visually grouped');
console.log('RECOVERY BULK UI PASS: selectable rows / select all / confirmation / scoped DELETE / refresh');
