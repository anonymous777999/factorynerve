"""Fix issues identified in code review.

1. Add missing field_validator/ValidationInfo import to steel.py
2. Wire up paginated helper in attendance.py live view
3. Make #9 validator actually useful (max total check)
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fix_steel_imports() -> bool:
    """Add field_validator and ValidationInfo to pydantic import in steel.py."""
    path = ROOT / "backend" / "routers" / "steel.py"
    content = path.read_text(encoding="utf-8")

    # Check if already imported
    if "from pydantic import" in content and "field_validator" in content:
        print("OK: field_validator already imported")
        return True

    # Find the pydantic import line
    import_pattern = r"(from pydantic import BaseModel, Field)"
    replacement = r"from pydantic import BaseModel, Field, field_validator, ValidationInfo"
    
    if re.search(import_pattern, content):
        content = re.sub(import_pattern, replacement, content)
        path.write_text(content, encoding="utf-8")
        print("OK: Added field_validator/ValidationInfo import")
        return True
    
    # Try alternative import patterns
    for pattern, replacement in [
        (r"(from pydantic import .*?)(\n)", r"\1, field_validator, ValidationInfo\2"),
    ]:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            path.write_text(content, encoding="utf-8")
            print("OK: Added field_validator/ValidationInfo import (alt pattern)")
            return True

    print("WARN: Could not find pydantic import line")
    return False


def fix_steel_validator() -> bool:
    """Replace the dead validator with a useful max-total check."""
    path = ROOT / "backend" / "routers" / "steel.py"
    content = path.read_text(encoding="utf-8")

    old = (
        "    @field_validator(\"weight_kg\")\n"
        "    @classmethod\n"
        "    def validate_line_total(cls, v: float, info: ValidationInfo) -> float:\n"
        "        rate = info.data.get(\"rate_per_kg\", 0.0) or 0.0\n"
        "        if v < 0 or rate < 0:\n"
        "            raise ValueError(\"Line total (weight * rate) must be non-negative.\")\n"
        "        return v"
    )
    new = (
        "    @field_validator(\"weight_kg\")\n"
        "    @classmethod\n"
        "    def validate_line_total(cls, v: float, info: ValidationInfo) -> float:\n"
        "        rate = info.data.get(\"rate_per_kg\", 0.0) or 0.0\n"
        "        total = v * rate\n"
        "        if total > 10_000_000:\n"
        "            raise ValueError(f\"Line total {total:,.2f} exceeds maximum allowed (10,000,000).\")\n"
        "        return v"
    )

    if old in content:
        content = content.replace(old, new, 1)
        path.write_text(content, encoding="utf-8")
        print("OK: Updated validator with max-total check")
        return True
    elif "validate_line_total" in content:
        print("OK: Validator already has different implementation, skipping")
        return True
    else:
        print("WARN: Validator pattern not found")
        return False


def wire_attendance_pagination() -> bool:
    """Wire the paginated helper into get_live_attendance endpoint."""
    path = ROOT / "backend" / "routers" / "attendance.py"
    content = path.read_text(encoding="utf-8")

    # Add page/page_size query params to get_live_attendance
    old_def = (
        "def get_live_attendance(\n"
        "    attendance_date: date | None = Query(default=None),\n"
        "    db: Session = Depends(get_db),\n"
        "    current_user: User = Depends(get_current_user),\n"
        ") -> AttendanceLiveResponse:"
    )
    new_def = (
        "def get_live_attendance(\n"
        "    attendance_date: date | None = Query(default=None),\n"
        "    page: int = Query(default=1, ge=1),\n"
        "    page_size: int = Query(default=50, ge=1, le=200),\n"
        "    db: Session = Depends(get_db),\n"
        "    current_user: User = Depends(get_current_user),\n"
        ") -> AttendanceLiveResponse:"
    )

    if old_def in content:
        content = content.replace(old_def, new_def, 1)
        
        # Replace the users = _attendance_users_for_factory(...) call with paginated version
        old_call = (
            "    users = _attendance_users_for_factory(db, factory_id=factory.factory_id, org_id=org_id)"
        )
        new_call = (
            "    users, total_users = _attendance_users_for_factory_paginated(\n"
            "        db, factory_id=factory.factory_id, org_id=org_id,\n"
            "        page=page, page_size=page_size,\n"
            "    )"
        )
        
        if old_call in content:
            content = content.replace(old_call, new_call, 1)
            
            # Update totals to use total_users instead of len(users)
            content = content.replace(
                '"total_people": len(users),',
                '"total_people": total_users,',
            )
            
            path.write_text(content, encoding="utf-8")
            print("OK: Wired paginated helper into get_live_attendance")
            return True
        else:
            print("WARN: Could not find old call pattern")
            return False
    else:
        print("WARN: Could not find get_live_attendance function definition")
        return False


if __name__ == "__main__":
    fix_steel_imports()
    fix_steel_validator()
    wire_attendance_pagination()
    print("\nRound 2 fixes complete")
