"""Synthetic wheel portraits: overlay alignment, scaling, pointer results and card crests."""
import functools
import threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login, snapshot


def check(browser,base,options,label):
    context=browser.new_context(**options)
    backend=Backend('',modern=True)
    context.route('https://script.google.com/**',backend.route)
    page=context.new_page();page.set_default_timeout(10000);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    photo=page.evaluate("""()=>{const c=document.createElement('canvas');c.width=c.height=144;const x=c.getContext('2d');x.fillStyle='#ee6633';x.fillRect(0,0,144,144);x.fillStyle='#fff';x.fillRect(20,20,20,20);return c.toDataURL('image/jpeg',.9)}""")
    template=backend.state['rosters']['p6'][0]
    backend.state['rosters']['p6']=[{**template,'id':f's{i+1}','name':f'測試學生{i+1}','photo':photo,'xp':2500,'theme':['t0-aurora','t0-seraph','t0-genesis','t0-lunar','t0-verdant'][i%5]} for i in range(5)]
    page.goto(base);login(page);saved=snapshot(page)
    assert page.locator('#students .skin-crest').count()==0
    assert page.locator('#students .skin-border').count()==5
    assert page.locator('#students .skin-art').count()==5
    page.locator('#students').screenshot(path=f'/tmp/star-cards-no-crest-{label}.png')
    page.locator('[data-tab="draw"]').click()
    page.evaluate("window.wheelFixtures=JSON.parse(JSON.stringify(students))")
    for n in [1,2,5,12,13,40,100,0]:
        page.evaluate("""async n=>{students=Array.from({length:n},(_,i)=>({...wheelFixtures[i%5],id:'s'+(i+1)}));drawn=[];await drawWheel();drawWheelEffects($('#wheel-fx').getContext('2d'),wheelPeople,0,false)}""",n)
        result=page.evaluate("""n=>{
          const base=$('#wheel').getContext('2d'),fx=$('#wheel-fx').getContext('2d');
          drawWheelEffects(fx,wheelPeople,0,false);const data=fx.getImageData(0,0,900,900).data;
          if(n===0||n>12){if(data.some((v,i)=>i%4===3&&v))throw Error('effects remain on numbered/empty wheel');return true}
          for(let i=0;i<n;i++){
            const a=-Math.PI/2+(i+.5)*2*Math.PI/n,x=450+Math.cos(a)*290,y=450+Math.sin(a)*290;
            const px=base.getImageData(Math.round(x),Math.round(y),1,1).data;
            if(px[0]<220||px[1]>120||px[2]>80)throw Error('portrait missing from sector center '+n+':'+i);
            if(fx.getImageData(Math.round(x),Math.round(y),1,1).data[3])throw Error('effect covers face '+i);
            const r=n===1?62:Math.min(62,Math.sin(Math.PI/n)*220),edgeX=Math.round(x+70*r/62);
            const ring=fx.getImageData(edgeX-2,Math.round(y)-2,5,5).data;
            if(!ring.some((v,j)=>j%4===3&&v))throw Error('ring not centered/scaled with portrait '+n+':'+i);
          }return true;
        }""",n)
        assert result
    # Restore the pictured five-student wheel, then resize/zoom both layers together.
    page.evaluate("students=wheelFixtures;drawn=[];drawWheel()")
    page.wait_for_function('wheelPeople.length===5')
    page.evaluate("drawWheelEffects($('#wheel-fx').getContext('2d'),wheelPeople,0,false)")
    page.locator('.wheel-wrap').screenshot(path=f'/tmp/star-wheel-aligned-{label}.png')
    for zoom in [1,1.25]:
        page.evaluate('z=>document.body.style.zoom=z',zoom)
        assert page.evaluate("""()=>{const a=$('#wheel').getBoundingClientRect(),b=$('#wheel-fx').getBoundingClientRect();if(!['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<1))throw Error(JSON.stringify({a,b,zoom:document.body.style.zoom}));return true}""")
    page.evaluate("document.body.style.zoom=1")
    # Real animation APIs, shortened only for tests; preserve both easing and angles.
    page.evaluate("""()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,opts){return animate.call(this,frames,['wheel','wheel-fx'].includes(this.id)?{...opts,duration:350}:opts)};window.savedRand=rand;}""")
    for direction in [1,0]:
        page.evaluate("""direction=>{window.spinChoices=[2,3200,0,direction,0,0];rand=n=>spinChoices.shift()??0;}""",direction)
        page.locator('#spin').click()
        page.wait_for_function("$('#wheel').getAnimations().some(a=>a.startTime!==null)")
        assert page.evaluate("""()=>{const a=$('#wheel').getAnimations()[0],b=$('#wheel-fx').getAnimations()[0];return Math.abs(a.startTime-b.startTime)<1}""")
        page.wait_for_function('winner && !spinning && !wheelPreparing')
        assert page.evaluate("""()=>{const count=wheelPeople.length,atPointer=Math.floor((((-rotation)%360)+360)%360/(360/count));return wheelPeople[atPointer].id===winner && $('#wheel').style.transform===$('#wheel-fx').style.transform}""")
        assert page.locator('#winner-card .skin-crest').count()==0
    assert len(set(page.evaluate('drawn')))==2
    page.evaluate('()=>{rand=savedRand}')
    # DOM previews share the same card layer and must not reintroduce the crest.
    page.locator('[data-tab="wardrobe"]').click()
    page.locator('[data-skin-preview="t0-inferno"]').click()
    assert page.locator('#skin-preview-card .skin-crest').count()==0
    assert page.locator('#skin-preview-card .skin-border').count()==1
    assert snapshot(page)==saved
    assert 'saveState' not in backend.calls
    assert not errors,errors
    context.close()
    print(f'PASS {label}: no floating crests; aligned portraits/rings for 1–12; clean numbered/empty wheel; zoom; clockwise/counterclockwise pointer and non-repeat; unchanged data')


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            base=f'http://127.0.0.1:{server.server_port}/'
            check(browser,base,{'viewport':{'width':1280,'height':822}},'desktop')
            ipad=dict(p.devices['iPad (gen 7)']);ipad.pop('default_browser_type',None)
            check(browser,base,ipad,'ipad')
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
