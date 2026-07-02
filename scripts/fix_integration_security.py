"""Fix remaining issues in test_steel_integration_security.py."""
import re

with open("tests/test_steel_integration_security.py", "rb") as f:
    data = bytearray(f.read())

# Fix 1: Change _auth_headers() to accept a user dict parameter
# pattern: def _auth_headers() -> dict[str, str]:
old_auth = b"def _auth_headers() -> dict[str, str]:\n    return {}"
new_auth = b"def _auth_headers(user: dict | None = None) -> dict[str, str]:\n    return {}"
data = data.replace(old_auth, new_auth)
print("Fixed _auth_headers signature")

# Fix 2: Fix _auth_headers(user["access_token"]) calls in fixtures
# These call _auth_headers(arg) but we changed to _auth_headers(user=None)
# Since we return {} anyway, we can just remove the argument pattern
data = data.replace(b"_auth_headers(user[\"access_token\"])", b"_auth_headers()")
data = data.replace(b"_auth_headers(owner[\"access_token\"])", b"_auth_headers()")
data = data.replace(b"_auth_headers(operator[\"access_token\"])", b"_auth_headers()")
print("Fixed _auth_headers call sites")

# Fix 3: Fix _seed_stock calls missing headers argument
# Pattern: _seed_stock(http_client, headers=headers, item_code="...")
# These were: _seed_stock(http_client, item_code="...")  # Missing headers!
# We need to add headers parameter

# Find all _seed_stock calls that are missing headers and add headers={}
# Instead of complex regex, let's fix the function signature to make headers optional
old_seed = (
    b"def _seed_stock(\n"
    b"    http_client: httpx.Client,\n"
    b"    headers: dict[str, str],\n"
    b"    *,"
)
new_seed = (
    b"def _seed_stock(\n"
    b"    http_client: httpx.Client,\n"
    b"    headers: dict[str, str] | None = None,\n"
    b"    *,"
)
data = data.replace(old_seed, new_seed)
# Now update the internal calls to use headers or {}
data = data.replace(
    b"    assert created.status_code == HTTPStatus.OK, created.text",
    b"    h = headers or {}\n    assert created.status_code == HTTPStatus.OK, created.text"
)
data = data.replace(
    b"    inward = http_client.post(\n"
    b"        \"/steel/inventory/transactions\",",
    b"    inward = http_client.post(\n"
    b"        \"/steel/inventory/transactions\",\n"
    b"        headers=h,"
)
# Fix the first inward call that doesn't have headers=h yet (double header)
data = data.replace(
    b"    inward = http_client.post(\n"
    b"        \"/steel/inventory/transactions\",\n"
    b"        headers=h,\n"
    b"        json={",
    b"    inward = http_client.post(\n"
    b"        \"/steel/inventory/transactions\",\n"
    b"        headers=h,\n"
    b"        json={",
)
print("Fixed _seed_stock signature (headers optional)")

# Fix 4: Fix duplicate phone field
old_phone = b'"phone": "919000000001",\n                "phone": "919000000002",'
data = data.replace(old_phone, b'"phone": "919000000001",')
print("Fixed duplicate phone field")

# Fix 5: Fix _seed_stock calls that pass headers as positional but have item_code=...
# Find all _seed_stock calls that look like: _seed_stock(http_client, item_code="..."
# These are missing the headers arg. We added headers=None so they'll work, but 
# let's fix the key ones with actual headers
# Actually the header=None default will work for these since cookie jar has correct user

with open("tests/test_steel_integration_security.py", "wb") as f:
    f.write(data)

print("Done! All fixes applied.")
