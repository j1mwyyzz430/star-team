"""Shared deduction recording/upload/backup UI, using synthetic audio and backend."""
import copy
import functools
import io
import json
import math
import struct
import threading
import wave
from pathlib import Path
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login


def wav():
    out=io.BytesIO()
    with wave.open(out,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(22050)
        w.writeframes(b''.join(struct.pack('<h',int(2000*math.sin(i*2*math.pi*330/22050))) for i in range(9*22050)))
    return out.getvalue()


def settings(page):
    page.locator('#settings').click();page.locator('#deduct-sound-settings').click()
    page.wait_for_function('!soundBusy')


def close_settings(page):
    page.locator('#settings-dialog [data-close]').click()


def saved(page):
    page.wait_for_function('!dirty && !saving && !loading')


def check(browser,base,options,label):
    backend=Backend('')
    first=backend.state['rosters']['p6'][0]
    backend.state['rosters']['p6'] += [{**first,'id':'s2','name':'缺席測試','present':False},{**first,'id':'s3','name':'零分測試','score':0}]
    before=copy.deepcopy(backend.state)
    context=browser.new_context(**options,permissions=['microphone'],accept_downloads=True)
    context.route('https://script.google.com/**',backend.route)
    context.add_init_script('''window.soundStarts=[];const start=AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start=function(at,...rest){if(this.context instanceof AudioContext)window.soundStarts.push(this.buffer.duration);return start.call(this,at,...rest)};''')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base);login(page)
    settings(page)
    assert '全班共用' in page.locator('#student-sound-title').inner_text()
    assert '所有班別、所有學生' in page.locator('#sound-description').inner_text()
    assert page.locator('#sound-preview').is_disabled()
    page.locator('#sound-file').set_input_files({'name':'fixture.wav','mimeType':'audio/wav','buffer':wav()})
    page.wait_for_function('!soundBusy && soundDraft!==null')
    assert '8.0 秒' in page.locator('#sound-status').inner_text()
    page.locator('#sound-preview').click();page.wait_for_function('window.soundStarts.length===1')
    assert page.evaluate('window.soundStarts[0]')==8
    page.locator('#sound-save').click();page.wait_for_function("studentSounds.has('global:deduct') && !soundBusy")
    assert page.evaluate('playingSources.size')==0
    close_settings(page)
    # Current audio data is local, never sent as part of score saves.
    page.locator('#sound').click();page.locator('[data-sub="s1"]').click(force=True)
    page.wait_for_function('window.soundStarts.length===2');saved(page)
    assert backend.state['rosters']['p6'][0]['score']==11
    assert backend.state['rosters']['p6'][0]['xp']==before['rosters']['p6'][0]['xp']
    assert backend.state['extras']==before['extras']
    page.evaluate("deduct(['s2','s3'])");assert page.evaluate('window.soundStarts.length')==2
    page.locator('#sound').click();page.locator('[data-sub="s1"]').click(force=True);saved(page)
    assert page.evaluate('window.soundStarts.length')==2
    page.locator('#grade-select').select_option('p4');page.wait_for_function("grade==='p4' && loaded && !loading")
    page.locator('#sound').click();page.locator('[data-sub="s1"]').click(force=True)
    page.wait_for_function('window.soundStarts.length===3');saved(page)
    assert page.evaluate('window.soundStarts.at(-1)')==8
    page.reload();page.wait_for_function('loaded && !loading');page.evaluate('soundReady')
    assert page.evaluate("studentSounds.has('global:deduct')")
    # Actual MediaRecorder with Chromium's synthetic microphone, not a real microphone.
    settings(page);page.locator('#sound-record').click();page.wait_for_function("recording?.state==='recording'")
    page.evaluate('window.fixtureTrack=recordStream.getTracks()[0]')
    page.wait_for_timeout(800)
    page.locator('#sound-stop').click();page.wait_for_function('!recording && !soundBusy && soundDraft!==null')
    assert '已準備' in page.locator('#sound-status').inner_text()
    assert page.evaluate('window.fixtureTrack.readyState')=='ended'
    page.locator('#sound-save').click();page.wait_for_function('!soundDialog.open && !soundBusy')
    # Preserve a student award clip alongside the shared clip in the backup.
    page.evaluate("""async()=>{const row={key:'p4:s1',blob:studentSounds.get('global:deduct').blob};await soundStore('readwrite',s=>s.put(row));studentSounds.set(row.key,row)}""")
    with page.expect_download() as dl:page.locator('#export').click()
    backup=json.loads(Path(dl.value.path()).read_text())
    assert {r['key'] for r in backup['sounds']}=={'global:deduct','p4:s1'}
    page.locator('#deduct-sound-settings').click();page.wait_for_function('!soundBusy')
    page.locator('#sound-remove').click();page.locator('#sound-save').click()
    page.wait_for_function("!studentSounds.has('global:deduct') && !soundBusy")
    assert page.evaluate("studentSounds.has('p4:s1')")
    close_settings(page)
    page.locator('#sound').click();page.locator('[data-sub="s1"]').click(force=True);saved(page)
    assert page.evaluate('window.soundStarts.length')==0
    page.locator('#settings').click();page.once('dialog',lambda d:d.accept())
    page.locator('#import-file').set_input_files({'name':'fixture-backup.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
    page.wait_for_function("studentSounds.has('global:deduct') && !dirty && !saving")
    close_settings(page)
    page.locator('[data-sub="s1"]').click(force=True)
    page.wait_for_function('window.soundStarts.length===1');saved(page)
    assert 0<page.evaluate('window.soundStarts[0]')<8
    # Invalid global sound keys must be rejected before altering any score or local clip.
    invalid=copy.deepcopy(backup);invalid['sounds'][0]['key']='global:unexpected'
    state=copy.deepcopy(backend.state)
    page.locator('#settings').click()
    page.locator('#import-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
    page.wait_for_function("document.querySelector('#toast').textContent.includes('音訊格式錯誤')")
    assert backend.state==state
    assert not errors,errors
    print(f'PASS {label}: shared clip upload/8-second trim/preview; real fake-mic recording; all-class deductions; zero/absent/mute guards; persistence/removal/backup restore; no cloud audio upload')
    context.close()


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
            base=f'http://127.0.0.1:{server.server_port}/'
            check(browser,base,{'viewport':{'width':1280,'height':960}},'desktop')
            ipad=dict(p.devices['iPad (gen 7)']);ipad.pop('default_browser_type',None)
            check(browser,base,ipad,'iPad')
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
