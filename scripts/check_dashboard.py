#!/usr/bin/env python3
"""Static checks for dashboard/aurora.yaml and dist/aurora-effects.js.

Each rule below exists because a user hit the bug it prevents (issue #1):

* ``entity.``      a button-card JS template that reads ``entity.state`` and
                   friends without a guard throws a ``ButtonCardJSTemplateError``
                   red box as soon as the entity is missing.  Write
                   ``entity?.state`` (or guard with ``entity ? entity.x : ...``).
* ``hard-path``    ``navigation_path: /aurora-home/...`` breaks as soon as the
                   dashboard has another URL.  Build the path from
                   ``location.pathname``.
* ``apex``         an apexcharts-card without ``update_interval`` re-fetches its
                   history on every state change and shows its loading spinner
                   each time; set ``update_interval`` and ``show.loading: false``.
* ``fixed-height`` ``aurora_person`` / ``aurora_sky_btn`` with a fixed pixel
                   ``height`` smaller than the content jump in height on every
                   re-render.  Use ``min-height`` (and no ``height: <n>px``,
                   not even a ``!important`` one in ``extra_styles``).
* ``helper``       the scene must read the helper the buttons write
                   (``input_select.sky_mode``); the slow cloud animation must
                   keep a sub-pixel transform; Firefox must get the glass
                   without the blur; version in the helper header, constant
                   and changelog must agree.

Usage::

    python scripts/check_dashboard.py            # exit 1 on any finding
    python scripts/check_dashboard.py --list     # also print what was checked
"""
from __future__ import annotations

import os
import re
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DASH = os.path.join(ROOT, "dashboard", "aurora.yaml")
HELPER = os.path.join(ROOT, "dist", "aurora-effects.js")
CHANGELOG = os.path.join(ROOT, "CHANGELOG.md")

PROPS = r"(?:state|attributes|entity_id|last_changed|last_updated|context)"
# `entity.state` that is not optional-chained and not directly behind a guard.
UNGUARDED = re.compile(r"(?<!entity \? )(?<!entity && )(?<![\w.?$])entity\." + PROPS + r"\b")


def lineno(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def walk(node, path=()):
    yield path, node
    if isinstance(node, dict):
        for k, v in node.items():
            yield from walk(v, path + (str(k),))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, path + (str(i),))


