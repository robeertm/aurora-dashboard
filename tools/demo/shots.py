#!/usr/bin/env python3
"""Onboard the demo instance and take the README screenshots (WebKit).

    shots.py wait    create the demo user, finish onboarding, wait for the data
    shots.py shoot   write PNGs to tools/demo/out/ (wide 1440 px and phone 390 px)

Only talks to 127.0.0.1:18523 - the throwaway container from demo.sh.
"""
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "http://127.0.0.1:18523"
CLIENT = BASE + "/"
RUN = os.path.join(HERE, "run")
OUT = os.path.join(HERE, "out")
TOKFILE = os.path.join(RUN, "tokens.json")
EXPECT_STATES = 100


def call(path, body=None, token=None, form=False, method=None):
    data = None
    headers = {}
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def tokens(code):
    return call("/auth/token", {"grant_type": "authorization_code", "code": code,
                                "client_id": CLIENT}, form=True)


def wait_up():
    for _ in range(120):
        try:
            call("/api/onboarding")
            return
        except Exception:
            time.sleep(2)
    sys.exit("instance did not come up")


def wait_cmd():
    wait_up()
    steps = {s["step"]: s["done"] for s in call("/api/onboarding")}
    if not steps.get("user"):
        pw = secrets.token_urlsafe(18)
        r = call("/api/onboarding/users", {"client_id": CLIENT, "name": "Demo Admin", "username": "demo",
                                           "password": pw, "language": "en"})
        t = tokens(r["auth_code"])
        json.dump(t, open(TOKFILE, "w"))
        os.chmod(TOKFILE, 0o600)
        for step, body in (("core_config", {}), ("analytics", {}),
                           ("integration", {"client_id": CLIENT, "redirect_uri": CLIENT + "?auth_callback=1"})):
            try:
                call("/api/onboarding/" + step, body, t["access_token"])
            except urllib.error.HTTPError as e:
                print("onboarding", step, e.code, file=sys.stderr)
    t = json.load(open(TOKFILE))
    # fresh access token from the refresh token
    a = call("/auth/token", {"grant_type": "refresh_token", "refresh_token": t["refresh_token"],
                             "client_id": CLIENT}, form=True)
    t["access_token"] = a["access_token"]
    json.dump(t, open(TOKFILE, "w"))
    tidy(t["access_token"])
    for _ in range(90):
        try:
            n = len(call("/api/states", token=t["access_token"]))
        except Exception:
            n = 0
        if n >= EXPECT_STATES:
            break
        time.sleep(2)
    else:
        sys.exit("demo data did not arrive (%d states)" % n)
    time.sleep(3)
    print("ready:", n, "states")


def tidy(token):
    """Onboarding adds a weather/radio/translate entry (needs the internet) and a
    person for the admin user. Drop them: the demo is offline and has one person."""
    import asyncio
    import websockets

    async def run():
        async with websockets.connect(BASE.replace("http", "ws") + "/api/websocket") as ws:
            await ws.recv()
            await ws.send(json.dumps({"type": "auth", "access_token": token}))
            await ws.recv()
            n = 0

            async def rpc(msg):
                nonlocal n
                n += 1
                msg["id"] = n
                await ws.send(json.dumps(msg))
                while True:
                    r = json.loads(await ws.recv())
                    if r.get("id") == n:
                        return r.get("result")

            await asyncio.sleep(10)  # onboarding finishes its integrations asynchronously
            for e in await rpc({"type": "config_entries/get"}) or []:
                if e["domain"] == "sun":  # keep: the sky follows it
                    continue
                try:
                    call("/api/config/config_entries/entry/" + e["entry_id"], token=token,
                         method="DELETE")
                except Exception as ex:
                    print("could not remove", e["domain"], ex, file=sys.stderr)
            res = await rpc({"type": "person/list"}) or {}
            for p in res.get("storage", []):
                await rpc({"type": "person/delete", "person_id": p["id"]})

    asyncio.run(run())


# ── screenshots ──────────────────────────────────────────────────────────────
DEEP_FIND = """
(sel) => {
  const walk = (root) => {
    const hit = root.querySelector(sel);
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; }
    }
    return null;
  };
  return walk(document);
}
"""


def hass_tokens(t):
    return json.dumps({"access_token": t["access_token"], "token_type": "Bearer",
                       "expires_in": 1800, "hassUrl": BASE, "clientId": CLIENT,
                       "expires": int(time.time() * 1000) + 1700 * 1000,
                       "refresh_token": t["refresh_token"]})


def shoot_cmd():
    from playwright.sync_api import sync_playwright
    t = json.load(open(TOKFILE))
    os.makedirs(OUT, exist_ok=True)
    init = """
      localStorage.setItem('hassTokens', %s);
      localStorage.setItem('dockedSidebar', '"always_hidden"');
      localStorage.setItem('selectedTheme', '{"theme":"Aurora","dark":true}');
    """ % json.dumps(hass_tokens(t))

    def settle(page, extra=6000):
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(extra)

    with sync_playwright() as p:
        browser = p.webkit.launch()
        try:
            # wide
            ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1,
                                      locale="en-GB", timezone_id="Europe/Rome")
            ctx.add_init_script(init)
            page = ctx.new_page()
            views = [("home", "home"), ("climate", "klima"), ("energy", "energie"),
                     ("system", "system"), ("lights", "licht"), ("radio", "radio")]
            for name, path in views:
                page.goto("%s/aurora-home/%s" % (BASE, path))
                settle(page, 9000)
                if name == "system":
                    # the charts sit below the first screen: bring the Server heading to the top
                    page.evaluate("""() => { const f = (n) => { if (n.nodeType === 1 && n.textContent && n.children.length === 0 && n.textContent.trim() === 'Server / Raspberry Pi') return n; const k = (n.shadowRoot ? [...n.shadowRoot.children] : []).concat([...(n.children || [])]); for (const c of k) { const r = f(c); if (r) return r; } return null; }; const e = f(document.body); if (e) e.scrollIntoView({block: 'start'}); }""")
                    page.mouse.move(700, 500)
                    page.mouse.wheel(0, -80)
                    page.wait_for_timeout(2500)
                page.screenshot(path=os.path.join(OUT, name + ".png"))
                print("shot", name)
                if name == "home":
                    open_first_row(page)
                    page.wait_for_timeout(1200)
                    page.screenshot(path=os.path.join(OUT, "detail-sheet.png"))
                    print("shot detail-sheet")
            ctx.close()
            # phone
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, locale="en-GB",
                                      timezone_id="Europe/Rome")
            ctx.add_init_script(init)
            page = ctx.new_page()
            page.goto(BASE + "/aurora-home/home")
            settle(page, 9000)
            page.screenshot(path=os.path.join(OUT, "phone.png"))
            print("shot phone")
            open_first_row(page)
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(OUT, "phone-detail.png"))
            print("shot phone-detail")
            ctx.close()
        finally:
            browser.close()


def open_first_row(page):
    h = page.evaluate_handle(DEEP_FIND, "[data-aurora-detail]")
    el = h.as_element()
    if el is None:
        sys.exit("no status row found")
    el.scroll_into_view_if_needed()
    el.click()


if __name__ == "__main__":
    {"wait": wait_cmd, "shoot": shoot_cmd}[sys.argv[1] if len(sys.argv) > 1 else ""]()
