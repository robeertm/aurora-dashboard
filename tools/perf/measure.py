#!/usr/bin/env python3
"""Measure how long the Aurora views take to build, in real WebKit (the iPhone engine).

    python3 tools/perf/measure.py [--views home,klima] [--runs 3] [--phone] [--json out.json]
                                  [--idle 8] [--max-seconds 120]

Talks only to the throwaway demo instance from tools/demo (127.0.0.1:18523,
`tools/demo/demo.sh up` first). Needs Playwright with WebKit.

Per view it reports
  build_s   seconds from navigation until the number of rendered cards stopped
            changing for 2.5 s (the page is "built"); the plain Home Assistant
            start-up (empty dashboard) is measured once and shown as `base_s`
  cards     rendered `ha-card` elements (shadow roots included)
  blocked   milliseconds the main thread was blocked longer than 50 ms during the
            build (sum of requestAnimationFrame gaps over 50 ms, minus 50 each)
  worst     the longest single gap in ms
  sweeps    how often the helper walked the whole page, their summed and longest
            duration in ms (measurement copy of the helper, same code otherwise)
  will-change  elements promoted to their own compositing layer
  idle      same blocked sum over `--idle` seconds AFTER the build (template churn)
"""
import argparse
import json
import os
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(HERE, "..", "demo", "run")
BASE = "http://127.0.0.1:18523"
CLIENT = BASE + "/"
ALL_VIEWS = ["home", "smarthome", "room-living_room", "room-kitchen", "automations", "licht",
             "klima", "energie", "netz", "radio", "system", "explorer"]

PROBE = """
(() => {
  window.__gaps = [];
  let last = performance.now();
  const tick = (t) => { window.__gaps.push([t, t - last]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();
"""

DEEP_COUNT = """
() => {
  let n = 0, sel = 'ha-card';
  const walk = (root) => {
    n += root.querySelectorAll(sel).length;
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  return n;
}
"""


PROMOTED = """
() => {
  // elements the browser keeps on their own compositing layer on request (will-change)
  let n = 0;
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const w = getComputedStyle(el).willChange;
      if (w && w !== 'auto') n++;
    }
  };
  walk(document);
  return n;
}
"""


def hass_tokens(t):
    return json.dumps({"access_token": t["access_token"], "token_type": "Bearer", "expires_in": 1800,
                       "hassUrl": BASE, "clientId": CLIENT,
                       "expires": int(time.time() * 1000) + 1700 * 1000,
                       "refresh_token": t["refresh_token"]})


