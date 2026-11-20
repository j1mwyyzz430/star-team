"""Full-viewport awakening scenes. Synthetic portraits; no live backend access."""
import functools
import threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login, snapshot

SETUP = """() => {
 const c=document.createElement('canvas');c.width=c.height=400;const x=c.getContext('2d');
 x.fillStyle='#8fabc6';x.fillRect(0,0,400,400);x.fillStyle='#334868';x.beginPath();x.ellipse(200,390,135,150,0,0,7);x.fill();
 x.fillStyle='#f1c69c';x.beginPath();x.ellipse(200,185,88,110,0,0,7);x.fill();
 x.fillStyle='#342d38';x.beginPath();x.ellipse(200,95,90,42,0,0,7);x.fill();
 x.fillRect(163,170,12,12);x.fillRect(225,170,12,12);x.beginPath();x.arc(200,215,30,.2,Math.PI-.2);x.stroke();
 window.fixtureStudent={...students[0],id:'fixture-0',name:'測試同學',theme:'t0-inferno',xp:10000,photo:c.toDataURL()};
 window.fixtureGroup=Array.from({length:19},(_,i)=>({...fixtureStudent,id:'fixture-'+i,name:'測試同學 '+(i+1),theme:['t0-inferno','t0-aurora','m1-rail'][i%3]}));
} """
PLAY = """({kind,group=false,at=1200})=>{
 collectionPlay(fixtureStudent,kind,group?{participants:fixtureGroup}:{});
 cancelAnimationFrame(collectionRaf);collectionRaf=0;awakeningRenderAt(collectionScene,at);
} """
BOUNDS = """() => {
 const o=$('#collection-overlay'),r=o.getBoundingClientRect();
 if(Math.abs(r.x)>1||Math.abs(r.y)>1||Math.abs(r.width-innerWidth)>1||Math.abs(r.height-innerHeight)>1)throw Error('not full viewport');
 if(getComputedStyle(o).display==='none')throw Error('invisible layer');
 for(const e of o.querySelectorAll('.awakening-copy,.awakening-face,.awakening-member>strong')){
  const b=e.getBoundingClientRect();if(b.x<0||b.y<0||b.right>innerWidth+1||b.bottom>innerHeight+1)throw Error('content outside viewport '+e.className);
 }
 for(const e of o.querySelectorAll('.awakening-face')){const b=e.getBoundingClientRect();if(Math.abs(b.width-b.height)>2)throw Error('portrait stretched');}
} """

