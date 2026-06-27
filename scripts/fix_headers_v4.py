"""Remove unused `headers` argument from call sites of helper functions.

The v3 script removed the `headers` parameter from helper function definitions
but the regex for call sites used `\.func_name` (dot-prefix) while calls are
bare `func_name(...)` without a dot. This fixes that.
"""

import re
from pathlib import Path

def fix_helper_calls(content: str, func_name: str) -> str:
    """Remove headers argument from calls to a helper function."""
    # Match: func_name(http_client, headers, ...) - bare function call
    # Or: obj.func_name(http_client, headers, ...) - method call
    
    # Case 1: open paren + http_client + headers + close paren
    # e.g. _create_item(http_client, headers)
    content = re.sub(
        rf'({func_name}\(\s*\w+\s*,\s*)headers\s*\)',
        r'\1)',
        content,
    )
    
    # Case 2: open paren + http_client + headers + comma + more args
    # e.g. _create_item(http_client, headers, item_id, ...)
    content = re.sub(
        rf'({func_name}\(\s*\w+\s*,\s*)headers\s*,',
        r'\1',
        content,
    )
    
    # Case 3: continuation lines where headers is on a separate line
    # e.g. _create_item(http_client,
    #                   headers,
    #                   item_id, ...)
    content = re.sub(
        rf'({func_name}\(\s*\w+\s*,\s*\n\s*)headers\s*,',
        r'\1',
        content,
    )
    content = re.sub(
        rf'({func_name}\(\s*\w+\s*,\s*\n\s*)headers\s*\)',
        r'\1)',
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

def fix_file(filepath: str) -> int:
    path = Path(filepath)
    if not path.exists():
        return 0
    
    content = path.read_text(encoding='utf-8')
    original = content
    
    for helper in COMMON_HELPERS:
        content = fix_helper_calls(content, helper)
    
    # Fix remaining `headers = _auth_headers(...)` calls
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
    
    if content != original:
        path.write_text(content, encoding='utf-8')
        print(f"FIXED: {filepath}")
        return 1
    print(f"OK: {filepath} (no changes)")
    return 0

if __name__ == "__main__":
    changed = 0
    for f in FILES:
        if fix_file(f):
            changed += 1
    print(f"\nFixed {changed} files")
