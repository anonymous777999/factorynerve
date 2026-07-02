"""
Phase 2 - Transaction Integrity fixes for steel.py.

Adds:
1. FOR UPDATE locking to batch creation (input/output items)
2. FOR UPDATE locking to reconciliation approval (item being adjusted)
3. try/except/rollback wrappers around critical db.commit() calls
"""

import sys

STEEL_ROUTER = r"backend/routers/steel.py"

with open(STEEL_ROUTER, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# Fix 1: Add FOR UPDATE to batch creation endpoint
old_batch_lock = (
    '    if existing_batch:\n        raise HTTPException(status_code=409, detail="Batch code already exists in this factory.")\n\n    input_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.input_item_id)\n    output_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.output_item_id)'
)
new_batch_lock = (
    '    if existing_batch:\n        raise HTTPException(status_code=409, detail="Batch code already exists in this factory.")\n\n    input_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.input_item_id)\n    output_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.output_item_id)\n    # Pessimistic lock both items to prevent concurrent stock corruption\n    db.query(SteelInventoryItem).filter(SteelInventoryItem.id == input_item.id).with_for_update().first()\n    db.query(SteelInventoryItem).filter(SteelInventoryItem.id == output_item.id).with_for_update().first()'
)

if old_batch_lock in content:
    content = content.replace(old_batch_lock, new_batch_lock, 1)
    changes += 1
    print("[OK] Fix 1: FOR UPDATE on batch input/output items")
else:
    print("[SKIP] Fix 1: batch lock pattern not found")

# Fix 2: Add FOR UPDATE to reconciliation approval endpoint
old_recon_lock = (
    '    if abs(float(row.variance_kg or 0.0)) > 0.0001:\n        db.add(\n            SteelInventoryTransaction('
)
new_recon_lock = (
    '    if abs(float(row.variance_kg or 0.0)) > 0.0001:\n        # Pessimistic lock the item before posting the ledger adjustment\n        db.query(SteelInventoryItem).filter(SteelInventoryItem.id == row.item_id).with_for_update().first()\n        db.add(\n            SteelInventoryTransaction('
)

if old_recon_lock in content:
    content = content.replace(old_recon_lock, new_recon_lock, 1)
    changes += 1
    print("[OK] Fix 2: FOR UPDATE on reconciliation adjustment item")
else:
    print("[SKIP] Fix 2: reconciliation lock pattern not found")

# Fix 3: Add try/except/rollback around db.commit() in batch creation
old_batch_commit = (
    '    db.commit()\n    db.refresh(batch)\n\n    # Notify approval system of completion\n    if approval_decision_batch.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision_batch.instance_id)\n\n    return {\n        "batch": serialize_batch(\n            batch,\n            input_item=input_item,\n            output_item=output_item,\n            operator=operator_map.get(batch.operator_user_id),\n        )\n    }'
)
new_batch_commit = (
    '    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f"Failed to create batch: {error}") from error\n    db.refresh(batch)\n\n    # Notify approval system of completion\n    if approval_decision_batch.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision_batch.instance_id)\n\n    return {\n        "batch": serialize_batch(\n            batch,\n            input_item=input_item,\n            output_item=output_item,\n            operator=operator_map.get(batch.operator_user_id),\n        )\n    }'
)

if old_batch_commit in content:
    content = content.replace(old_batch_commit, new_batch_commit, 1)
    changes += 1
    print("[OK] Fix 3: try/except/rollback on batch creation commit")
else:
    print("[SKIP] Fix 3: batch commit pattern not found")

# Fix 4: Add try/except/rollback around db.commit() in dispatch creation
old_dispatch_commit = (
    '    db.commit()\n    db.refresh(dispatch)\n\n    # Notify approval system of completion\n    if approval_decision_dispatch.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision_dispatch.instance_id)\n\n    # Post inventory movements (only if status triggers it)\n    if _dispatch_status_posts_inventory(\n        payload.status\n    ):\n        _create_dispatch_inventory_movements(\n            db,\n            factory=factory,\n            dispatch=dispatch,\n            dispatch_lines=dispatch_lines,\n            current_user=current_user,\n        )'
)
new_dispatch_commit = (
    '    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f"Failed to create dispatch: {error}") from error\n    db.refresh(dispatch)\n\n    # Notify approval system of completion\n    if approval_decision_dispatch.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision_dispatch.instance_id)\n\n    # Post inventory movements (only if status triggers it)\n    if _dispatch_status_posts_inventory(\n        payload.status\n    ):\n        _create_dispatch_inventory_movements(\n            db,\n            factory=factory,\n            dispatch=dispatch,\n            dispatch_lines=dispatch_lines,\n            current_user=current_user,\n        )'
)

if old_dispatch_commit in content:
    content = content.replace(old_dispatch_commit, new_dispatch_commit, 1)
    changes += 1
    print("[OK] Fix 4: try/except/rollback on dispatch creation commit")
else:
    print("[SKIP] Fix 4: dispatch commit pattern not found")

# Fix 5: Add try/except/rollback around db.commit() in reconciliation approve
old_recon_approve_commit = (
    '    db.commit()\n    db.refresh(row)\n\n    # Step 3: Notify approval system of completion\n    if approval_decision.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision.instance_id)\n\n    return {\n        "reconciliation": {'
)
new_recon_approve_commit = (
    '    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f"Failed to approve reconciliation: {error}") from error\n    db.refresh(row)\n\n    # Step 3: Notify approval system of completion\n    if approval_decision.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision.instance_id)\n\n    return {\n        "reconciliation": {'
)

if old_recon_approve_commit in content:
    content = content.replace(old_recon_approve_commit, new_recon_approve_commit, 1)
    changes += 1
    print("[OK] Fix 5: try/except/rollback on reconciliation approve commit")
else:
    print("[SKIP] Fix 5: recon approve commit pattern not found")

# Fix 6: Add try/except/rollback around db.commit() in reconciliation reject
old_recon_reject_commit = (
    '    db.commit()\n    db.refresh(row)\n\n    # Notify approval system of completion\n    if approval_decision.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision.instance_id)\n\n    return {\n        "reconciliation": {\n            "id": row.id,\n            "status": row.status,\n            "confidence_status": row.confidence_status,\n            "mismatch_cause": row.mismatch_cause,\n        }\n    }'
)
new_recon_reject_commit = (
    '    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f"Failed to reject reconciliation: {error}") from error\n    db.refresh(row)\n\n    # Notify approval system of completion\n    if approval_decision.instance_id:\n        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision.instance_id)\n\n    return {\n        "reconciliation": {\n            "id": row.id,\n            "status": row.status,\n            "confidence_status": row.confidence_status,\n            "mismatch_cause": row.mismatch_cause,\n        }\n    }'
)

if old_recon_reject_commit in content:
    content = content.replace(old_recon_reject_commit, new_recon_reject_commit, 1)
    changes += 1
    print("[OK] Fix 6: try/except/rollback on reconciliation reject commit")
else:
    print("[SKIP] Fix 6: recon reject commit pattern not found")

# Fix 7: Add try/except/rollback around db.commit() in payment creation
old_payment_commit = (
    '    db.commit()\n    db.refresh(payment)\n\n    # Refresh payment statuses for all affected invoices\n    if invoice_ids:\n        _refresh_invoice_payment_statuses(\n            db,\n            factory_id=factory.factory_id,\n            invoice_ids=invoice_ids,\n        )\n\n    # Build response\n    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=payload.customer_id)'
)
new_payment_commit = (
    '    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f"Failed to create payment: {error}") from error\n    db.refresh(payment)\n\n    # Refresh payment statuses for all affected invoices\n    if invoice_ids:\n        _refresh_invoice_payment_statuses(\n            db,\n            factory_id=factory.factory_id,\n            invoice_ids=invoice_ids,\n        )\n\n    # Build response\n    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=payload.customer_id)'
)

if old_payment_commit in content:
    content = content.replace(old_payment_commit, new_payment_commit, 1)
    changes += 1
    print("[OK] Fix 7: try/except/rollback on payment creation commit")
else:
    print("[SKIP] Fix 7: payment commit pattern not found")

# Fix 8: Add try/except/rollback around db.commit() in invoice creation
old_invoice_commit = (
    '    db.commit()\n    db.refresh(invoice)\n\n    # Build response'
)
new_invoice_commit = (
    '    try:\n        db.commit()\n    except Exception as error:\n        db.rollback()\n        raise HTTPException(status_code=500, detail=f"Failed to create invoice: {error}") from error\n    db.refresh(invoice)\n\n    # Build response'
)

if old_invoice_commit in content:
    content = content.replace(old_invoice_commit, new_invoice_commit, 1)
    changes += 1
    print("[OK] Fix 8: try/except/rollback on invoice creation commit")
else:
    print("[SKIP] Fix 8: invoice commit pattern not found")

# Write back
with open(STEEL_ROUTER, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n{'='*50}")
print(f"Total changes applied: {changes}")
print(f"[DONE] steel.py updated")
