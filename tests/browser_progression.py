"""Lv.100 unlocks and continued leveling using synthetic students and mocked saves."""
import copy
import functools
import threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login


def check(browser,base,options,label):
    backend=Backend('',modern=True)
    template=backend.state['rosters']['p6'][0]
    values=[3628,3699,4009,4809,6209,10000]
    backend.state['rosters']['p6']=[{**template,'id':f's{i+1}','name':f'升級測試{i+1}',
        'xp':xp,'theme':'t0-genesis' if i==0 else 't0-inferno'} for i,xp in enumerate(values)]
    original=copy.deepcopy(backend.state)
    context=browser.new_context(**options,reduced_motion='reduce')
    context.route('https://script.google.com/**',backend.route)
    page=context.new_page();page.set_default_timeout(10000);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base);login(page)
    assert backend.state==original
    assert 'saveState' not in backend.calls
    # Existing accumulated XP immediately displays the correct level without migration.
    assert page.evaluate('levelOf(students[5]).level')>100
    assert page.locator('#students .level-badge').nth(5).text_content()!='Lv.100'
    page.locator('[data-tab="wardrobe"]').click()
    page.locator('#skin-student').select_option('s1')
    page.locator('[data-collection="awakening"]').click()
    assert page.locator('.awakening-steps .earned').count()==0
    page.locator('#skin-student').select_option('s2')
    assert page.locator('.awakening-steps .earned').count()==54
    assert '100 級後 ＋' not in page.locator('#skin-grid').text_content()
    assert '已達最高等級' not in page.locator('#skin-progress').text_content()
    page.locator('[data-collection="mecha"]').click()
    for skin in ['m1-rail','m1-sonic','m1-emperor']:
        page.locator(f'[data-skin-preview="{skin}"]').click()
        assert page.locator('#skin-equip').is_disabled()
        page.evaluate("$('#skin-dialog').close()")
    page.locator('[data-tab="score"]').click()
    page.locator('#all').click();page.wait_for_function('!dirty && !saving')
    assert [s['xp'] for s in backend.state['rosters']['p6']]==[v+20 for v in values]
    assert all(s['score']==13 for s in backend.state['rosters']['p6'])
    assert page.locator('#students .level-badge').nth(0).text_content()=='Lv.100'
    assert page.locator('#students .level-badge').nth(1).text_content()=='Lv.101'
    assert page.evaluate('collectionStage(students[0])')==3
    page.locator('[data-tab="wardrobe"]').click()
    page.locator('#skin-student').select_option('s1')
    page.locator('[data-collection="awakening"]').click()
    assert page.locator('.awakening-steps .earned').count()==54
    page.locator('[data-collection="mecha"]').click()
    for student,skin in [('s3','m1-rail'),('s4','m1-sonic'),('s5','m1-emperor')]:
        page.locator('#skin-student').select_option(student)
        page.locator(f'[data-skin-preview="{skin}"]').click()
        assert page.locator('#skin-equip').is_enabled()
        page.locator('#skin-equip').click();page.wait_for_function('!dirty && !saving')
    expected=copy.deepcopy(backend.state)
    # Saving the student form and deducting points must not reset post-100 XP or equipment.
    page.locator('[data-tab="score"]').click()
    page.locator('[data-edit="2"]').click()
    assert '最高等級' not in page.locator('#level-explain').text_content()
    page.locator('#edit-save').click();page.wait_for_function('!dirty && !saving')
    assert backend.state['rosters']==expected['rosters']
    page.locator('[data-sub="s3"]').click();page.wait_for_function('!dirty && !saving')
    assert backend.state['rosters']['p6'][2]['xp']==4029
    assert backend.state['rosters']['p6'][2]['theme']=='m1-rail'
    page.reload();page.wait_for_function('loaded && !loading')
    assert page.evaluate('levelOf(students[1]).level')==101
    assert page.evaluate("students[2].xp===4029 && canEquip(students[2],skinOf(students[2]))")
    assert backend.state['rosters']['p4']==original['rosters']['p4']
    assert backend.state['rosters']['p5']==original['rosters']['p5']
    assert backend.state['extras']==original['extras']
    assert not errors,errors
    context.close()
    print(f'PASS {label}: existing XP, Lv.99→100→101, all 54 awakenings, three mecha boundaries/equip, save/reload, deduction and no data migration')


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            base=f'http://127.0.0.1:{server.server_port}/'
            check(browser,base,{'viewport':{'width':1280,'height':822}},'desktop')
            ipad=dict(p.devices['iPad (gen 7)']);ipad.pop('default_browser_type',None)
            check(browser,base,ipad,'iPad')
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
