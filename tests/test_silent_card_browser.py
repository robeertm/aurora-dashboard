"""Silent card (tap_action: none) with its own controls: the controls must react.

Reproduces the mechanism with button-card's own rule, copied verbatim from
button-card 7.0.1: `ha-card.disabled { pointer-events: none; cursor: default; }`.
An embedded page (iframe) and a back chip sit inside such a card. Without the
helper nothing in it can be clicked (the regression); with the helper both react.

Needs Playwright with a browser; skipped otherwise (the static checker covers the
dashboard side either way).
"""
import os
import unittest

from tests.helpers import ROOT, read

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover - optional dependency
    sync_playwright = None

HELPER = os.path.join(ROOT, "dist", "aurora-effects.js")

PAGE = """<!doctype html>
<html><head><style>:root { --aurora-fx: 1; } body { margin: 0; background: #11111b; }</style></head>
<body><div id="host"></div>
<script>
  window.hits = { frame: 0, chip: 0 };
  window.addEventListener("message", (e) => { if (e.data === "frame-click") window.hits.frame++; });
  customElements.define("button-card", class extends HTMLElement {
    constructor() {
      super();
      const sr = this.attachShadow({ mode: "open" });
      sr.innerHTML = `
        <style>
          ha-card { display: block; padding: 0; }
          ha-card.disabled { pointer-events: none; cursor: default; }
          iframe { display: block; width: 400px; height: 120px; border: 0; }
          .back { display: inline-block; padding: 8px 12px; background: #313244; color: #cdd6f4; }
        </style>
        <ha-card class="button-card-main disabled">
          <div id="container">
            <div class="back" role="button" tabindex="0" onclick="window.hits.chip++">Overview</div>
            <iframe srcdoc="<button id=b style='width:200px;height:60px' onclick='parent.postMessage(&quot;frame-click&quot;, &quot;*&quot;)'>7 days</button>"></iframe>
          </div>
        </ha-card>`;
    }
  });
  document.getElementById("host").appendChild(document.createElement("button-card"));
</script>
%s
</body></html>"""


def engines():
    return [e for e in os.environ.get("AURORA_UI_ENGINES", "chromium,webkit").split(",") if e]


@unittest.skipIf(sync_playwright is None, "playwright not installed")
class SilentCardControls(unittest.TestCase):
    def run_page(self, engine, with_helper):
        helper = "<script>%s</script>" % read(HELPER) if with_helper else ""
        with sync_playwright() as p:
            try:
                browser = getattr(p, engine).launch()
            except Exception as exc:  # browser not installed here
                self.skipTest("%s not available: %s" % (engine, str(exc).splitlines()[0]))
            try:
                page = browser.new_page(viewport={"width": 600, "height": 400})
                page.set_content(PAGE % helper)
                page.wait_for_timeout(1500)  # first sweep of the helper
                frame = next(f for f in page.frames if f is not page.main_frame)
                frame.wait_for_selector("#b")
                card = page.locator("button-card")
                box_frame = page.evaluate("""() => { const f = document.querySelector('button-card').shadowRoot.querySelector('iframe').getBoundingClientRect(); return [f.x, f.y]; }""")
                b = frame.evaluate("""() => { const r = document.getElementById('b').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }""")
                chip = page.evaluate("""() => { const r = document.querySelector('button-card').shadowRoot.querySelector('.back').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }""")
                page.mouse.click(box_frame[0] + b[0], box_frame[1] + b[1])
                page.mouse.click(chip[0], chip[1])
                page.wait_for_timeout(400)
                self.assertTrue(card.count() == 1)
                return page.evaluate("window.hits")
            finally:
                browser.close()

    def test_without_helper_nothing_reacts(self):
        # Guards the test itself: if this ever reacts, the reproduction is too generous.
        for engine in engines():
            with self.subTest(engine=engine):
                self.assertEqual(self.run_page(engine, False), {"frame": 0, "chip": 0})

    def test_with_helper_both_react(self):
        for engine in engines():
            with self.subTest(engine=engine):
                self.assertEqual(self.run_page(engine, True), {"frame": 1, "chip": 1})


if __name__ == "__main__":
    unittest.main()
