"""Fix escaped single quotes inside f-string expressions.

Python 3.10+ does not allow backslashes inside f-string {} expressions.
Replace `owner[\'session_token\']` with `owner['session_token']` in f-strings.
"""
import re

FILE = "tests/test_steel_integration_security.py"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# Replace escaped single quotes inside f-string expressions
# Pattern: inside an f"...{var[\'key\']}..."  the backslash before ' is illegal
# The file has lines like: f"auth_session={owner[\'session_token\']}"
# We need to change the escaped quotes to normal single quotes
# But since the whole f-string uses double quotes, single quotes are fine inside {}

# Strategy: find all f-strings with escaped quotes and fix them
# Replace patterns like: owner[\'session_token\']  ->  owner['session_token']
# In Python source: the escaped version looks like: owner[\\'session_token\\']
# In the actual file: owner[\'session_token\']
# But since we're reading the file, the raw text has: owner[\'session_token\']
# In Python string literals: the text is owner[\\'session_token\\']

# Actually in the raw file content (read as string), the text is:
# f"auth_session={owner[\'session_token\']}"
# The backslash-quote is literal in the source code.

# Fix: replace all \' inside dictionary access in f-strings
# Simple approach: replace [\' with [' and \'] with ']
# But we need to be careful not to replace in wrong places

# Just replace common patterns
replacements = [
    ("owner[\\'session_token\\']", "owner['session_token']"),
    ("manager[\\'session_token\\']", "manager['session_token']"),
    ("supervisor[\\'session_token\\']", "supervisor['session_token']"),
    ("accountant[\\'session_token\\']", "accountant['session_token']"),
    ("admin[\\'session_token\\']", "admin['session_token']"),
    ("org1[\\'session_token\\']", "org1['session_token']"),
    ("org2[\\'session_token\\']", "org2['session_token']"),
    ("operator[\\'session_token\\']", "operator['session_token']"),
]

for old, new in replacements:
    content = content.replace(old, new)
    count = original.count(old) - content.count(old)
    if count != original.count(old):
        pass  # at least some were replaced

if content != original:
    with open(FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed!")
else:
    print("No changes needed - checking for escaped quotes...")
    # Debug: find lines with escaped single quotes
    for i, line in enumerate(original.split("\n"), 1):
        if "session_token" in line and "\\'" in line:
            print(f"  Line {i}: {line.strip()[:100]}")
