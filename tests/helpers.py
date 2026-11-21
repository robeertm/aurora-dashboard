"""Shared helpers: copy the checked files into a temp tree, seed a defect, run the checker."""
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIX = os.path.join(os.path.dirname(__file__), "fixtures")
CHECKER = os.path.join(ROOT, "scripts", "check_dashboard.py")
TRACKED = ("dashboard", "dist", "packages", "themes", "CHANGELOG.md", "hacs.json")


def make_tree():
    tmp = tempfile.mkdtemp(prefix="aurora-test-")
    for name in TRACKED:
        src = os.path.join(ROOT, name)
        dst = os.path.join(tmp, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns("aurora-robert*", "*.bak*"))
        elif os.path.exists(src):
            shutil.copy(src, dst)
    return tmp


def edit(tree, rel, fn):
    p = os.path.join(tree, rel)
    with open(p, encoding="utf-8") as f:
        text = f.read()
    new = fn(text)
    assert new != text, "mutation changed nothing in " + rel
    with open(p, "w", encoding="utf-8") as f:
        f.write(new)


def run_checker(tree):
    env = dict(os.environ, AURORA_ROOT=tree)
    r = subprocess.run([sys.executable, CHECKER], capture_output=True, text=True, env=env, timeout=120)
    return r.returncode, r.stdout


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()
