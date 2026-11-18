"""Production-only native Windows smoke. Must run on a real Windows runner."""
from pathlib import Path
import hashlib, os, subprocess, sys
if sys.platform!='win32':raise SystemExit('Native Windows is required for this gate')
root=Path(__file__).resolve().parents[1]
setup=root/'dist/CartoRig-2.0.4-Setup-Windows-x64.exe'
portable=root/'dist/CartoRig-2.0.4-Portable-Windows-x64.exe'
installed=Path(os.environ['LOCALAPPDATA'])/'Programs/CartoRig/CartoRig.exe'
assert setup.is_file() and portable.is_file()
subprocess.run([str(setup),'/silent'],check=True,timeout=120)
assert installed.is_file(), 'Installer did not install CartoRig.exe'
sha=lambda path:hashlib.file_digest(open(path,'rb'),'sha256').hexdigest()
assert sha(installed)==sha(portable),'Installed executable and portable mismatch'
subprocess.run(['reg','query',r'HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\CartoRigSceneComposer','/v','DisplayVersion'],check=True,timeout=25)
print('NATIVE WINDOWS INSTALLER: PASS; installed SHA-256 matches production portable')
