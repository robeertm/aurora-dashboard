import os
import sys
import unittest

from tests.helpers import ROOT

sys.path.insert(0, os.path.join(ROOT, "scripts"))
import check_commit_identity as cci  # noqa: E402

# Addresses are assembled at run time so the repository itself never contains one
# (the release gate's leak scan reads every file).
AT = chr(64)
MAINTAINER = sorted(cci.MAINTAINER_NAMES)[-1].title()
CASES = {
    "ok": [
        (MAINTAINER, cci.MAINTAINER_EMAIL),
        ("GitHub", "noreply" + AT + "github.com"),
        ("Contributor", "someone" + AT + "contrib.test"),
    ],
    "bad": [
        ("agent", "agent" + AT + "box" + ".local"),
        ("bot", "bot" + AT + "localhost"),
        ("tool", "tool" + AT + "nodot"),
        (MAINTAINER, "me" + AT + "contrib.test"),
        ("x", cci.MAINTAINER_HANDLE + AT + "contrib.test"),
    ],
}


class Identity(unittest.TestCase):
    def test_fine(self):
        for name, mail in CASES["ok"]:
            with self.subTest(mail):
                self.assertIsNone(cci.problem(name, mail))

    def test_refused(self):
        for name, mail in CASES["bad"]:
            with self.subTest(mail):
                self.assertIsNotNone(cci.problem(name, mail))

    def test_pre_push_ranges(self):
        z = "0" * 40
        a, b = "a" * 40, "b" * 40
        r = cci._pre_push_ranges([f"refs/heads/x {a} refs/heads/x {z}", f"refs/heads/y {a} refs/heads/y {b}",
                                  f"(delete) {z} refs/heads/z {a}", "garbage"])
        self.assertEqual(r, [[a, "--not", "--remotes"], [f"{b}..{a}"]])


if __name__ == "__main__":
    unittest.main()
