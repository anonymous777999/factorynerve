"""
Replace top border-radius arbitrary values with semantic Tailwind tokens.

Mapping:
  rounded-[1.5rem]  (24px) → rounded-3xl (24px) — exact match
  rounded-[24px]    (24px) → rounded-3xl (24px) — exact match
  rounded-[28px]    (28px) → rounded-3xl (24px) — closest semantic
  rounded-[30px]    (30px) → rounded-3xl (24px) — closest semantic
  rounded-[20px]    (20px) → rounded-2xl (16px) — closest semantic
  rounded-[2rem]    (32px) → rounded-3xl (24px) — closest semantic
  rounded-[1.7rem]  (27px) → rounded-3xl (24px) — closest semantic
"""

import os
import re

WEB_DIR = os.path.join(os.path.dirname(__file__))
SCAN_DIRS = ["src/components", "src/app", "src/features", "src/shared", "src/legacy-ui"]
EXCLUDE_PATTERNS = (r"\.test\.tsx?$", r"\.stories\.tsx?$", r"\.spec\.tsx?$", r"__tests__", r"/test_")

REPLACEMENTS = [
    # Exact matches first
    ('rounded-[1.5rem]', 'rounded-3xl'),
    ('rounded-[24px]', 'rounded-3xl'),
    # Close matches
    ('rounded-[28px]', 'rounded-3xl'),
    ('rounded-[30px]', 'rounded-3xl'),
    ('rounded-[20px]', 'rounded-2xl'),
    ('rounded-[2rem]', 'rounded-3xl'),
    ('rounded-[1.7rem]', 'rounded-3xl'),
]

# Build a regex that matches any of the patterns
PATTERN = re.compile('|'.join(re.escape(old) for old, _ in REPLACEMENTS))

def replacement(match):
    matched = match.group(0)
    for old, new in REPLACEMENTS:
        if old == matched:
            return new
    return matched  # shouldn't happen

def is_excluded(filepath):
    name = str(filepath)
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, name):
            return True
    return False

total_changes = 0
total_files = 0

for scan_dir in SCAN_DIRS:
    target = os.path.join(WEB_DIR, scan_dir)
    if not os.path.exists(target):
        continue
    for root, dirs, files in os.walk(target):
        for filename in sorted(files):
            if not filename.endswith(('.tsx', '.ts')):
                continue
            filepath = os.path.join(root, filename)
            if is_excluded(filepath):
                continue
            
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            new_content, count = PATTERN.subn(replacement, content)
            
            if count > 0:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                total_changes += count
                total_files += 1
                short = filepath.split('web\\', 1)[-1] if 'web\\' in filepath else filepath
                print(f"  {short}: {count} replacement(s)")

print(f"\nTotal: {total_changes} replacements across {total_files} files")
