"""Windows CI: real bundled EXE + real HTTP + real F5 reload of Scene Looks."""
from pathlib import Path
import argparse,queue,re,subprocess,threading,sys
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--executable',type=Path,required=True)
args=parser.parse_args()
proc=subprocess.Popen([str(args.executable.resolve()),'--no-browser'],stdout=subprocess.PIPE,
                      stderr=subprocess.STDOUT,text=True,bufsize=1)
lines=queue.Queue()
def consume():
    for line in proc.stdout:lines.put(line)
threading.Thread(target=consume,daemon=True).start()
try:
    start=lines.get(timeout=40)
    matched=re.search(r'http://127\.0\.0\.1:\d+',start)
    assert matched, f'Unexpected executable startup: {start}'
    url=matched.group(0)
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path="/usr/bin/chromium" if sys.platform!="win32" else None,args=["--no-sandbox","--no-proxy-server"] if sys.platform!="win32" else [])
        context=browser.new_context(viewport={'width':1560,'height':960})
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        for iteration in range(4):
            if iteration==0:page.goto(url,wait_until='domcontentloaded',timeout=60000)
            else:page.reload(wait_until='domcontentloaded',timeout=60000)
            page.wait_for_function('window.CartoRig?.ready===true',timeout=60000)
            page.wait_for_function('''()=>[...document.querySelectorAll('#presets img.style14-preview')].length===36&&
                [...document.querySelectorAll('#presets img.style14-preview')].every(i=>i.complete&&i.naturalWidth===288)''',timeout=30000)
            looks=page.locator('#presets [data-style]')
            assert looks.count()==36
            for key in ['terrain','relief','noir-monochrome','oceanic-engraving','crimson-geopolitics','night','atlas','dark']:
                looks.filter(has=page.locator(f'[data-native-look="{key}"]')).click()
                assert page.evaluate('''()=>[...document.querySelectorAll('#presets img.style14-preview')].every(i=>
                    i.getAttribute('src').startsWith('/assets/look-previews/')&&i.naturalWidth===288)''')
            print(f'HTTP initial load/F5 {iteration+1}: 36 real offline look images + repeated clicks: PASS',flush=True)
        assert not errors,errors
        browser.close()
finally:
    proc.terminate()
    try:proc.wait(timeout=6)
    except subprocess.TimeoutExpired:proc.kill()
