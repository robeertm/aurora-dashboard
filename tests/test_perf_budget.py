"""Performance budgets for the helper, measured in a real browser (WebKit first: the iPhone engine).

Wall-clock limits flake on a loaded machine, so these tests pin the *causes* of the slowness
that was measured on the demo instance (tools/perf/measure.py) instead:

* a sweep reads every computed style BEFORE it writes the first one (it used to alternate per
  card: one forced style recalculation per card, 3-10 s per sweep in a room view on a Pi);
* the tile width of a trend axis comes from a ResizeObserver, never from a layout read;
* an icon whose idle animation the helper switches off gets no compositor layer, an icon that
  carries a meaningful animation still does.

A fourth test is the end-to-end budget on the throwaway demo instance (tools/demo, started with
`demo.sh up`): it only runs when AURORA_PERF_LIVE=1 and the instance answers.

Needs Playwright with a browser; skipped otherwise.
"""
import json
import os
import subprocess
import sys
import unittest
import urllib.request

from tests.helpers import ROOT, read

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover - optional dependency
    sync_playwright = None

HELPER = os.environ.get("AURORA_HELPER") or os.path.join(ROOT, "dist", "aurora-effects.js")
CARDS = 60

# Records every read of computed style / layout ("R") and every write the sweep makes ("W"); the
# sweep brackets itself with performance.now() ("T").
SPY = """
<script>
  window.log = [];
  const L = window.log;
  const gcs = window.getComputedStyle.bind(window);
  window.getComputedStyle = (...a) => { L.push("R"); return gcs(...a); };
  const gbr = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { L.push("R"); return gbr.call(this); };
  const ads = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, "adoptedStyleSheets");
  if (ads && ads.set) {
    Object.defineProperty(ShadowRoot.prototype, "adoptedStyleSheets",
      { get: ads.get, set(v) { L.push("W"); ads.set.call(this, v); }, configurable: true });
  }
  const sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (...a) { L.push("W"); return sa.apply(this, a); };
  const ac = Node.prototype.appendChild;
  Node.prototype.appendChild = function (...a) { L.push("W"); return ac.apply(this, a); };
  const now = performance.now.bind(performance);
  performance.now = () => { L.push("T"); return now(); };
</script>
"""

PAGE = """<!doctype html>
<html><head><style>:root { --aurora-fx: 1; } body { margin: 0; background: #11111b; }
#grid { display: grid; grid-template-columns: repeat(3, 1fr); width: 900px; }</style></head>
<body><div id="host"><div id="grid"></div></div>
<script>
  const shadow = (html) => class extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: "open" }).innerHTML = html; }
  };
  customElements.define("button-card", shadow(
    '<ha-card><div class="idle" style="animation: aurora-float 6s ease-in-out infinite">i</div>' +
    '<div class="live" style="animation: aurora-pulse 1.2s ease-in-out infinite">l</div></ha-card>'));
  customElements.define("mini-graph-card", shadow('<style>.graph { width: 200px; height: 40px; }</style><ha-card><div class="graph"></div></ha-card>'));
  const grid = document.getElementById("grid");
  for (let i = 0; i < %(cards)d; i++) grid.appendChild(document.createElement("button-card"));
  for (let i = 0; i < 3; i++) grid.appendChild(document.createElement("mini-graph-card"));
</script>
%(spy)s
<script>%(helper)s</script>
</body></html>"""


def engines():
    return [e for e in os.environ.get("AURORA_UI_ENGINES", "webkit,chromium").split(",") if e]


