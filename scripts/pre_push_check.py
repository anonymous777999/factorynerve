"""Pre-push validation script.

Run this before pushing to GitHub to catch issues locally.
Usage: python scripts/pre_push_check.py

Checks performed:
  1. Backend dependency check     (scripts/check_deps.py)
  2. Migration naming lint        (scripts/lint_migrations.py)
  3. Frontend build + typecheck   (npm run build)
  4. Frontend lint summary        (npm run lint)

Note: Backend pytest requires a PostgreSQL database and is not included
here. Run manually when you have a local PG instance:
    set DATABASE_URL=postgresql+psycopg2://user:pass@localhost/dbname
    python -m pytest -q -x

Prerequisites:
  - pre-commit: pip install pre-commit && pre-commit install
  - Node deps: cd web && npm install
  - Python deps: pip install -r requirements.txt
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = PROJECT_ROOT / "web"


_BAR = "=" * 60


def _run(cmd: list[str], cwd: str | None = None, label: str = "") -> bool:
    """Run a command and return True if it succeeded."""
    label = label or cmd[0]
    print(f"\n{_BAR}")
    print(f"  [{label}] Running: {' '.join(cmd)}")
    print(_BAR)
    result = subprocess.run(cmd, cwd=cwd or str(PROJECT_ROOT))
    if result.returncode != 0:
        print(f"  FAIL [{label}] (exit code {result.returncode})")
    else:
        print(f"  PASS [{label}]")
    return result.returncode == 0


def _parse_eslint_counts(text: str) -> tuple[int, int]:
    """Extract error/warning counts from ESLint summary line.

    The summary looks like: "X problems (Y errors, Z warnings)"
    """
    for line in text.splitlines():
        stripped = line.strip()
        if "problems" in stripped and ("errors" in stripped or "warnings" in stripped):
            parts = stripped.split()
            errors = 0
            warnings = 0
            for i, p in enumerate(parts):
                if p == "errors" and i > 0:
                    try:
                        errors = int(parts[i - 1])
                    except ValueError:
                        pass
                elif p == "warnings" and i > 0:
                    try:
                        warnings = int(parts[i - 1])
                    except ValueError:
                        pass
            return errors, warnings
    return 0, 0


def main() -> int:
    print(_BAR)
    print("  PRE-PUSH VALIDATION")
    print(_BAR)

    results: list[tuple[str, bool]] = []

    # --- Check 1: Backend dependency check -----------------------------
    ok = _run(
        [sys.executable, "scripts/check_deps.py"],
        label="deps-check",
    )
    results.append(("Backend dependency check", ok))

    # --- Check 2: Migration lint --------------------------------------
    ok = _run(
        [sys.executable, "scripts/lint_migrations.py"],
        label="migration-lint",
    )
    results.append(("Migration naming lint", ok))

    # --- Check 3: Frontend build (typecheck + compile) ----------------
    ok = _run(
        ["npm", "run", "build"],
        cwd=str(WEB_DIR),
        label="frontend-build",
    )
    results.append(("Frontend build (typecheck)", ok))

    # --- Check 4: Frontend lint (summary only, not blocking) ---------
    print(f"\n{_BAR}")
    print("  [frontend-lint] Running: npm run lint")
    print(_BAR)
    lint_result = subprocess.run(
        ["npm", "run", "lint"],
        cwd=str(WEB_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    errors, warnings = _parse_eslint_counts(lint_result.stdout)
    print(f"  Lint results: {errors} errors, {warnings} warnings")
    if lint_result.returncode != 0:
        print(f"  Lint found issues (CI blocks on errors with --max-warnings=0)")
    else:
        print(f"  Lint passed with 0 errors")
    results.append(("Frontend lint (non-blocking)", lint_result.returncode == 0))

    # --- Summary ------------------------------------------------------
    print(f"\n{_BAR}")
    print("  SUMMARY")
    print(_BAR)
    all_ok = True
    for name, ok in results:
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}]  {name}")
        if not ok:
            all_ok = False

    print(f"\n{_BAR}")
    if all_ok:
        print("  ALL CHECKS PASSED - safe to push!")
        print(_BAR)
        return 0
    else:
        print("  SOME CHECKS FAILED - review output above before pushing")
        print(_BAR)
        return 1


if __name__ == "__main__":
    sys.exit(main())
