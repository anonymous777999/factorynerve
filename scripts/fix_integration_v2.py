"""Fix _auth_headers signature and callers, _seed_stock headers, and duplicate phone field."""
import re

with open("tests/test_steel_integration_security.py", "rb") as f:
    data = bytearray(f.read())

# Fix 1: Change _auth_headers to accept optional user dict, return Cookie headers if session_token exists
old_func = b"""def _auth_headers() -> dict[str, str]:
    return {}"""

new_func = b"""def _auth_headers(user: dict | None = None) -> dict[str, str]:
    if user and user.get("session_token"):
        return {"Cookie": f"auth_session={user['session_token']}"}
    return {}"""

data = data.replace(old_func, new_func)
print("1. Updated _auth_headers function")

# Fix 2: Change _auth_headers(user["access_token"]) to _auth_headers(user)
data = data.replace(b'_auth_headers(user["access_token"])', b"_auth_headers(user)")
data = data.replace(b'_auth_headers(owner["access_token"])', b"_auth_headers(owner)")
data = data.replace(b'_auth_headers(operator["access_token"])', b"_auth_headers(operator)")
data = data.replace(b'_auth_headers(manager["access_token"])', b"_auth_headers(manager)")
print("2. Updated _auth_headers callers")

# Fix 3: Make _seed_stock headers parameter optional with default {}
# Change: def _seed_stock(http_client, headers, *... to add default
old_seed = b"def _seed_stock(\n    http_client: httpx.Client,\n    headers: dict[str, str],\n    *,"
new_seed = b"def _seed_stock(\n    http_client: httpx.Client,\n    headers: dict[str, str] | None = None,\n    *,"
data = data.replace(old_seed, new_seed)
# Fix the call inside _seed_stock to use empty dict when headers is None
# The inside is: created = http_client.post("/steel/inventory/items", json={...})
# We need to add headers parameter to these internal calls
# But since these are the FIRST user's operations and cookie jar is set, empty headers work
# So no need to change internal calls - headers=None defaults to cookie jar auth
print("3. Made _seed_stock headers optional")

# Fix 4: Fix duplicate phone field
old_phone = b'"phone": "919000000001",\n                "phone": "919000000002",'
data = data.replace(old_phone, b'"phone": "919000000001",')
print("4. Fixed duplicate phone field")

with open("tests/test_steel_integration_security.py", "wb") as f:
    f.write(data)

print("\nAll fixes applied!")
