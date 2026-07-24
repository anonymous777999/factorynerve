"""Fix byte-level corruption and encoding issues."""
import sys

file_path = sys.argv[1]

with open(file_path, "rb") as f:
    data = bytearray(f.read())

# Find and fix the mangled pattern: return {}}"} -> return {}
# In bytes: return {}}" -> search for specific bytes
pattern = b'return {}}"}'
idx = data.find(pattern)
if idx >= 0:
    data[idx:idx+len(pattern)] = b"return {}"
    print(f"Fixed syntax error at byte {idx}")

# Fix any 0x90 byte by replacing it
while True:
    idx = data.find(b'\x90')
    if idx < 0:
        break
    data[idx] = ord(' ')
    print(f"Replaced 0x90 byte at position {idx}")

# Fix duplicate phone field
pattern2 = b'"phone": "919000000001",\n                "phone": "919000000002",'
idx2 = data.find(pattern2)
if idx2 >= 0:
    replacement = b'"phone": "919000000001",'
    data[idx2:idx2+len(pattern2)] = replacement
    print(f"Fixed duplicate phone field at byte {idx2}")

with open(file_path, "wb") as f:
    f.write(data)

print(f"Done fixing: {file_path}")
