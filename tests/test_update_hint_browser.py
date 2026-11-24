"""Quiet update hint: fake release source old -> new, same version, off switch, hide, 304.

Needs Playwright with a browser; skipped otherwise.
"""
import json
import os
import re
import unittest

from tests.helpers import ROOT, read

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover - optional dependency
    sync_playwright = None

HELPER = os.path.join(ROOT, "dist", "aurora-effects.js")
SRC = "https://updates.invalid/latest"
CUR = re.search(r'AE_VERSION = "([0-9.]+)"', read(HELPER)).group(1)


def bump(v):
    a = v.split(".")
    a[1] = str(int(a[1]) + 1)
    return ".".join(a)


ORIGIN = "https://aurora.invalid/"


def load(page, extra=""):
    """Serve the page from a real (fake) origin: about:blank has no localStorage."""
    page.route(ORIGIN, lambda r: r.fulfill(status=200, content_type="text/html", body=page_html(extra)))
    page.goto(ORIGIN)


def page_html(extra=""):
    return ("<!doctype html><html lang=en><head><meta charset=utf-8><style>:root{--aurora-fx:1;%s}body{margin:0;background:#11111b}"
            "</style></head><body><div style='height:300px'></div><script>"
            "window.AURORA_UPDATE_URL=%s;window.AURORA_UPDATE_DELAY_MS=50;</script><script>%s</script></body></html>"
            % (extra, json.dumps(SRC), read(HELPER)))


@unittest.skipIf(sync_playwright is None, "playwright not installed")
class UpdateHint(unittest.TestCase):
    def run_case(self, tag, extra="", before=None, width=390, shot=None, hits=None):
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch()
            except Exception as exc:
                self.skipTest("chromium not available: %s" % str(exc).splitlines()[0])
            try:
                ctx = browser.new_context(viewport={"width": width, "height": 600})
                page = ctx.new_page()
                calls = []

                def handler(route):
                    calls.append(route.request.headers.get("if-none-match"))
                    if hits is not None and calls[-1] == '"e1"':
                        route.fulfill(status=304, headers={"access-control-allow-origin": "*"})
                        return
                    route.fulfill(status=200, content_type="application/json",
                                  headers={"access-control-allow-origin": "*", "etag": '"e1"'},
                                  body=json.dumps({"tag_name": "v" + tag,
                                                   "html_url": "https://example.invalid/r/" + tag}))
                ctx.route(SRC, handler)
                load(page, extra)
                if before:
                    page.evaluate(before)
                page.wait_for_timeout(900)
                pill = page.locator("#aurora-update-pill")
                state = {"count": pill.count(), "text": pill.inner_text() if pill.count() else "",
                         "href": pill.locator("a").get_attribute("href") if pill.count() else None}
                if shot and pill.count():
                    page.screenshot(path=shot)
                return state, calls, page
            finally:
                browser.close()

    def test_newer_release_shows_pill(self):
        new = bump(CUR)
        st, calls, _ = self.run_case(new, width=int(os.environ.get("AURORA_UPDATE_WIDTH", "390")), shot=os.environ.get("AURORA_UPDATE_SHOT"))
        self.assertEqual(st["count"], 1)
        self.assertIn(new, st["text"])
        self.assertEqual(st["href"], "https://example.invalid/r/" + new)
        self.assertEqual(len(calls), 1)

    def test_same_or_older_version_stays_silent(self):
        for tag in (CUR, "1.0.0"):
            st, calls, _ = self.run_case(tag)
            self.assertEqual(st["count"], 0)
            self.assertEqual(len(calls), 1)

    def test_theme_variable_off_means_no_request(self):
        st, calls, _ = self.run_case(bump(CUR), extra="--aurora-update-check:0")
        self.assertEqual(st["count"], 0)
        self.assertEqual(calls, [])

    def test_hide_remembers_the_version(self):
        new = bump(CUR)
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch()
            except Exception as exc:
                self.skipTest("chromium not available: %s" % str(exc).splitlines()[0])
            try:
                page = browser.new_page()
                page.route(SRC, lambda r: r.fulfill(
                    status=200, content_type="application/json",
                    headers={"access-control-allow-origin": "*"},
                    body=json.dumps({"tag_name": "v" + new, "html_url": "https://example.invalid/r"})))
                load(page)
                page.wait_for_selector("#aurora-update-pill", timeout=3000)
                page.click("#aurora-update-pill button")
                self.assertEqual(page.locator("#aurora-update-pill").count(), 0)
                self.assertEqual(page.evaluate("localStorage.getItem('aurora-update-skip')"), "v" + new)
            finally:
                browser.close()

    def test_cached_etag_is_sent_and_304_keeps_cache(self):
        new = bump(CUR)
        seed = "localStorage.setItem('aurora-update-cache', JSON.stringify({at:1,etag:'\"e1\"',tag:'v%s',url:''}))" % new
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch()
            except Exception as exc:
                self.skipTest("chromium not available: %s" % str(exc).splitlines()[0])
            try:
                seen = []
                page = browser.new_page()

                def h(route):
                    seen.append(route.request.headers.get("if-none-match"))
                    route.fulfill(status=304, headers={"access-control-allow-origin": "*"})
                page.route(SRC, h)
                page.route(ORIGIN, lambda r: r.fulfill(status=200, content_type="text/html", body=page_html().replace("AURORA_UPDATE_DELAY_MS=50", "AURORA_UPDATE_DELAY_MS=1200")))
                page.goto(ORIGIN)
                page.evaluate(seed)
                page.wait_for_timeout(2500)
                self.assertEqual(seen[:1], ['"e1"'])
                self.assertEqual(page.locator("#aurora-update-pill").count(), 1)
            finally:
                browser.close()


if __name__ == "__main__":
    unittest.main()
