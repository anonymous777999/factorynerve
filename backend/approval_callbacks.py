"""Approval callbacks for workflow completion notifications."""
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
