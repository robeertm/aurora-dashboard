"""Syntax, version and hygiene checks on the shipped files (what the release gate also runs)."""
import glob
import json
import os
import re
import shutil
import subprocess
import unittest

import yaml

from tests.helpers import ROOT, make_tree, read

NODE = shutil.which("node")


class Syntax(unittest.TestCase):
    def test_yaml_files_parse(self):
        files = ["dashboard/aurora.yaml", "packages/aurora_helpers.yaml"] + sorted(
            os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "themes", "*.yaml")))
        self.assertGreater(len(files), 2)
        for f in files:
            with self.subTest(f):
                self.assertTrue(yaml.safe_load(read(os.path.join(ROOT, f))))

    def test_hacs_json(self):
        self.assertIn("name", json.loads(read(os.path.join(ROOT, "hacs.json"))))

    @unittest.skipUnless(NODE, "node not installed")
    def test_js_syntax_ok(self):
        r = subprocess.run([NODE, "--check", os.path.join(ROOT, "dist", "aurora-effects.js")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    @unittest.skipUnless(NODE, "node not installed")
    def test_js_syntax_error_is_caught(self):
        tree = make_tree()
        self.addCleanup(shutil.rmtree, tree, True)
        p = os.path.join(tree, "dist", "aurora-effects.js")
        with open(p, "a", encoding="utf-8") as f:
            f.write("\nfunction (((\n")
        r = subprocess.run([NODE, "--check", p], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)


class Version(unittest.TestCase):
    def test_three_places_agree(self):
        js = read(os.path.join(ROOT, "dist", "aurora-effects.js"))
        cl = read(os.path.join(ROOT, "CHANGELOG.md"))
        const = re.search(r'const AE_VERSION = "(\d+\.\d+\.\d+)"', js).group(1)
        head = re.search(r"^ \* v(\d+\.\d+\.\d+) ", js, re.M).group(1)
        top = re.search(r"^## (\d+\.\d+\.\d+)\s*$", cl, re.M).group(1)
        self.assertEqual(const, head)
        self.assertEqual(const, top)


class Hygiene(unittest.TestCase):
    def test_no_private_instance_or_backups_tracked(self):
        out = subprocess.run(["git", "-C", ROOT, "ls-files", "dashboard/aurora-robert*", "*.bak*"],
                             capture_output=True, text=True).stdout.split()
        self.assertEqual(out, [])

    def test_no_addresses_in_shipped_yaml(self):
        for f in ("dashboard/aurora.yaml", "packages/aurora_helpers.yaml"):
            text = read(os.path.join(ROOT, f))
            with self.subTest(f):
                self.assertIsNone(re.search(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", text))
                self.assertIsNone(re.search(r"[\w.+-]+@[\w-]+\.\w+", text))


if __name__ == "__main__":
    unittest.main()
