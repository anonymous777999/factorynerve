"""Lint script: flag .all() calls that lack .limit() or date-based filters.

Detects SQLAlchemy query patterns where `.all()` is called on a query that
does not have an explicit `.limit(...)` constraint or a date-based WHERE filter.
These unbounded queries can cause OOM crashes on large tables.

Known limitations:
- Date filters using `and_()`, `or_()`, or nested `func.*()` inside
  `.filter()` may not be detected (regex uses `[^)]*` which breaks on
  nested parens).  Such patterns are rare for date-bounding queries.
- Query chains stored in intermediate variables (not direct chaining)
  are detected via backward line scan, which is heuristic.

Usage:
    python scripts/lint_unbounded_queries.py                          # scan backend/ recursively
    python scripts/lint_unbounded_queries.py backend/routers/steel.py  # scan single file

Exit code:
    0 -- no unbounded queries found
    1 -- unbounded queries found
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Patterns that indicate a query is bounded
# ---------------------------------------------------------------------------

# A .limit(N) call somewhere in the chain
RE_HAS_LIMIT = re.compile(r"\.limit\s*\(")

# A date-based filter — any column name containing "date" or "_at" compared
# with ==, >=, <=, >, < in a .filter(...) call
RE_DATE_FILTER = re.compile(
    r"""\.filter\s*\(
        [^)]*?                    # inside the filter call (non-greedy)
        (?:                       # look for:
            \bdate\b              #   bare "date" keyword
            |\.date\b             #   .date attribute
            |_date\b              #   column_name_date
            |_at\b                #   created_at, updated_at, …
        )
        \s*                       # optional whitespace
        (?:==|>=|<=|>|<|!=)       # comparison operator
    """,
    re.VERBOSE | re.IGNORECASE,
)

# A filter on a primary-key or foreign-key column that limits to a
# small-ish number of rows (.filter(Model.id == x) or .filter(Model.id.in_(…)))
RE_ID_FILTER = re.compile(
    r"""\.filter\s*\(
        [^)]*?
        (?:
            \.(?:id|_id)\s*(?:==|=|!=|\.in_\s*\()     # Model.id ==  or  Model.col._id ==
            |
            _id\s*(?:==|=|!=|\.in_\s*\()               # col_id ==  or  col_id.in_(
        )
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Single-file mode: if a path is passed, use it directly
if len(sys.argv) > 1:
    targets = [Path(sys.argv[1])]
else:
    targets = [Path("backend")]


def _collect_py_files(root: Path) -> list[Path]:
    """Yield all .py files under *root*."""
    if root.is_file():
        return [root] if root.suffix == ".py" else []
    return sorted(root.rglob("*.py"))


def _is_ast_annotated(s: str) -> bool:
    """Return True when *s* contains a `# lint-unbounded-ok` marker."""
    return "# lint-unbounded-ok" in s or "# noqa" in s


def _find_all_call_on_line(line: str, col_offset: int = 0) -> int | None:
    """Return the column offset of ``.all()`` on *line*, or None."""
    # We look for `.all(` not followed by anything inside the parens
    # (it's always `.all()` with no args in SQLAlchemy)
    m = re.search(r"\.all\s*\(\s*\)", line[col_offset:])
    return m.start() + col_offset if m else None


def _concatenate_chunk(chunk: list[str], end_idx: int) -> str:
    """Join lines 0..*end_idx* into a single string so that multi-line
    expressions (e.g. ``.filter(\n    col >= value\n)``) are detected
    correctly by single-line regex patterns."""
    return " ".join(chunk[: end_idx + 1])


def _look_back_for_limit(chunk: list[str], all_line_idx: int) -> bool:
    """Return True when a ``.limit(`` call appears in the chain."""
    combined = _concatenate_chunk(chunk, all_line_idx)
    return bool(RE_HAS_LIMIT.search(combined))


def _look_back_for_date_filter(chunk: list[str], all_line_idx: int) -> bool:
    """Return True when a date-based filter appears in the query chain,
    handling multi-line ``.filter()`` calls correctly."""
    combined = _concatenate_chunk(chunk, all_line_idx)
    return bool(RE_DATE_FILTER.search(combined))


def _look_back_for_id_filter(chunk: list[str], all_line_idx: int) -> bool:
    """Return True when a PK/FK ``.filter()`` appears, handling multi-line
    calls correctly."""
    combined = _concatenate_chunk(chunk, all_line_idx)
    return bool(RE_ID_FILTER.search(combined))


def _look_back_for_query_construction(chunk: list[str], all_line_idx: int) -> int | None:
    """Find the index (in *chunk*) where the ``db.query(`` or ``Model.query``
    chain starts, by scanning backward from *all_line_idx*."""
    for i in range(all_line_idx, -1, -1):
        line = chunk[i].strip()
        if line.startswith("db.query(") or ".query(" in line:
            return i
        # Lines that start with `.`, `)`, or end with `(` or contain `= (`
        # are continuations of a chained expression or assignment wrapper.
        if line.startswith(".") or line.startswith(")"):
            continue
        if line.rstrip().endswith("(") or "= (" in line or "=(" in line:
            continue
    return None


def _context_near(lines: list[str], lineno: int, context: int = 5) -> str:
    """Return a snippet of source lines around *lineno* (1-based)."""
    start = max(0, lineno - 1 - context)
    end = min(len(lines), lineno + context)
    out: list[str] = []
    for i in range(start, end):
        prefix = ">" if i == lineno - 1 else " "
        out.append(f"  {prefix} {i+1:>6}:{lines[i].rstrip()}")
    return "\n".join(out)


def check_file(path: Path) -> list[dict[str, Any]]:
    """Scan *path* and return a list of diagnostic dicts.

    Each dict has keys: file, line, col, message, context.
    """
    diagnostics: list[dict[str, Any]] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        print(f"  [WARN] Cannot read {path}: {exc}", file=sys.stderr)
        return diagnostics

    lines = text.splitlines(keepends=False)

    for lineno, line in enumerate(lines, start=1):
        # 1 — check for the annotation marker
        if _is_ast_annotated(line):
            continue

        # 2 — find `.all()` on this line
        col = _find_all_call_on_line(line)
        if col is None:
            continue

        # 3 — collect the "query chain chunk" — lines that belong to this
        #     query.  Walk backward to find `db.query(` or `Model.query(`.
        chain_start = max(0, lineno - 15)  # generous upper bound
        chunk = lines[chain_start - 1 : lineno]  # 0-based slice
        all_idx = lineno - chain_start  # index of .all() within chunk

        qs_idx = _look_back_for_query_construction(chunk, all_idx)
        if qs_idx is not None:
            # Narrow the chunk to just the query expression
            chunk = chunk[qs_idx:]
            all_idx_inner = all_idx - qs_idx
        else:
            # Couldn't find a `db.query(` — might be a secondary query that
            # uses `in_()` ids.  Still check it, but treat the whole window.
            all_idx_inner = all_idx

        # 4 — check for bounding patterns
        has_limit = _look_back_for_limit(chunk, all_idx_inner)
        has_date_filter = _look_back_for_date_filter(chunk, all_idx_inner)
        has_id_filter = _look_back_for_id_filter(chunk, all_idx_inner)
        has_group_by = ".group_by(" in _concatenate_chunk(chunk, all_idx_inner)

        # 5 — skip if bounded by limit, date filter, or aggregation
        if has_limit or has_date_filter or has_group_by:
            continue

        # 6 — if the query filters by primary/foreign key (id == X or id.in_(…)),
        #     it's bounded to a small number of rows — skip.
        if has_id_filter:
            continue

        # If it's `SELECT 1` / `.first()` we already limited, but .all() on a
        # very narrow filter is usually fine.
        # Additional heuristics: check if the query is on a "small" model
        # (known reference/lookup tables).  We keep this simple for now.

        # Report
        snippet = _context_near(lines, lineno, context=8)
        diagnostics.append(
            {
                "file": str(path),
                "line": lineno,
                "col": col + 1,
                "message": "Unbounded `.all()` call — add `.limit(N)` or a date-based `.filter()` to prevent OOM",
                "context": snippet,
            }
        )

    return diagnostics


def _format_lint(diag: dict[str, Any]) -> str:
    """Standard lint-style output: ``file:line:col: error: message``."""
    return (
        f"{diag['file']}:{diag['line']}:{diag['col']}: "
        f"error: {diag['message']}\n"
        f"{diag['context']}\n"
    )


def main() -> int:
    # Handle Windows console encoding (CP437/CP850 can't print many Unicode chars)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass  # older Python or pipe mode — fall through

    all_diagnostics: list[dict[str, Any]] = []
    files_scanned = 0

    for target in targets:
        for py_file in _collect_py_files(target):
            # Skip virtualenvs, node_modules, test dirs
            rel = py_file.relative_to(py_file.anchor) if py_file.is_absolute() else py_file
            parts = rel.parts
            if any(
                skip in parts
                for skip in (".venv", "venv", "env", "node_modules", "__pycache__", ".git", ".mypy_cache", ".pytest_cache")
            ):
                continue
            # Skip actual test files
            if any(p.startswith("test_") or p.endswith("_test.py") for p in parts[-2:]):
                continue

            files_scanned += 1
            diagnostics = check_file(py_file)
            all_diagnostics.extend(diagnostics)

    # Print results
    print(f"Scanned {files_scanned} files — {len(all_diagnostics)} unbounded `.all()` calls found.\n")

    if not all_diagnostics:
        print("[OK]  No unbounded query calls detected.")
        return 0

    all_diagnostics.sort(key=lambda d: (d["file"], d["line"]))
    for diag in all_diagnostics:
        print(_format_lint(diag))

    print(
        f"\n{'=' * 60}\n"
        f"To suppress a specific call, append  `  # lint-unbounded-ok`\n"
        f"to the line with `.all()`, or refactor to add `.limit(N)` / a date filter.\n"
        f"{'=' * 60}"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
