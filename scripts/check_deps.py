#!/usr/bin/env python3
"""
check_deps.py — Cross-reference requirements.txt against actual Python imports.

Scans all ``.py`` files in the project for third-party import statements,
extracts the top-level package names, and reports any that are missing from
``requirements.txt``.

Usage:
    python scripts/check_deps.py

Exit code:
    0 — all imports are covered by requirements.txt
    1 — one or more imports are missing from requirements.txt
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Packages that are part of the Python stdlib and should be ignored
STDLIB_PACKAGES: set[str] = {
    "abc", "argparse", "ast", "asyncio", "base64", "base",
    "binascii", "calendar", "collections", "concurrent",
    "configparser", "contextlib", "contextvars", "copy",
    "csv", "dataclasses", "datetime", "decimal", "difflib",
    "dis", "email", "enum", "filecmp", "fnmatch", "functools",
    "gc", "getpass", "glob", "gzip", "hashlib", "hmac", "html",
    "http", "importlib", "inspect", "io", "ipaddress",
    "itertools", "json", "keyword", "linecache", "locale",
    "logging", "math", "mimetypes", "mmap", "multiprocessing",
    "netrc", "numbers", "operator", "os", "pathlib", "pickle",
    "pickletools", "platform", "pprint", "queue", "random",
    "re", "reprlib", "runpy", "secrets", "selectors",
    "shlex", "shutil", "signal", "site", "smtplib", "socket",
    "socketserver", "sqlite3", "ssl", "stat", "statistics",
    "string", "struct", "subprocess", "sys", "tarfile",
    "tempfile", "textwrap", "threading", "time", "timeit",
    "tkinter", "token", "tokenize", "trace", "traceback",
    "tracemalloc", "turtle", "types", "typing", "unicodedata",
    "unittest", "urllib", "uuid", "warnings", "weakref",
    "webbrowser", "xml", "xmlrpc", "zipfile", "zipimport",
    "zlib", "zoneinfo",
}

# These packages are imported under a different name than their pip package
PACKAGE_ALIASES: dict[str, str] = {
    "PIL": "Pillow",
    "cv2": "opencv-python-headless",
    "yaml": "PyYAML",
    "bs4": "beautifulsoup4",
    "sklearn": "scikit-learn",
    "dotenv": "python-dotenv",
    "jose": "python-jose",
    "google": "google_generativeai",
    "starlette": "starlette",
}

# Transitive dependencies installed as side-effects of other packages
# (e.g., starlette comes with fastapi)
TRANSITIVE_DEPS: set[str] = {"starlette", "yaml"}

# These packages are only needed for development/testing
DEV_ONLY_IMPORTS: set[str] = {"pytest", "fakeredis"}


def _parse_imports(filepath: Path) -> set[str]:
    """Extract third-party top-level package names from a Python file."""
    try:
        tree = ast.parse(filepath.read_text(encoding="utf-8"))
    except (SyntaxError, UnicodeDecodeError):
        return set()

    packages: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top_level = alias.name.split(".")[0]
                packages.add(top_level)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                top_level = node.module.split(".")[0]
                packages.add(top_level)

    return packages


def _load_requirements(path: Path) -> set[str]:
    """Extract package names from a requirements.txt file (no versions)."""
    packages: set[str] = set()
    if not path.exists():
        return packages
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        pkg = re.split(r"[>=<!~[;]", line)[0].strip()
        if pkg:
            pkg = pkg.split("[")[0].strip()
            packages.add(pkg.lower().replace("-", "_"))
    return packages


def main() -> int:
    req_path = PROJECT_ROOT / "requirements.txt"
    req_packages = _load_requirements(req_path)

    all_imports: dict[str, set[Path]] = {}
    scan_dirs = ["backend", "scripts", "alembic", "tests"]

    for dir_name in scan_dirs:
        dir_path = PROJECT_ROOT / dir_name
        if not dir_path.exists():
            continue
        for pyfile in dir_path.rglob("*.py"):
            if "__pycache__" in str(pyfile):
                continue
            imports = _parse_imports(pyfile)
            for pkg in imports:
                all_imports.setdefault(pkg, set()).add(pyfile)

    missing: list[tuple[str, list[Path]]] = []

    for pkg, files in sorted(all_imports.items()):
        if pkg in STDLIB_PACKAGES:
            continue
        if pkg in DEV_ONLY_IMPORTS:
            continue
        if pkg in ("backend", "tests", "scripts", "alembic", "config", "metrics"):
            continue
        if pkg.startswith("_"):
            continue
        if pkg in TRANSITIVE_DEPS:
            continue

        pip_name = PACKAGE_ALIASES.get(pkg, pkg).lower().replace("-", "_")
        in_req = pip_name in req_packages
        if not in_req:
            in_req = pkg.lower().replace("-", "_") in req_packages

        if not in_req:
            missing.append((pkg, sorted(set(files))))

    if missing:
        print("[FAIL] The following imports are missing from requirements.txt:\n")
        for pkg, files in missing:
            print(f"  - {pkg}")
            for f in files[:5]:
                rel = f.relative_to(PROJECT_ROOT)
                print(f"      {rel}")
            if len(files) > 5:
                print(f"      ... and {len(files) - 5} more")
        print()
        return 1

    print("[PASS] All imports are covered by requirements.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
