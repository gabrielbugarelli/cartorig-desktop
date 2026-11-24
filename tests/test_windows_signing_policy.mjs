import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pipeline=get('.github/workflows/cartorig-windows-signpath-signed.yml');
const script=get('scripts/verify-windows-signature.ps1');
const manual=get('.github/workflows/cartorig-wails3-portable.yml');
const docs=get('docs/WINDOWS_CODE_SIGNING.md');

assert.match(pipeline,/workflow_dispatch:/,'Signing must be manually authorized');
assert.doesNotMatch(pipeline,/^\s+push:/m,'No automatic signing on every push');
assert.match(pipeline,/github\.event\.repository\.private == false/,'Only public builds');
assert.match(pipeline,/runs-on: windows-2022/,'Use standard free runner');
assert.match(pipeline,/signpath\/github-action-submit-signing-request@v3/,'Sign through approved certificate service');
assert.match(pipeline,/secrets\.SIGNPATH_API_TOKEN/,'Token from GitHub Actions secrets only');
assert.match(pipeline,/vars\.SIGNPATH_ORGANIZATION_ID/,'Organization ID must be configured');
assert.match(pipeline,/vars\.SIGNPATH_PROJECT_SLUG/,'Signing project must be configured');
assert.match(pipeline,/vars\.SIGNPATH_SIGNING_POLICY_SLUG/,'Signing policy must be configured');
assert.match(pipeline,/wait-for-completion: true/,'Must await signature before packaging');
assert.match(pipeline,/github-artifact-id:/,'SignPath validates GitHub-hosted build provenance');
assert.match(pipeline,/Verify Authenticode, regenerate SHA256 and package ONLY signed executable/);
assert.ok(pipeline.indexOf('Request trusted signature from SignPath Foundation') <
 pipeline.indexOf('Verify Authenticode, regenerate SHA256'),
 'Do not checksum or distribute before signature');
assert.ok(pipeline.indexOf('./scripts/verify-windows-signature.ps1') <
 pipeline.indexOf('Compress-Archive -LiteralPath'),
 'Refuse to archive any unsigned or invalid executable');
assert.ok(pipeline.indexOf('Compress-Archive -LiteralPath') <
 pipeline.indexOf('Upload verified SIGNED Windows portable'));
assert.match(pipeline,/if-no-files-found: error/);
assert.match(pipeline,/retention-days: 3/);
assert.match(script,/Get-AuthenticodeSignature/);
assert.match(script,/SignatureStatus\]::Valid/);
assert.match(script,/UNSIGNED EXECUTABLE/);
assert.match(script,/INVALID\/UNTRUSTED SIGNATURE/);
assert.match(script,/1\.3\.6\.1\.5\.5\.7\.3\.3/,'Certificate must be issued for code signing');
const localSigner=get('scripts/sign-windows-portable.ps1');
assert.match(localSigner,/ExpectedSHA256/);
assert.match(localSigner,/CertificateThumbprint/);
assert.match(localSigner,/Get-FileHash/);
assert.match(localSigner,/verify-windows-signature/);
assert.ok(localSigner.indexOf('& $signtool sign')<localSigner.indexOf('verify-windows-signature.ps1'),
 'Signature verification must follow signing');
assert.ok(localSigner.indexOf('verify-windows-signature.ps1')<localSigner.indexOf('Compress-Archive'),
 'Cannot package unverified executable');
assert.match(docs,/SignPath Foundation/);
assert.match(docs,/assinatura altera os bytes|assinatura \(a assinatura altera os bytes|assinatura.*bytes/);
assert.match(manual,/workflow_dispatch:/,'Existing free unsigned preview workflow retained');
assert.doesNotMatch(manual,/^\s+push:/m);
console.log('CODE SIGNING POLICY PASS: strict trusted-signature gate, checksum after signing, public/manual runner, no security bypasses');
