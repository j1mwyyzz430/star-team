"""Independent living-art preview: original public art, no student/backend access."""
import functools
import threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import QuietHandler, ROOT


def check(browser,base,viewport,label,fallback=False):
    context=browser.new_context(viewport=viewport,device_scale_factor=1,has_touch=True)
    if fallback:
        context.add_init_script("const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,...args){return k==='webgl'?null:get.call(this,k,...args)}")
    page=context.new_page();page.set_default_timeout(15000);errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.goto(base+'previews/living-cards/');page.evaluate('cardPreview.ready');page.evaluate('cardPreview.pause()')
    assert page.evaluate('cardPreview.renderer')==('canvas-fallback' if fallback else 'webgl')
    assert page.locator('.beast-choice').count()==18
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if label=='desktop':
        for beast in page.evaluate('cardPreview.beasts.map(b=>b.id)'):
            page.evaluate('id=>cardPreview.select(id)',beast)
            a=page.evaluate('()=>{cardPreview.seek(0);return cardPreview.pixels()}')
            b=page.evaluate('()=>{cardPreview.seek(2);return cardPreview.pixels()}')
            c=page.evaluate('()=>{cardPreview.seek(8);return cardPreview.pixels()}')
            d=page.evaluate('()=>{cardPreview.seek(2);return cardPreview.pixels()}')
            assert a==c,(beast,'loop seam')
            assert b==d,(beast,'seek not deterministic')
            assert a['art']!=b['art'],(beast,'art frozen')
            assert a['fx']!=b['fx'],(beast,'effects frozen')
        page.evaluate("()=>cardPreview.select('t0-inferno')")
    for stars in [1,3,5]:
        page.locator(f'[data-stars-option="{stars}"]').click()
        assert page.locator('#card').get_attribute('data-stars')==str(stars)
    page.locator('#compare').click();assert page.locator('#living-art').is_hidden();assert page.locator('#elements').is_hidden()
    page.locator('#compare').click();assert page.locator('#elements').is_visible()
    # Real clicks stay available while pulses run; no blocking popover or modal.
    for _ in range(12):page.locator('#award').click()
    assert page.evaluate('cardPreview.clicks')==12
    assert page.locator('.award-pop').count()<=6
    assert not page.locator('dialog[open]').count()
    page.wait_for_function("document.querySelectorAll('.award-pop').length===0")
    page.evaluate('cardPreview.seek(2)')
    page.screenshot(path=f'/tmp/living-cards-{label}.png',full_page=True)
    # Last selection wins even when the previous request is still in flight.
    page.evaluate("async()=>{await Promise.all([cardPreview.select('t0-ocean'),cardPreview.select('t0-genesis')])}")
    assert page.locator('#beast-name').text_content()=='萬界創世凰'
    assert page.evaluate('cardPreview.loaded')
    page.emulate_media(reduced_motion='reduce');assert page.locator('#play').text_content()=='播放動態'
    assert all(url.startswith(base) for url in requests),requests
    assert page.evaluate('localStorage.length')==0
    assert not errors,errors
    context.close();print(f'PASS {label}: gallery, no backend/storage, star choices, continuous +1, static compare, selection races, reduced motion'+('; all 18 seamless/deterministic/moving' if label=='desktop' else ''))


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
            base=f'http://127.0.0.1:{server.server_port}/'
            for label,v in [('desktop',{'width':1366,'height':1000}),('ipad',{'width':820,'height':1180}),('phone',{'width':390,'height':844})]:check(browser,base,v,label)
            check(browser,base,{'width':1024,'height':768},'fallback',True)
            browser.close()
    finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
