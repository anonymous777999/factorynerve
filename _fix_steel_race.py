"""Fix TOCTOU race conditions in steel.py by adding row-level locks."""
import re

path = "backend/routers/steel.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# Fix 1: Dispatch creation - lock items before balance check
old1 = (
    "    if _dispatch_status_posts_inventory(requested_status):\n"
    "        balances = stock_balances_for_factory(db, factory.factory_id)\n"
    "        for item_id, requested_weight in requested_by_item.items():\n"
    "            available = float(balances.get(item_id, 0.0))"
)
new1 = (
    "    if _dispatch_status_posts_inventory(requested_status):\n"
    "        # Lock all affected item rows to prevent concurrent stock underflow (TOCTOU race)\n"
    "        for lock_item_id in requested_by_item:\n"
    "            db.query(SteelInventoryItem).filter(SteelInventoryItem.id == lock_item_id).with_for_update().first()\n"
    "        balances = stock_balances_for_factory(db, factory.factory_id)\n"
    "        for item_id, requested_weight in requested_by_item.items():\n"
    "            available = float(balances.get(item_id, 0.0))"
)
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("Fix 1 applied: dispatch creation locking")
else:
    print("ERROR: Fix 1 pattern not found!")

# Fix 2: Dispatch status update - lock items before balance check
old2 = (
    "    if _dispatch_status_posts_inventory(next_status) and not _dispatch_has_posted_inventory(dispatch):\n"
    "        requested_by_item: dict[int, float] = {}\n"
    "        for row in line_rows:\n"
    "            requested_by_item[row.item_id] = float(requested_by_item.get(row.item_id, 0.0)) + float(row.weight_kg or 0.0)\n"
    "        balances = stock_balances_for_factory(db, factory.factory_id)\n"
    "        for item_id, requested_weight in requested_by_item.items():\n"
    "            available = float(balances.get(item_id, 0.0))"
)
new2 = (
    "    if _dispatch_status_posts_inventory(next_status) and not _dispatch_has_posted_inventory(dispatch):\n"
    "        requested_by_item: dict[int, float] = {}\n"
    "        for row in line_rows:\n"
    "            requested_by_item[row.item_id] = float(requested_by_item.get(row.item_id, 0.0)) + float(row.weight_kg or 0.0)\n"
    "        # Lock all affected item rows to prevent concurrent stock underflow (TOCTOU race)\n"
    "        for lock_item_id in requested_by_item:\n"
    "            db.query(SteelInventoryItem).filter(SteelInventoryItem.id == lock_item_id).with_for_update().first()\n"
    "        balances = stock_balances_for_factory(db, factory.factory_id)\n"
    "        for item_id, requested_weight in requested_by_item.items():\n"
    "            available = float(balances.get(item_id, 0.0))"
)
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("Fix 2 applied: dispatch status update locking")
else:
    print("ERROR: Fix 2 pattern not found!")

# Fix 3: Batch creation - lock input item before balance check
old3 = (
    "    balances = stock_balances_for_factory(db, factory.factory_id)\n"
    "    available_input = float(balances.get(input_item.id, 0.0))\n"
    "    if available_input + 0.0001 < payload.input_quantity_kg:"
)
new3 = (
    "    # Lock the input item row to prevent concurrent stock underflow (TOCTOU race)\n"
    "    db.query(SteelInventoryItem).filter(SteelInventoryItem.id == input_item.id).with_for_update().first()\n"
    "    balances = stock_balances_for_factory(db, factory.factory_id)\n"
    "    available_input = float(balances.get(input_item.id, 0.0))\n"
    "    if available_input + 0.0001 < payload.input_quantity_kg:"
)
if old3 in content:
    content = content.replace(old3, new3, 1)
    changes += 1
    print("Fix 3 applied: batch creation locking")
else:
    print("ERROR: Fix 3 pattern not found!")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nTotal changes applied: {changes}")
