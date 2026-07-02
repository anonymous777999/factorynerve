"""Remove unused `headers` parameter from helper functions and fix call sites.

The fix script removed `headers=headers` kwargs from http_client calls inside
helper functions, but left the `headers: dict` parameter in function signatures.
Test functions still pass `headers` as an argument, but it's now undefined.

This script:
1. Removes `headers: dict` or `headers` from helper function signatures
2. Removes `headers` from all call sites to those helpers
"""

import re
from pathlib import Path

def fix_helper_param(content: str, func_name: str) -> str:
    """Remove headers param from a helper function definition."""
    # Match: def func_name(http_client, headers: dict, ...)
    content = re.sub(
        rf'(def {func_name}\(\s*\w+\s*,\s*)headers\s*:\s*dict(?:\[str,\s*str\])?\s*,',
        r'\1',
        content,
    )
    # Match: def func_name(http_client, headers, ...)
    content = re.sub(
        rf'(def {func_name}\(\s*\w+\s*,\s*)headers\s*,',
        r'\1',
        content,
    )
    return content

def fix_helper_calls(content: str, func_name: str) -> str:
    """Remove headers argument from calls to a helper function."""
    # Match: , headers) at end of call
    content = re.sub(
        rf'(\.{func_name}\(\s*\w+\s*,\s*)headers\s*\)',
        r'\1)',
        content,
    )
    # Match: , headers, in middle of call
    content = re.sub(
        rf'(\.{func_name}\(\s*\w+\s*,\s*)headers\s*,',
        r'\1',
        content,
    )
    return content

COMMON_HELPERS = [
    "_create_item",
    "_create_inward",
    "_create_outward",
    "_create_adjustment",
    "_create_batch",
    "_create_invoice",
    "_create_payment",
    "_create_dispatch",
    "_create_entry",
    "_create_production_line",
    "_create_machine",
    "_create_vendor",
    "_create_vendor_bill",
    "_create_expense",
    "_approve_reconciliation",
    "_reconcile_stock",
    "_seed_stock",
    "_seed_invoice",
]

def fix_file(filepath: str) -> int:
    path = Path(filepath)
    if not path.exists():
        return 0
    
    content = path.read_text(encoding='utf-8')
    original = content
    
    for helper in COMMON_HELPERS:
        content = fix_helper_param(content, helper)
        content = fix_helper_calls(content, helper)
    
    # Also fix direct `headers = _auth_headers(...)` calls that weren't caught
    content = re.sub(
        r'(\w*headers)\s*=\s*_auth_headers\([^)]+\)',
        r'\1 = {}',
        content,
    )
    
    # Fix remaining `headers = {"Authorization": ...}` patterns
    content = re.sub(
        r'^\s+\w*headers\s*=\s*\{[^}]*Authorization[^}]*Bearer[^}]*\}\s*$',
        '    headers = {}',
        content,
        flags=re.MULTILINE,
    )
    
    # Also add `headers = {}` inside functions that use `_auth_headers(http_client, ...)` directly
    # or call helper functions without declaring headers
    
    if content != original:
        path.write_text(content, encoding='utf-8')
        print(f"FIXED: {filepath}")
        return 1
    return 0

FILES = [
    "tests/test_steel_inventory_intelligence.py",
    "tests/test_steel_scrap_loss_intelligence.py",
    "tests/test_steel_finance.py",
    "tests/test_steel_module.py",
    "tests/test_steel_machine_intelligence.py",
    "tests/test_steel_dispatch_batch_workflow.py",
    "tests/test_steel_integration_security.py",
    "tests/test_quality_intelligence.py",
    "tests/test_workforce_intelligence.py",
    "tests/test_tenant_isolation.py",
]

if __name__ == "__main__":
    changed = 0
    for f in FILES:
        if fix_file(f):
            changed += 1
    print(f"\nFixed {changed} files")
