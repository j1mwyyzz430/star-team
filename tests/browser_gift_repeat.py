"""Exercise personal anti-repeat draws through the real UI with a synthetic backend."""
import copy
import functools
import threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login, snapshot


def check(browser, base, options, label):
    backend=Backend('')
    backend.state['rosters']['p4'][0]['score']=90
    gifts=backend.state['extras']['gifts']
    gifts[:]=[{**gifts[0],'id':key,'name':name} for key,name in [('a','貼紙'),('b','鉛筆')]]
    backend.state['extras']['receipts']=[dict(id='fixture-receipt',grade='p4',studentId='s1',giftId='a',giftName='貼紙',cost=1,time='2026-10-22T00:00:00Z',kind='draw',status='delivered')]
    before=copy.deepcopy(backend.state)
    context=browser.new_context(**options)
    context.route('https://script.google.com/**',backend.route)
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base);login(page)
    assert snapshot(page)=={k:before[k] for k in ['rosters','extras']}
    assert 'saveState' not in backend.calls
    page.locator('[data-tab=shop]').click()
    page.locator('[data-gift-student="p4:s1"]').click()
    assert page.evaluate('grade')=='p6', 'exercise a student in a different class from the score board'
    assert '降低個人重複' in page.locator('#gift-odds').inner_text()
    page.locator('#draw-settings-open').click()
    assert '不改變上方稀有度比例' in page.locator('#draw-settings-dialog').inner_text()
    page.locator('#odds-close').click()
    # Ticket 4 must select B with personal weights [4,32], but A with old uniform odds.
    page.evaluate('()=>{window.drawRolls=[];rand=n=>{window.drawRolls.push(n);return n===36?4:0}}')
    page.once('dialog',lambda d:d.accept())
    page.locator('#gift-draw').click()
    page.locator('#summon-dialog').wait_for(state='visible')
    assert page.evaluate('window.drawRolls.slice(0,2)')==[54,36], page.evaluate('({rolls:window.drawRolls,receipt:extras.receipts.at(-1),weights:extras.drawWeights})')
    receipt=backend.state['extras']['receipts'][-1]
    assert (receipt['grade'],receipt['studentId'],receipt['giftId'])==('p4','s1','b')
    assert len(backend.state['extras']['receipts'])==2
    assert backend.state['rosters']['p4'][0]['score']==60
    assert backend.state['rosters']['p4'][0]['xp']==before['rosters']['p4'][0]['xp']
    for g in ['p5','p6']:assert backend.state['rosters'][g]==before['rosters'][g]
    assert backend.state['extras']['drawWeights']==before['extras']['drawWeights']
    assert backend.state['extras']['gifts'][0]['stock']==5
    assert backend.state['extras']['gifts'][1]['stock']==4
    page.locator('#summon-skip').click();page.locator('#summon-close').click()
    page.reload();page.wait_for_function('loaded && !loading')
    assert page.evaluate("personalGiftWeights(extras.gifts,'p4','s1').map(p=>p.weight)")==[16,4]
    assert page.evaluate("personalGiftWeights(extras.gifts,'p6','s1').map(p=>p.weight)")==[32,32]
    other_context=browser.new_context(**options)
    other_context.route('https://script.google.com/**',backend.route)
    other=other_context.new_page();other.goto(base);login(other)
    assert other.evaluate("personalGiftWeights(extras.gifts,'p4','s1').map(p=>p.weight)")==[16,4]
    assert snapshot(other)==snapshot(page)
    assert not errors,errors
    print(f'PASS {label}: selected student history affects actual draw; one charge and stock decrement; rarity weights/XP unchanged; history survives reload and another device')
    other_context.close();context.close()


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
            base=f'http://127.0.0.1:{server.server_port}/'
            check(browser,base,{'viewport':{'width':1280,'height':960}},'desktop')
            ipad=dict(p.devices['iPad (gen 7)']);ipad.pop('default_browser_type',None)
            check(browser,base,ipad,'iPad')
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
