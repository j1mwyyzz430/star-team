"""Reward regression checks using synthetic data and a mocked Google backend."""
import copy
import functools
import threading
from http.server import ThreadingHTTPServer

from playwright.sync_api import sync_playwright
from browser_sync import Backend, QuietHandler, ROOT, login, snapshot


def check_rewards(browser, base, options, label):
    backend = Backend("")
    backend.state["rosters"]["p6"][0].update(score=9, xp=0, theme="default")
    template = backend.state["rosters"]["p4"][0]
    backend.state["rosters"]["p4"] = [
        {**template, "id": f"s{i}", "name": f"測試p4-{i}", "score": 90}
        for i in range(1, 9)
    ]
    context = browser.new_context(**options)
    context.route("https://script.google.com/**", backend.route)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base, wait_until="domcontentloaded")
    login(page)

    # Exercise the actual renderer, including the full-screen popover wrapper.
    result = page.evaluate("""() => {
        const base=xpAtLevel(100),skin=skins.find(k=>k.id==='t0-inferno');
        const entry=base+collectionStart(skin)+40;
        const mecha=skins.find(k=>k.id==='m1-rail');
        const cases=[
            ['plain below 100','default',0,false],
            ['mythic below 100','t0-inferno',base-1,false],
            ['level 100 without awakening','t0-inferno',base,false],
            ['border only','t0-inferno',entry-40,false],
            ['one XP before entrance','t0-inferno',entry-1,false],
            ['entrance unlocked','t0-inferno',entry,true],
            ['ultimate unlocked','t0-inferno',entry+40,true],
            ['mecha still locked','m1-rail',skinUnlockXp(mecha)-1,false],
            ['mecha unlocked','m1-rail',skinUnlockXp(mecha),true],
            ['plain at high XP','default',10000,false],
            ['non-awakening card','t1-flare',10000,false]
        ];
        for(const [name,theme,xp,expected] of cases){
            for(const kind of ['small','big','rainbow','wheel']){
                collectionEnd();
                const s={...students[0],theme,xp};
                // A caller-provided stage must not bypass the student's actual unlocks.
                collectionPlay(s,kind,{stage:3});
                const visible=!!collectionScene&&!$('#collection-overlay').hidden;
                if(visible!==expected)throw Error(name+' / '+kind+' eligibility mismatch');
                if(visible&&collectionScene.stage!==collectionStage(s))throw Error('incorrect stage');
            }
        }
        collectionEnd();
        return cases.length*4;
    }""")
    assert result == 44
    print(f"PASS {label}: 44 level, awakening-stage and mecha boundary checks")

    page.evaluate("""() => {
        const high={...students[0],name:'已覺醒測試',theme:'t0-inferno',xp:xpAtLevel(100)+280};
        const low={...students[0],name:'未覺醒測試',xp:0,theme:'default'};
        collectionPlay(high,'big');
        const scene=collectionScene,oldDuration=scene.duration;
        collectionPlay(low,'small');
        if(collectionScene!==scene||scene.pulses.length||scene.duration!==oldDuration)
            throw Error('locked award modified an active awakened scene');
        collectionEnd();
        const before=[{...low,id:'s1',score:29},{...high,id:'s2',score:12}];
        const after=before.map(s=>({...s,score:s.score+1}));
        collectionAward(before,after,['s1','s2']);
        if(collectionScene?.s.id!=='s2'||collectionScene.names.join()!=='已覺醒測試')
            throw Error('class award included a locked performer');
        collectionEnd();
        showWinnerSkin(low);
        if(collectionScene)throw Error('locked wheel winner received a full-screen scene');
        showWinnerSkin(high);
        if(collectionScene?.kind!=='wheel')throw Error('awakened wheel winner lost its scene');
        collectionEnd();
    }""")
    print(f"PASS {label}: mixed class awards and wheel winners respect individual unlocks")

    page.locator('#students [data-add="s1"]').click()
    page.wait_for_function("!dirty && !saving && revision===8")
    assert backend.state["rosters"]["p6"][0]["score"] == 10
    assert backend.state["rosters"]["p6"][0]["xp"] == 20
    assert not page.locator("#collection-overlay").is_visible()
    print(f"PASS {label}: ordinary score/XP updates save successfully without a full-screen scene")

    saved = snapshot(page)
    page.locator('[data-tab="wardrobe"]').click()
    page.locator('[data-skin-preview="t0-inferno"]').click()
    page.locator("#collection-big-demo").click()
    assert page.evaluate("collectionScene?.preview === true && collectionScene.stage === 3")
    assert snapshot(page) == saved
    page.evaluate("collectionEnd();$('#skin-dialog').close()")
    print(f"PASS {label}: explicit locked-effect previews remain available without unlocking or spending")

    page.locator('[data-tab="shop"]').click()
    assert page.locator("#gift-students").count() == 1
    assert page.locator(".lucky-panel #gift-students").count() == 1
    picker = page.locator("#gift-students").bounding_box()
    draw = page.locator("#gift-draw").bounding_box()
    assert picker["y"] + picker["height"] <= draw["y"]
    assert draw["y"] - picker["y"] - picker["height"] < 220
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    page.locator('[data-gift-student="p4:s2"]').click()
    assert page.locator('[data-gift-student="p4:s2"]').get_attribute("aria-pressed") == "true"
    assert "測試p4-2" in page.locator("#gift-balance").text_content()
    assert page.locator("#gift-draw").is_enabled()
    if label == "iPad":
        page.locator(".lucky-panel").screenshot(path="/tmp/star-team-lottery-ipad.png")

    before = copy.deepcopy(backend.state)
    page.on("dialog", lambda d: d.accept())
    page.locator("#gift-draw").click()
    page.locator("#summon-dialog").wait_for(state="visible")
    assert "測試p4-2" in page.locator("#summon-title").text_content()
    receipt = backend.state["extras"]["receipts"][-1]
    assert receipt["grade"] == "p4" and receipt["studentId"] == "s2" and receipt["kind"] == "draw"
    assert backend.state["rosters"]["p4"][1]["score"] == before["rosters"]["p4"][1]["score"] - 30
    assert backend.state["rosters"]["p4"][1]["xp"] == before["rosters"]["p4"][1]["xp"]
    for grade, roster in before["rosters"].items():
        for i, student in enumerate(roster):
            if (grade, i) != ("p4", 1):
                assert backend.state["rosters"][grade][i] == student
    assert backend.state["extras"]["drawWeights"] == before["extras"]["drawWeights"]
    assert backend.state["extras"]["gifts"][0]["stock"] == before["extras"]["gifts"][0]["stock"] - 1
    assert not errors, errors
    print(f"PASS {label}: picker sits above draw button; a draw charges only the selected student and preserves XP/weights")
    context.close()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                        args=["--no-sandbox", "--disable-dev-shm-usage"])
            base = f"http://127.0.0.1:{server.server_port}/"
            check_rewards(browser, base, {"viewport": {"width": 1280, "height": 960}}, "desktop")
            ipad = dict(p.devices["iPad (gen 7)"])
            ipad.pop("default_browser_type", None)
            check_rewards(browser, base, ipad, "iPad")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
