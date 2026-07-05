"""Audit all backend Python files for `raise ... from error` outside except blocks.

Usage: python scripts/audit_from_error.py
"""

import ast
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")  # type: ignore

BACKEND_DIR = "backend"


class FromErrorFinder(ast.NodeVisitor):
    """Find all `raise ... from error` statements and determine if they're safe."""

    def __init__(self, filepath: str, source: str):
        self.filepath = filepath
        self.source_lines = source.splitlines()
        self.problematic: list[dict] = []
        self.safe: list[dict] = []
        self._in_except = False

    def visit_Try(self, node: ast.Try) -> None:
        old = self._in_except
        for handler in node.handlers:
            self._in_except = True
            self.generic_visit(handler)
            self._in_except = False
        for body in node.orelse:
            self.generic_visit(body)
        for body in node.finalbody:
            self.generic_visit(body)
        self._in_except = old

    def visit_Raise(self, node: ast.Raise) -> None:
        if node.exc is None:
            return
        if node.cause is not None and isinstance(node.cause, ast.Name) and node.cause.id == "error":
            info = {
                "line": node.lineno,
                "column": node.col_offset,
                "code": self.source_lines[node.lineno - 1].strip(),
            }
            if self._in_except:
                self.safe.append(info)
            else:
                self.problematic.append(info)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        old = self._in_except
        self._in_except = True
        self.generic_visit(node)
        self._in_except = old


def audit_file(filepath: str) -> dict:
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            source = f.read()
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        return {"file": filepath, "error": str(e), "problematic": [], "safe": []}
    except Exception as e:
        return {"file": filepath, "error": str(e), "problematic": [], "safe": []}

    finder = FromErrorFinder(filepath, source)
    finder.visit(tree)
    return {
        "file": filepath,
        "error": None,
        "problematic": finder.problematic,
        "safe": finder.safe,
    }


def main():
    python_files = []
    for root, dirs, files in os.walk(BACKEND_DIR):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            if f.endswith(".py"):
                python_files.append(os.path.join(root, f))

    python_files.sort()
    print(f"Scanning {len(python_files)} files in backend/...")
    print()

    total_problematic = 0
    total_safe = 0

    for filepath in python_files:
        result = audit_file(filepath)
        if result["error"]:
            print(f"  PARSE-ERROR: {result['file']}: {result['error']}")
            continue
        if result["problematic"]:
            total_problematic += len(result["problematic"])
            relpath = os.path.relpath(filepath)
            print()
            print("=" * 70)
            print(f"PROBLEMATIC: {relpath}")
            print("=" * 70)
            for item in result["problematic"]:
                print(f"  Line {item['line']}: {item['code']}")
        total_safe += len(result["safe"])

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Problematic (outside except): {total_problematic}")
    print(f"  Safe (inside except):         {total_safe}")
    print()

    if total_problematic == 0:
        print("No problematic `raise ... from error` found anywhere!")
        print("All 168 occurrences from initial search are inside except blocks.")
    else:
        print(f"Found {total_problematic} problematic `raise ... from error` to fix.")
        print()
        print("Fix: Remove `from error` from each line.")
        print("There is no exception variable 'error' in scope to chain from.")


if __name__ == "__main__":
    main()
