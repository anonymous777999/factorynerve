"""Re-encode test_steel_integration_security.py as UTF-8."""
import sys
import re

file_path = sys.argv[1]

with open(file_path, "r", encoding="cp1252") as f:
    content = f.read()

# Fix the mangled _auth_headers function
content = content.replace('return {}"}', "return {}")
content = content.replace("return {}}", "return {}")

# Fix duplicate phone field in the customer creation (line ~173)
content = content.replace(
    '"phone": "919000000001",\n                "phone": "919000000002",',
    '"phone": "919000000001",'
)

# Write back as UTF-8
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Re-encoded and fixed: {file_path}")
