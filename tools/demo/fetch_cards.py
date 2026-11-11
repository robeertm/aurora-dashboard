#!/usr/bin/env python3
"""Download the third-party frontend cards the dashboard needs into ./cache/www.

The versions are pinned below, so the demo renders the same way every time.
Nothing here is installed on any real Home Assistant: the files only ever
land in the throwaway demo instance (see demo.sh).
"""
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "cache", "www")

# name -> (repo, tag, [(asset, url-template)]) ; {r}=repo {t}=tag
REL = "https://github.com/{r}/releases/download/{t}/{a}"
RAW = "https://raw.githubusercontent.com/{r}/{t}/{a}"
CARDS = {
    "button-card": ("custom-cards/button-card", "v7.0.1", [("button-card.js", REL)]),
    "apexcharts-card": ("RomRider/apexcharts-card", "v2.2.3", [("apexcharts-card.js", REL)]),
    "mini-graph-card": ("kalkih/mini-graph-card", "v0.13.0", [("mini-graph-card-bundle.js", REL)]),
    "auto-entities": ("thomasloven/lovelace-auto-entities", "v1.16.1", [("auto-entities.js", RAW)]),
    "stack-in-card": ("custom-cards/stack-in-card", "0.2.0", [("stack-in-card.js", REL)]),
    "mushroom": ("piitaya/lovelace-mushroom", "v5.2.3", [("mushroom.js", REL)]),
    "clock-weather-card": ("pkissling/clock-weather-card", "v3.1.0", None),  # many chunks
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "aurora-demo-fetch"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    lock = {}
    for name, (repo, tag, files) in CARDS.items():
        d = os.path.join(OUT, name)
        os.makedirs(d, exist_ok=True)
        if files is None:  # list the release assets through the API
            api = json.loads(get("https://api.github.com/repos/%s/releases/tags/%s" % (repo, tag)))
            files = [(a["name"], a["browser_download_url"]) for a in api["assets"]]
            files = [(n, u.replace("{", "{{")) for n, u in files]
        for asset, tmpl in files:
            dest = os.path.join(d, asset)
            if not os.path.exists(dest) or os.path.getsize(dest) == 0:
                url = tmpl.format(r=repo, t=tag, a=asset) if "{r}" in tmpl else tmpl
                body = get(url)
                if not body:
                    raise SystemExit("empty download: " + url)
                with open(dest + ".part", "wb") as f:   # never leave a half file behind
                    f.write(body)
                os.replace(dest + ".part", dest)
            lock["%s/%s" % (name, asset)] = hashlib.sha256(open(dest, "rb").read()).hexdigest()[:16]
        print("ok", name, tag, file=sys.stderr)
    with open(os.path.join(HERE, "cache", "cards.lock.json"), "w") as f:
        json.dump(lock, f, indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
