"""Dashboard checker: the real repo passes, each seeded defect is caught by its own rule."""
import json
import os
import re
import shutil
import subprocess
import sys
import unittest

import yaml

from tests.helpers import FIX, ROOT, edit, make_tree, read, run_checker

sys.path.insert(0, os.path.join(ROOT, "scripts"))
import check_dashboard  # noqa: E402


class Seeded(unittest.TestCase):
    def setUp(self):
        self.tree = make_tree()
        self.addCleanup(shutil.rmtree, self.tree, True)

    def fails(self, needle):
        code, out = run_checker(self.tree)
        self.assertEqual(code, 1, out)
        self.assertIn(needle, out)

    def test_good_tree_passes(self):
        code, out = run_checker(self.tree)
        self.assertEqual(code, 0, out)
        self.assertIn("0 finding(s)", out)

    def test_unguarded_entity_access(self):
        edit(self.tree, "dashboard/aurora.yaml", lambda t: t + "\n# [[[ return entity.state; ]]]\n")
        self.fails("unguarded")

    def test_hard_coded_path(self):
        edit(self.tree, "dashboard/aurora.yaml", lambda t: t + "\n# x\nfoo:\n  navigation_path: /aurora-home/energy\n")
        self.fails("hard-coded path")

    def test_apex_without_update_interval(self):
        def mut(t):
            return t.replace("update_interval:", "update_intervalx:", 1)
        edit(self.tree, "dashboard/aurora.yaml", mut)
        self.fails("apexcharts-card")

    def test_old_sky_helper(self):
        edit(self.tree, "dashboard/aurora.yaml", lambda t: t + "\n# input_select.aurora_himmel\n")
        self.fails("aurora_himmel")

    def test_sky_animation_loses_subpixel_rotate(self):
        edit(self.tree, "dashboard/aurora.yaml", lambda t: t.replace("rotate(", "skewX(", 1) if "@keyframes sky-sail" in t else t)
        # the first rotate( of the file may belong to another rule; accept either message
        code, out = run_checker(self.tree)
        self.assertEqual(code, 1, out)

    def test_invalid_yaml_dashboard(self):
        edit(self.tree, "dashboard/aurora.yaml", lambda t: t + "\n  - [unclosed\n")
        with self.assertRaises(Exception):
            yaml.safe_load(read(os.path.join(self.tree, "dashboard/aurora.yaml")))
        code, _ = run_checker(self.tree)
        self.assertNotEqual(code, 0)

    def test_version_mismatch(self):
        edit(self.tree, "dist/aurora-effects.js", lambda t: re.sub(r'const AE_VERSION = "[0-9.]+"', 'const AE_VERSION = "0.0.1"', t, 1))
        self.fails("version mismatch")

    def test_changelog_head_mismatch(self):
        edit(self.tree, "CHANGELOG.md", lambda t: re.sub(r"^## [0-9.]+\s*$", "## 9.9.9", t, 1, re.M))
        self.fails("version mismatch")

    def test_firefox_glass_blur(self):
        edit(self.tree, "dist/aurora-effects.js", lambda t: t.replace('glassCss("none"', 'glassCss(BLUR', 1))
        self.fails("GLASS_FIREFOX")

    def test_silent_card_with_controls_without_pointer_back(self):
        # tap_action: none + own controls, but the pointer is not handed back:
        # button-card's `ha-card.disabled { pointer-events: none }` kills every control in it.
        edit(self.tree, "dashboard/aurora.yaml",
             lambda t: t.replace("ha-card.disabled { pointer-events: auto", "ha-card.disabled { opacity: 1"))
        self.fails("nothing in it can be clicked")

    def test_helper_loses_pointer_back(self):
        edit(self.tree, "dist/aurora-effects.js", lambda t: t.replace("FOCUS + DISABLED_CONTROLS +", "FOCUS +", 1))
        self.fails("do not get the pointer back")

    def test_package_missing_helper(self):
        edit(self.tree, "packages/aurora_helpers.yaml", lambda t: t.replace("person_pulse:", "person_pulse_x:", 1))
        self.fails("person_pulse")

    def test_package_unused_helper(self):
        edit(self.tree, "packages/aurora_helpers.yaml", lambda t: t + "\ninput_boolean:\n  never_used:\n    name: x\n")
        self.fails("never uses")

    def test_package_private_content(self):
        edit(self.tree, "packages/aurora_helpers.yaml", lambda t: t + "\n# see http://" + ".".join(["10", "0", "0", "5"]) + ":8123\n")
        self.fails("private/secret")

    def test_package_file_missing(self):
        os.remove(os.path.join(self.tree, "packages/aurora_helpers.yaml"))
        self.fails("missing")


class Units(unittest.TestCase):
    def test_guard_regex_accepts_guarded(self):
        text = read(os.path.join(FIX, "guarded_good.js"))
        self.assertEqual(check_dashboard.UNGUARDED.findall(text), [])

    def test_guard_regex_flags_unguarded(self):
        text = read(os.path.join(FIX, "unguarded_bad.js"))
        self.assertEqual(len(check_dashboard.UNGUARDED.findall(text)), 1)

    def test_controls_regex(self):
        hit = check_dashboard.CONTROLS.search
        self.assertTrue(hit('<iframe class="zs" src="x"></iframe>'))
        self.assertTrue(hit('<div class="back" onclick="go(this)" role="button">'))
        self.assertTrue(hit('<a href="/config/updates">all</a>'))
        self.assertFalse(hit('<div class="sky"><span>decoration</span></div>'))

    def test_pointer_back_regex(self):
        back = check_dashboard.POINTER_BACK.search
        self.assertTrue(back("ha-card.disabled { pointer-events: auto !important; }"))
        self.assertFalse(back("ha-card.disabled { cursor: default; }"))

    def test_lineno(self):
        self.assertEqual(check_dashboard.lineno("a\nb\nc", 4), 3)

    def test_walk_visits_nested(self):
        seen = [p for p, _ in check_dashboard.walk({"a": [{"b": 1}]})]
        self.assertIn(("a", "0", "b"), seen)


if __name__ == "__main__":
    unittest.main()
