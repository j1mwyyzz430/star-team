"""Synthetic class management, stable identities, backup and crowded-wheel regressions."""
import copy
import functools
import json
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login, snapshot


def saved(page):
    page.wait_for_function('loaded && !dirty && !saving && !loading')


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/'
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
            for ipad in [False, True]:
                options = dict(p.devices['iPad (gen 7)']) if ipad else {'viewport': {'width': 1280, 'height': 960}}
                options.pop('default_browser_type', None)
                ctx = browser.new_context(**options, reduced_motion='reduce', accept_downloads=True)
                backend = Backend('', modern=True)
                template = backend.state['rosters']['p6'][0]
                backend.state['rosters']['p6'] = [{**template, 'id': f's{i}', 'name': f'學生{i}', 'xp': 20, 'theme':'default'} for i in range(1,41)]
                backend.state['extras']['receipts'] = [dict(id='receipt-'+str(i),grade='p6',studentId='s'+str(i),giftId='fixture-gift',giftName='禮物',cost=1,time='2026-10-16T00:00:00Z',status=status,kind='redeem') for i,status in [(2,'delivered'),(3,'pending')]]
                original = copy.deepcopy(backend.state)
                ctx.route('https://script.google.com/**', backend.route)
                page = ctx.new_page();page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(base);login(page)
                assert snapshot(page) == {k:original[k] for k in ['rosters','extras']}
                assert backend.calls.count('saveState') == 0
                # Retain audio by identity, never reassign it to a new student.
                page.evaluate("""async()=>{await soundReady;const r={key:'p6:s4',blob:new Blob(['fixture'],{type:'audio/wav'})};await soundStore('readwrite',s=>s.put(r));studentSounds.set(r.key,r)}""")
                page.locator('#delete-students').click()
                for key in ['s2','s4']:
                    page.locator(f'#delete-student-list input[value="{key}"]').check()
                page.once('dialog', lambda d:d.dismiss());page.locator('#delete-selected').click()
                assert len(page.evaluate('students'))==40
                page.once('dialog', lambda d:d.accept());page.locator('#delete-selected').click();saved(page)
                remaining=page.evaluate('students')
                assert remaining==[x for x in original['rosters']['p6'] if x['id'] not in ['s2','s4']]
                assert page.evaluate("extras.receipts[0].studentName")=='學生2'
                assert page.evaluate("studentSounds.has('p6:s4')")
                page.locator('#add-student').click();page.locator('#edit-name').fill('單個新增');page.locator('#edit-save').click();saved(page)
                new_id=page.evaluate('students.at(-1).id');assert new_id.startswith('s-')
                assert page.evaluate("!studentSounds.has('p6:'+students.at(-1).id)")
                page.locator('#undo').click();saved(page)
                page.locator('#undo').click();saved(page)
                assert page.evaluate('students')==original['rosters']['p6']
                # Pending gifts stop deletion without a confirmation or mutation.
                page.locator('#delete-students').click();page.locator('#delete-student-list input[value="s3"]').check()
                page.locator('#delete-selected').click()
                assert '待派發' in page.locator('#toast').inner_text()
                assert len(page.evaluate('students'))==40
                page.locator('#delete-students-dialog [data-class-close]').click()
                page.locator('#manage-class').click();page.locator('#delete-class').click()
                assert page.locator('#manage-class-dialog').is_visible()
                page.locator('#manage-class-dialog [data-class-close]').click()
                # Names are arbitrary text, escaped in all rendered contexts.
                page.locator('#add-grade').click();page.locator('#new-grade').fill('代課 <A>');page.locator('#grade-save').click();saved(page)
                custom=page.evaluate('grade');assert custom.startswith('c-')
                assert page.locator('#grade-title').inner_text()=='代課 <A> · 星星小隊'
                page.locator('#manage-class').click();page.locator('#class-name').fill('星期五代課');page.locator('#rename-class-form button').click();saved(page)
                page.locator('#batch-add').click();page.locator('#batch-names').fill('\n'.join(f'代課學生{i}' for i in range(1,71)))
                page.locator('#batch-preview').click();page.locator('#batch-save').click();saved(page)
                ids=page.evaluate('students.map(s=>s.id)');assert len(set(ids))==70
                assert all(x.startswith('s-') for x in ids)
                # Reopen the same custom class and synchronize another device.
                page.reload();page.wait_for_function('loaded && !loading');assert page.evaluate('grade')==custom
                assert page.evaluate('students.length')==70
                other=ctx.new_page();other.goto(base);other.wait_for_function('loaded && !loading')
                assert snapshot(other)==snapshot(page);other.close()
                # Dense wheel remains fair: all eligible IDs participate, no photos crammed into sectors.
                page.locator('[data-tab=draw]').click()
                page.wait_for_function('wheelPeople.length===70')
                assert page.locator('.wheel-roster-list span').count()==70
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path='/tmp/star-classes-'+('ipad' if ipad else 'desktop')+'.png',full_page=True)
                page.locator('#spin').click();page.wait_for_function('winner && !spinning && !wheelPreparing')
                assert page.evaluate('winner') in ids
                page.locator('#spin').click();page.wait_for_function('drawn.length===2 && !spinning && !wheelPreparing')
                assert len(set(page.evaluate('drawn')))==2
                assert page.evaluate('wheelPeople.length')==69
                # v6 roundtrip includes custom labels and both old/new stable audio keys.
                page.evaluate("""async()=>{const r={key:grade+':'+students[0].id,blob:new Blob(['new fixture'],{type:'audio/wav'})};await soundStore('readwrite',s=>s.put(r));studentSounds.set(r.key,r)}""")
                with page.expect_download() as dl:
                    page.evaluate("document.querySelector('#export').click()")
                backup=json.loads(Path(dl.value.path()).read_text())
                assert backup['format']=='star-team-v6' and backup['extras']['classNames'][custom]=='星期五代課'
                assert {r['key'] for r in backup['sounds']}=={'p6:s4',custom+':'+ids[0]}
                page.locator('[data-tab=score]').click()
                remote=ctx.new_page();remote.on('pageerror',lambda e:errors.append(str(e)));remote.goto(base);remote.wait_for_function('loaded && !loading')
                remote.evaluate('drawn=[students[0].id];winner=students[0].id;groupIds=[[students[0].id]];render()')
                page.locator('#manage-class').click();page.once('dialog',lambda d:d.accept());page.locator('#delete-class').click();saved(page)
                remote.bring_to_front();remote.evaluate('pollCloud()');remote.wait_for_function('(id)=>!Object.hasOwn(rosters,id)',arg=custom)
                assert remote.evaluate('drawn.length===0 && winner===null && groupIds.length===0')
                remote.close();page.bring_to_front()
                assert custom not in page.evaluate('rosters')
                page.locator('#undo').click();saved(page);assert page.evaluate('students.map(s=>s.id)')==ids
                page.once('dialog',lambda d:d.accept())
                page.locator('#import-file').set_input_files({'name':'fixture.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
                saved(page);assert snapshot(page)['rosters'][custom]==backup['rosters'][custom]
                # Select all is scoped to this class. Single deletion also works from the editor.
                page.locator('#delete-students').click();page.locator('#delete-select-all').check()
                page.once('dialog',lambda d:d.accept());page.locator('#delete-selected').click();saved(page)
                assert page.evaluate('students.length')==0
                assert page.evaluate('rosters.p6.length')==40
                page.locator('#add-student').click();page.locator('#edit-name').fill('新同學');page.locator('#edit-save').click();saved(page)
                assert page.evaluate('students[0].id') not in ids
                page.locator('[data-edit="0"]').click(force=True);page.once('dialog',lambda d:d.accept());page.locator('#delete-student').click();saved(page)
                assert page.evaluate('students.length')==0
                # Delete every class, including legacy defaults: an empty roster remains usable.
                page.evaluate("commit(()=>extras.receipts.forEach(r=>r.status='delivered'))");saved(page)
                while page.evaluate('Object.keys(rosters).length'):
                    page.locator('#manage-class').click();page.once('dialog',lambda d:d.accept());page.locator('#delete-class').click();saved(page)
                page.reload();page.wait_for_function('loaded && !loading')
                assert page.locator('#add-student').is_disabled()
                page.locator('#add-grade').click();page.locator('#new-grade').fill('重新開班');page.locator('#grade-save').click();saved(page)
                assert page.locator('#add-student').is_enabled()
                print('PASS', 'iPad' if ipad else 'desktop', ': stable IDs/audio; delete cancel/undo/pending-gift guard; custom classes; 70-student wheel; v6 backup; sync; empty roster recovery')
                ctx.close()
            # Old Google deployment: existing scoring works; unsupported structural operations cannot mutate state.
            ctx=browser.new_context();old=Backend('');ctx.route('https://script.google.com/**',old.route)
            page=ctx.new_page();page.goto(base);login(page);before=snapshot(page)
            for selector in ['#add-grade','#manage-class','#delete-students']:
                page.locator(selector).click();assert '更新原有 Google 後台' in page.locator('#toast').inner_text()
                assert snapshot(page)==before
            assert 'saveState' not in old.calls
            print('PASS: old backend remains readable; unsupported roster management is gated without data writes')
            assert not errors, errors
            browser.close()
    finally:server.shutdown()

if __name__=='__main__':main()
