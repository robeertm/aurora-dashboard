import json
import os
import sys
import unittest

from tests.helpers import FIX, ROOT, read

sys.path.insert(0, os.path.join(ROOT, "scripts"))
import check_commit_identity as cci  # noqa: E402

CASES = json.loads(read(os.path.join(FIX, "identity_cases.json")))


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