def fresh_tokens():
    import urllib.parse
    import urllib.request
    t = json.load(open(os.path.join(RUN, "tokens.json")))
    body = urllib.parse.urlencode({"grant_type": "refresh_token", "refresh_token": t["refresh_token"],
                                   "client_id": CLIENT}).encode()
    req = urllib.request.Request(BASE + "/auth/token", data=body,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        t["access_token"] = json.loads(r.read())["access_token"]
    return t


SWEEP_HEAD = "const sweep = () => {"


def instrument(src):
    """Time every full sweep of the helper (measurement copy only, never shipped)."""
    if SWEEP_HEAD not in src:
        return src
    return src.replace(
        SWEEP_HEAD,
        "const sweep = () => {\n    const __t = performance.now();\n"
        "    try { __sweepInner(); } finally {\n"
        "      (window.__aeSweep = window.__aeSweep || []).push(performance.now() - __t);\n    }\n  };\n"
        "  const __sweepInner = () => {", 1)


def sweep_stats():
    return """() => { const a = window.__aeSweep || []; return {n: a.length,
      total: Math.round(a.reduce((x, y) => x + y, 0)), max: Math.round(Math.max(0, ...a))}; }"""


def blocked(gaps, t0, t1):
    tot, worst = 0.0, 0.0
    for t, g in gaps:
        if t0 <= t <= t1:
            worst = max(worst, g)
            if g > 50:
                tot += g - 50
    return round(tot), round(worst)


def measure_view(page, path, idle, max_seconds):
    page.goto("about:blank")
    page.evaluate("0")
    start = time.time()
    page.goto("%s/aurora-home/%s" % (BASE, path) if path != "_base" else BASE + "/lovelace/0")
    page.evaluate(PROBE)
    t_nav = page.evaluate("performance.now()")
    last_n, last_change = -1, time.time()
    n = 0
    while time.time() - start < max_seconds:
        page.wait_for_timeout(500)
        n = page.evaluate(DEEP_COUNT)
        if n != last_n:
            last_n, last_change = n, time.time()
        elif (n > 0 and time.time() - last_change >= 2.5) or \
                (path == "_base" and time.time() - last_change >= 8):
            break
    built = last_change - start
    t_built = page.evaluate("performance.now()") - (time.time() - last_change) * 1000
    gaps = page.evaluate("window.__gaps")
    b, w = blocked(gaps, t_nav, t_built)
    page.wait_for_timeout(int(idle * 1000))
    gaps = page.evaluate("window.__gaps")
    t_end = page.evaluate("performance.now()")
    ib, iw = blocked(gaps, t_end - idle * 1000, t_end)
    sw = page.evaluate(sweep_stats())
    promoted = page.evaluate(PROMOTED)
    return {"promoted": promoted, "sweeps": sw["n"], "sweep_total_ms": sw["total"], "sweep_max_ms": sw["max"],
            "view": path, "build_s": round(built, 1), "cards": n, "blocked_ms": b, "worst_ms": w,
            "idle_blocked_ms": ib, "idle_worst_ms": iw}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--views", default=",".join(ALL_VIEWS))
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--phone", action="store_true")
    ap.add_argument("--idle", type=float, default=8)
    ap.add_argument("--max-seconds", type=float, default=120)
    ap.add_argument("--helper", help="serve this file instead of the demo's aurora-effects.js (A/B runs)")
    ap.add_argument("--json")
    ap.add_argument("--engine", default="webkit", choices=["webkit", "chromium"])
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright
    t = fresh_tokens()
    init = """
      localStorage.setItem('hassTokens', %s);
      localStorage.setItem('dockedSidebar', '"always_hidden"');
      localStorage.setItem('selectedTheme', '{"theme":"Aurora","dark":true}');
    """ % json.dumps(hass_tokens(t))
    rows = []
    with sync_playwright() as p:
        browser = getattr(p, a.engine).launch()
        try:
            kw = dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                      has_touch=True) if a.phone else dict(viewport={"width": 1440, "height": 1000})
            ctx = browser.new_context(locale="en-GB", timezone_id="Europe/Rome", **kw)
            ctx.add_init_script(init)
            helper = open(a.helper or os.path.join(HERE, "..", "..", "dist", "aurora-effects.js"),
                          encoding="utf-8").read()
            helper = instrument(helper)
            ctx.route("**/aurora-effects/aurora-effects.js*", lambda r: r.fulfill(
                status=200, content_type="application/javascript", body=helper))
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)[:120]))
            for path in ["_base"] + a.views.split(","):
                res = []
                for _ in range(a.runs):
                    try:
                        res.append(measure_view(page, path, a.idle, a.max_seconds))
                    except Exception as exc:   # a WebKit tab that dies under load: say so, go on
                        print("%-18s FAILED: %s" % (path, str(exc).splitlines()[0][:90]), flush=True)
                        page = ctx.new_page()
                if not res:
                    continue
                r = dict(res[0])
                for k in ("build_s", "blocked_ms", "worst_ms", "idle_blocked_ms", "idle_worst_ms", "cards",
                          "sweeps", "sweep_total_ms", "sweep_max_ms", "promoted"):
                    r[k] = statistics.median(x[k] for x in res)
                rows.append(r)
                print("%-18s build %6.1fs  cards %4d  blocked %6d ms  worst %5d ms  idle-blocked %5d ms"
                      "  sweeps %3d = %5d ms (max %4d)  will-change %3d"
                      % (path, r["build_s"], r["cards"], r["blocked_ms"], r["worst_ms"],
                         r["idle_blocked_ms"], r["sweeps"], r["sweep_total_ms"], r["sweep_max_ms"], r["promoted"]),
                      flush=True)
            ctx.close()
        finally:
            browser.close()
    if a.json:
        json.dump({"engine": a.engine, "phone": a.phone, "rows": rows, "errors": errors[:10]},
                  open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