@unittest.skipIf(sync_playwright is None, "playwright not installed")
class HelperBudgets(unittest.TestCase):
    def open(self, p, engine):
        try:
            browser = getattr(p, engine).launch()
        except Exception as exc:  # browser not installed here
            self.skipTest("%s not available: %s" % (engine, str(exc).splitlines()[0]))
        page = browser.new_page(viewport={"width": 1000, "height": 700})
        # the spy goes in front of the helper, the helper is the last script
        page.set_content(PAGE % {"cards": CARDS, "spy": SPY, "helper": read(HELPER)})
        page.wait_for_timeout(1200)  # the first sweep runs while the script loads, the rest settles
        return browser, page

    def sweep_log(self, page):
        """The longest stretch between two performance.now() calls = the first sweep. What came
        before the first call counts as a candidate too: a helper that does not time its sweeps
        (older versions) has nothing else to delimit it."""
        log = page.evaluate("window.log")
        stretches, cur = [], []
        for ev in log:
            if ev == "T":
                stretches.append(cur)
                cur = []
            else:
                cur.append(ev)
        stretches.append(cur)
        return max(stretches, key=len)

    def test_sweep_reads_before_it_writes(self):
        for engine in engines():
            with self.subTest(engine=engine), sync_playwright() as p:
                browser, page = self.open(p, engine)
                try:
                    seq = self.sweep_log(page)
                    reads = seq.count("R")
                    self.assertGreaterEqual(reads, CARDS, "the sweep did not run (%d reads)" % reads)
                    self.assertIn("W", seq, "the sweep wrote nothing")
                    first_write = seq.index("W")
                    late = seq[first_write:].count("R")
                    self.assertEqual(late, 0, "%d style/layout reads after the first write of a sweep "
                                     "(each one forces a recalculation)" % late)
                finally:
                    browser.close()

    def test_axis_width_comes_from_a_resize_observer(self):
        for engine in engines():
            with self.subTest(engine=engine), sync_playwright() as p:
                browser, page = self.open(p, engine)
                try:
                    rows = page.evaluate("""() => [...document.querySelectorAll('mini-graph-card')].map(c => {
                        const row = c.shadowRoot.querySelector('.aurora-xaxis');
                        return row ? [row.dataset.ticks, row.children.length] : null; })""")
                    # a 200 px tile gets one tick = two labels; the observer reports it after layout
                    self.assertEqual(rows, [["1", 2]] * 3)
                    page.evaluate("""() => document.querySelectorAll('mini-graph-card').forEach(c => {
                        c.shadowRoot.querySelector('.graph').style.width = '400px'; })""")
                    page.wait_for_timeout(500)
                    rows = page.evaluate("""() => [...document.querySelectorAll('mini-graph-card')].map(c => {
                        const row = c.shadowRoot.querySelector('.aurora-xaxis');
                        return [row.dataset.ticks, row.children.length]; })""")
                    self.assertEqual(rows, [["4", 5]] * 3, "the axis does not follow a resize")
                finally:
                    browser.close()

    def test_switched_off_animation_keeps_no_layer(self):
        for engine in engines():
            with self.subTest(engine=engine), sync_playwright() as p:
                browser, page = self.open(p, engine)
                try:
                    got = page.evaluate("""() => {
                        const sr = document.querySelector('button-card').shadowRoot;
                        const idle = getComputedStyle(sr.querySelector('.idle'));
                        const live = getComputedStyle(sr.querySelector('.live'));
                        return [idle.animationName, idle.willChange, live.animationName, live.willChange]; }""")
                    self.assertEqual(got[0], "none", "idle float animation is not switched off")
                    self.assertEqual(got[1], "auto", "an icon that does not move got a compositor layer")
                    self.assertEqual(got[2], "aurora-pulse", "the meaningful animation was switched off")
                    self.assertIn("transform", got[3], "the meaningful animation lost its layer")
                finally:
                    browser.close()


def live_up(base):
    try:
        urllib.request.urlopen(base + "/api/onboarding", timeout=5).read()
        return True
    except Exception:
        return False


@unittest.skipUnless(os.environ.get("AURORA_PERF_LIVE") == "1", "set AURORA_PERF_LIVE=1 with the demo instance up")
@unittest.skipIf(sync_playwright is None, "playwright not installed")
class LiveBudget(unittest.TestCase):
    """End to end on the demo instance. Wall-clock limits are coarse on purpose (a Raspberry Pi under
    load measured 3.9-5.3 s of sweeps in the kitchen view with this helper and 6-10 s with 2.40.2);
    the layer count is exact and is the sharp part of this budget."""

    BASE = "http://127.0.0.1:18523"
    LIMITS = {"sweep_total_ms": 8000, "promoted": 40}

    def test_overview_and_a_room_stay_inside_the_budget(self):
        if not live_up(self.BASE):
            self.skipTest("demo instance is not up (tools/demo/demo.sh up)")
        out = os.path.join(os.environ.get("TMPDIR", "/tmp"), "aurora-perf-budget.json")
        r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "perf", "measure.py"),
                            "--views", "home,room-kitchen", "--runs", "2", "--idle", "2", "--json", out],
                           capture_output=True, text=True, timeout=1500)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        with open(out) as f:
            rows = {x["view"]: x for x in json.load(f)["rows"]}
        for view in ("home", "room-kitchen"):
            for key, limit in self.LIMITS.items():
                self.assertLessEqual(rows[view][key], limit, "%s %s over budget\n%s" % (view, key, r.stdout))


if __name__ == "__main__":
    unittest.main()
