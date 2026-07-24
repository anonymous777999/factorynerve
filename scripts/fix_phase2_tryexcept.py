"""
Apply try/except/rollback wrappers around critical db.commit() calls in steel.py.
Only adds the wrapper - does not change any other logic.
"""
import re

PATH = "backend/routers/steel.py"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

changes_made = []
lines = content.splitlines(keepends=True)

# ── Fix 1: Dispatch commit (line 4296 area) ──────────────────────────────
# Pattern: bare db.commit() followed by db.refresh(dispatch)
pattern1_start = "    db.commit()\n    db.refresh(dispatch)\n    for row in dispatch_line_rows:\n        db.refresh(row)\n"
replacement1 = (
    "    try:\n"
    "        db.commit()\n"
    "    except Exception as _e:\n"
    "        db.rollback()\n"
    "        raise HTTPException(status_code=500, detail=f\"Failed to create dispatch: {_e}\") from _e\n"
    "    db.refresh(dispatch)\n"
    "    for row in dispatch_line_rows:\n"
    "        db.refresh(row)\n"
)
if pattern1_start in content:
    content = content.replace(pattern1_start, replacement1, 1)
    changes_made.append("Dispatch commit wrapped in try/except/rollback")
else:
    # Try to find a nearby pattern to debug
    idx = content.find("db.refresh(dispatch)")
    if idx >= 0:
        changes_made.append(f"FAILED: Dispatch commit pattern not found. 'db.refresh(dispatch)' found at index {idx}")
    else:
        changes_made.append("FAILED: Dispatch commit pattern not found. 'db.refresh(dispatch)' not found either")

# ── Fix 2: Payment commit (line 3473 area) ───────────────────────────────
pattern2_start = "    db.commit()\n    db.refresh(payment)\n    for row in created_allocations:\n        db.refresh(row)\n"
replacement2 = (
    "    try:\n"
    "        db.commit()\n"
    "    except Exception as _e:\n"
    "        db.rollback()\n"
    "        raise HTTPException(status_code=500, detail=f\"Failed to create payment: {_e}\") from _e\n"
    "    db.refresh(payment)\n"
    "    for row in created_allocations:\n"
    "        db.refresh(row)\n"
)
if pattern2_start in content:
    content = content.replace(pattern2_start, replacement2, 1)
    changes_made.append("Payment commit wrapped in try/except/rollback")
else:
    idx = content.find("db.refresh(payment)")
    if idx >= 0:
        changes_made.append(f"FAILED: Payment commit pattern not found. 'db.refresh(payment)' found at index {idx}")
    else:
        changes_made.append("FAILED: Payment commit pattern not found")

# ── Fix 3: Invoice commit (line 3910 area) ──────────────────────────────
pattern3_start = "    db.commit()\n    db.refresh(invoice)\n    for row in line_rows:\n        db.refresh(row)\n\n    return {\n        \"invoice\": _serialize_steel_invoice(\n"
replacement3 = (
    "    try:\n"
    "        db.commit()\n"
    "    except Exception as _e:\n"
    "        db.rollback()\n"
    "        raise HTTPException(status_code=500, detail=f\"Failed to create invoice: {_e}\") from _e\n"
    "    db.refresh(invoice)\n"
    "    for row in line_rows:\n"
    "        db.refresh(row)\n\n"
    "    return {\n"
    "        \"invoice\": _serialize_steel_invoice(\n"
)
if pattern3_start in content:
    content = content.replace(pattern3_start, replacement3, 1)
    changes_made.append("Invoice commit wrapped in try/except/rollback")
else:
    idx = content.find("db.refresh(invoice)")
    if idx >= 0:
        changes_made.append(f"FAILED: Invoice commit pattern not found. 'db.refresh(invoice)' found at index {idx}")
    else:
        changes_made.append("FAILED: Invoice commit pattern not found")

# ── Write back ───────────────────────────────────────────────────────────
with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

# Report results
print("=== Phase 2 Remaining Fixes ===")
for c in changes_made:
    print(f"  {c}")
print(f"\n  Total lines in file: {len(lines)}")
