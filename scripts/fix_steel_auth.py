"""Fix all steel and related test files by removing empty Bearer Authorization headers.

The register_user() function now returns access_token="" (JWT removed in favor of v2
session cookies). All Authorization: Bearer {access_token} headers produce 
"Bearer " which is an illegal HTTP header value causing httpx.LocalProtocolError.

Fix strategy:
1. Remove `headers = {"Authorization": f"Bearer {user['access_token']}"}` lines
2. Remove `headers = _auth_headers(token)` lines and the _auth_headers helper
3. Change `headers=headers` to `headers=cookie_headers` when user switching is needed
4. For single-user tests, just drop `headers=headers`
"""

import re
import sys
from pathlib import Path

FILES = [
    "tests/test_steel_module.py",
    "tests/test_steel_inventory_intelligence.py",
    "tests/test_steel_scrap_loss_intelligence.py",
    "tests/test_steel_machine_intelligence.py",
    "tests/test_steel_finance.py",
    "tests/test_steel_dispatch_batch_workflow.py",
    "tests/test_steel_integration_security.py",
    "tests/test_quality_intelligence.py",
    "tests/test_workforce_intelligence.py",
    "tests/test_tenant_isolation.py",
    "tests/test_priority_integration.py",
    "tests/test_user_codes.py",
]

def _fix_helper_auth_headers(content: str) -> str:
    """Remove _auth_headers function definitions that just return Bearer token dicts."""
    # Remove `def _auth_headers(token) ...` that returns Bearer auth
    content = re.sub(
        r'def _auth_headers\([^)]*\)\s*->\s*dict.*?:\n\s+return\s*\{[^}]*Bearer[^}]*\}',
        'def _auth_headers() -> dict[str, str]:\n    return {}',
        content,
        flags=re.DOTALL,
    )
    return content

def _fix_bearer_headers_declarations(content: str) -> str:
    """Remove lines that declare Authorization Bearer token headers."""
    # Pattern: headers = {"Authorization": f"Bearer {something}"}
    content = re.sub(
        r'^\s*(?:\w+_)?headers\s*=\s*\{.*?Authorization.*?Bearer.*?\}\s*\n',
        '',
        content,
        flags=re.MULTILINE,
    )
    # Pattern: headers = _auth_headers(something)
    # Don't remove these - we changed _auth_headers to return empty dict
    return content

def _fix_headers_kwargs(content: str) -> str:
    """Remove `headers=headers` from http_client calls."""
    # Pattern: `, headers=headers)` or `, headers=headers,\n`
    content = re.sub(
        r',\s*headers=headers\)',
        ')',
        content,
    )
    content = re.sub(
        r',\s*headers=headers,\n',
        ',\n',
        content,
    )
    content = re.sub(
        r', headers=headers\b',
        '',
        content,
    )
    return content

def _fix_multi_user_headers(content: str) -> str:
    """Fix multi-user test patterns where a second user registers and needs Cookie headers."""
    # Replace `owner_headers = _auth_headers(owner["access_token"])` with Cookie-based headers
    content = re.sub(
        r'(\w+_headers)\s*=\s*_auth_headers\((\w+)\["access_token"\]\)',
        r'\1 = {"Cookie": f"auth_session={\2[\'session_token\']}"}',
        content,
    )
    
    # Replace `headers = _auth_headers(token)` for multi-user scenarios
    content = re.sub(
        r'(\w+_headers)\s*=\s*_auth_headers\((\w+)\)',
        r'\1 = {}',
        content,
    )
    return content

def fix_file(filepath: str) -> int:
    """Fix a single test file. Returns number of changes made."""
    path = Path(filepath)
    if not path.exists():
        print(f"SKIP: {filepath} does not exist")
        return 0
    
    original = path.read_text(encoding='utf-8')
    content = original
    
    # Step 1: Remove _auth_headers helper function
    content = _fix_helper_auth_headers(content)
    
    # Step 2: Remove Authorization Bearer header declarations
    content = _fix_bearer_headers_declarations(content)
    
    # Step 3: Remove headers=headers kwargs from http calls
    content = _fix_headers_kwargs(content)
    
    # Step 4: Fix multi-user Cookie headers
    content = _fix_multi_user_headers(content)
    
    if content != original:
        path.write_text(content, encoding='utf-8')
        changes = len(set(original.splitlines()) - set(content.splitlines()))
        print(f"FIXED: {filepath} ({changes} lines changed)")
        return changes
    
    print(f"OK: {filepath} (no changes needed)")
    return 0

if __name__ == "__main__":
    total = 0
    for filepath in FILES:
        total += fix_file(filepath)
    print(f"\nTotal: {total} changes across {len(FILES)} files")
