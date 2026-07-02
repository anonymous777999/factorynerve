"""Fix steel.py: migrate invoice detail endpoint to PDP and clean unused imports."""
import re

path = "backend/routers/steel.py"
with open(path, "r") as f:
    content = f.read()

# 1. Fix invoice detail endpoint - replace require_any_role with PDP
old_invoice = '''def get_steel_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    invoice = (
        db.query(SteelSalesInvoice)
        .filter(SteelSalesInvoice.id == invoice_id, SteelSalesInvoice.factory_id == factory.factory_id)
        .first()
    )'''

new_invoice = '''def get_steel_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="invoice.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    invoice = (
        db.query(SteelSalesInvoice)
        .filter(SteelSalesInvoice.id == invoice_id, SteelSalesInvoice.factory_id == factory.factory_id)
        .first()
    )'''

# Try exact match first, then fuzzy
if old_invoice in content:
    content = content.replace(old_invoice, new_invoice, 1)
    print("invoice detail: REPLACED")
else:
    print("invoice detail: NOT FOUND (trying regex)")
    # Try regex as fallback
    pattern = r'def get_steel_invoice_detail\([^)]+\) -> dict:\n    require_any_role\([^)]+\)\n    try:\n        factory = require_active_steel_factory'
    if re.search(pattern, content):
        content = re.sub(pattern, 
            'def get_steel_invoice_detail(\n    invoice_id: int,\n    db: Session = Depends(get_db),\n    current_user: User = Depends(get_current_user),\n) -> dict:\n    try:\n        factory = require_active_steel_factory',
            content, 1)
        print("invoice detail: REPLACED via regex")
    else:
        print("invoice detail: NOT FOUND via regex either")

# 2. Fix unused is_admin_or_owner import
content = content.replace(
    "from backend.authorization import PDP, ResourceContext\nfrom backend.rbac import require_any_role, require_role",
    "from backend.authorization import PDP, ResourceContext\nfrom backend.rbac import require_any_role, require_role",
    1
)
# Actually just remove is_admin_or_owner from the import
old_import = "from backend.authorization import PDP, ResourceContext\nfrom backend.rbac import is_admin_or_owner, require_any_role, require_role"
new_import = "from backend.authorization import PDP, ResourceContext\nfrom backend.rbac import require_any_role, require_role"
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("rbac import: FIXED (removed is_admin_or_owner)")
elif "is_admin_or_owner" not in content:
    print("rbac import: is_admin_or_owner already removed")
else:
    print("rbac import: is_admin_or_owner still present but import line doesn't match")

with open(path, "w") as f:
    f.write(content)

print("Done")
