"""Fix remaining border-radius arbitrary value violations.

Maps each pattern to the closest semantic token:
  rounded-[1rem]       (16px)   → rounded-2xl  (16px)   ✅ exact
  rounded-[1.75rem]    (28px)   → rounded-3xl  (24px)   ⚠️ close
  rounded-[1.6rem]     (~25.6px) → rounded-3xl  (24px)   ⚠️ close
  rounded-[0.45rem]    (~7.2px)  → rounded-overlay (8px) ⚠️ close
  rounded-[8px]        (8px)    → rounded-overlay (8px)  ✅ exact
  rounded-[0.35rem]    (~5.6px)  → rounded-panel  (6px)  ⚠️ close
  rounded-[1.25rem]    (20px)   → rounded-2xl  (16px)   ⚠️ close (consistent with prev)
  rounded-[1.8rem]     (~28.8px) → rounded-3xl  (24px)   ⚠️ close
  rounded-[18px]       (18px)   → rounded-2xl  (16px)   ⚠️ close
  rounded-[16px]       (16px)   → rounded-2xl  (16px)   ✅ exact
  rounded-[32px]       (32px)   → rounded-3xl  (24px)   ⚠️ close
  rounded-[22px]       (22px)   → rounded-3xl  (24px)   ⚠️ close
  rounded-[4px]        (4px)    → rounded-control (4px)  ✅ exact
  rounded-[1.95rem]    (~31.2px) → rounded-3xl  (24px)   ⚠️ close
  rounded-[1.55rem]    (~24.8px) → rounded-3xl  (24px)   ⚠️ close
  rounded-[0.85rem]    (~13.6px) → rounded-xl   (12px)   ⚠️ close
  rounded-[1.9rem]     (~30.4px) → rounded-3xl  (24px)   ⚠️ close
  rounded-[1.35rem]    (~21.6px) → rounded-3xl  (24px)   ⚠️ close
  rounded-[1.1rem]     (~17.6px) → rounded-2xl  (16px)   ⚠️ close
  rounded-[1.4rem]     (~22.4px) → rounded-3xl  (24px)   ⚠️ close
  rounded-[10px]       (10px)   → rounded-overlay (8px)  ⚠️ close
"""

import os
import re

SRC_DIRS = [
    "src/components",
    "src/app",
    "src/features",
    "src/shared",
]

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# Pattern → replacement mapping
REPLACEMENTS = {
    "rounded-[1rem]": "rounded-2xl",
    "rounded-[1.75rem]": "rounded-3xl",
    "rounded-[1.6rem]": "rounded-3xl",
    "rounded-[0.45rem]": "rounded-overlay",
    "rounded-[8px]": "rounded-overlay",
    "rounded-[0.35rem]": "rounded-panel",
    "rounded-[1.25rem]": "rounded-2xl",
    "rounded-[1.8rem]": "rounded-3xl",
    "rounded-[18px]": "rounded-2xl",
    "rounded-[16px]": "rounded-2xl",
    "rounded-[32px]": "rounded-3xl",
    "rounded-[22px]": "rounded-3xl",
    "rounded-[4px]": "rounded-control",
    "rounded-[1.95rem]": "rounded-3xl",
    "rounded-[1.55rem]": "rounded-3xl",
    "rounded-[0.85rem]": "rounded-xl",
    "rounded-[1.9rem]": "rounded-3xl",
    "rounded-[1.35rem]": "rounded-3xl",
    "rounded-[1.1rem]": "rounded-2xl",
    "rounded-[1.4rem]": "rounded-3xl",
    "rounded-[10px]": "rounded-overlay",
}

# Build a regex that matches any of the patterns
patterns_escaped = [re.escape(p) for p in REPLACEMENTS]
PATTERN_RE = re.compile("|".join(patterns_escaped))

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    def replace_match(m):
        matched = m.group(0)
        replacement = REPLACEMENTS.get(matched)
        if replacement:
            return replacement
        return matched

    new_content, count = PATTERN_RE.subn(replace_match, content)
    if count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        return count
    return 0

total = 0
changed_files = []

for src_dir in SRC_DIRS:
    full_path = os.path.join(PROJECT_ROOT, src_dir)
    if not os.path.isdir(full_path):
        continue
    for root, dirs, files in os.walk(full_path):
        # Skip node_modules, test files, stories
        dirs[:] = [d for d in dirs if d not in ("node_modules", "__tests__", "test")]
        for fname in files:
            if not (fname.endswith(".tsx") or fname.endswith(".ts")):
                continue
            # Skip test/story files
            if ".test." in fname or ".spec." in fname or ".stories." in fname:
                continue
            # Skip files in test/ subdirs
            if "/test_" in root or "\\test_" in root:
                continue

            fpath = os.path.join(root, fname)
            count = fix_file(fpath)
            if count > 0:
                total += count
                rel = os.path.relpath(fpath, PROJECT_ROOT)
                changed_files.append((rel, count))
                print(f"  {count:3d} replacements in {rel}")

print(f"\n{'='*60}")
print(f"Total: {total} replacements across {len(changed_files)} files")
print(f"{'='*60}")

# Per-pattern summary
print(f"\nPer-pattern breakdown:")
pattern_totals = {}
for rel, count in changed_files:
    fpath = os.path.join(PROJECT_ROOT, rel)
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    for old, new in REPLACEMENTS.items():
        # Count occurrences of the replacement (not the original)
        c = content.count(new)
        # Actually, let me just look at the original patterns
for old, new in REPLACEMENTS.items():
    grep_cmd = f'findstr /c:"{old}" "{rel}"'  # Would be slow, let's just use the file counts
    pattern_totals[old] = 0

# Readall files for per-pattern summary
for rel, count in changed_files:
    fpath = os.path.join(PROJECT_ROOT, rel)
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    for old, new in REPLACEMENTS.items():
        # The old pattern should not appear anymore (they were replaced)
        # But we can check how many times the new pattern appears
        c_old = content.count(old)
        c_new = content.count(new)
        # Actually this is misleading because new tokens may have existed before
        # Let me just note patterns that still appear (unreplaced)
        if c_old > 0:
            print(f"  ⚠️  {old} still found in {rel}")

print(f"\nNOTE: {total} replacements applied across {len(changed_files)} files.")
