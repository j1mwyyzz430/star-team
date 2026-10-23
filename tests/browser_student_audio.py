"""Real Web Audio scheduling with synthetic WAVs; no private recordings or live backend."""
import copy
import functools
import threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login


def check(browser,base,options,label):
    backend=Backend('')
    template=backend.state['rosters']['p6'][0]
    backend.state['rosters']['p6']=[{**template,'id':f's{i}','name':f'音效測試{i}','score':999999 if i==6 else 1,'xp':0,'theme':'default','present':i!=5} for i in range(1,7)]
    original=copy.deepcopy(backend.state)
    context=browser.new_context(**options,reduced_motion='reduce')
    context.route('https://script.google.com/**',backend.route)
    context.add_init_script('''window.audioStarts=[];const start=AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start=function(at,...rest){window.audioStarts.push({at,duration:this.buffer.duration});return start.call(this,at,...rest)};''')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base);login(page)
    page.evaluate('''async()=>{
        await soundReady;const ctx=new OfflineAudioContext(1,22050,22050);
        for(const i of [1,2,3,5,6]){
            const buffer=ctx.createBuffer(1,22050*(1+i/10),22050),data=buffer.getChannelData(0);
            for(let j=0;j<data.length;j++)data[j]=.1*Math.sin(2*Math.PI*(200+i*50)*j/22050);
            const row={key:'p6:s'+i,blob:encodeSoundWav(buffer)};await soundStore('readwrite',s=>s.put(row));studentSounds.set(row.key,row);
        }
        const row={key:'p4:s1',blob:encodeSoundWav(ctx.createBuffer(1,22050*2,22050))};await soundStore('readwrite',s=>s.put(row));studentSounds.set(row.key,row);
    }''')
    page.locator('#sound').click();page.locator('#all').click()
    page.wait_for_function('window.audioStarts.length===3')
    starts=page.evaluate('window.audioStarts');assert len({s['at'] for s in starts})==1
    assert [round(s['duration'],1) for s in starts]==[1.1,1.2,1.3]
    assert page.evaluate('audioContext.state')=='running'
    assert abs(page.evaluate('soundMix.gain.value')-1/3)<.00001
    page.locator('#sound').click();assert page.evaluate('playingSources.size')==0
    page.wait_for_function('!dirty && !saving')
    for i,student in enumerate(backend.state['rosters']['p6']):
        assert student['score']==original['rosters']['p6'][i]['score']+(1 if i<4 else 0)
        assert student['xp']==(20 if i<4 else 0)
    assert backend.state['rosters']['p4']==original['rosters']['p4']
    assert backend.state['extras']==original['extras']
    # Muted awards do not schedule audio. Restore sound, then single and group awards.
    page.locator('#all').click();page.wait_for_function('!dirty && !saving')
    assert page.evaluate('window.audioStarts.length')==3
    page.locator('#sound').click()
    page.locator('#students [data-add="s1"]').click(force=True)
    page.wait_for_function('window.audioStarts.length===4')
    assert round(page.evaluate('window.audioStarts.at(-1).duration'),1)==1.1
    page.evaluate("stopStudentSound();groupIds=[['s1','s2']];renderGroups()")
    page.locator('[data-tab=group]').click();page.locator('[data-group="0"]').click()
    page.wait_for_function('window.audioStarts.length===6')
    starts=page.evaluate('window.audioStarts.slice(-2)');assert starts[0]['at']==starts[1]['at']
    # Leaving the page stops active sounds. No stale playback on return.
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
    assert page.evaluate('playingSources.size')==0
    page.evaluate("delete document.hidden")
    page.wait_for_function('!dirty && !saving')
    # IndexedDB clips survive a reload and are still aligned on the next class award.
    page.reload();page.wait_for_function('loaded && !loading');page.evaluate('soundReady')
    assert page.evaluate("studentSounds.has('p6:s1')")
    page.locator('#sound').click();page.locator('#all').click();page.wait_for_function('window.audioStarts.length===3')
    starts=page.evaluate('window.audioStarts');assert len({s['at'] for s in starts})==1
    # Preview still plays while the global award sound toggle is off.
    page.locator('#sound').click()
    page.locator('#students [data-edit="0"]').click(force=True)
    page.locator('#student-sound-settings').click();page.locator('#sound-preview').click()
    page.wait_for_function('window.audioStarts.length===4')
    assert round(page.evaluate('window.audioStarts.at(-1).duration'),1)==1.1
    page.locator('#sound-close').click();assert page.evaluate('playingSources.size')==0
    assert not errors,errors
    print(f'PASS {label}: real audio uses identical start times; absent/capped/unconfigured students excluded; score/XP correct; mute, group, single, preview and reload work')
    context.close()


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
