"""Fix remaining syntax errors in mangled test files."""
import re

files = [
    "tests/test_steel_integration_security.py",
    "tests/test_workforce_intelligence.py",
]

for file_path in files:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # Fix: return {}}"  -> return {}
    content = content.replace('return {}"}', "return {}")
    content = content.replace("return {}}", "return {}")
    
    # Fix escaped single quotes in Cookie headers
    content = content.replace('owner[\\\\', "owner['")
    content = content.replace("owner['session_token\\']", "owner['session_token']")
    content = content.replace("manager[\\\\", "manager['")
    content = content.replace("manager['session_token\\']", "manager['session_token']")
    content = content.replace("supervisor[\\\\", "supervisor['")
    content = content.replace("supervisor['session_token\\']", "supervisor['session_token']")
    content = content.replace("accountant[\\\\", "accountant['")
    content = content.replace("accountant['session_token\\']", "accountant['session_token']")
    content = content.replace("admin[\\\\", "admin['")
    content = content.replace("admin['session_token\\']", "admin['session_token']")
    content = content.replace("org1[\\\\", "org1['")
    content = content.replace("org1['session_token\\']", "org1['session_token']")
    content = content.replace("org2[\\\\", "org2['")
    content = content.replace("org2['session_token\\']", "org2['session_token']")
    content = content.replace("operator[\\\\", "operator['")
    content = content.replace("operator['session_token\\']", "operator['session_token']")
    
    if content != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed: {file_path}")
    else:
        print(f"No changes: {file_path}")
        # Show the problematic line
        for i, line in enumerate(content.split('\n'), 1):
            if 'auth_headers' in line and 'return' in line:
                print(f"  Line {i}: {repr(line)}")

print("Done!")
