"""Clean up non-UTF-8 bytes and fix f-string syntax errors in test file."""
import re

FILE = "tests/test_steel_integration_security.py"

# Read as binary
with open(FILE, "rb") as f:
    data = f.read()

# Decode with 'replace' to clean all non-UTF-8 bytes
text = data.decode("utf-8", errors="replace")

# Fix replaced characters (they show as replacement char U+FFFD)
# Replace any replacement characters with space
text = text.replace("\ufffd", " ")

# Fix escaped single quotes inside f-string expressions
# Pattern: f"auth_session={owner[\'session_token\']}"
# The \' inside {} is illegal in Python f-strings
text = re.sub(r"f\"([^\"]*?)\\[\'\"]([^\"]*?)\\[\'\"]([^\"]*?)\"", 
              lambda m: 'f"' + m.group(1) + "'" + m.group(2) + "'" + m.group(3) + '"', 
              text)

# Also fix any remaining backslash-quote patterns in dict access inside f-strings
# Simple string replacements for common patterns
text = text.replace("\\'session_token\\'", "'session_token'")
text = text.replace("\\'session_token'", "'session_token'")

# Write back as clean UTF-8
with open(FILE, "w", encoding="utf-8") as f:
    f.write(text)

print("Written as UTF-8")

# Verify
try:
    compile(text, FILE, "exec")
    print("SUCCESS: No syntax errors!")
except SyntaxError as e:
    print(f"ERROR at line {e.lineno}: {e.msg}")
    lines = text.split("\n")
    for i in range(max(0, e.lineno - 3), min(len(lines), e.lineno + 2)):
        marker = ">>>" if i == e.lineno - 1 else "   "
        print(f"{marker} {i+1}: {repr(lines[i])}")
except Exception as e:
    print(f"Unexpected error: {e}")
