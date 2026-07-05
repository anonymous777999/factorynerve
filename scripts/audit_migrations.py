"""Audit the full Alembic migration chain for down_revision/revision ID mismatches."""

import ast
import os
import re

VERSIONS_DIR = "alembic/versions"


def extract_revision_info(filepath: str) -> dict | None:
    """Parse revision and down_revision from a migration file using AST."""
    with open(filepath, "r", encoding="utf-8") as fh:
        content = fh.read()

    # Try AST first for reliable parsing
    try:
        tree = ast.parse(content)
        revisions = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id in ("revision", "down_revision"):
                        revisions[target.id] = ast.literal_eval(node.value) if isinstance(node.value, ast.Constant) else _ast_value(node.value)
            elif isinstance(node, ast.AnnAssign):
                if isinstance(node.target, ast.Name) and node.target.id in ("revision", "down_revision"):
                    if node.value:
                        revisions[node.target.id] = ast.literal_eval(node.value) if isinstance(node.value, ast.Constant) else _ast_value(node.value)
                    else:
                        revisions[node.target.id] = None

        if "revision" in revisions:
            return revisions
    except SyntaxError:
        pass

    # Fallback: regex for files where AST fails
    rev = None
    down_rev = None

    for line in content.splitlines():
        stripped = line.strip()
        # Skip comments
        if stripped.startswith("#"):
            continue

        # Match revision = "..." or revision = '...'
        m = re.match(r"(?:revision)\s*(?::\s*(?:\w+(?:\[\w+(?:,\s*\w+)?\])?\s+)?)?=\s*[\"']([^\"']+)[\"']", stripped)
        if m:
            rev = m.group(1)

        # Match down_revision = "..." or down_revision = (...) or down_revision = None
        m = re.match(r"(?:down_revision)\s*(?::\s*(?:\w+(?:\[\w+(?:,\s*\w+)?\])?\s+)?)?=\s*(.*)", stripped)
        if m:
            rest = m.group(1).strip()
            if rest.startswith("("):
                # Tuple: extract all string literals
                items = re.findall(r"[\"']([^\"']+)[\"']", rest)
                if items:
                    down_rev = tuple(items)
                else:
                    down_rev = None
            elif rest.startswith("None"):
                down_rev = None
            elif rest.startswith("\"") or rest.startswith("'"):
                down_rev = re.search(r"[\"']([^\"']+)[\"']", rest)
                down_rev = down_rev.group(1) if down_rev else None
            elif rest.startswith("("):
                down_rev = tuple()  # Empty tuple
            else:
                down_rev = None

    if rev:
        return {"revision": rev, "down_revision": down_rev}
    return None


def _ast_value(node):
    """Extract value from an AST node."""
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Tuple):
        return tuple(ast.literal_eval(el) if isinstance(el, ast.Constant) else str(el.s) for el in node.elts if isinstance(el, (ast.Constant, ast.Str)))
    if isinstance(node, ast.Str):
        return node.s
    if isinstance(node, ast.NameConstant):
        return None if node.value is None else node.value
    if isinstance(node, ast.Name) and node.id == "None":
        return None
    return None


def main():
    files = sorted([f for f in os.listdir(VERSIONS_DIR) if f.endswith(".py") and not f.startswith("__")])

    # Build revision lookup: revision_id -> {file, down_revision}
    revisions = {}  # revision_id -> info
    filestems = {}  # filestem -> revision_id
    parse_errors = []

    print("=" * 80)
    print("MIGRATION CHAIN AUDIT")
    print("=" * 80)

    for f in files:
        filepath = os.path.join(VERSIONS_DIR, f)
        filestem = f[:-3]  # remove .py

        try:
            info = extract_revision_info(filepath)
        except Exception as e:
            parse_errors.append((f, str(e)))
            print(f"  ⚠ {f:55s} PARSE ERROR: {e}")
            continue

        if info is None:
            parse_errors.append((f, "Could not extract revision"))
            print(f"  ⚠ {f:55s} PARSE ERROR: Could not extract revision")
            continue

        rev = info["revision"]
        down = info["down_revision"]

        revisions[rev] = {"file": filestem, "down_revision": down}
        filestems[filestem] = rev

        print(f"  {filestem:55s} rev={rev!r:25s} down={down!r}")

    print()
    print("=" * 80)
    print("REVISION CHAIN VERIFICATION")
    print("=" * 80)
    print()

    # Build edge list: child -> list of parents
    edges = []
    for rev, info in revisions.items():
        down = info["down_revision"]
        if down is not None:
            if isinstance(down, tuple):
                for d in down:
                    edges.append((rev, d, info["file"]))
            else:
                edges.append((rev, down, info["file"]))

    # Check each edge
    issues = []
    resolved = []

    for child_rev, parent_ref, child_file in edges:
        if parent_ref in revisions:
            # Direct match by revision ID
            parent_file = revisions[parent_ref]["file"]
            if parent_ref != parent_file and parent_ref != filestems.get(parent_file):
                # Reference is neither the revision ID nor a filestem
                issues.append(f"❌ {child_file}: parent ref '{parent_ref}' is ambiguous (rev ID but doesn't match parent file stem)")
            else:
                resolved.append(f"✅ {child_file}: '{parent_ref}' → '{parent_ref}' (revision ID match)")
        elif parent_ref in filestems:
            parent_rev = filestems[parent_ref]
            issues.append(f"⚠️ {child_file}: uses filestem '{parent_ref}' instead of revision ID '{parent_rev}' (works but inconsistent)")
        else:
            # Check if it looks like a short revision ID
            matching_stems = [s for s, r in filestems.items() if r == parent_ref]
            if matching_stems:
                issues.append(f"❌ {child_file}: parent ref '{parent_ref}' not found in [revisions, filestems] despite having matching files: {matching_stems}")
            else:
                issues.append(f"❌ {child_file}: parent ref '{parent_ref}' completely orphaned — no matching revision or filestem found")

    print()
    if issues:
        print(f"Found {len(issues)} issue(s):")
        print()
        for issue in issues:
            print(f"  {issue}")
    else:
        print("  ✅ No issues found!")

    # Print the resolved ones for context
    print()
    print("Resolved references:")
    for r in resolved:
        print(f"  {r}")

    print()
    print(f"\nSummary: {len(revisions)} revisions, {len(issues)} issues, {len(parse_errors)} parse errors")


if __name__ == "__main__":
    main()
