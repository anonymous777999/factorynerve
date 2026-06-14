"""
SIZING fix batch 2 — Fix remaining SIZING violations

Category 1: Shadow bugs — w-[shadow] → shadow-[shadow] (values with rgba, color-mix, inset, var(--shadow/glow/border))
Category 2: Deeply nested shadow vars — w-[var(--shadow-[var(--shadow-sm)] → shadow-[var(--shadow-[var(--shadow-sm)])]
Category 3: rem values → Tailwind spacing tokens (e.g. min-w-[11rem] → min-w-44)
Category 4: px values → Tailwind spacing tokens (e.g. h-[320px] → h-80)
"""

import os
import re

SRC_DIRS = ["src/components", "src/app", "src/features", "src/shared"]
EXCLUDE_SUBSTRINGS = ["/test_", "\\test_", "/stories/", "\\stories\\", ".stories.", "/legacy-ui/", "\\legacy-ui\\", "src-v2/", "src-v2\\"]

BASE = os.path.dirname(os.path.abspath(__file__))

def should_include(filepath):
    rel = os.path.relpath(filepath, BASE)
    return not any(p in rel for p in EXCLUDE_SUBSTRINGS)

# ---------------------------------------------------------------
# Category 1 — Shadow bugs: detect if a w-[value] is actually a shadow
# ---------------------------------------------------------------

SHADOW_INDICATORS = [
    "rgba(", "rgba (", "rgb(", "rgb (",
    "color-mix(",
    "hsl(", "hsla(",
    "var(--shadow", "var(--glow", "var(--border-focus", "var(--border)",
    "inset_",
]

def looks_like_shadow(value):
    """Check if an arbitrary value looks like a CSS shadow/glow/border."""
    for ind in SHADOW_INDICATORS:
        if ind in value:
            return True
    # Starts with a number followed by _ (e.g., "0_16px_40px_...")
    if re.match(r'^\d+(\.\d+)?(px|rem|em)?_', value):
        return True
    return False

def fix_category1_shadow(content):
    """Replace w-[shadow_value] with shadow-[shadow_value]."""
    count = 0
    # Match w-[...] where ... does not contain ]
    pattern = re.compile(r'w-\[([^\]]+)\]')
    
    def replacer(m):
        value = m.group(1)
        if looks_like_shadow(value):
            nonlocal count
            count += 1
            return f'shadow-[{value}]'
        return m.group(0)
    
    result = pattern.sub(replacer, result if 'result' in dir() else content)
    return result if 'result' in dir() else content, count

# Actually let me do it the simple way with str.replace for each file
def fix_content(content):
    """Apply all fixes to a file's content. Returns (new_content, counts_dict)."""
    counts = {"shadow": 0, "nested": 0, "rem": 0, "px": 0}
    result = content

    # ---- Category 1: Shadow bugs via regex ----
    # Match w-[value] where value contains shadow indicators
    shadow_pattern = re.compile(r'w-\[([^\]]+)\]')
    
    def shadow_replacer(m):
        value = m.group(1)
        if looks_like_shadow(value):
            counts["shadow"] += 1
            return f'shadow-[{value}]'
        return m.group(0)
    
    result = shadow_pattern.sub(shadow_replacer, result)

    # ---- Category 2: Deeply nested shadow vars ----
    # w-[var(--shadow-[var(--shadow-sm)] with potential missing brackets
    nested_pattern = re.compile(r'w-\[var\(--shadow-\[var\(--shadow-sm\)\]\)?\]?')
    
    def nested_replacer(m):
        counts["nested"] += 1
        return 'shadow-[var(--shadow-[var(--shadow-sm)])]'
    
    result = nested_pattern.sub(nested_replacer, result)

    # ---- Category 3: rem values → spacing tokens ----
    rem_replacements = [
        ("min-w-[3rem]", "min-w-12"),
        ("min-w-[7rem]", "min-w-28"),
        ("min-h-[7rem]", "min-h-28"),
        ("min-w-[10rem]", "min-w-40"),
        ("min-w-[11rem]", "min-w-44"),
        ("min-w-[12rem]", "min-w-48"),
        ("min-w-[13rem]", "min-w-52"),
        ("min-w-[15rem]", "min-w-60"),
        ("min-h-[18rem]", "min-h-72"),
        ("min-h-[20rem]", "min-h-80"),
        ("min-h-[22rem]", "min-h-88"),
        ("max-w-[22rem]", "max-w-88"),
        ("h-[24rem]", "h-96"),
        ("max-w-[24rem]", "max-w-96"),
        ("h-[28rem]", "h-112"),
        ("max-w-[30rem]", "max-w-120"),
        ("max-h-[32rem]", "max-h-128"),
        ("h-[36rem]", "h-144"),
        ("max-w-[40rem]", "max-w-160"),
        ("w-[13rem]", "w-52"),
        ("min-h-[260px]", ""),  # Will be handled in Category 4
        ("min-w-[860px]", ""),  # Will be handled in Category 4
    ]
    
    for old, new in rem_replacements:
        if new:  # non-empty means apply it
            c = result.count(old)
            if c > 0:
                counts["rem"] += c
                result = result.replace(old, new)

    # ---- Category 4: px values → spacing tokens ----
    px_replacements = [
        ("max-w-[120px]", "max-w-30"),
        ("h-[320px]", "h-80"),
    ]
    
    for old, new in px_replacements:
        c = result.count(old)
        if c > 0:
            counts["px"] += c
            result = result.replace(old, new)

    return result, counts


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

all_files = []
for src_dir in SRC_DIRS:
    full_dir = os.path.join(BASE, src_dir)
    if not os.path.isdir(full_dir):
        continue
    for root, dirs, files in os.walk(full_dir):
        for f in files:
            if f.endswith(('.tsx', '.ts', '.jsx', '.js')):
                fpath = os.path.join(root, f)
                if should_include(fpath):
                    all_files.append(fpath)

total_counts = {"shadow": 0, "nested": 0, "rem": 0, "px": 0}
modified_files = []

for fpath in sorted(all_files):
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        continue

    new_content, counts = fix_content(content)
    total = sum(counts.values())
    if total > 0:
        for k in total_counts:
            total_counts[k] += counts[k]
        modified_files.append((os.path.relpath(fpath, BASE), counts))
        
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)

# Report
print(f"=== SIZING Batch 2 Fix Results ===")
print(f"Files modified: {len(modified_files)}")
print(f"Category 1 — Shadow bugs: {total_counts['shadow']}")
print(f"Category 2 — Nested shadow vars: {total_counts['nested']}")
print(f"Category 3 — rem→spacing: {total_counts['rem']}")
print(f"Category 4 — px→spacing: {total_counts['px']}")
print(f"Total: {sum(total_counts.values())}")
print()
print("Per-file:")
for fpath, c in sorted(modified_files, key=lambda x: -sum(x[1].values())):
    parts = [f"{k}={v}" for k, v in c.items() if v > 0]
    print(f"  {fpath}: {', '.join(parts)}")
