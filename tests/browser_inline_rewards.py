"""Actual scoring stays clickable through small, big, rainbow and class awards."""
import functools
import threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import Backend,QuietHandler,ROOT,login


def check(browser,base,options,label):
    backend=Backend('',modern=True);template=backend.state['rosters']['p6'][0]
    backend.state['rosters']['p6']=[{**template,'id':'s1','name':'連按測試','score':8,'xp':10000,'theme':'t0-inferno'},
        {**template,'id':'s2','name':'彩星測試','score':29,'xp':10000,'theme':'t0-glacier'},
        {**template,'id':'s3','name':'未覺醒測試','score':12,'xp':0,'theme':'default'}]
    context=browser.new_context(**options);context.route('https://script.google.com/**',backend.route)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base);login(page)
    for _ in range(4):
        page.locator('[data-add="s1"]').click()
        assert not page.locator('#collection-overlay').is_visible()
        assert page.evaluate('collectionScene===null')
    assert page.evaluate('students[0].score')==12
    assert page.evaluate('students[0].xp')==10080
    page.locator('[data-add="s2"]').click()
    assert page.locator('#card-s2 .inline-rainbow').count()==1
    assert page.locator('#card-s2 .inline-rainbow').evaluate("e=>getComputedStyle(e).pointerEvents")=='none'
    page.locator('[data-add="s2"]').click()
    assert page.evaluate('students[1].score===31 && students[1].xp===10080')
    page.locator('#all').click()
    assert page.locator('.collection-inline-award').count()==2
    assert not page.locator('#collection-overlay').is_visible()
    page.locator('#undo').click()
    assert page.evaluate('students.map(s=>s.score)')==[12,31,12]
    page.wait_for_function('!dirty && !saving')
    assert [s['score'] for s in backend.state['rosters']['p6']]==[12,31,12]
    assert [s['xp'] for s in backend.state['rosters']['p6']]==[10080,10080,0]
    page.reload();page.wait_for_function('loaded && !loading')
    assert page.evaluate('students[0].score===12 && students[1].score===31')
    page.emulate_media(reduced_motion='reduce');page.locator('[data-add="s1"]').click()
    assert page.locator('.collection-inline-award').count()==0
    assert not page.locator('#collection-overlay').is_visible()
    assert not errors,errors
    context.close();print(f'PASS {label}: rapid +1, 10/30 milestones, class award and undo stay clickable; exact XP/scores saved; reduced motion')


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            base=f'http://127.0.0.1:{server.server_port}/'
            check(browser,base,{'viewport':{'width':1280,'height':822}},'desktop')
            ipad=dict(p.devices['iPad (gen 7)']);ipad.pop('default_browser_type',None);check(browser,base,ipad,'iPad')
            browser.close()
    finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