def run(browser, base, width, height, fallback=False):
    context=browser.new_context(viewport={"width":width,"height":height}, device_scale_factor=1, has_touch=True)
    if fallback:
        context.add_init_script("HTMLElement.prototype.showPopover=undefined")
    backend=Backend('',modern=True)
    if width==1280:
        template=backend.state['rosters']['p6'][0]
        backend.state['rosters']['p6']=[{**template,'id':f's{i+1}','name':f'全班測試{i}',
            'xp':0 if i==5 else 10000,'score':999999 if i==7 else 12,'present':i!=6} for i in range(8)]
    context.route('https://script.google.com/**',backend.route)
    page=context.new_page();page.set_default_timeout(10000); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base);login(page);page.evaluate(SETUP)
    before=snapshot(page)
    for kind in ['small','big','rainbow']:
        page.evaluate(PLAY,dict(kind=kind))
        page.evaluate(BOUNDS)
        page.wait_for_function("[...document.querySelectorAll('#collection-overlay img')].every(e=>e.complete)")
        assert page.locator('.awakening-art').evaluate('(e)=>e.complete&&e.naturalWidth>0')
        if width in [1280,390,820] and not fallback:
            page.screenshot(path=f'/tmp/awakening-{width}-{kind}.png')
        # Same clock drives entrance, hold, particles and exit; no frozen animation.
        transforms=[]
        for at in [100,500,1500]:
            transforms.append(page.evaluate("t=>{awakeningRenderAt(collectionScene,t);return getComputedStyle($('.awakening-art')).transform}",at))
        assert len(set(transforms))==3
        page.evaluate("awakeningRenderAt(collectionScene,collectionScene.duration-30)")
        assert float(page.locator('#collection-overlay').evaluate('(e)=>e.style.opacity'))<.15
        page.keyboard.press('Escape');assert page.evaluate('collectionScene===null')
    page.evaluate(PLAY,dict(kind='rainbow',group=True,at=1500))
    page.evaluate(BOUNDS)
    page.wait_for_function("[...document.querySelectorAll('#collection-overlay img')].every(e=>e.complete&&e.naturalWidth>0)")
    if not fallback:page.screenshot(path=f'/tmp/awakening-{width}-class.png')
    seen=page.evaluate("""() => {
      const scene=collectionScene,result=[];
      for(let i=0;i<Math.ceil(scene.participants.length/scene.perPage);i++){
       awakeningRenderAt(scene,i*scene.pageDuration+1500);
       for(const e of document.querySelectorAll('.awakening-member'))result.push(e.dataset.studentId);
      }return result;
    }""")
    assert seen==[f'fixture-{i}' for i in range(19)],seen
    page.locator('#awakening-close').click();assert page.evaluate('collectionScene===null')
    # All beast stages, including the ultimate crown, unlock exactly at Lv.100.
    page.evaluate("""()=>{const k=skinOf(fixtureStudent),s={...fixtureStudent,xp:xpAtLevel(100)};collectionPlay(s,'rainbow');cancelAnimationFrame(collectionRaf);awakeningRenderAt(collectionScene,1800)}""")
    assert page.locator('.awakening-crown').is_visible()
    page.evaluate('collectionEnd()')
    # Broken portrait and artwork recover without broken-image icons.
    page.evaluate("fixtureStudent.photo='/missing-fixture-photo.png'")
    page.evaluate(PLAY,dict(kind='big'))
    page.wait_for_function("document.querySelector('.awakening-face span.avatar')")
    page.evaluate('collectionEnd()')
    page.emulate_media(reduced_motion='reduce')
    page.evaluate(PLAY.replace('cancelAnimationFrame(collectionRaf);collectionRaf=0;awakeningRenderAt(collectionScene,at);',''),dict(kind='big'))
    assert page.evaluate('collectionScene===null')
    assert snapshot(page)==before
    if width==1280:
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#all').click()
        page.wait_for_function('collectionScene?.participants.length===5')
        assert page.evaluate('collectionScene.participants.map(s=>s.id)')==[f's{i+1}' for i in range(5)]
        page.wait_for_function('!dirty && !saving')
        for i,s in enumerate(backend.state['rosters']['p6']):
            assert s['score']==(13 if i<6 else 12 if i==6 else 999999)
            assert s['xp']==(20 if i==5 else 10020 if i<5 else 10000)
        # Actual animation clock finishes and removes the blocking layer.
        page.wait_for_function('collectionScene===null',timeout=5000)
        assert not page.locator('#collection-overlay').is_visible()
        page.evaluate(PLAY,dict(kind='rainbow'))
        page.set_viewport_size({'width':822,'height':1280});page.evaluate('awakeningRenderAt(collectionScene,1800)');page.evaluate(BOUNDS)
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        assert page.evaluate('collectionScene===null')
    assert not errors,errors
    context.close()
    print(f'PASS {width}x{height}, fallback={fallback}: viewport, portrait ratio, three timings, paging, Lv.100 ultimate crown, skip, missing photo, reduced motion, unchanged data')

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            for width,height in [(1280,822),(1024,768),(820,1180),(390,844),(844,390)]:
                run(browser,f'http://127.0.0.1:{server.server_port}/',width,height)
            run(browser,f'http://127.0.0.1:{server.server_port}/',1024,768,True)
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
