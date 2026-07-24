"""Fix remaining f-string backslash and encoding issues."""
import re

FILE = "tests/test_steel_integration_security.py"

# Read as binary
with open(FILE, "rb") as f:
    data = f.read()

# Fix 1: Replace 0x90 bytes (cp1252 arrow char) with space
data = data.replace(b"\x90", b" ")

# Fix 2: Replace escaped single quotes inside f-string expressions
# Binary pattern for: f"auth_session={owner[\'session_token\']}"
# The actual bytes have: owner[\'session_token\']
# In CP1252, backslash is 0x5C, single quote is 0x27
# So the escaped pattern looks like: owner[\x5c\x27session_token\x5c\x27]
# We want to replace with: owner[\x27session_token\x27]

# Fix: [\'session_token\'] -> ['session_token']
# In bytes: [\x5c\x27session_token\x5c\x27] -> [\x27session_token\x27]
data = data.replace(b"[\\'session_token\\']", b"['session_token']")
data = data.replace(b"[\\'session_token']", b"['session_token']")  

# Also fix any remaining backslash-quote patterns in dict access
# e.g., owner[\\'id\\'] etc (any escaped single quotes used as Python string delimiters inside f-strings)
# Actually, the specific pattern from the error is: owner[\'session_token\']
# inside an f-string like: f"auth_session={owner[\'session_token\']}"

with open(FILE, "wb") as f:
    f.write(data)

# Verify no syntax errors remain
try:
    with open(FILE, "r", encoding="utf-8") as f:
        content = f.read()
    compile(content, FILE, "exec")
    print("SUCCESS: File compiles without syntax errors!")
except SyntaxError as e:
    print(f"STILL HAS SYNTAX ERROR at line {e.lineno}: {e.msg}")
    print(f"  Text: {e.text}")
    # Show surrounding lines
    lines = content.split("\n")
    start = max(0, e.lineno - 3)
    end = min(len(lines), e.lineno + 2)
    for i in range(start, end):
        marker = ">>>" if i == e.lineno - 1 else "   "
        print(f"{marker} {i+1}: {lines[i]}")
except UnicodeDecodeError as e:
    print(f"STILL HAS ENCODING ERROR: {e}")
