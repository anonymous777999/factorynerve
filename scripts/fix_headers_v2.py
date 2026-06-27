"""Fix remaining steel test files by changing Bearer headers to empty dicts.

Some files have helper functions that accept `headers` as a parameter.
For these files, we must keep the `headers` variable but change its value
from `{"Authorization": f"Bearer {x}"}` to `{}`.
"""

import re
from pathlib import Path

FILES = [
    "tests/test_steel_inventory_intelligence.py",
    "tests/test_steel_scrap_loss_intelligence.py",
    "tests/test_steel_finance.py",
    "tests/test_quality_intelligence.py",
    "tests/test_workforce_intelligence.py",
    "tests/test_steel_module.py",
    "tests/test_steel_dispatch_batch_workflow.py",
    "tests/test_steel_integration_security.py",
    "tests/test_tenant_isolation.py",
]

def fix_file(filepath: str) -> int:
    path = Path(filepath)
    if not path.exists():
        return 0
    
    content = path.read_text(encoding='utf-8')
    original = content
    
    # Pattern 1: Restore `headers = {...}` declarations that were removed
    # by replacing with `headers = {}` before the first usage
    # 
    # Look for patterns where `headers` is used as an argument but not declared
    # We need to find: (after a test function def) where headers is passed 
    # to a helper function like `_create_item(http_client, headers)`
    
    # Fix: Add `headers = {}` inside each test function before the first use
    test_functions = re.findall(
        r'(def test_\w+\(http_client\):.*?)(?=def test_|$)',
        content,
        re.DOTALL,
    )
    
    for func in test_functions:
        # Check if function uses `headers` but doesn't declare it
        has_header_args = bool(re.search(r'_create_\w+\([^)]*headers', func))
        has_header_kwargs = bool(re.search(r'headers=headers', func))
        has_header_declaration = bool(re.search(r'^\s+headers\s*=', func, re.MULTILINE))
        
        if (has_header_args or has_header_kwargs) and not has_header_declaration:
            # Add `headers = {}` after the function signature
            content = re.sub(
                r'(def test_\w+\(http_client\):\n.*?)(\n\s+)(?=\S)',
                r'\1\2headers: dict[str, str] = {}\n\2',
                content,
            )
    
    # Pattern 2: Fix remaining `headers = _auth_headers(...)` calls
    content = re.sub(
        r'(\w*headers)\s*=\s*_auth_headers\([^)]+\)',
        r'\1 = {}',
        content,
    )
    
    # Pattern 3: Fix remaining `headers = {"Authorization": ...}` that script didn't catch
    content = re.sub(
        r'^\s+headers\s*=\s*\{.*?Authorization.*?Bearer.*?\}\s*$',
        '    headers = {}',
        content,
    )
    
    # Pattern 4: Fix `headers = {"Authorization": ...}` with multi-line
    content = re.sub(
        r'^\s+headers\s*=\s*\{[\s\S]*?Authorization[\s\S]*?Bearer[\s\S]*?\}\s*',
        '    headers = {}',
        content,
    )
    
    return 1 if content != original else 0

if __name__ == "__main__":
    changed = 0
    for f in FILES:
        if fix_file(f):
            print(f"FIXED: {f}")
            changed += 1
    print(f"\nFixed {changed} files")