def main() -> int:
    findings: list[str] = []
    checked: list[str] = []
    text = open(DASH, encoding="utf-8").read()
    data = yaml.safe_load(text)
    checked.append("dashboard/aurora.yaml parses")

    # 1. unguarded entity access in JS templates
    n = 0
    for m in UNGUARDED.finditer(text):
        n += 1
        findings.append("aurora.yaml:%d: unguarded `%s` (use `entity?.…`)" % (lineno(text, m.start()), m.group(0)))
    checked.append("no unguarded entity.* access (%d found)" % n)

    # 2. hard-coded dashboard paths
    n = 0
    for m in re.finditer(r"""(?:navigation_path|url_path):\s*["']?(/[A-Za-z0-9_-]+/[^\s"']*)""", text):
        n += 1
        findings.append("aurora.yaml:%d: hard-coded path `%s` (build it from location.pathname)" % (lineno(text, m.start()), m.group(1)))
    for m in re.finditer(r"/aurora-home/", text):
        ln = lineno(text, m.start())
        line = text.splitlines()[ln - 1]
        if "navigation_path" in line or "url_path" in line:
            continue  # already reported above
        n += 1
        findings.append("aurora.yaml:%d: literal `/aurora-home/` outside a comment-free template" % ln)
    checked.append("no hard-coded dashboard paths (%d found)" % n)

    # 3. apexcharts-card needs update_interval + show.loading false
    n = 0
    total = 0
    for path, node in walk(data):
        if isinstance(node, dict) and node.get("type") == "custom:apexcharts-card":
            total += 1
            show = node.get("show") or {}
            if "update_interval" not in node or show.get("loading") is not False:
                n += 1
                findings.append("aurora.yaml: apexcharts-card at %s lacks update_interval / show.loading: false" % "/".join(path))
    checked.append("%d apexcharts-card entries have update_interval + show.loading:false (%d bad)" % (total, n))

    # 4. fixed heights smaller than the content
    tpls = data.get("button_card_templates", {})
    for name in ("aurora_person", "aurora_sky_btn"):
        t = tpls.get(name) or {}
        card = (t.get("styles") or {}).get("card") or []
        for entry in card:
            if isinstance(entry, dict) and "height" in entry and re.fullmatch(r"\d+px", str(entry["height"])):
                findings.append("aurora.yaml: template %s sets card height: %s (use min-height)" % (name, entry["height"]))
        extra = t.get("extra_styles") or ""
        for m in re.finditer(r"(?<![-\w])height:\s*\d+px\s*!important", extra):
            findings.append("aurora.yaml: template %s extra_styles has `%s` (use min-height)" % (name, m.group(0)))
        if not any(isinstance(e, dict) and "min-height" in e for e in card):
            findings.append("aurora.yaml: template %s has no min-height" % name)
    checked.append("aurora_person / aurora_sky_btn have no fixed pixel height")

    # 5. scene reads the helper the buttons write
    if "input_select.aurora_himmel" in text:
        findings.append("aurora.yaml: still reads input_select.aurora_himmel (buttons write input_select.sky_mode)")
    checked.append("scene and buttons share input_select.sky_mode")

    # 6. slow cloud animation keeps a sub-pixel transform
    for name in ("sky-sail", "sky-drift-a", "sky-drift-b", "sky-fog"):
        m = re.search(r"@keyframes " + name + r"\s*\{[^}]*\}[^}]*\}", text)
        if not m or m.group(0).count("rotate(") < 2:
            findings.append("aurora.yaml: @keyframes %s has no sub-pixel rotate() in from/to" % name)
    checked.append("slow sky animations keep the sub-pixel rotate")

    # 8. every overview tile does something (issue #1: three of eight did nothing)
    n_chip = 0
    for view in data.get("views", []):
        if view.get("path") not in ("home", "smarthome"):
            continue
        for path, node in walk(view):
            if isinstance(node, dict) and node.get("template") in ("aurora_chip", "aurora_chip_kompakt"):
                n_chip += 1
                tap = (node.get("tap_action") or {}).get("action")
                where = "%s/%s" % (view.get("path"), "/".join(path))
                if tap not in ("navigate", "fire-dom-event", "more-info", "call-service"):
                    findings.append("aurora.yaml: tile at %s has no tap action (every overview tile opens something)" % where)
                elif tap == "fire-dom-event" and node["tap_action"].get("aurora_sheet") not in ("persons", "media"):
                    findings.append("aurora.yaml: tile at %s fires a dom event the helper does not know" % where)
    checked.append("%d overview tiles have a tap action" % n_chip)

    # 7. helper
    js = open(HELPER, encoding="utf-8").read()
    ver = re.search(r'const AE_VERSION = "([0-9.]+)"', js)
    head = re.search(r"^ \* v([0-9.]+) ", js, re.M)
    log = re.search(r"^## ([0-9.]+)\s*$", open(CHANGELOG, encoding="utf-8").read(), re.M)
    if not (ver and head and log and ver.group(1) == head.group(1) == log.group(1)):
        findings.append("version mismatch: AE_VERSION=%s header=%s CHANGELOG=%s" % (
            ver and ver.group(1), head and head.group(1), log and log.group(1)))
    checked.append("AE_VERSION, helper header and CHANGELOG agree (%s)" % (ver and ver.group(1)))
    if "const FIREFOX" not in js:
        findings.append("aurora-effects.js: no FIREFOX detection")
    if not re.search(r"glass:\s*mkSheet\([^)]*FIREFOX\s*\?\s*GLASS_FIREFOX", js):
        findings.append("aurora-effects.js: SHEETS.glass does not use GLASS_FIREFOX")
    if not re.search(r'GLASS_FIREFOX\s*=\s*glassCss\(\s*"none"', js):
        findings.append("aurora-effects.js: GLASS_FIREFOX must pass blur `none`")
    if not re.search(r"GLASS\s*=\s*glassCss\(BLUR", js) or 'BLUR = "blur(18px) saturate(1.45)"' not in js:
        findings.append("aurora-effects.js: Blink glass must stay blur(18px) saturate(1.45)")
    checked.append("Firefox glass has no blur, Blink glass unchanged")

    if "tabindex" not in js or 'ev.detail.aurora_sheet' not in js:
        findings.append("aurora-effects.js: tappable cards are not made focusable / no ll-custom sheet handler")
    checked.append("helper focuses tappable cards and answers the tile sheet event")

    if "--list" in sys.argv:
        for c in checked:
            print("ok  ", c)
    for f in findings:
        print("FAIL", f)
    print("%d finding(s)" % len(findings))
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
