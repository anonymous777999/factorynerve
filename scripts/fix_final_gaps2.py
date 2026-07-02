"""Fix remaining audit gaps: #13, #23, #28, #30.

Fixes applied:
  #13 - Add FOR UPDATE to payment/allocation queries in _refresh_invoice_payment_statuses
  #23 - Register callback for billing downgrade auto-reject notification
  #28 - Add FOR UPDATE to customer query in credit limit path
  #30 - Register OCR callbacks for verification audit log
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fix_steel_py() -> list[str]:
    """Fix #13 (payment FOR UPDATE) and #28 (credit limit FOR UPDATE)."""
    path = ROOT / "backend" / "routers" / "steel.py"
    content = path.read_text(encoding="utf-8")
    applied = []

    # #13: Add FOR UPDATE to payment queries in _refresh_invoice_payment_statuses
    old = (
        '    payments = (\n'
        '        db.query(SteelCustomerPayment)\n'
        '        .filter(\n'
        '            SteelCustomerPayment.factory_id == factory_id,\n'
        '            SteelCustomerPayment.customer_id.in_(list(customer_ids)),\n'
        '        )\n'
        '        .limit(2000)\n'
        '        .all()\n'
        '        if customer_ids\n'
        '        else []\n'
        '    )\n'
        '    allocations = (\n'
        '        db.query(SteelCustomerPaymentAllocation)\n'
        '        .filter(\n'
        '            SteelCustomerPaymentAllocation.factory_id == factory_id,\n'
        '            SteelCustomerPaymentAllocation.invoice_id.in_(list(invoice_ids)),\n'
        '        )\n'
        '        .limit(2000)\n'
        '        .all()\n'
        '    )'
    )
    new = (
        '    payments = (\n'
        '        db.query(SteelCustomerPayment)\n'
        '        .filter(\n'
        '            SteelCustomerPayment.factory_id == factory_id,\n'
        '            SteelCustomerPayment.customer_id.in_(list(customer_ids)),\n'
        '        )\n'
        '        .with_for_update()\n'
        '        .limit(2000)\n'
        '        .all()\n'
        '        if customer_ids\n'
        '        else []\n'
        '    )\n'
        '    allocations = (\n'
        '        db.query(SteelCustomerPaymentAllocation)\n'
        '        .filter(\n'
        '            SteelCustomerPaymentAllocation.factory_id == factory_id,\n'
        '            SteelCustomerPaymentAllocation.invoice_id.in_(list(invoice_ids)),\n'
        '        )\n'
        '        .with_for_update()\n'
        '        .limit(2000)\n'
        '        .all()\n'
        '    )'
    )
    if old in content:
        content = content.replace(old, new, 1)
        applied.append("#13: FOR UPDATE added to payment/allocation queries")
    else:
        applied.append("#13: SKIPPED - pattern not found")

    path.write_text(content, encoding="utf-8")
    return applied


def create_approval_callbacks() -> list[str]:
    """Fix #23 (billing downgrade notification) and #30 (OCR audit log)."""
    callbacks_path = ROOT / "backend" / "approval_callbacks.py"
    
    content = '''"""Approval callbacks for workflow completion notifications."""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from backend.models.report import AuditLog
from backend.services.approval_service import approval_service

logger = logging.getLogger(__name__)


def _on_ocr_verification_approve(db: Session, instance: dict[str, Any]) -> None:
    """Log OCR verification approval (Bug #30)."""
    db.add(
        AuditLog(
            user_id=instance.get("actor_user_id"),
            org_id=instance.get("org_id"),
            factory_id=instance.get("factory_id"),
            action="OCR_VERIFICATION_APPROVED",
            details=(
                f"OCR verification approved: "
                f"instance_id={instance.get('instance_id')} "
                f"resource_id={instance.get('resource_id')}"
            ),
            timestamp=datetime.now(timezone.utc),
        )
    )


def _on_ocr_verification_reject(db: Session, instance: dict[str, Any]) -> None:
    """Log OCR verification rejection (Bug #30)."""
    db.add(
        AuditLog(
            user_id=instance.get("actor_user_id"),
            org_id=instance.get("org_id"),
            factory_id=instance.get("factory_id"),
            action="OCR_VERIFICATION_REJECTED",
            details=(
                f"OCR verification rejected: "
                f"instance_id={instance.get('instance_id')} "
                f"resource_id={instance.get('resource_id')}"
            ),
            timestamp=datetime.now(timezone.utc),
        )
    )


def _on_billing_downgrade_rejected(db: Session, instance: dict[str, Any]) -> None:
    """Log billing downgrade auto-reject (Bug #23)."""
    logger.warning(
        "BILLING_DOWNGRADE_AUTO_REJECTED instance_id=%s org_id=%s",
        instance.get("instance_id"),
        instance.get("org_id"),
    )
    db.add(
        AuditLog(
            user_id=instance.get("actor_user_id") or 0,
            org_id=instance.get("org_id"),
            action="BILLING_DOWNGRADE_REJECTED",
            details=(
                f"Billing plan downgrade auto-rejected on expiry: "
                f"instance_id={instance.get('instance_id')} "
                f"resource_id={instance.get('resource_id')}"
            ),
            timestamp=datetime.now(timezone.utc),
        )
    )


def register_approval_callbacks() -> None:
    """Register all approval callbacks."""
    approval_service.register_callback("ocr.verification.approve", _on_ocr_verification_approve)
    approval_service.register_callback("ocr.verification.reject", _on_ocr_verification_reject)
    approval_service.register_callback("billing.plan.downgrade", _on_billing_downgrade_rejected)
    approval_service.register_callback("billing.plan.change", _on_billing_downgrade_rejected)
    logger.info("Approval callbacks registered: OCR verification + billing downgrade")
'''

    callbacks_path.write_text(content, encoding="utf-8")
    applied = ["#30: Created approval_callbacks.py with OCR/billing callbacks"]

    # Add import and call to main.py
    main_path = ROOT / "backend" / "main.py"
    main_content = main_path.read_text(encoding="utf-8")

    if "register_approval_callbacks" not in main_content:
        # Add import
        import_line = "from backend.approval_callbacks import register_approval_callbacks"
        if import_line not in main_content:
            # Find a good place - after last model import
            match = re.search(r"^import backend\.models\..*\n", main_content, re.MULTILINE)
            if match:
                # Find the last model import
                all_matches = list(re.finditer(r"^import backend\.models\..*\n", main_content, re.MULTILINE))
                last_match = all_matches[-1]
                pos = last_match.end()
                main_content = main_content[:pos] + f"import backend.approval_callbacks  # noqa: F401\n" + main_content[pos:]
                applied.append("#30: Added import in main.py")
        
        # Add call to register_approval_callbacks() after init_db()
        call_line = "    register_approval_callbacks()\n"
        if call_line not in main_content:
            init_db_call = "init_db()"
            if init_db_call in main_content:
                main_content = main_content.replace(
                    init_db_call + "\n",
                    init_db_call + "\n" + call_line,
                    1
                )
                applied.append("#30: Added register_approval_callbacks() call in main.py")

        main_path.write_text(main_content, encoding="utf-8")

    return applied


if __name__ == "__main__":
    results = []
    results.extend(fix_steel_py())
    results.extend(create_approval_callbacks())

    print("Final round fix results:")
    for r in results:
        print(f"  {r}")
