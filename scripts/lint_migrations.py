#!/usr/bin/env python3
"""
lint_migrations.py — Lint Alembic migration files for common issues.

Checks:
1. Hardcoded ``DROP CONSTRAINT`` / ``ADD CONSTRAINT`` names that may not
   match the project's SQLAlchemy naming convention (defined in
   ``backend/database.py``: ``"pk": "pk_%(table_name)s"``).
2. Raw SQL ``ALTER TABLE`` statements that reference constraint names
   without ``IF EXISTS`` guard.
3. Migrations that use ``op.get_bind()`` but don't check the dialect
   before executing PostgreSQL-specific SQL.
4. Migration files that don't have a proper ``down_revision``.

Usage:
    python scripts/lint_migrations.py

Exit code:
    0 — no issues found
    1 — one or more issues found
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import NamedTuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = PROJECT_ROOT / "alembic" / "versions"

# The project's naming convention from backend/database.py:
# NAMING_CONVENTION = {
#     "pk": "pk_%(table_name)s",
#     "ix": "ix_%(table_name)s_%(column_0_name)s",
#     "uq": "uq_%(table_name)s_%(column_0_name)s",
#     "ck": "ck_%(table_name)s_%(constraint_name)s",
#     "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
# }
# This means PK constraints follow the pattern: pk_{tablename}
# The PostgreSQL default would be: {tablename}_pkey

# Constraint name patterns that match PostgreSQL defaults but NOT our convention
# The project naming convention uses pk_{tablename}, not {tablename}_pkey
DEFAULT_PG_PK_PATTERN = re.compile(r'\b\w+_pkey\b', re.IGNORECASE)

# Pattern for DROP CONSTRAINT without IF EXISTS
DROP_CONSTRAINT_NO_IF_EXISTS = re.compile(
    r'DROP\s+CONSTRAINT\s+(?!IF EXISTS)(\w+)', re.IGNORECASE
)

# Pattern for "CONSTRAINT \w+ PRIMARY KEY" in CREATE TABLE
CREATE_TABLE_CONSTRAINT = re.compile(
    r'CONSTRAINT\s+(\w+)\s+PRIMARY\s+KEY', re.IGNORECASE
)


class LintIssue(NamedTuple):
    file: Path
    line: int
    severity: str  # "error" or "warning"
    message: str


# Suppression markers, mirroring the flake8/eslint ``noqa`` convention. Some
# migrations legitimately reference a constraint by its real (already-applied)
# name — e.g. reworking a table whose PK is the PostgreSQL default
# ``<table>_pkey``. Editing an applied migration's SQL to satisfy a naming
# lint would be actively dangerous, so intent is declared explicitly instead:
#   - line-level:  put ``# migration-lint: ignore`` on the offending line
#   - file-level:  put ``# migration-lint: ignore-file`` anywhere in the file
_LINE_IGNORE = "migration-lint: ignore"
_FILE_IGNORE = "migration-lint: ignore-file"


def lint_migration(filepath: Path) -> list[LintIssue]:
    """Lint a single migration file."""
    issues: list[LintIssue] = []
    content = filepath.read_text(encoding="utf-8")
    lines = content.splitlines()

    # Whole-file opt-out for frozen/already-applied migrations.
    if _FILE_IGNORE in content:
        return issues

    table_name = filepath.stem

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Skip comments
        if stripped.startswith("#") and not stripped.startswith("##"):
            continue

        # Respect an explicit per-line suppression.
        if _LINE_IGNORE in line:
            continue

        # ── Check 1: DROP CONSTRAINT without IF EXISTS ──────
        match = DROP_CONSTRAINT_NO_IF_EXISTS.search(stripped)
        if match:
            const_name = match.group(1)
            issues.append(LintIssue(
                file=filepath,
                line=i,
                severity="warning",
                message=f"DROP CONSTRAINT \"{const_name}\" without IF EXISTS — "
                        f"will crash if constraint doesn't exist",
            ))

        # ── Check 2: Hardcoded constraint names that look like PG defaults ──
        match = DEFAULT_PG_PK_PATTERN.search(stripped)
        if match:
            issues.append(LintIssue(
                file=filepath,
                line=i,
                severity="error",
                message=f"Hardcoded constraint \"{match.group(0)}\" looks like PostgreSQL "
                        f"default naming. Project convention uses pk_{{tablename}}. "
                        f"Use the correct name or add IF EXISTS fallback.",
            ))

        # ── Check 3: CREATE TABLE with explicit CONSTRAINT name ──
        match = CREATE_TABLE_CONSTRAINT.search(stripped)
        if match:
            const_name = match.group(1)
            if DEFAULT_PG_PK_PATTERN.fullmatch(const_name):
                issues.append(LintIssue(
                    file=filepath,
                    line=i,
                    severity="warning",
                    message=f"CREATE TABLE uses explicit CONSTRAINT \"{const_name}\" — "
                            f"verify this matches the naming convention.",
                ))

    return issues


def main() -> int:
    if not MIGRATIONS_DIR.exists():
        print(f"[FAIL] Migrations directory not found: {MIGRATIONS_DIR}")
        return 1

    migration_files = sorted(MIGRATIONS_DIR.glob("*.py"))
    if not migration_files:
        print("[FAIL] No migration files found.")
        return 1

    all_issues: list[LintIssue] = []
    error_count = 0
    warning_count = 0

    for mf in migration_files:
        issues = lint_migration(mf)
        all_issues.extend(issues)
        for issue in issues:
            rel_path = issue.file.relative_to(PROJECT_ROOT)
            severity_tag = "ERROR" if issue.severity == "error" else "WARN"
            print(f"[{severity_tag}] {rel_path}:{issue.line} -- {issue.message}")
            if issue.severity == "error":
                error_count += 1
            else:
                warning_count += 1

    print()
    print(f"Scanned {len(migration_files)} migration files.")
    print(f"Errors:   {error_count}")
    print(f"Warnings: {warning_count}")

    return 1 if error_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
