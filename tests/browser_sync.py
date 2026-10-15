"""Run with Python Playwright and Chromium; all backend data is synthetic and mocked."""
import copy
import functools
import json
import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BACKEND = re.search(r"STAR_BACKEND_URL\s*=\s*'([^']+)'", (ROOT / "config.js").read_text())[1]
PASSWORD = "fixture-password-only"
STALE = "https://script.google.com/macros/s/fixture-stale/exec"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Backend:
    def __init__(self, photo):
        self.state = {
            "version": 7, "lastOpId": "fixture-initial",
            "rosters": {
                g: [{"id": "s1", "name": "測試" + g, "score": 12, "xp": 6000,
                     "theme": "m1-rail", "present": True, "photo": photo}]
                for g in ["p4", "p5", "p6"]
            },
            "extras": {
                "currencyVersion": 2, "drawCost": 1,
                "drawWeights": {"2": 12, "3": 34, "4": 54},
                "gifts": [{"id": "fixture-gift", "name": "測試禮物", "cost": 1,
                           "stock": 5, "rarity": 4, "draw": True, "image": photo}],
                "receipts": [],
            },
        }
        self.tokens = set()
        self.calls = []
        self.offline = False
        self.bad_login_reply = False

    def route(self, route):
        req = route.request
        assert req.url == BACKEND, "request sent to a different backend"
        payload = req.post_data_json
        self.calls.append(payload["method"])
        if self.offline:
            route.abort("failed")
            return
        method = payload["method"]
        if method == "login":
            if self.bad_login_reply:
                result = {}
            elif payload["password"] != PASSWORD:
                result = {"error": "密碼不正確"}
            else:
                token = "fixture-token-" + str(len(self.calls))
                self.tokens.add(token)
                result = {"token": token}
        elif payload.get("token") not in self.tokens:
            result = {"error": "AUTH"}
        elif method == "getState":
            result = self.state
        else:
            assert method == "saveState"
            arg = payload["arg"]
            if arg["opId"] == self.state["lastOpId"]:
                result = self.state
            elif arg["baseVersion"] != self.state["version"]:
                result = {"error": "CONFLICT：另一裝置已更新"}
            else:
                self.state = {"version": self.state["version"] + 1, "lastOpId": arg["opId"],
                              "rosters": copy.deepcopy(arg["rosters"]),
                              "extras": copy.deepcopy(arg["extras"])}
                result = self.state
        route.fulfill(status=200, content_type="application/json",
                      headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(result))


def login(page):
    page.locator("#teacher-password").fill(PASSWORD)
    page.locator("dialog[open] button[type=submit]").click()
    page.wait_for_function("loaded && !loading")


