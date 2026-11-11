#!/usr/bin/env python3
"""Visual regression check: compare fresh shots (out/) with docs/screenshots/.

    compare.py            report, exit 1 if a view changed more than the limit
    compare.py --diff     also write out/diff-<name>.png (changed pixels in red)

The clock, the sun and the clouds move between runs, so a small share of
changed pixels is normal; a card that moved, vanished or broke changes a lot.
Phone images are compared after scaling to the stored width.
"""
import os
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
REF = os.path.abspath(os.path.join(HERE, "..", "..", "docs", "screenshots"))
LIMIT = 0.06      # share of pixels that may differ strongly
LEVEL = 48        # per-channel difference that counts as "strong"


def main():
    want_diff = "--diff" in sys.argv
    bad = 0
    for name in sorted(os.listdir(OUT)):
        if not name.endswith(".png") or name.startswith("diff-"):
            continue
        ref = os.path.join(REF, name)
        if not os.path.exists(ref):
            print("%-20s no reference" % name)
            continue
        a = Image.open(os.path.join(OUT, name)).convert("RGB")
        b = Image.open(ref).convert("RGB")
        if a.size != b.size:
            a = a.resize(b.size, Image.LANCZOS)
        d = ImageChops.difference(a, b).convert("L")
        strong = d.point(lambda v: 255 if v > LEVEL else 0)
        share = strong.histogram()[255] / float(d.size[0] * d.size[1])
        flag = "CHANGED" if share > LIMIT else "ok"
        bad += share > LIMIT
        print("%-20s %5.2f %% strongly different  %s" % (name, share * 100, flag))
        if want_diff:
            red = Image.new("RGB", a.size, (255, 0, 0))
            Image.composite(red, b, strong).save(os.path.join(OUT, "diff-" + name))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
