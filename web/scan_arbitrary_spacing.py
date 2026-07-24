"""
Phase 4 — Arbitrary Spacing Value Scanner (v2)

Scans all .tsx/.ts files for Tailwind arbitrary value patterns that violate
the semantic spacing governance rule.

Allowed tokens (from tailwind.config.ts):
  spacing: px, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24
           xs, sm, md, lg, xl, 2xl (semantic aliases)
           badge-x, badge-y, cell-x, cell-y, density-gap (density tokens)
  borderRadius: xs, control, panel, overlay, badge
                none, sm, md, lg, xl, 2xl, 3xl, full (Tailwind defaults)

Reported categories:
  - SPACING: p-, px-, py-, pt-, pr-, pb-, pl-, m-, mx-, my-, mt-, mr-, mb-, ml-,
             gap-, gap-x-, gap-y-, space-x-, space-y-
  - BORDER_RADIUS: rounded-
  - SIZING: h-, w-, min-h-, min-w-, max-h-, max-w-
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict

# Handle Windows console encoding
if sys.stdout.encoding and sys.stdout.encoding.upper() not in ("UTF-8", "UTF8"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Allowed numeric spacing tokens
ALLOWED_SPACING = {
    "px", "0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5",
    "4", "5", "6", "7", "8", "9", "10", "12", "14", "16", "20", "24",
    "xs", "sm", "md", "lg", "xl", "2xl",
    "badge-x", "badge-y", "cell-x", "cell-y", "density-gap",
}

# Allowed border-radius tokens
ALLOWED_RADIUS = {
    "none", "xs", "control", "panel", "overlay", "badge",
    "sm", "md", "lg", "xl", "2xl", "3xl", "full",
}

# Scan directories (relative to web/)
SCAN_DIRS = ["src/components", "src/app", "src/features", "src/shared", "src/legacy-ui"]

# Exclude test and story files
EXCLUDE_PATTERNS = (
    r"\.test\.tsx?$",
    r"\.stories\.tsx?$",
    r"\.spec\.tsx?$",
    r"__tests__",
    r"/test_",
)

# Arbitrary value pattern
# Handles: p-[X], px-[X], py-[X], pt-[X], pr-[X], pb-[X], pl-[X]
#          m-[X], mx-[X], my-[X], mt-[X], mr-[X], mb-[X], ml-[X]
#          gap-[X], gap-x-[X], gap-y-[X]
#          space-x-[X], space-y-[X]
#          rounded-[X]
#          h-[X], w-[X], min-h-[X], min-w-[X], max-h-[X], max-w-[X]
ARBITRARY_PATTERN = re.compile(
    r'(?P<prefix>'
    r'p[xyrtbl]?|m[xyrtbl]?|'       # padding/margin
    r'gap(?:-[xy])?|'               # gap
    r'space-[xy]?|'                  # space (space-x, space-y with or without inner hyphen)
    r'rounded|'                      # border-radius
    r'h|w|min-h|min-w|max-h|max-w'  # sizing
    r')'
    r'-\[(?P<value>[^\]]+)\]'
)


def is_excluded(filepath: Path) -> bool:
    """Check if file should be excluded (test/story files)."""
    name = str(filepath)
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, name):
            return True
    return False


def is_allowed(prefix: str, value: str) -> bool:
    """Check if the prefix+value combination is an allowed semantic token."""
    if prefix == "rounded":
        return value in ALLOWED_RADIUS
    return value in ALLOWED_SPACING


def is_css_var(value: str) -> bool:
    """Check if the value is a CSS variable reference like var(--xxx)."""
    return bool(re.match(r'var\(--[\w-]+\)', value))


def is_percentage(value: str) -> bool:
    """Check if the value is a percentage like 50vh, 100vw, 50%, etc."""
    return bool(re.match(r'^\d+(\.\d+)?(vh|vw|vmin|vmax|%|dvh|svw)$', value))


def scan_file(filepath: Path) -> dict:
    """Scan a single file for arbitrary value violations. Returns categorized results."""
    result = {
        "spacing": [],
        "border_radius": [],
        "sizing": [],
        "css_var": [],
        "percentage": [],
    }
    file_str = str(filepath)
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return result

    for match in ARBITRARY_PATTERN.finditer(content):
        prefix = match.group("prefix")
        value = match.group("value")

        if is_allowed(prefix, value):
            continue

        line_num = content[:match.start()].count("\n") + 1
        entry = {
            "file": file_str,
            "line": line_num,
            "match": match.group(0),
            "prefix": prefix,
            "value": value,
        }

        # Categorize (order matters: most specific first)
        if is_css_var(value):
            result["css_var"].append(entry)
        elif is_percentage(value):
            result["percentage"].append(entry)
        elif prefix == "rounded":
            result["border_radius"].append(entry)
        elif prefix in ("h", "w", "min-h", "min-w", "max-h", "max-w"):
            result["sizing"].append(entry)
        else:
            result["spacing"].append(entry)

    return result


def main():
    web_dir = Path(__file__).parent
    all_spacing = []
    all_radius = []
    all_sizing = []
    all_cssvar = []
    all_percentage = []

    for scan_dir in SCAN_DIRS:
        target = web_dir / scan_dir
        if not target.exists():
            continue
        for filepath in sorted(target.rglob("*")):
            if filepath.suffix not in (".tsx", ".ts"):
                continue
            if is_excluded(filepath):
                continue
            result = scan_file(filepath)
            all_spacing.extend(result["spacing"])
            all_radius.extend(result["border_radius"])
            all_sizing.extend(result["sizing"])
            all_cssvar.extend(result["css_var"])
            all_percentage.extend(result["percentage"])

    all_data = all_spacing + all_radius + all_sizing
    total = len(all_data)
    all_files = set(x["file"] for x in all_data)

    print(f"{'=' * 70}")
    print(f"  ARBITRARY SPACING VALUE REPORT")
    print(f"  {len(all_files)} files with violations")
    print(f"  {total} total arbitrary value violations (excluding CSS vars and percentages)")
    print(f"  {len(all_cssvar)} CSS variable references (informational)")
    print(f"  {len(all_percentage)} percentage/vh/vw values (likely intentional, informational)")
    print(f"{'=' * 70}")

    def print_section(title, violations, icon):
        if not violations:
            return
        by_file = defaultdict(list)
        for v in violations:
            by_file[v["file"]].append(v)
        sorted_files = sorted(by_file.items(), key=lambda x: -len(x[1]))

        print(f"\n  {icon} [{title}] — {len(violations)} violations")
        print(f"  {'─' * 60}")
        for filepath, items in sorted_files:
            short = filepath.split("web/", 1)[-1] if "web/" in filepath else filepath
            print(f"    {short} ({len(items)}):")
            for item in items:
                print(f"      L{item['line']:>5}: {item['match']}")
        print()

    print_section("SPACING", all_spacing, "[S]")
    print_section("BORDER_RADIUS", all_radius, "[R]")
    print_section("SIZING", all_sizing, "[Z]")

    if all_cssvar:
        by_file_var = defaultdict(list)
        for v in all_cssvar:
            by_file_var[v["file"]].append(v)
        print(f"\n  [V] [CSS_VARIABLE REFERENCES] — {len(all_cssvar)} (informational, non-blocking)")
        print(f"  {'─' * 60}")
        # Show top 5 files
        for filepath, items in sorted(by_file_var.items(), key=lambda x: -len(x[1]))[:5]:
            short = filepath.split("web/", 1)[-1] if "web/" in filepath else filepath
            print(f"    {short} ({len(items)}):")
            for item in items[:3]:
                print(f"      L{item['line']:>5}: {item['match']}")
            if len(items) > 3:
                print(f"      ... and {len(items) - 3} more")
        print()

    # Summary — most common real violations (excluding CSS vars)
    print(f"\n  {'=' * 70}")
    print(f"  TOP ARBITRARY VALUES (real violations — excluding CSS vars)")
    print(f"  {'=' * 70}")
    value_counts = defaultdict(int)
    for v in all_spacing + all_radius + all_sizing:
        key = v["match"]
        value_counts[key] += 1

    for match_str, count in sorted(value_counts.items(), key=lambda x: -x[1])[:40]:
        print(f"    {match_str:35s}  × {count:>3}")

    # Severity assessment
    print(f"\n  {'=' * 70}")
    print(f"  SEVERITY ASSESSMENT")
    print(f"  {'=' * 70}")
    print(f"  HIGH: {len(all_radius)} border-radius violations — should migrate to semantic tokens")
    print(f"  MEDIUM: {len(all_spacing)} padding/margin/gap violations — likely easily refactored")
    print(f"  LOW: {len(all_sizing)} sizing violations — many may be intentional layout choices")
    print(f"  INFO: {len(all_cssvar)} CSS variable references — legitimate design token usage")


if __name__ == "__main__":
    main()
