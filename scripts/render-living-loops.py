"""Render public-art loops from the same deterministic browser preview (no student data)."""
import base64
import functools
import subprocess
import threading
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    out=ROOT/'previews/living-cards/loops';out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1200,'height':900},device_scale_factor=1)
        page.goto(f'http://127.0.0.1:{server.server_port}/previews/living-cards/')
        page.evaluate('cardPreview.ready');page.evaluate("()=>{cardPreview.pause();cardPreview.setStars(5);document.querySelector('#card').style.cssText+=';width:512px;height:384px';window.exportCanvas=document.createElement('canvas');exportCanvas.width=512;exportCanvas.height=384;}")
        for beast in page.evaluate('cardPreview.beasts.map(b=>b.id)'):
            page.evaluate('id=>cardPreview.select(id)',beast)
            dest=out/(beast+'.mp4')
            process=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-r','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],stdin=subprocess.PIPE)
            try:
                for frame in range(240):
                    data=page.evaluate("""t=>{
                      cardPreview.seek(t);const c=exportCanvas.getContext('2d'),b=cardPreview.selected;
                      c.drawImage(document.querySelector('#living-art'),0,0,512,384);c.drawImage(document.querySelector('#elements'),0,0,512,384);
                      const shade=c.createLinearGradient(0,230,0,384);shade.addColorStop(0,'#070b1700');shade.addColorStop(1,'#070b17ef');c.fillStyle=shade;c.fillRect(0,230,512,154);
                      c.strokeStyle='#e7c98a';c.lineWidth=1;c.strokeRect(8,8,496,368);
                      c.fillStyle='#ffe3a4';c.font='13px sans-serif';c.fillText('★★★★★',400,30);c.fillText(b.title,26,308);
                      c.fillStyle='#fff3df';c.font='bold 30px sans-serif';c.fillText(b.name,24,349);
                      return exportCanvas.toDataURL('image/jpeg',.9).split(',')[1];
                    }""",frame/30)
                    process.stdin.write(base64.b64decode(data))
            finally:process.stdin.close()
            if process.wait()!=0:raise RuntimeError('ffmpeg failed: '+beast)
            print(f'RENDERED {beast}: {dest.stat().st_size} bytes',flush=True)
        browser.close()
finally:server.shutdown();server.server_close()
