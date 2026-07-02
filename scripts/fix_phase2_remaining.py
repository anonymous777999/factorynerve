"""
Phase 2 remaining fixes - applies directly to steel.py.
Avoids print() to prevent encoding issues.
"""

import sys

STEEL_ROUTER = "backend/routers/steel.py"

with open(STEEL_ROUTER, "r", encoding="utf-8") as f:
    content = f.read()

changes = []

# --- Fix A: Add output_item FOR UPDATE in batch creation ---
# Line ~4520 already locks input_item. Add lock for output_item too.
old_a = "    # Lock the input item row to prevent concurrent stock underflow (TOCTOU race)\n    db.query(SteelInventoryItem).filter(SteelInventoryItem.id == input_item.id).with_for_update().first()"
new_a = "    # Lock both input and output item rows to prevent concurrent stock corruption\n    db.query(SteelInventoryItem).filter(SteelInventoryItem.id == input_item.id).with_for_update().first()\n    db.query(SteelInventoryItem).filter(SteelInventoryItem.id == output_item.id).with_for_update().first()"

if old_a in content:
    content = content.replace(old_a, new_a, 1)
    changes.append("A: FOR UPDATE on output_item in batch creation")
else:
    changes.append("A: SKIPPED - pattern not found")

# --- Fix B: Add try/except/rollback around batch creation db.commit() ---
old_b = "    db.commit()\n    db.refresh(batch)\n    return {\n        \"batch\": serialize_batch(\n            batch,\n            input_item=input_item,\n            output_item=output_item,\n            operator=current_user,\n            can_view_financials=_can_view_steel_financials(current_user),\n        )\n    }"
new_b = "    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create batch: {error}\") from error\n    db.refresh(batch)\n    return {\n        \"batch\": serialize_batch(\n            batch,\n            input_item=input_item,\n            output_item=output_item,\n            operator=current_user,\n            can_view_financials=_can_view_steel_financials(current_user),\n        )\n    }"

if old_b in content:
    content = content.replace(old_b, new_b, 1)
    changes.append("B: try/except/rollback on batch creation commit")
else:
    changes.append("B: SKIPPED - pattern not found")

# --- Fix C: Add try/except/rollback around dispatch creation db.commit() ---
old_c = "    db.commit()\n    db.refresh(dispatch)\n    for row in dispatch_line_rows:\n        db.refresh(row)\n\n    # Notify approval system of completion\n    if approval_decision_dispatch.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision_dispatch.instance_id)\n\n    # Post inventory movements (only if status triggers it)"
new_c = "    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create dispatch: {error}\") from error\n    db.refresh(dispatch)\n    for row in dispatch_line_rows:\n        db.refresh(row)\n\n    # Notify approval system of completion\n    if approval_decision_dispatch.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision_dispatch.instance_id)\n\n    # Post inventory movements (only if status triggers it)"

if old_c in content:
    content = content.replace(old_c, new_c, 1)
    changes.append("C: try/except/rollback on dispatch creation commit")
else:
    changes.append("C: SKIPPED - pattern not found")

# --- Fix D: Add try/except/rollback around payment creation db.commit() ---
old_d = "    db.commit()\n    db.refresh(payment)\n\n    # Refresh payment statuses for all affected invoices\n    if invoice_ids:\n        _refresh_invoice_payment_statuses(\n            db,\n            factory_id=factory.factory_id,\n            invoice_ids=invoice_ids,\n        )\n\n    # Build response\n    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=payload.customer_id)"
new_d = "    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create payment: {error}\") from error\n    db.refresh(payment)\n\n    # Refresh payment statuses for all affected invoices\n    if invoice_ids:\n        _refresh_invoice_payment_statuses(\n            db,\n            factory_id=factory.factory_id,\n            invoice_ids=invoice_ids,\n        )\n\n    # Build response\n    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=payload.customer_id)"

if old_d in content:
    content = content.replace(old_d, new_d, 1)
    changes.append("D: try/except/rollback on payment creation commit")
else:
    changes.append("D: SKIPPED - pattern not found")

# --- Fix E: Add try/except/rollback around invoice creation db.commit() ---
old_e = "    db.commit()\n    db.refresh(invoice)\n\n    # Build response\n    approval_decision_invoice = APPROVAL_SERVICE.initiate_approval(db,"
new_e = "    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f\"Failed to create invoice: {error}\") from error\n    db.refresh(invoice)\n\n    # Build response\n    approval_decision_invoice = APPROVAL_SERVICE.initiate_approval(db,"

if old_e in content:
    content = content.replace(old_e, new_e, 1)
    changes.append("E: try/except/rollback on invoice creation commit")
else:
    changes.append("E: SKIPPED - pattern not found")

# Write back
with open(STEEL_ROUTER, "w", encoding="utf-8") as f:
    f.write(content)

# Write results to a file to avoid encoding issues
result_path = "scripts/phase2_result.txt"
with open(result_path, "w", encoding="utf-8") as f:
    f.write("Phase 2 Remaining Fixes - Results\n")
    f.write("=" * 40 + "\n")
    for c in changes:
        f.write(c + "\n")
    f.write(f"\nTotal applied: {sum(1 for c in changes if 'SKIPPED' not in c)}\n")
    f.write(f"Total skipped: {sum(1 for c in changes if 'SKIPPED' in c)}\n")
