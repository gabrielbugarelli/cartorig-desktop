"""Windows-only unattended installer smoke test. The GUI installer supports /silent."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys

if sys.platform!='win32':raise SystemExit('Only run on Windows.')
root=Path(__file__).resolve().parents[1]
setup=root/'dist'/'CartoRig-1.4.5-Setup-Windows-x64.exe'
portable=root/'dist'/'CartoRig-1.4.5-Portable-Windows-x64.exe'
assert setup.is_file() and portable.is_file()
installed=Path(os.environ['LOCALAPPDATA'])/'Programs'/'CartoRig'/'CartoRig.exe'
print('Installing from:',setup,flush=True)
subprocess.run([str(setup),'/silent'],check=True,timeout=120)
assert installed.exists(),f'Windows installer did not write {installed}'
checksum=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert checksum(installed)==checksum(portable),'Installed application differs from validated fullgeo portable build'
print('Installed executable matches fullgeo SHA-256:',checksum(installed),flush=True)
subprocess.run(['reg','query',r'HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\CartoRigSceneComposer','/v','DisplayVersion'],check=True,timeout=25)
print('Windows installed app, version/registry and SHA-256: PASS',flush=True)
# Do not uninstall automatically; leave the actual per-user install available to inspect on the runner.