def snapshot(page):
    return page.evaluate("JSON.parse(JSON.stringify({rosters,extras}))")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}/"
    errors = []
    contexts = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                        args=["--no-sandbox", "--disable-dev-shm-usage"])
            seed = browser.new_page()
            photo = seed.evaluate("""() => {
                const c=document.createElement('canvas');c.width=c.height=2;
                c.getContext('2d').fillRect(0,0,2,2);return c.toDataURL('image/jpeg');
            }""")
            seed.close()
            backend = Backend(photo)
            initial = copy.deepcopy(backend.state)

            def new_page(ipad=False, blocked=False, empty_config=False, legacy=False):
                options = {"viewport": {"width": 1280, "height": 960}}
                if ipad:
                    options.update(p.devices["iPad (gen 7)"])
                    options.pop("default_browser_type", None)
                ctx = browser.new_context(**options)
                contexts.append(ctx)
                ctx.route("https://script.google.com/**", backend.route)
                if empty_config:
                    ctx.route("**/config.js?*", lambda r: r.fulfill(
                        content_type="text/javascript", body="window.STAR_BACKEND_URL='';"))
                if blocked:
                    ctx.add_init_script("""Object.defineProperty(window,'localStorage',{
                        get(){throw new DOMException('blocked','SecurityError')}
                    });""")
                if legacy:
                    ctx.add_init_script("Object.defineProperty(AbortSignal,'timeout',{value:undefined});")
                if not blocked:
                    ctx.add_init_script(f"localStorage.setItem('star-backend-url',{json.dumps(STALE)});")
                page = ctx.new_page()
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto(base, wait_until="domcontentloaded")
                page.locator("dialog[open]").wait_for()
                return page

            desktop = new_page()
            ipad = new_page(ipad=True, legacy=True)
            for page in [desktop, ipad]:
                assert page.locator("#backend-url").input_value() == BACKEND
                assert page.locator("#backend-url").get_attribute("readonly") is not None
                assert page.locator("#google-fallback").get_attribute("href") == BACKEND
                login(page)
                assert snapshot(page) == {k: initial[k] for k in ["rosters", "extras"]}
                page.locator("#students img.avatar").evaluate("img => img.decode()")
            assert "saveState" not in backend.calls
            print("PASS: desktop and iPad emulation load the same grades, photos, XP, cards, gifts and weights")

            desktop.locator('#students [data-add="s1"]').click()
            desktop.wait_for_function("!dirty && !saving && revision === 8")
            ipad.evaluate("pollCloud()")
            assert snapshot(ipad) == snapshot(desktop)
            assert backend.state["rosters"]["p6"][0]["score"] == 13
            for g in ["p4", "p5"]:
                assert backend.state["rosters"][g] == initial["rosters"][g]
            assert backend.state["extras"] == initial["extras"]
            print("PASS: a score update reaches the second device; other grades, photos, cards and shared gifts are preserved")

            ipad.locator("#grade-select").select_option("p4")
            ipad.wait_for_function("loaded && !loading && grade === 'p4'")
            assert ipad.locator("#students .student-name").text_content() == "測試p4"
            assert snapshot(ipad)["extras"] == initial["extras"]
            print("PASS: switching grades reads the existing backend without reimporting data")

            protected_state = copy.deepcopy(backend.state)
            backend.state["version"] += 1
            backend.state["rosters"]["p4"][0]["score"] = 20
            ipad.locator('#students [data-add="s1"]').click()
            ipad.wait_for_function("conflict && !saving")
            assert backend.state["rosters"]["p4"][0]["score"] == 20
            assert backend.state["extras"] == protected_state["extras"]
            assert ipad.evaluate("dirty")
            print("PASS: stale-device conflict retains unsaved changes and never overwrites newer backend scores")

            backend.tokens.clear()
            desktop.evaluate("void pollCloud()")
            desktop.locator("dialog[open]").wait_for()
            login(desktop)
            desktop.wait_for_function("!polling")
            assert snapshot(desktop)["rosters"] == backend.state["rosters"]
            print("PASS: expired sessions reauthenticate against the same backend")

            blocked = new_page(ipad=True, blocked=True, legacy=True)
            login(blocked)
            assert snapshot(blocked)["rosters"] == backend.state["rosters"]
            assert blocked.evaluate("typeof AbortSignal.timeout") == "undefined"
            print("PASS: login and reads work with blocked storage and no AbortSignal.timeout")

            manual = new_page(blocked=True, empty_config=True)
            manual.locator("#backend-url").fill(BACKEND)
            login(manual)
            assert manual.evaluate("backendURL()") == BACKEND
            assert snapshot(manual)["rosters"] == backend.state["rosters"]
            print("PASS: manual backend login remains usable in memory when storage is unavailable")

            wrong = new_page()
            wrong.locator("#teacher-password").fill("wrong-fixture-password")
            wrong.locator("dialog[open] button[type=submit]").click()
            wrong.wait_for_function("document.querySelector('#login-status').textContent.includes('密碼不正確')")
            assert wrong.evaluate("localStorage.getItem('star-backend-url')") == STALE
            assert not wrong.evaluate("loaded")
            backend.bad_login_reply = True
            wrong.locator("dialog[open] button[type=submit]").click()
            wrong.wait_for_function("document.querySelector('#login-status').textContent.includes('有效登入資料')")
            assert not wrong.evaluate("loaded")
            backend.bad_login_reply = False
            print("PASS: failed/invalid login never changes saved backend or unlocks editing")

            backend.offline = True
            fallback = new_page(ipad=True)
            fallback.locator("#teacher-password").fill(PASSWORD)
            fallback.locator("dialog[open] button[type=submit]").click()
            fallback.wait_for_function("document.querySelector('#login-status').textContent.includes('Google 備用入口')")
            assert fallback.locator("#google-fallback").is_visible()
            assert fallback.locator("#google-fallback").get_attribute("href") == BACKEND
            assert not fallback.evaluate("loaded")
            backend.offline = False
            print("PASS: network failure offers the same Google backend without exposing a password in the URL")

            for page in [desktop, ipad, wrong]:
                saved = page.evaluate("JSON.stringify(Object.entries(localStorage))")
                assert PASSWORD not in saved and "fixture-token-" not in saved
            assert not errors, errors
            print("PASS: no uncaught browser errors or password/session persistence")
            for ctx in contexts:
                ctx.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
