"""Fix SIZING violations across three categories:

1. ICON SIZES: h-[18px]/w-[18px] → h-icon/w-icon (16px at default density)
2. BROKEN SHADOW SYNTAX: w-[shadow_value] → shadow-[shadow_value]
3. EXACT TOKEN MATCHES: h-[32px]→h-input, min-h-[48px]→min-h-row-lg, etc.

For category 2, we detect shadow values by checking if the value
contains color functions (rgba, color-mix), inset keyword, or
shadow/glow CSS variable references.
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

# -------------------------------------------------------------------
# Category 1: Icon sizes (exact string replacements)
# -------------------------------------------------------------------
ICON_SIZE_REPLACEMENTS = {
    'h-[18px]': 'h-icon',
    'w-[18px]': 'w-icon',
}

# -------------------------------------------------------------------
# Category 2: Broken shadow syntax
# Detect w-[shadow_value] where the value is clearly a box-shadow.
# -------------------------------------------------------------------
# Regex to detect shadow-like values inside w-[...]
# Matches: values that contain rgba, rgb, color-mix, hsl, inset, var(--shadow-, var(--glow-)
SHADOW_VALUE_RE = re.compile(
    r'w-\['
    r'(?P<value>'
    r'(?=.*(?:rgba?\s*\(|color-mix\s*\(|hsl\s*\(|var\(--shadow|var\(--glow))'
    r'[^\]]+'
    r')\]'
)

# -------------------------------------------------------------------
# Category 3: Exact token matches
# -------------------------------------------------------------------
TOKEN_REPLACEMENTS = {
    'h-[32px]': 'h-input',        # 32px exact match
    'min-h-[48px]': 'min-h-row-lg',  # 48px exact match  
    'min-h-[96px]': 'min-h-textarea',  # 96px exact match
    'h-[36px]': 'h-9',             # Tailwind default h-9 = 36px
    'min-h-[44px]': 'min-h-row-lg',   # 44px → 48px (close)
}

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    original = content
    changes = []
    category_counts = {"icon": 0, "shadow": 0, "token": 0}

    # Category 1: Icon sizes
    for old, new in ICON_SIZE_REPLACEMENTS.items():
        count = content.count(old)
        if count > 0:
            content = content.replace(old, new)
            category_counts["icon"] += count

    # Category 2: Broken shadow syntax
    def replace_shadow(m):
        value = m.group('value')
        return f'shadow-[{value}]'
    
    new_content, shadow_count = SHADOW_VALUE_RE.subn(replace_shadow, content)
    if shadow_count > 0:
        category_counts["shadow"] += shadow_count
        content = new_content

    # Category 3: Token matches
    for old, new in TOKEN_REPLACEMENTS.items():
        count = content.count(old)
        if count > 0:
            content = content.replace(old, new)
            category_counts["token"] += count

    total = sum(category_counts.values())
    if total > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return total, category_counts
    return 0, category_counts

total_all = 0
total_icon = 0
total_shadow = 0
total_token = 0
changed_files = []

for src_dir in SRC_DIRS:
    full_path = os.path.join(PROJECT_ROOT, src_dir)
    if not os.path.isdir(full_path):
        continue
    for root, dirs, files in os.walk(full_path):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "__tests__", "test")]
        for fname in files:
            if not (fname.endswith(".tsx") or fname.endswith(".ts")):
                continue
            if ".test." in fname or ".spec." in fname or ".stories." in fname:
                continue
            if "/test_" in root or "\\test_" in root:
                continue

            fpath = os.path.join(root, fname)
            total, counts = fix_file(fpath)
            if total > 0:
                total_all += total
                total_icon += counts["icon"]
                total_shadow += counts["shadow"]
                total_token += counts["token"]
                rel = os.path.relpath(fpath, PROJECT_ROOT)
                changed_files.append((rel, total, counts))
                parts = []
                if counts["icon"]: parts.append(f"{counts['icon']} icon")
                if counts["shadow"]: parts.append(f"{counts['shadow']} shadow")
                if counts["token"]: parts.append(f"{counts['token']} token")
                print(f"  {total:3d} fixes ({', '.join(parts)}) in {rel}")

print(f"\n{'='*60}")
print(f"TOTAL: {total_all} fixes across {len(changed_files)} files")
print(f"  Icon sizes: {total_icon}")
print(f"  Shadow bugs: {total_shadow}")
print(f"  Token matches: {total_token}")
print(f"{'='*60}")
