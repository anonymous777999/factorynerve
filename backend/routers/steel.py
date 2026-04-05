"""Steel-industry operations module: trusted stock, batches, and owner visibility."""

from __future__ import annotations

import mimetypes
import re
import secrets
from difflib import SequenceMatcher
from io import BytesIO
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.factory import Factory
from backend.models.report import AuditLog
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.steel_dispatch import SteelDispatch
from backend.models.steel_dispatch_line import SteelDispatchLine
from backend.models.steel_customer import SteelCustomer
from backend.models.steel_customer_follow_up_task import SteelCustomerFollowUpTask
from backend.models.steel_customer_payment import SteelCustomerPayment
from backend.models.steel_customer_payment_allocation import SteelCustomerPaymentAllocation
from backend.models.steel_sales_invoice import SteelSalesInvoice
from backend.models.steel_sales_invoice_line import SteelSalesInvoiceLine
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.models.user import User, UserRole
from backend.plans import get_org_plan, has_plan_feature, min_plan_for_feature
from backend.rbac import is_admin_or_owner, require_any_role, require_role
from backend.security import get_current_user
from backend.services.steel_service import (
    build_steel_overview,
    build_steel_realization_metrics,
    coerce_utc_datetime,
    generate_batch_code,
    generate_dispatch_number,
    generate_gate_pass_number,
    generate_invoice_number,
    latest_reconciliations_for_factory,
    normalize_display_unit,
    normalize_steel_category,
    normalize_transaction_type,
    recent_steel_batches,
    recent_transactions,
    require_active_steel_factory,
    serialize_batch,
    serialize_stock_row,
    severity_from_variance,
    stock_reconciliation_summary_for_factory,
    stock_balances_for_factory,
    stock_confidence_for_item,
    variance_reason,
)
from backend.tenancy import resolve_org_id
from backend.utils import normalize_identifier_code, normalize_phone_number, normalize_reference_code, sanitize_text


router = APIRouter(tags=["Steel"])
SteelPaymentMode = Literal["bank_transfer", "cash", "cheque", "upi"]
SteelCustomerStatus = Literal["active", "on_hold", "blocked"]
SteelDispatchStatus = Literal["pending", "loaded", "dispatched", "delivered", "cancelled"]
SteelVehicleType = Literal["truck", "trailer", "pickup", "other"]
SteelStockMismatchCause = Literal[
    "counting_error",
    "process_loss",
    "theft_or_leakage",
    "wrong_entry",
    "delayed_dispatch_update",
    "other",
]
SteelFollowUpTaskPriority = Literal["low", "medium", "high", "critical"]
SteelFollowUpTaskStatus = Literal["open", "in_progress", "done", "cancelled"]
SteelCustomerVerificationStatus = Literal[
    "draft",
    "format_valid",
    "pending_review",
    "verified",
    "mismatch",
    "rejected",
    "expired",
]
SteelCustomerVerificationDocType = Literal["pan", "gst"]
STEEL_VERIFICATION_DOC_MAX_BYTES = 6 * 1024 * 1024
STEEL_VERIFICATION_DOC_DIR = Path(__file__).resolve().parents[2] / "var" / "steel_customer_verification"
_STEEL_VERIFICATION_ALLOWED_EXTENSIONS = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}
_STEEL_STOCK_MISMATCH_CAUSES: set[str] = {
    "counting_error",
    "process_loss",
    "theft_or_leakage",
    "wrong_entry",
    "delayed_dispatch_update",
    "other",
}
_PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_GST_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


class SteelInventoryItemCreateRequest(BaseModel):
    item_code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=160)
    category: str = Field(max_length=40)
    display_unit: str = Field(default="kg", max_length=16)
    current_rate_per_kg: float | None = Field(default=None, ge=0)

    @field_validator("item_code")
    @classmethod
    def validate_item_code(cls, value: str) -> str:
        return normalize_identifier_code(value, field_name="Item code", max_length=40) or value


class SteelInventoryTransactionCreateRequest(BaseModel):
    item_id: int
    transaction_type: str = Field(max_length=40)
    quantity_kg: float = Field(gt=0)
    direction: str | None = Field(default=None, max_length=16)
    notes: str | None = Field(default=None, max_length=500)


class SteelStockReconciliationCreateRequest(BaseModel):
    item_id: int
    physical_qty_kg: float = Field(ge=0)
    notes: str | None = Field(default=None, max_length=500)
    mismatch_cause: SteelStockMismatchCause | None = None


class SteelStockReconciliationReviewRequest(BaseModel):
    approver_notes: str | None = Field(default=None, max_length=500)
    rejection_reason: str | None = Field(default=None, max_length=500)
    mismatch_cause: SteelStockMismatchCause | None = None


class SteelBatchCreateRequest(BaseModel):
    batch_code: str | None = Field(default=None, max_length=40)
    production_date: date
    input_item_id: int
    output_item_id: int
    input_quantity_kg: float = Field(gt=0)
    expected_output_kg: float = Field(gt=0)
    actual_output_kg: float = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("batch_code")
    @classmethod
    def validate_batch_code(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="Batch code", max_length=40)


class SteelInvoiceLineCreateRequest(BaseModel):
    item_id: int
    batch_id: int | None = None
    description: str | None = Field(default=None, max_length=200)
    weight_kg: float = Field(gt=0)
    rate_per_kg: float = Field(ge=0)


class SteelInvoiceCreateRequest(BaseModel):
    invoice_number: str | None = Field(default=None, max_length=40)
    invoice_date: date
    customer_name: str | None = Field(default=None, max_length=200)
    customer_id: int | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    notes: str | None = Field(default=None, max_length=500)
    lines: list[SteelInvoiceLineCreateRequest] = Field(min_length=1, max_length=25)

    @field_validator("invoice_number")
    @classmethod
    def validate_invoice_number(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="Invoice number", max_length=40)


class SteelCustomerCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    tax_id: str | None = Field(default=None, max_length=64)
    gst_number: str | None = Field(default=None, max_length=32)
    pan_number: str | None = Field(default=None, max_length=16)
    company_type: str | None = Field(default=None, max_length=40)
    contact_person: str | None = Field(default=None, max_length=160)
    designation: str | None = Field(default=None, max_length=120)
    credit_limit: float | None = Field(default=None, ge=0)
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    status: SteelCustomerStatus = "active"
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return normalize_phone_number(value)

    @field_validator("tax_id")
    @classmethod
    def validate_tax_id(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="Tax ID", max_length=64)

    @field_validator("gst_number")
    @classmethod
    def validate_gst_number(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="GST number", max_length=32)

    @field_validator("pan_number")
    @classmethod
    def validate_pan_number(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="PAN number", max_length=16)


class SteelCustomerVerificationReviewRequest(BaseModel):
    decision: Literal["approve", "reject"]
    verification_source: str | None = Field(default=None, max_length=80)
    official_legal_name: str | None = Field(default=None, max_length=200)
    official_trade_name: str | None = Field(default=None, max_length=200)
    official_state: str | None = Field(default=None, max_length=120)
    mismatch_reason: str | None = Field(default=None, max_length=500)


class SteelCustomerPaymentAllocationRequest(BaseModel):
    invoice_id: int
    amount: float = Field(gt=0)


class SteelCustomerPaymentCreateRequest(BaseModel):
    customer_id: int
    invoice_id: int | None = None
    payment_date: date
    amount: float = Field(gt=0)
    payment_mode: SteelPaymentMode = "bank_transfer"
    reference_number: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=500)
    allocations: list[SteelCustomerPaymentAllocationRequest] | None = Field(default=None, max_length=25)

    @field_validator("reference_number")
    @classmethod
    def validate_reference_number(cls, value: str | None) -> str | None:
        return normalize_reference_code(value, field_name="Reference number", max_length=80)


class SteelDispatchLineCreateRequest(BaseModel):
    invoice_line_id: int
    weight_kg: float = Field(gt=0)


class SteelDispatchCreateRequest(BaseModel):
    dispatch_number: str | None = Field(default=None, max_length=40)
    gate_pass_number: str | None = Field(default=None, max_length=40)
    invoice_id: int
    dispatch_date: date
    truck_number: str = Field(min_length=2, max_length=40)
    transporter_name: str | None = Field(default=None, max_length=160)
    vehicle_type: SteelVehicleType | None = None
    truck_capacity_kg: float | None = Field(default=None, gt=0)
    driver_name: str = Field(min_length=2, max_length=120)
    driver_phone: str | None = Field(default=None, max_length=32)
    driver_license_number: str | None = Field(default=None, max_length=80)
    entry_time: datetime | None = None
    exit_time: datetime | None = None
    status: SteelDispatchStatus = "dispatched"
    notes: str | None = Field(default=None, max_length=500)
    lines: list[SteelDispatchLineCreateRequest] = Field(min_length=1, max_length=25)

    @field_validator("dispatch_number")
    @classmethod
    def validate_dispatch_number(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="Dispatch number", max_length=40)

    @field_validator("gate_pass_number")
    @classmethod
    def validate_gate_pass_number(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="Gate pass number", max_length=40)

    @field_validator("truck_number")
    @classmethod
    def validate_truck_number(cls, value: str) -> str:
        return normalize_reference_code(value, field_name="Truck number", max_length=40) or value

    @field_validator("driver_phone")
    @classmethod
    def validate_driver_phone(cls, value: str | None) -> str | None:
        return normalize_phone_number(value)

    @field_validator("driver_license_number")
    @classmethod
    def validate_driver_license_number(cls, value: str | None) -> str | None:
        return normalize_reference_code(value, field_name="Driver license", max_length=80)


class SteelDispatchStatusUpdateRequest(BaseModel):
    status: SteelDispatchStatus
    entry_time: datetime | None = None
    exit_time: datetime | None = None
    receiver_name: str | None = Field(default=None, max_length=160)
    pod_notes: str | None = Field(default=None, max_length=500)


class SteelCustomerFollowUpTaskCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    note: str | None = Field(default=None, max_length=500)
    priority: SteelFollowUpTaskPriority = "medium"
    due_date: date | None = None
    invoice_id: int | None = None
    assigned_to_user_id: int | None = None


class SteelCustomerFollowUpTaskStatusRequest(BaseModel):
    status: SteelFollowUpTaskStatus
    note: str | None = Field(default=None, max_length=500)


def _write_steel_audit(
    db: Session,
    *,
    actor: User,
    factory_id: str,
    action: str,
    details: str,
    request: Request | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            org_id=resolve_org_id(actor),
            factory_id=factory_id,
            action=action,
            details=details,
            ip_address=request.client.host if request and request.client else None,
            user_agent=request.headers.get("user-agent") if request else None,
            timestamp=datetime.now(timezone.utc),
        )
    )


def _get_item_or_404(db: Session, *, factory_id: str, item_id: int) -> SteelInventoryItem:
    item = (
        db.query(SteelInventoryItem)
        .filter(
            SteelInventoryItem.id == item_id,
            SteelInventoryItem.factory_id == factory_id,
            SteelInventoryItem.is_active.is_(True),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Steel inventory item not found.")
    return item


def _serialize_items_with_stock(db: Session, *, factory_id: str) -> list[dict[str, object]]:
    items = (
        db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory_id, SteelInventoryItem.is_active.is_(True))
        .order_by(SteelInventoryItem.category.asc(), SteelInventoryItem.name.asc())
        .all()
    )
    balances = stock_balances_for_factory(db, factory_id)
    reconciliations = latest_reconciliations_for_factory(db, factory_id)
    return [
        serialize_stock_row(
            item,
            balance_kg=balances.get(item.id, 0.0),
            reconciliation=reconciliations.get(item.id),
        )
        for item in items
    ]


def _serialize_steel_transaction(
    row: SteelInventoryTransaction,
    *,
    item: SteelInventoryItem | None,
    actor: User | None,
    balance_before_kg: float | None = None,
    balance_after_kg: float | None = None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    return {
        "id": row.id,
        "item_id": row.item_id,
        "item_code": item.item_code if item else None,
        "item_name": item.name if item else None,
        "item_category": item.category if item else None,
        "transaction_type": row.transaction_type,
        "quantity_kg": round(float(row.quantity_kg or 0.0), 3),
        "reference_type": row.reference_type,
        "reference_id": row.reference_id,
        "notes": row.notes,
        "created_by_user_id": row.created_by_user_id,
        "created_by_name": actor.name if actor else None,
        "created_at": created_at.isoformat(),
        "balance_before_kg": round(float(balance_before_kg or 0.0), 3) if balance_before_kg is not None else None,
        "balance_after_kg": round(float(balance_after_kg or 0.0), 3) if balance_after_kg is not None else None,
    }


def _serialize_steel_audit(row: AuditLog, *, actor: User | None) -> dict[str, Any]:
    timestamp = coerce_utc_datetime(row.timestamp) or datetime.now(timezone.utc)
    return {
        "id": row.id,
        "action": row.action,
        "details": row.details,
        "user_id": row.user_id,
        "user_name": actor.name if actor else None,
        "timestamp": timestamp.isoformat(),
    }


def _normalize_stock_mismatch_cause(value: str | None) -> str | None:
    normalized = sanitize_text(value, max_length=40, preserve_newlines=False)
    if not normalized:
        return None
    normalized = normalized.strip().lower().replace("-", "_").replace(" ", "_")
    if normalized not in _STEEL_STOCK_MISMATCH_CAUSES:
        allowed = ", ".join(sorted(_STEEL_STOCK_MISMATCH_CAUSES))
        raise HTTPException(status_code=400, detail=f"Mismatch cause must be one of: {allowed}.")
    return normalized


def _stock_variance_needs_cause(variance_kg: float | None) -> bool:
    return abs(float(variance_kg or 0.0)) > 0.001


def _serialize_steel_invoice_line(
    row: SteelSalesInvoiceLine,
    *,
    item: SteelInventoryItem | None,
    batch: SteelProductionBatch | None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    return {
        "id": row.id,
        "item_id": row.item_id,
        "item_code": item.item_code if item else None,
        "item_name": item.name if item else None,
        "batch_id": row.batch_id,
        "batch_code": batch.batch_code if batch else None,
        "description": row.description,
        "weight_kg": round(float(row.weight_kg or 0.0), 3),
        "rate_per_kg": round(float(row.rate_per_kg or 0.0), 2),
        "line_total": round(float(row.line_total or 0.0), 2),
        "created_at": created_at.isoformat(),
    }


def _serialize_steel_invoice(
    row: SteelSalesInvoice,
    *,
    creator: User | None,
    lines: list[dict[str, Any]] | None = None,
    paid_amount_inr: float | None = None,
    outstanding_amount_inr: float | None = None,
    overdue_days: int | None = None,
    is_overdue: bool | None = None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    updated_at = coerce_utc_datetime(row.updated_at) or created_at
    payload: dict[str, Any] = {
        "id": row.id,
        "customer_id": row.customer_id,
        "invoice_number": row.invoice_number,
        "invoice_date": row.invoice_date.isoformat(),
        "due_date": row.due_date.isoformat(),
        "customer_name": row.customer_name,
        "status": row.status,
        "currency": row.currency,
        "payment_terms_days": int(row.payment_terms_days or 0),
        "total_weight_kg": round(float(row.total_weight_kg or 0.0), 3),
        "subtotal_amount": round(float(row.subtotal_amount or 0.0), 2),
        "total_amount": round(float(row.total_amount or 0.0), 2),
        "notes": row.notes,
        "created_by_user_id": row.created_by_user_id,
        "created_by_name": creator.name if creator else None,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
    }
    if paid_amount_inr is not None:
        payload["paid_amount_inr"] = round(float(paid_amount_inr or 0.0), 2)
    if outstanding_amount_inr is not None:
        payload["outstanding_amount_inr"] = round(float(outstanding_amount_inr or 0.0), 2)
    if overdue_days is not None:
        payload["overdue_days"] = int(max(0, overdue_days))
    if is_overdue is not None:
        payload["is_overdue"] = bool(is_overdue)
    if lines is not None:
        payload["lines"] = lines
    return payload


def _serialize_steel_dispatch_line(
    row: SteelDispatchLine,
    *,
    invoice_line: SteelSalesInvoiceLine | None,
    item: SteelInventoryItem | None,
    batch: SteelProductionBatch | None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    return {
        "id": row.id,
        "invoice_line_id": row.invoice_line_id,
        "item_id": row.item_id,
        "item_code": item.item_code if item else None,
        "item_name": item.name if item else None,
        "batch_id": row.batch_id,
        "batch_code": batch.batch_code if batch else None,
        "weight_kg": round(float(row.weight_kg or 0.0), 3),
        "invoice_line_weight_kg": round(float(invoice_line.weight_kg or 0.0), 3) if invoice_line else None,
        "rate_per_kg": round(float(invoice_line.rate_per_kg or 0.0), 2) if invoice_line else None,
        "line_total_reference": round(float(invoice_line.line_total or 0.0), 2) if invoice_line else None,
        "created_at": created_at.isoformat(),
    }


def _dispatch_has_posted_inventory(dispatch: SteelDispatch) -> bool:
    return coerce_utc_datetime(dispatch.inventory_posted_at) is not None


def _dispatch_status_posts_inventory(status: str | None) -> bool:
    normalized = _normalize_dispatch_status(status, allow_cancelled=False)
    return normalized in {"dispatched", "delivered"}


def _serialize_steel_dispatch(
    row: SteelDispatch,
    *,
    creator: User | None,
    invoice: SteelSalesInvoice | None,
    delivered_by: User | None = None,
    lines: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    updated_at = coerce_utc_datetime(row.updated_at) or created_at
    entry_time = coerce_utc_datetime(row.entry_time)
    exit_time = coerce_utc_datetime(row.exit_time)
    delivered_at = coerce_utc_datetime(row.delivered_at)
    payload: dict[str, Any] = {
        "id": row.id,
        "invoice_id": row.invoice_id,
        "invoice_number": invoice.invoice_number if invoice else None,
        "customer_name": invoice.customer_name if invoice else None,
        "dispatch_number": row.dispatch_number,
        "gate_pass_number": row.gate_pass_number,
        "dispatch_date": row.dispatch_date.isoformat(),
        "truck_number": row.truck_number,
        "transporter_name": row.transporter_name,
        "vehicle_type": row.vehicle_type,
        "truck_capacity_kg": round(float(row.truck_capacity_kg or 0.0), 3) if row.truck_capacity_kg is not None else None,
        "driver_name": row.driver_name,
        "driver_phone": row.driver_phone,
        "driver_license_number": row.driver_license_number,
        "entry_time": entry_time.isoformat() if entry_time else None,
        "exit_time": exit_time.isoformat() if exit_time else None,
        "status": row.status,
        "total_weight_kg": round(float(row.total_weight_kg or 0.0), 3),
        "notes": row.notes,
        "receiver_name": row.receiver_name,
        "pod_notes": row.pod_notes,
        "inventory_posted_at": row.inventory_posted_at.isoformat() if coerce_utc_datetime(row.inventory_posted_at) else None,
        "delivered_at": delivered_at.isoformat() if delivered_at else None,
        "delivered_by_user_id": row.delivered_by_user_id,
        "delivered_by_name": delivered_by.name if delivered_by else None,
        "created_by_user_id": row.created_by_user_id,
        "created_by_name": creator.name if creator else None,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
    }
    if lines is not None:
        payload["lines"] = lines
    return payload


def _serialize_steel_customer(
    row: SteelCustomer,
    *,
    invoice_total_inr: float = 0.0,
    payments_total_inr: float = 0.0,
    outstanding_amount_inr: float = 0.0,
    advance_amount_inr: float = 0.0,
    overdue_amount_inr: float = 0.0,
    invoice_count: int = 0,
    payment_count: int = 0,
    open_invoice_count: int = 0,
    overdue_days: int = 0,
    credit_used_percentage: float = 0.0,
    available_credit_inr: float = 0.0,
    risk_score: float = 0.0,
    risk_level: str = "low",
    late_payment_count: int = 0,
    last_payment_date: date | None = None,
    last_invoice_date: date | None = None,
    open_follow_up_count: int = 0,
    next_follow_up_date: date | None = None,
    verified_by_name: str | None = None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    updated_at = coerce_utc_datetime(row.updated_at) or created_at
    verified_at = coerce_utc_datetime(row.verified_at)
    return {
        "id": row.id,
        "customer_code": row.customer_code,
        "name": row.name,
        "phone": row.phone,
        "email": row.email,
        "address": row.address,
        "city": row.city,
        "state": row.state,
        "tax_id": row.tax_id,
        "gst_number": row.gst_number,
        "pan_number": row.pan_number,
        "company_type": row.company_type,
        "contact_person": row.contact_person,
        "designation": row.designation,
        "credit_limit": round(float(row.credit_limit or 0.0), 2),
        "payment_terms_days": int(row.payment_terms_days or 0),
        "status": row.status,
        "notes": row.notes,
        "verification_status": row.verification_status,
        "pan_status": row.pan_status,
        "gst_status": row.gst_status,
        "verification_source": row.verification_source,
        "official_legal_name": row.official_legal_name,
        "official_trade_name": row.official_trade_name,
        "official_state": row.official_state,
        "name_match_status": row.name_match_status,
        "state_match_status": row.state_match_status,
        "match_score": round(float(row.match_score or 0.0), 2),
        "mismatch_reason": row.mismatch_reason,
        "pan_document_url": _customer_verification_document_route(int(row.id), "pan") if row.pan_document_path else None,
        "gst_document_url": _customer_verification_document_route(int(row.id), "gst") if row.gst_document_path else None,
        "verified_at": verified_at.isoformat() if verified_at else None,
        "verified_by_user_id": row.verified_by_user_id,
        "verified_by_name": verified_by_name,
        "is_active": row.is_active,
        "invoice_total_inr": round(float(invoice_total_inr or 0.0), 2),
        "payments_total_inr": round(float(payments_total_inr or 0.0), 2),
        "outstanding_amount_inr": round(float(outstanding_amount_inr or 0.0), 2),
        "advance_amount_inr": round(float(advance_amount_inr or 0.0), 2),
        "overdue_amount_inr": round(float(overdue_amount_inr or 0.0), 2),
        "invoice_count": int(invoice_count or 0),
        "payment_count": int(payment_count or 0),
        "open_invoice_count": int(open_invoice_count or 0),
        "overdue_days": int(overdue_days or 0),
        "credit_used_percentage": round(float(credit_used_percentage or 0.0), 2),
        "available_credit_inr": round(float(available_credit_inr or 0.0), 2),
        "risk_score": round(float(risk_score or 0.0), 2),
        "risk_level": risk_level,
        "late_payment_count": int(late_payment_count or 0),
        "last_payment_date": last_payment_date.isoformat() if last_payment_date else None,
        "last_invoice_date": last_invoice_date.isoformat() if last_invoice_date else None,
        "open_follow_up_count": int(open_follow_up_count or 0),
        "next_follow_up_date": next_follow_up_date.isoformat() if next_follow_up_date else None,
        "created_by_user_id": row.created_by_user_id,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
    }


def _serialize_steel_customer_payment(
    row: SteelCustomerPayment,
    *,
    creator: User | None,
    customer: SteelCustomer | None,
    invoice: SteelSalesInvoice | None,
    allocations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    payload = {
        "id": row.id,
        "customer_id": row.customer_id,
        "customer_name": customer.name if customer else None,
        "invoice_id": row.invoice_id,
        "invoice_number": invoice.invoice_number if invoice else None,
        "payment_date": row.payment_date.isoformat(),
        "amount": round(float(row.amount or 0.0), 2),
        "payment_mode": row.payment_mode,
        "reference_number": row.reference_number,
        "notes": row.notes,
        "created_by_user_id": row.created_by_user_id,
        "created_by_name": creator.name if creator else None,
        "created_at": created_at.isoformat(),
    }
    if allocations is not None:
        payload["allocations"] = allocations
    return payload


def _normalize_customer_status(value: str | None) -> str:
    normalized = (sanitize_text(value, max_length=24, preserve_newlines=False) or "active").lower()
    if normalized not in {"active", "on_hold", "blocked"}:
        raise HTTPException(status_code=422, detail="Customer status must be active, on_hold, or blocked.")
    return normalized


def _normalize_dispatch_status(value: str | None, *, allow_cancelled: bool = True) -> str:
    normalized = (sanitize_text(value, max_length=24, preserve_newlines=False) or "dispatched").lower()
    allowed = {"pending", "loaded", "dispatched", "delivered"}
    if allow_cancelled:
        allowed.add("cancelled")
    if normalized not in allowed:
        raise HTTPException(status_code=422, detail="Dispatch status is invalid.")
    return normalized


def _normalize_follow_up_task_priority(value: str | None) -> str:
    normalized = (sanitize_text(value, max_length=20, preserve_newlines=False) or "medium").lower()
    if normalized not in {"low", "medium", "high", "critical"}:
        raise HTTPException(status_code=422, detail="Follow-up priority is invalid.")
    return normalized


def _normalize_follow_up_task_status(value: str | None) -> str:
    normalized = (sanitize_text(value, max_length=20, preserve_newlines=False) or "open").lower()
    if normalized not in {"open", "in_progress", "done", "cancelled"}:
        raise HTTPException(status_code=422, detail="Follow-up status is invalid.")
    return normalized


def _serialize_steel_follow_up_task(
    row: SteelCustomerFollowUpTask,
    *,
    assignee: User | None = None,
    creator: User | None = None,
    invoice: SteelSalesInvoice | None = None,
) -> dict[str, Any]:
    created_at = coerce_utc_datetime(row.created_at) or datetime.now(timezone.utc)
    updated_at = coerce_utc_datetime(row.updated_at) or created_at
    completed_at = coerce_utc_datetime(row.completed_at)
    return {
        "id": row.id,
        "customer_id": row.customer_id,
        "invoice_id": row.invoice_id,
        "invoice_number": invoice.invoice_number if invoice else None,
        "title": row.title,
        "note": row.note,
        "priority": row.priority,
        "status": row.status,
        "due_date": row.due_date.isoformat() if row.due_date else None,
        "assigned_to_user_id": row.assigned_to_user_id,
        "assigned_to_name": assignee.name if assignee else None,
        "created_by_user_id": row.created_by_user_id,
        "created_by_name": creator.name if creator else None,
        "completed_at": completed_at.isoformat() if completed_at else None,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
    }


def _customer_verification_document_route(customer_id: int, document_type: SteelCustomerVerificationDocType) -> str:
    return f"/steel/customers/{customer_id}/verification-documents/{document_type}"


def _customer_verification_document_name(
    customer: SteelCustomer,
    document_type: SteelCustomerVerificationDocType,
) -> str | None:
    if document_type == "pan":
        return customer.pan_document_path
    return customer.gst_document_path


def _set_customer_verification_document_name(
    customer: SteelCustomer,
    *,
    document_type: SteelCustomerVerificationDocType,
    document_name: str | None,
) -> None:
    if document_type == "pan":
        customer.pan_document_path = document_name
        return
    customer.gst_document_path = document_name


def _delete_customer_verification_document(document_name: str | None) -> None:
    if not document_name:
        return
    safe_name = Path(document_name).name
    if not safe_name or safe_name != document_name:
        return
    try:
        (STEEL_VERIFICATION_DOC_DIR / safe_name).unlink(missing_ok=True)
    except OSError:
        return


def _guess_verification_document_extension(file: UploadFile) -> str:
    content_type = (file.content_type or "").strip().lower()
    for extension, expected_type in _STEEL_VERIFICATION_ALLOWED_EXTENSIONS.items():
        if content_type == expected_type:
            return extension
    suffix = Path(file.filename or "").suffix.lower()
    if suffix in _STEEL_VERIFICATION_ALLOWED_EXTENSIONS:
        return suffix
    raise HTTPException(status_code=400, detail="Document must be JPG, PNG, WEBP, or PDF.")


def _save_customer_verification_document(
    *,
    customer_id: int,
    document_type: SteelCustomerVerificationDocType,
    extension: str,
    file_bytes: bytes,
) -> str:
    STEEL_VERIFICATION_DOC_DIR.mkdir(parents=True, exist_ok=True)
    document_name = f"customer-{customer_id}-{document_type}-{secrets.token_hex(10)}{extension}"
    (STEEL_VERIFICATION_DOC_DIR / document_name).write_bytes(file_bytes)
    return document_name


def _normalize_customer_match_text(value: str | None) -> str:
    cleaned = sanitize_text(value, max_length=200, preserve_newlines=False) or ""
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned.lower()).strip()
    return re.sub(r"\s+", " ", cleaned)


def _normalize_customer_state_text(value: str | None) -> str:
    cleaned = sanitize_text(value, max_length=120, preserve_newlines=False) or ""
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned.lower()).strip()
    return re.sub(r"\s+", " ", cleaned)


def _company_name_match_status(entered_name: str | None, official_name: str | None) -> str:
    normalized_entered = _normalize_customer_match_text(entered_name)
    normalized_official = _normalize_customer_match_text(official_name)
    if not normalized_official:
        return "not_available"
    if not normalized_entered:
        return "mismatch"
    if normalized_entered == normalized_official:
        return "matched"
    ratio = SequenceMatcher(None, normalized_entered, normalized_official).ratio()
    entered_tokens = set(normalized_entered.split())
    official_tokens = set(normalized_official.split())
    overlap = len(entered_tokens & official_tokens) / max(len(official_tokens), 1)
    return "matched" if ratio >= 0.72 or overlap >= 0.6 else "mismatch"


def _state_match_status(entered_state: str | None, official_state: str | None) -> str:
    normalized_entered = _normalize_customer_state_text(entered_state)
    normalized_official = _normalize_customer_state_text(official_state)
    if not normalized_official:
        return "not_available"
    if not normalized_entered:
        return "mismatch"
    if (
        normalized_entered == normalized_official
        or normalized_entered in normalized_official
        or normalized_official in normalized_entered
    ):
        return "matched"
    return "mismatch"


def _evaluate_customer_verification(customer: SteelCustomer) -> dict[str, Any]:
    pan_number = (customer.pan_number or "").strip().upper()
    gst_number = (customer.gst_number or "").strip().upper()
    name_match_status = _company_name_match_status(customer.name, customer.official_legal_name)
    state_match_status = _state_match_status(customer.state, customer.official_state)
    mismatch_reasons: list[str] = []
    match_score = 0.0

    if not pan_number:
        pan_status = "missing"
    elif _PAN_REGEX.fullmatch(pan_number):
        pan_status = "format_valid"
        match_score += 20
    else:
        pan_status = "invalid_format"
        mismatch_reasons.append("PAN format looks invalid.")

    if not gst_number:
        gst_status = "missing"
    elif _GST_REGEX.fullmatch(gst_number):
        gst_status = "format_valid"
        match_score += 20
    else:
        gst_status = "invalid_format"
        mismatch_reasons.append("GSTIN format looks invalid.")

    if pan_number and gst_number and pan_status == "format_valid" and gst_status == "format_valid":
        if gst_number[2:12] == pan_number:
            match_score += 20
        else:
            mismatch_reasons.append("PAN does not match the PAN embedded in GSTIN.")

    if customer.pan_document_path:
        match_score += 10
    if customer.gst_document_path:
        match_score += 10
    if name_match_status == "matched":
        match_score += 10
    elif name_match_status == "mismatch":
        mismatch_reasons.append("Customer name does not match the official legal name.")
    if state_match_status == "matched":
        match_score += 10
    elif state_match_status == "mismatch":
        mismatch_reasons.append("Customer state does not match the official state.")

    if mismatch_reasons:
        verification_status = "mismatch"
    elif any(
        [
            customer.pan_document_path,
            customer.gst_document_path,
            customer.official_legal_name,
            customer.official_trade_name,
            customer.official_state,
        ]
    ):
        verification_status = "pending_review"
    elif pan_status == "format_valid" or gst_status == "format_valid":
        verification_status = "format_valid"
    else:
        verification_status = "draft"

    return {
        "verification_status": verification_status,
        "pan_status": pan_status,
        "gst_status": gst_status,
        "name_match_status": name_match_status,
        "state_match_status": state_match_status,
        "match_score": round(match_score, 2),
        "mismatch_reason": " ".join(mismatch_reasons) if mismatch_reasons else None,
    }


def _apply_customer_verification_state(
    customer: SteelCustomer,
    *,
    final_status: SteelCustomerVerificationStatus | None = None,
    verification_source: str | None = None,
    reviewer_user_id: int | None = None,
) -> None:
    evaluation = _evaluate_customer_verification(customer)
    customer.pan_status = evaluation["pan_status"]
    customer.gst_status = evaluation["gst_status"]
    customer.name_match_status = evaluation["name_match_status"]
    customer.state_match_status = evaluation["state_match_status"]
    customer.match_score = evaluation["match_score"]
    customer.mismatch_reason = evaluation["mismatch_reason"]
    customer.verification_status = final_status or evaluation["verification_status"]
    if verification_source is not None:
        customer.verification_source = sanitize_text(
            verification_source,
            max_length=80,
            preserve_newlines=False,
        )
    elif not customer.verification_source:
        customer.verification_source = "system_check"

    if customer.verification_status == "verified":
        customer.verified_at = datetime.now(timezone.utc)
        customer.verified_by_user_id = reviewer_user_id
    else:
        customer.verified_at = None
        customer.verified_by_user_id = None


def _build_payment_allocation_maps(
    *,
    payments: list[SteelCustomerPayment],
    allocations: list[SteelCustomerPaymentAllocation],
    invoice_map: dict[int, SteelSalesInvoice],
) -> tuple[dict[int, list[dict[str, Any]]], dict[int, float], dict[int, date]]:
    payment_map = {int(row.id): row for row in payments}
    allocations_by_payment: dict[int, list[dict[str, Any]]] = {}
    paid_by_invoice: dict[int, float] = {}
    last_payment_date_by_invoice: dict[int, date] = {}
    explicit_payment_ids = {int(row.payment_id) for row in allocations}

    for row in allocations:
        payment = payment_map.get(int(row.payment_id))
        if not payment:
            continue
        invoice = invoice_map.get(int(row.invoice_id))
        allocated_amount = round(float(row.allocated_amount or 0.0), 2)
        invoice_id = int(row.invoice_id)
        allocations_by_payment.setdefault(int(row.payment_id), []).append(
            {
                "invoice_id": invoice_id,
                "invoice_number": invoice.invoice_number if invoice else None,
                "amount": allocated_amount,
                "payment_date": payment.payment_date.isoformat(),
            }
        )
        paid_by_invoice[invoice_id] = round(float(paid_by_invoice.get(invoice_id, 0.0)) + allocated_amount, 2)
        prior_date = last_payment_date_by_invoice.get(invoice_id)
        if prior_date is None or payment.payment_date > prior_date:
            last_payment_date_by_invoice[invoice_id] = payment.payment_date

    for payment in payments:
        payment_id = int(payment.id)
        if payment_id in explicit_payment_ids or payment.invoice_id is None:
            continue
        invoice_id = int(payment.invoice_id)
        invoice = invoice_map.get(invoice_id)
        allocated_amount = round(float(payment.amount or 0.0), 2)
        allocations_by_payment.setdefault(payment_id, []).append(
            {
                "invoice_id": invoice_id,
                "invoice_number": invoice.invoice_number if invoice else None,
                "amount": allocated_amount,
                "payment_date": payment.payment_date.isoformat(),
            }
        )
        paid_by_invoice[invoice_id] = round(float(paid_by_invoice.get(invoice_id, 0.0)) + allocated_amount, 2)
        prior_date = last_payment_date_by_invoice.get(invoice_id)
        if prior_date is None or payment.payment_date > prior_date:
            last_payment_date_by_invoice[invoice_id] = payment.payment_date

    return allocations_by_payment, paid_by_invoice, last_payment_date_by_invoice


def _compute_customer_lifecycle_summary(
    *,
    customer: SteelCustomer,
    invoices: list[SteelSalesInvoice],
    payments: list[SteelCustomerPayment],
    paid_by_invoice: dict[int, float],
    last_payment_date_by_invoice: dict[int, date],
) -> dict[str, Any]:
    today = date.today()
    invoice_total = sum(float(row.total_amount or 0.0) for row in invoices)
    payments_total = sum(float(row.amount or 0.0) for row in payments)
    net_outstanding = max(0.0, invoice_total - payments_total)
    advance_amount = max(0.0, payments_total - invoice_total)
    overdue_amount = 0.0
    overdue_days = 0
    open_invoice_count = 0
    late_payment_count = 0
    last_payment_date = max((row.payment_date for row in payments), default=None)
    last_invoice_date = max((row.invoice_date for row in invoices), default=None)

    for invoice in invoices:
        paid_amount = float(paid_by_invoice.get(int(invoice.id), 0.0))
        total_amount = float(invoice.total_amount or 0.0)
        outstanding_amount = max(0.0, total_amount - paid_amount)
        if outstanding_amount > 0.005:
            open_invoice_count += 1
            if invoice.due_date and invoice.due_date < today:
                overdue_amount += outstanding_amount
                overdue_days = max(overdue_days, (today - invoice.due_date).days)
        elif invoice.due_date:
            completed_at = last_payment_date_by_invoice.get(int(invoice.id))
            if completed_at and completed_at > invoice.due_date:
                late_payment_count += 1

    credit_limit = float(customer.credit_limit or 0.0)
    credit_used_percentage = (net_outstanding / credit_limit * 100.0) if credit_limit > 0 else 0.0
    available_credit = max(0.0, credit_limit - net_outstanding) if credit_limit > 0 else 0.0
    risk_score = float(overdue_days * 2) + float(credit_used_percentage) + float(late_payment_count * 5)
    if risk_score > 70:
        risk_level = "high"
    elif risk_score > 30:
        risk_level = "medium"
    else:
        risk_level = "low"

    return {
        "invoice_total_inr": round(invoice_total, 2),
        "payments_total_inr": round(payments_total, 2),
        "outstanding_amount_inr": round(net_outstanding, 2),
        "advance_amount_inr": round(advance_amount, 2),
        "overdue_amount_inr": round(overdue_amount, 2),
        "invoice_count": len(invoices),
        "payment_count": len(payments),
        "open_invoice_count": open_invoice_count,
        "overdue_days": overdue_days,
        "credit_used_percentage": round(credit_used_percentage, 2),
        "available_credit_inr": round(available_credit, 2),
        "risk_score": round(risk_score, 2),
        "risk_level": risk_level,
        "late_payment_count": late_payment_count,
        "last_payment_date": last_payment_date,
        "last_invoice_date": last_invoice_date,
    }


def _build_customer_lifecycle_alerts(
    *,
    customer: SteelCustomer,
    lifecycle: dict[str, Any],
    follow_up_tasks: list[SteelCustomerFollowUpTask],
) -> list[dict[str, str]]:
    alerts: list[dict[str, str]] = []
    if customer.status in {"on_hold", "blocked"}:
        alerts.append({"level": "critical", "title": "Customer is on hold", "detail": "Invoice and dispatch work should be reviewed before proceeding."})
    if customer.verification_status in {"mismatch", "rejected"}:
        alerts.append({"level": "critical", "title": "Identity verification issue", "detail": customer.mismatch_reason or "PAN/GST verification needs review."})
    elif customer.verification_status in {"pending_review", "format_valid"}:
        alerts.append({"level": "warning", "title": "Verification pending", "detail": "PAN/GST data has not been fully approved yet."})
    if float(lifecycle.get("overdue_amount_inr") or 0.0) > 0:
        alerts.append(
            {
                "level": "warning",
                "title": "Overdue exposure",
                "detail": f"{round(float(lifecycle['overdue_amount_inr']), 2)} INR overdue for {int(lifecycle.get('overdue_days') or 0)} days.",
            }
        )
    if float(lifecycle.get("credit_used_percentage") or 0.0) >= 85:
        alerts.append(
            {
                "level": "warning" if float(lifecycle.get("credit_used_percentage") or 0.0) < 100 else "critical",
                "title": "Credit limit pressure",
                "detail": f"Credit usage is at {round(float(lifecycle['credit_used_percentage']), 2)}%.",
            }
        )
    open_tasks = [task for task in follow_up_tasks if task.status in {"open", "in_progress"}]
    if open_tasks:
        oldest_due = min((task.due_date for task in open_tasks if task.due_date), default=None)
        alerts.append(
            {
                "level": "info",
                "title": "Collection follow-up open",
                "detail": f"{len(open_tasks)} active follow-up task(s){f', oldest due {oldest_due.isoformat()}' if oldest_due else ''}.",
            }
        )
    return alerts[:5]


def _ensure_customer_code(customer: SteelCustomer) -> None:
    if customer.customer_code or customer.id is None:
        return
    customer.customer_code = f"CUST-{int(customer.id):05d}"


def _refresh_invoice_payment_statuses(db: Session, *, factory_id: str, invoice_ids: set[int]) -> None:
    if not invoice_ids:
        return
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.id.in_(list(invoice_ids)),
        )
        .all()
    )
    if not invoices:
        return
    customer_ids = {int(row.customer_id) for row in invoices if row.customer_id is not None}
    payments = (
        db.query(SteelCustomerPayment)
        .filter(
            SteelCustomerPayment.factory_id == factory_id,
            SteelCustomerPayment.customer_id.in_(list(customer_ids)),
        )
        .all()
        if customer_ids
        else []
    )
    allocations = (
        db.query(SteelCustomerPaymentAllocation)
        .filter(
            SteelCustomerPaymentAllocation.factory_id == factory_id,
            SteelCustomerPaymentAllocation.invoice_id.in_(list(invoice_ids)),
        )
        .all()
    )
    invoice_map = {int(row.id): row for row in invoices}
    _, paid_by_invoice, _ = _build_payment_allocation_maps(
        payments=payments,
        allocations=allocations,
        invoice_map=invoice_map,
    )
    for invoice in invoices:
        paid_amount = float(paid_by_invoice.get(int(invoice.id), 0.0))
        total_amount = float(invoice.total_amount or 0.0)
        if paid_amount <= 0.005:
            next_status = "unpaid"
        elif paid_amount + 0.005 >= total_amount:
            next_status = "paid"
        else:
            next_status = "partial"
        if invoice.status != next_status:
            invoice.status = next_status


def _serialize_steel_reconciliation(
    row: SteelStockReconciliation,
    *,
    item: SteelInventoryItem | None,
    counted_by: User | None,
    approved_by: User | None,
    rejected_by: User | None,
) -> dict[str, Any]:
    counted_at = coerce_utc_datetime(row.counted_at) or datetime.now(timezone.utc)
    approved_at = coerce_utc_datetime(row.approved_at)
    rejected_at = coerce_utc_datetime(row.rejected_at)
    return {
        "id": row.id,
        "item_id": row.item_id,
        "item_code": item.item_code if item else None,
        "item_name": item.name if item else None,
        "status": row.status,
        "physical_qty_kg": round(float(row.physical_qty_kg or 0.0), 3),
        "system_qty_kg": round(float(row.system_qty_kg or 0.0), 3),
        "variance_kg": round(float(row.variance_kg or 0.0), 3),
        "variance_percent": round(float(row.variance_percent or 0.0), 3),
        "confidence_status": row.confidence_status,
        "notes": row.notes,
        "approver_notes": row.approver_notes,
        "rejection_reason": row.rejection_reason,
        "mismatch_cause": row.mismatch_cause,
        "counted_by_user_id": row.counted_by_user_id,
        "counted_by_name": counted_by.name if counted_by else None,
        "approved_by_user_id": row.approved_by_user_id,
        "approved_by_name": approved_by.name if approved_by else None,
        "rejected_by_user_id": row.rejected_by_user_id,
        "rejected_by_name": rejected_by.name if rejected_by else None,
        "counted_at": counted_at.isoformat(),
        "approved_at": approved_at.isoformat() if approved_at else None,
        "rejected_at": rejected_at.isoformat() if rejected_at else None,
    }


STEEL_FINANCIAL_BATCH_KEYS = {
    "input_rate_per_kg",
    "output_rate_per_kg",
    "variance_value_inr",
    "estimated_input_cost_inr",
    "estimated_output_value_inr",
    "estimated_gross_profit_inr",
    "profit_per_kg_inr",
}


def _can_view_steel_financials(user: User) -> bool:
    return user.role == UserRole.OWNER


def _redact_steel_batch_financials(batch: dict[str, Any] | None) -> dict[str, Any] | None:
    if not batch:
        return batch
    payload = dict(batch)
    for key in STEEL_FINANCIAL_BATCH_KEYS:
        if key in payload:
            payload[key] = None
    return payload


def _redact_operator_rollup(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return row
    payload = dict(row)
    payload["total_variance_value_inr"] = None
    payload["total_estimated_gross_profit_inr"] = None
    return payload


def _redact_day_rollup(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return row
    payload = dict(row)
    payload["total_variance_value_inr"] = None
    payload["total_estimated_gross_profit_inr"] = None
    return payload


def _redact_batch_rollup(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return row
    payload = dict(row)
    payload["variance_value_inr"] = None
    payload["estimated_gross_profit_inr"] = None
    return payload


def _redact_steel_overview_financials(payload: dict[str, Any]) -> dict[str, Any]:
    data = dict(payload)
    data["profit_summary"] = None

    anomaly_summary = dict(data.get("anomaly_summary") or {})
    anomaly_summary["total_estimated_leakage_value_inr"] = None
    anomaly_summary["highest_risk_operator"] = _redact_operator_rollup(anomaly_summary.get("highest_risk_operator"))
    anomaly_summary["highest_loss_day"] = _redact_day_rollup(anomaly_summary.get("highest_loss_day"))
    data["anomaly_summary"] = anomaly_summary

    data["top_loss_batch"] = _redact_steel_batch_financials(data.get("top_loss_batch"))
    data["top_operator_losses"] = [_redact_operator_rollup(row) for row in list(data.get("top_operator_losses") or [])]
    data["loss_by_day"] = [_redact_day_rollup(row) for row in list(data.get("loss_by_day") or [])]
    data["anomaly_batches"] = [_redact_steel_batch_financials(row) for row in list(data.get("anomaly_batches") or [])]
    data["ranked_anomalies"] = [
        {
            **dict(row),
            "estimated_leakage_value_inr": None,
            "batch": _redact_steel_batch_financials(row.get("batch")),
        }
        for row in list(data.get("ranked_anomalies") or [])
    ]

    responsibility = dict(data.get("responsibility_analytics") or {})
    responsibility["by_operator"] = [_redact_operator_rollup(row) for row in list(responsibility.get("by_operator") or [])]
    responsibility["by_day"] = [_redact_day_rollup(row) for row in list(responsibility.get("by_day") or [])]
    responsibility["by_batch"] = [_redact_batch_rollup(row) for row in list(responsibility.get("by_batch") or [])]
    data["responsibility_analytics"] = responsibility
    return data


def _render_steel_owner_daily_pdf(
    *,
    factory: Factory,
    report_date: date,
    overview: dict[str, Any],
    daily_batches: list[dict[str, Any]],
    daily_invoices: list[SteelSalesInvoice],
    daily_dispatches: list[SteelDispatch],
    realization: dict[str, float | int],
) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFillColor(colors.HexColor("#0B0E14"))
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    pdf.setFillColor(colors.HexColor("#3EA6FF"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(36, height - 34, "DPR.ai STEEL OWNER DAILY REVIEW")

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 19)
    pdf.drawString(36, height - 56, factory.name)

    pdf.setFillColor(colors.HexColor("#C8D1DB"))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(36, height - 74, f"Factory Code: {factory.factory_code or 'Pending'} | Report Date: {report_date.isoformat()}")

    cards = [
        ("Dispatch Revenue", f"INR {int(float(realization.get('realized_dispatched_revenue_inr', 0.0))):,}"),
        ("Dispatch Profit", f"INR {int(float(realization.get('realized_dispatched_profit_inr', 0.0))):,}"),
        ("Dispatch Weight", f"{round(float(realization.get('realized_dispatch_weight_kg', 0.0)), 2)} KG"),
        ("Leakage Exposure", f"INR {int(float((overview.get('anomaly_summary') or {}).get('total_estimated_leakage_value_inr') or 0.0)):,}"),
    ]
    card_y = height - 138
    card_width = (width - 90) / 4
    for index, (label, value) in enumerate(cards):
        x = 36 + (index * (card_width + 6))
        pdf.setFillColor(colors.HexColor("#152032"))
        pdf.roundRect(x, card_y, card_width, 54, 10, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#8AA4BE"))
        pdf.setFont("Helvetica", 8)
        pdf.drawString(x + 10, card_y + 36, label)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(x + 10, card_y + 16, value[:28])

    line_y = card_y - 24
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(36, line_y, "Daily Steel Snapshot")
    line_y -= 18
    pdf.setFillColor(colors.HexColor("#D0D7E2"))
    pdf.setFont("Helvetica", 9)
    snapshot_lines = [
        f"Raw stock: {round(float((overview.get('inventory_totals') or {}).get('raw_material_kg') or 0.0), 2)} KG",
        f"Finished stock: {round(float((overview.get('inventory_totals') or {}).get('finished_goods_kg') or 0.0), 2)} KG",
        f"Batches today: {len(daily_batches)}",
        f"Invoices today: {len(daily_invoices)}",
        f"Dispatches today: {len(daily_dispatches)}",
    ]
    for text in snapshot_lines:
        pdf.drawString(42, line_y, f"- {text}")
        line_y -= 14

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(36, line_y - 4, "Top Anomalies")
    line_y -= 22
    anomaly_rows = [row for row in daily_batches if str(row.get("severity")) in {"watch", "high", "critical"}][:5]
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.HexColor("#D0D7E2"))
    if not anomaly_rows:
        pdf.drawString(42, line_y, "- No elevated batch anomalies recorded for the selected day.")
        line_y -= 14
    else:
        for row in anomaly_rows:
            detail = (
                f"{row.get('batch_code')} | {row.get('severity')} | "
                f"{round(float(row.get('variance_kg') or 0.0), 2)} KG variance | "
                f"{round(float(row.get('loss_percent') or 0.0), 2)}% loss"
            )
            pdf.drawString(42, line_y, detail[:110])
            line_y -= 14

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(36, line_y - 4, "Owner Notes")
    line_y -= 22
    owner_notes = [
        f"Highest-risk operator: {((overview.get('anomaly_summary') or {}).get('highest_risk_operator') or {}).get('name') or 'N/A'}",
        f"Highest-loss day: {((overview.get('anomaly_summary') or {}).get('highest_loss_day') or {}).get('date') or report_date.isoformat()}",
        f"Outstanding invoice value: INR {int(float(realization.get('outstanding_invoice_amount_inr', 0.0))):,}",
    ]
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.HexColor("#D0D7E2"))
    for text in owner_notes:
        pdf.drawString(42, line_y, f"- {text}"[:112])
        line_y -= 14

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def _signed_transaction_quantity(
    *,
    transaction_type: str,
    quantity_kg: float,
    direction: str | None = None,
) -> float:
    normalized_type = normalize_transaction_type(transaction_type)
    if normalized_type in {"inward", "production_output"}:
        return float(quantity_kg)
    if normalized_type in {"dispatch_out", "production_issue"}:
        return -float(quantity_kg)
    normalized_direction = str(direction or "increase").strip().lower()
    if normalized_direction not in {"increase", "decrease"}:
        raise ValueError("Adjustment direction must be increase or decrease.")
    return float(quantity_kg) if normalized_direction == "increase" else -float(quantity_kg)


def _get_batch_or_404(db: Session, *, factory_id: str, batch_id: int) -> SteelProductionBatch:
    row = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.id == batch_id,
            SteelProductionBatch.factory_id == factory_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Steel batch not found.")
    return row


def _get_invoice_or_404(db: Session, *, factory_id: str, invoice_id: int) -> SteelSalesInvoice:
    row = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.id == invoice_id,
            SteelSalesInvoice.factory_id == factory_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Steel invoice not found.")
    return row


def _get_customer_or_404(db: Session, *, factory_id: str, customer_id: int) -> SteelCustomer:
    row = (
        db.query(SteelCustomer)
        .filter(
            SteelCustomer.id == customer_id,
            SteelCustomer.factory_id == factory_id,
            SteelCustomer.is_active.is_(True),
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Steel customer not found.")
    return row


def _get_dispatch_or_404(db: Session, *, factory_id: str, dispatch_id: int) -> SteelDispatch:
    row = (
        db.query(SteelDispatch)
        .filter(SteelDispatch.id == dispatch_id, SteelDispatch.factory_id == factory_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Steel dispatch not found.")
    return row


def _get_customer_follow_up_task_or_404(
    db: Session,
    *,
    factory_id: str,
    customer_id: int,
    task_id: int,
) -> SteelCustomerFollowUpTask:
    row = (
        db.query(SteelCustomerFollowUpTask)
        .filter(
            SteelCustomerFollowUpTask.id == task_id,
            SteelCustomerFollowUpTask.customer_id == customer_id,
            SteelCustomerFollowUpTask.factory_id == factory_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Customer follow-up task not found.")
    return row


def _dispatch_alerts(*, total_weight_kg: float, truck_capacity_kg: float | None, remaining_after_dispatch_kg: float | None = None, duplicate_truck_exists: bool = False) -> list[str]:
    warnings: list[str] = []
    if truck_capacity_kg is not None and total_weight_kg - truck_capacity_kg > 0.0001:
        warnings.append("Selected dispatch weight exceeds the truck capacity.")
    if duplicate_truck_exists:
        warnings.append("This truck already has another dispatch recorded for the same date.")
    if remaining_after_dispatch_kg is not None and remaining_after_dispatch_kg <= 0.0001:
        warnings.append("This dispatch consumes the full remaining invoice quantity.")
    return warnings


def _create_dispatch_inventory_movements(
    db: Session,
    *,
    factory: Factory,
    dispatch: SteelDispatch,
    dispatch_lines: list[SteelDispatchLine],
    current_user: User,
) -> None:
    if _dispatch_has_posted_inventory(dispatch):
        return
    notes_suffix = f"Gate pass {dispatch.gate_pass_number}"
    for line in dispatch_lines:
        db.add(
            SteelInventoryTransaction(
                org_id=factory.org_id,
                factory_id=factory.factory_id,
                item_id=line.item_id,
                transaction_type="dispatch_out",
                quantity_kg=-float(line.weight_kg or 0.0),
                reference_type="steel_dispatch",
                reference_id=dispatch.dispatch_number,
                notes=notes_suffix,
                created_by_user_id=current_user.id,
            )
        )
    dispatch.inventory_posted_at = datetime.now(timezone.utc)


@router.get("/overview")
def get_steel_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    overview = build_steel_overview(db, factory)
    financial_access = _can_view_steel_financials(current_user)
    overview["financial_access"] = financial_access
    if not financial_access:
        overview = _redact_steel_overview_financials(overview)
        overview["financial_access"] = False
    return overview


@router.get("/owner-daily-pdf")
def download_steel_owner_daily_pdf(
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    require_role(current_user, UserRole.OWNER)
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not has_plan_feature(plan, "pdf"):
        min_plan = min_plan_for_feature("pdf")
        raise HTTPException(
            status_code=403,
            detail=f"PDF export is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )

    target_date = report_date or date.today()
    overview = build_steel_overview(db, factory)
    overview["financial_access"] = True

    day_batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory.factory_id,
            SteelProductionBatch.production_date == target_date,
        )
        .order_by(SteelProductionBatch.created_at.desc(), SteelProductionBatch.id.desc())
        .all()
    )
    item_ids = {row.input_item_id for row in day_batches} | {row.output_item_id for row in day_batches}
    item_map = {
        item.id: item
        for item in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.id.in_(item_ids))
        .all()
    } if item_ids else {}
    operator_ids = {row.operator_user_id for row in day_batches if row.operator_user_id}
    operator_map = {
        user.id: user for user in db.query(User).filter(User.id.in_(operator_ids)).all()
    } if operator_ids else {}
    daily_batch_payload = [
        serialize_batch(
            row,
            input_item=item_map.get(row.input_item_id),
            output_item=item_map.get(row.output_item_id),
            operator=operator_map.get(row.operator_user_id),
        )
        for row in day_batches
    ]

    daily_invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory.factory_id,
            SteelSalesInvoice.invoice_date == target_date,
        )
        .order_by(SteelSalesInvoice.created_at.desc(), SteelSalesInvoice.id.desc())
        .all()
    )
    daily_dispatches = (
        db.query(SteelDispatch)
        .filter(
            SteelDispatch.factory_id == factory.factory_id,
            SteelDispatch.dispatch_date == target_date,
        )
        .order_by(SteelDispatch.created_at.desc(), SteelDispatch.id.desc())
        .all()
    )
    realization = build_steel_realization_metrics(db, factory_id=factory.factory_id, target_date=target_date)
    pdf_bytes = _render_steel_owner_daily_pdf(
        factory=factory,
        report_date=target_date,
        overview=overview,
        daily_batches=daily_batch_payload,
        daily_invoices=daily_invoices,
        daily_dispatches=daily_dispatches,
        realization=realization,
    )
    return Response(content=pdf_bytes, media_type="application/pdf")


@router.get("/inventory/items")
def list_steel_inventory_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    items = (
        db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.is_active.is_(True))
        .order_by(SteelInventoryItem.category.asc(), SteelInventoryItem.name.asc())
        .all()
    )
    return {
        "items": [
            {
                "id": item.id,
                "item_code": item.item_code,
                "name": item.name,
                "category": item.category,
                "display_unit": item.display_unit,
                "base_unit": item.base_unit,
                "current_rate_per_kg": item.current_rate_per_kg,
                "is_active": item.is_active,
            }
            for item in items
        ]
    }


@router.get("/inventory/stock")
def list_steel_inventory_stock(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"items": _serialize_items_with_stock(db, factory_id=factory.factory_id)}


@router.get("/inventory/transactions")
def list_steel_inventory_transactions(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    limit = max(1, min(limit, 100))
    transactions = recent_transactions(db, factory.factory_id, limit=limit)
    item_map = {
        item.id: item
        for item in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.is_active.is_(True))
        .all()
    }
    return {
        "items": [
            {
                "id": row.id,
                "item_id": row.item_id,
                "item_name": item_map.get(row.item_id).name if item_map.get(row.item_id) else None,
                "transaction_type": row.transaction_type,
                "quantity_kg": round(float(row.quantity_kg or 0.0), 3),
                "reference_type": row.reference_type,
                "reference_id": row.reference_id,
                "notes": row.notes,
                "created_at": row.created_at.isoformat(),
            }
            for row in transactions
        ]
    }


@router.post("/inventory/items")
def create_steel_inventory_item(
    payload: SteelInventoryItemCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.MANAGER)
    try:
        factory = require_active_steel_factory(db, current_user)
        category = normalize_steel_category(payload.category)
        display_unit = normalize_display_unit(payload.display_unit)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    item_code = (sanitize_text(payload.item_code, max_length=40, preserve_newlines=False) or "").upper()
    name = sanitize_text(payload.name, max_length=160, preserve_newlines=False)
    if not item_code or not name:
        raise HTTPException(status_code=400, detail="Item code and name are required.")
    existing = (
        db.query(SteelInventoryItem)
        .filter(
            SteelInventoryItem.factory_id == factory.factory_id,
            SteelInventoryItem.item_code == item_code,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Item code already exists in this steel factory.")

    item = SteelInventoryItem(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        item_code=item_code,
        name=name,
        category=category,
        display_unit=display_unit,
        current_rate_per_kg=payload.current_rate_per_kg,
        created_by_user_id=current_user.id,
    )
    db.add(item)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_INVENTORY_ITEM_CREATED",
        details=f"item_code={item_code} category={category}",
        request=request,
    )
    db.commit()
    db.refresh(item)
    return {"item": {"id": item.id, "item_code": item.item_code, "name": item.name, "category": item.category}}


@router.post("/inventory/transactions")
def create_steel_inventory_transaction(
    payload: SteelInventoryTransactionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.MANAGER)
    try:
        factory = require_active_steel_factory(db, current_user)
        signed_quantity = _signed_transaction_quantity(
            transaction_type=payload.transaction_type,
            quantity_kg=payload.quantity_kg,
            direction=payload.direction,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.item_id)
    balances = stock_balances_for_factory(db, factory.factory_id)
    projected_balance = float(balances.get(item.id, 0.0)) + signed_quantity
    if projected_balance < -0.001:
        raise HTTPException(status_code=400, detail="This transaction would make stock negative.")

    notes = sanitize_text(payload.notes, max_length=500)
    transaction = SteelInventoryTransaction(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        item_id=item.id,
        transaction_type=normalize_transaction_type(payload.transaction_type),
        quantity_kg=signed_quantity,
        reference_type="manual_entry",
        reference_id=str(current_user.id),
        notes=notes,
        created_by_user_id=current_user.id,
    )
    db.add(transaction)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_LEDGER_TRANSACTION_CREATED",
        details=f"item={item.item_code} type={transaction.transaction_type} qty_kg={round(signed_quantity, 3)}",
        request=request,
    )
    db.commit()
    db.refresh(transaction)
    return {
        "transaction": {
            "id": transaction.id,
            "item_id": transaction.item_id,
            "transaction_type": transaction.transaction_type,
            "quantity_kg": round(float(transaction.quantity_kg or 0.0), 3),
        }
    }


@router.post("/inventory/reconciliations")
def create_steel_stock_reconciliation(
    payload: SteelStockReconciliationCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.MANAGER)
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.item_id)
    balances = stock_balances_for_factory(db, factory.factory_id)
    system_qty = float(balances.get(item.id, 0.0))
    physical_qty = float(payload.physical_qty_kg or 0.0)
    variance_kg = physical_qty - system_qty
    variance_percent = (abs(variance_kg) / system_qty * 100.0) if system_qty > 0 else (0.0 if physical_qty == 0 else 100.0)
    mismatch_cause = _normalize_stock_mismatch_cause(payload.mismatch_cause)
    if _stock_variance_needs_cause(variance_kg) and mismatch_cause is None:
        raise HTTPException(
            status_code=400,
            detail="Mismatch cause is required when physical stock does not match system stock.",
        )
    auto_approved = is_admin_or_owner(current_user)
    now = datetime.now(timezone.utc)
    confidence_status, _confidence_reason = stock_confidence_for_item(
        balance_kg=system_qty,
        reconciliation=SteelStockReconciliation(
            org_id=factory.org_id,
            factory_id=factory.factory_id,
            item_id=item.id,
            physical_qty_kg=physical_qty,
            system_qty_kg=system_qty,
            variance_kg=variance_kg,
            variance_percent=variance_percent,
            confidence_status="yellow",
            counted_by_user_id=current_user.id,
        ),
    )

    row = SteelStockReconciliation(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        item_id=item.id,
        physical_qty_kg=physical_qty,
        system_qty_kg=system_qty,
        variance_kg=variance_kg,
        variance_percent=variance_percent,
        confidence_status=confidence_status,
        status="approved" if auto_approved else "pending",
        notes=sanitize_text(payload.notes, max_length=500),
        mismatch_cause=mismatch_cause,
        counted_by_user_id=current_user.id,
        submitted_by_user_id=current_user.id,
        approved_by_user_id=current_user.id if auto_approved else None,
        approved_at=now if auto_approved else None,
    )
    db.add(row)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_STOCK_RECONCILIATION_APPROVED" if auto_approved else "STEEL_STOCK_RECONCILIATION_SUBMITTED",
        details=(
            f"item={item.item_code} status={row.status} "
            f"system_kg={round(system_qty, 3)} physical_kg={round(physical_qty, 3)} "
            f"variance_kg={round(variance_kg, 3)} cause={mismatch_cause or 'none'}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(row)
    return {
        "reconciliation": {
            "id": row.id,
            "status": row.status,
            "confidence_status": row.confidence_status,
            "variance_kg": round(float(row.variance_kg or 0.0), 3),
            "variance_percent": round(float(row.variance_percent or 0.0), 3),
            "mismatch_cause": row.mismatch_cause,
        }
    }


@router.get("/inventory/reconciliations/summary")
def get_steel_stock_reconciliation_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "summary": stock_reconciliation_summary_for_factory(
            db,
            factory_id=factory.factory_id,
        )
    }


@router.get("/inventory/reconciliations")
def list_steel_stock_reconciliations(
    status: str | None = Query(default=None, max_length=16),
    item_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    query = db.query(SteelStockReconciliation).filter(SteelStockReconciliation.factory_id == factory.factory_id)
    normalized_status = str(status or "").strip().lower()
    if normalized_status:
        if normalized_status not in {"pending", "approved", "rejected"}:
            raise HTTPException(status_code=400, detail="Status must be pending, approved, or rejected.")
        query = query.filter(SteelStockReconciliation.status == normalized_status)
    if item_id is not None:
        query = query.filter(SteelStockReconciliation.item_id == item_id)
    rows = query.order_by(SteelStockReconciliation.counted_at.desc(), SteelStockReconciliation.id.desc()).limit(limit).all()

    item_ids = {row.item_id for row in rows}
    actor_ids = {
        actor_id
        for row in rows
        for actor_id in [
            row.counted_by_user_id,
            row.approved_by_user_id,
            row.rejected_by_user_id,
        ]
        if actor_id
    }
    item_map = {
        item.id: item
        for item in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.id.in_(item_ids))
        .all()
    } if item_ids else {}
    actor_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(actor_ids)).all()
    } if actor_ids else {}

    return {
        "items": [
            _serialize_steel_reconciliation(
                row,
                item=item_map.get(row.item_id),
                counted_by=actor_map.get(row.counted_by_user_id),
                approved_by=actor_map.get(row.approved_by_user_id),
                rejected_by=actor_map.get(row.rejected_by_user_id),
            )
            for row in rows
        ]
    }


@router.post("/inventory/reconciliations/{reconciliation_id}/approve")
def approve_steel_stock_reconciliation(
    reconciliation_id: int,
    payload: SteelStockReconciliationReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.ADMIN, UserRole.OWNER})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    row = (
        db.query(SteelStockReconciliation)
        .filter(
            SteelStockReconciliation.id == reconciliation_id,
            SteelStockReconciliation.factory_id == factory.factory_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Steel reconciliation not found.")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending reconciliations can be approved.")
    mismatch_cause = (
        _normalize_stock_mismatch_cause(payload.mismatch_cause)
        if payload.mismatch_cause is not None
        else row.mismatch_cause
    )
    if _stock_variance_needs_cause(row.variance_kg) and mismatch_cause is None:
        raise HTTPException(status_code=400, detail="Mismatch cause is required before approval.")

    row.status = "approved"
    row.approver_notes = sanitize_text(payload.approver_notes, max_length=500)
    row.rejection_reason = None
    row.mismatch_cause = mismatch_cause
    row.approved_by_user_id = current_user.id
    row.rejected_by_user_id = None
    row.approved_at = datetime.now(timezone.utc)
    row.rejected_at = None
    item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=row.item_id)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_STOCK_RECONCILIATION_APPROVED",
        details=(
            f"item={item.item_code} reconciliation_id={row.id} "
            f"variance_kg={round(float(row.variance_kg or 0.0), 3)} cause={row.mismatch_cause or 'none'}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(row)
    return {
        "reconciliation": {
            "id": row.id,
            "status": row.status,
            "confidence_status": row.confidence_status,
            "mismatch_cause": row.mismatch_cause,
        }
    }


@router.post("/inventory/reconciliations/{reconciliation_id}/reject")
def reject_steel_stock_reconciliation(
    reconciliation_id: int,
    payload: SteelStockReconciliationReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.ADMIN, UserRole.OWNER})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    row = (
        db.query(SteelStockReconciliation)
        .filter(
            SteelStockReconciliation.id == reconciliation_id,
            SteelStockReconciliation.factory_id == factory.factory_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Steel reconciliation not found.")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending reconciliations can be rejected.")
    rejection_reason = sanitize_text(payload.rejection_reason, max_length=500)
    if not rejection_reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required.")
    mismatch_cause = (
        _normalize_stock_mismatch_cause(payload.mismatch_cause)
        if payload.mismatch_cause is not None
        else row.mismatch_cause
    )
    if _stock_variance_needs_cause(row.variance_kg) and mismatch_cause is None:
        raise HTTPException(status_code=400, detail="Mismatch cause is required before rejection.")

    row.status = "rejected"
    row.approver_notes = sanitize_text(payload.approver_notes, max_length=500)
    row.rejection_reason = rejection_reason
    row.mismatch_cause = mismatch_cause
    row.approved_by_user_id = None
    row.rejected_by_user_id = current_user.id
    row.approved_at = None
    row.rejected_at = datetime.now(timezone.utc)
    item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=row.item_id)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_STOCK_RECONCILIATION_REJECTED",
        details=(
            f"item={item.item_code} reconciliation_id={row.id} "
            f"reason={rejection_reason} cause={row.mismatch_cause or 'none'}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(row)
    return {
        "reconciliation": {
            "id": row.id,
            "status": row.status,
            "rejection_reason": row.rejection_reason,
            "mismatch_cause": row.mismatch_cause,
        }
    }


@router.get("/batches")
def list_steel_batches(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    limit = max(1, min(limit, 100))
    batches = recent_steel_batches(db, factory.factory_id, limit=limit)
    item_map = {
        item.id: item
        for item in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.is_active.is_(True))
        .all()
    }
    operator_ids = {batch.operator_user_id for batch in batches if batch.operator_user_id}
    operator_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(operator_ids)).all()
    } if operator_ids else {}
    financial_access = _can_view_steel_financials(current_user)
    return {
        "items": [
            (
                serialize_batch(
                    batch,
                    input_item=item_map.get(batch.input_item_id),
                    output_item=item_map.get(batch.output_item_id),
                    operator=operator_map.get(batch.operator_user_id),
                )
                if financial_access
                else _redact_steel_batch_financials(
                    serialize_batch(
                        batch,
                        input_item=item_map.get(batch.input_item_id),
                        output_item=item_map.get(batch.output_item_id),
                        operator=operator_map.get(batch.operator_user_id),
                    )
                )
            )
            for batch in batches
        ]
    }


@router.get("/batches/{batch_id}")
def get_steel_batch_detail(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    batch = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.id == batch_id,
            SteelProductionBatch.factory_id == factory.factory_id,
        )
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Steel batch not found.")

    item_ids = {batch.input_item_id, batch.output_item_id}
    item_map = {
        item.id: item
        for item in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.id.in_(item_ids))
        .all()
    }
    input_item = item_map.get(batch.input_item_id)
    output_item = item_map.get(batch.output_item_id)

    actor_ids = {batch.operator_user_id, batch.created_by_user_id}
    linked_transactions = (
        db.query(SteelInventoryTransaction)
        .filter(
            SteelInventoryTransaction.factory_id == factory.factory_id,
            SteelInventoryTransaction.reference_type == "steel_batch",
            SteelInventoryTransaction.reference_id == batch.batch_code,
        )
        .order_by(SteelInventoryTransaction.created_at.asc(), SteelInventoryTransaction.id.asc())
        .all()
    )
    actor_ids.update(row.created_by_user_id for row in linked_transactions if row.created_by_user_id)

    audit_rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.factory_id == factory.factory_id,
            AuditLog.details.isnot(None),
            AuditLog.details.like(f"%{batch.batch_code}%"),
        )
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .limit(20)
        .all()
    )
    actor_ids.update(row.user_id for row in audit_rows if row.user_id)

    actor_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_({actor_id for actor_id in actor_ids if actor_id})).all()
    } if actor_ids else {}

    history_rows = (
        db.query(SteelInventoryTransaction)
        .filter(
            SteelInventoryTransaction.factory_id == factory.factory_id,
            SteelInventoryTransaction.item_id.in_(item_ids),
        )
        .order_by(SteelInventoryTransaction.created_at.asc(), SteelInventoryTransaction.id.asc())
        .all()
    )
    running_balances: dict[int, float] = {}
    balance_markers: dict[int, tuple[float, float]] = {}
    for row in history_rows:
        before = float(running_balances.get(row.item_id, 0.0))
        after = before + float(row.quantity_kg or 0.0)
        running_balances[row.item_id] = after
        balance_markers[row.id] = (before, after)

    current_balances = stock_balances_for_factory(db, factory.factory_id)
    linked_transaction_payload = [
        _serialize_steel_transaction(
            row,
            item=item_map.get(row.item_id),
            actor=actor_map.get(row.created_by_user_id),
            balance_before_kg=balance_markers.get(row.id, (None, None))[0],
            balance_after_kg=balance_markers.get(row.id, (None, None))[1],
        )
        for row in linked_transactions
    ]

    input_issue = next(
        (
            row
            for row in linked_transaction_payload
            if row["item_id"] == batch.input_item_id and row["transaction_type"] == "production_issue"
        ),
        None,
    )
    output_receipt = next(
        (
            row
            for row in linked_transaction_payload
            if row["item_id"] == batch.output_item_id and row["transaction_type"] == "production_output"
        ),
        None,
    )
    financial_access = _can_view_steel_financials(current_user)
    batch_payload = serialize_batch(
        batch,
        input_item=input_item,
        output_item=output_item,
        operator=actor_map.get(batch.operator_user_id),
    )
    if not financial_access:
        batch_payload = _redact_steel_batch_financials(batch_payload)

    return {
        "factory": {
            "factory_id": factory.factory_id,
            "name": factory.name,
            "factory_code": factory.factory_code,
            "industry_type": factory.industry_type,
        },
        "financial_access": financial_access,
        "batch": batch_payload,
        "traceability": {
            "input_item": {
                "id": input_item.id if input_item else None,
                "item_code": input_item.item_code if input_item else None,
                "name": input_item.name if input_item else None,
                "category": input_item.category if input_item else None,
                "current_rate_per_kg": input_item.current_rate_per_kg if input_item and financial_access else None,
                "current_stock_kg": round(float(current_balances.get(batch.input_item_id, 0.0)), 3),
                "movement": input_issue,
            },
            "output_item": {
                "id": output_item.id if output_item else None,
                "item_code": output_item.item_code if output_item else None,
                "name": output_item.name if output_item else None,
                "category": output_item.category if output_item else None,
                "current_rate_per_kg": output_item.current_rate_per_kg if output_item and financial_access else None,
                "current_stock_kg": round(float(current_balances.get(batch.output_item_id, 0.0)), 3),
                "movement": output_receipt,
            },
            "severity_reason": variance_reason(batch.severity, float(batch.variance_percent or 0.0)),
        },
        "inventory_movements": linked_transaction_payload,
        "audit_events": [
            _serialize_steel_audit(row, actor=actor_map.get(row.user_id))
            for row in audit_rows
        ],
    }


@router.get("/customers")
def list_steel_customers(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customers = (
        db.query(SteelCustomer)
        .filter(SteelCustomer.factory_id == factory.factory_id, SteelCustomer.is_active.is_(True))
        .order_by(SteelCustomer.name.asc(), SteelCustomer.id.asc())
        .limit(limit)
        .all()
    )
    customer_ids = [int(row.id) for row in customers]
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory.factory_id,
            SteelSalesInvoice.customer_id.in_(customer_ids),
        )
        .all()
        if customer_ids
        else []
    )
    payments = (
        db.query(SteelCustomerPayment)
        .filter(
            SteelCustomerPayment.factory_id == factory.factory_id,
            SteelCustomerPayment.customer_id.in_(customer_ids),
        )
        .all()
        if customer_ids
        else []
    )
    follow_up_tasks = (
        db.query(SteelCustomerFollowUpTask)
        .filter(
            SteelCustomerFollowUpTask.factory_id == factory.factory_id,
            SteelCustomerFollowUpTask.customer_id.in_(customer_ids),
        )
        .all()
        if customer_ids
        else []
    )
    invoice_ids = [int(row.id) for row in invoices]
    allocations = (
        db.query(SteelCustomerPaymentAllocation)
        .filter(
            SteelCustomerPaymentAllocation.factory_id == factory.factory_id,
            SteelCustomerPaymentAllocation.invoice_id.in_(invoice_ids),
        )
        .all()
        if invoice_ids
        else []
    )
    invoice_map = {int(row.id): row for row in invoices}
    _, paid_by_invoice, last_payment_date_by_invoice = _build_payment_allocation_maps(
        payments=payments,
        allocations=allocations,
        invoice_map=invoice_map,
    )
    invoices_by_customer: dict[int, list[SteelSalesInvoice]] = {}
    for row in invoices:
        if row.customer_id is None:
            continue
        invoices_by_customer.setdefault(int(row.customer_id), []).append(row)
    payments_by_customer: dict[int, list[SteelCustomerPayment]] = {}
    for row in payments:
        payments_by_customer.setdefault(int(row.customer_id), []).append(row)
    follow_up_by_customer: dict[int, list[SteelCustomerFollowUpTask]] = {}
    for row in follow_up_tasks:
        follow_up_by_customer.setdefault(int(row.customer_id), []).append(row)

    return {
        "items": [
            _serialize_steel_customer(
                row,
                open_follow_up_count=sum(1 for task in follow_up_by_customer.get(int(row.id), []) if task.status in {"open", "in_progress"}),
                next_follow_up_date=min(
                    (task.due_date for task in follow_up_by_customer.get(int(row.id), []) if task.status in {"open", "in_progress"} and task.due_date),
                    default=None,
                ),
                **_compute_customer_lifecycle_summary(
                    customer=row,
                    invoices=invoices_by_customer.get(int(row.id), []),
                    payments=payments_by_customer.get(int(row.id), []),
                    paid_by_invoice=paid_by_invoice,
                    last_payment_date_by_invoice=last_payment_date_by_invoice,
                ),
            )
            for row in customers
        ]
    }


@router.post("/customers")
def create_steel_customer(
    payload: SteelCustomerCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    name = sanitize_text(payload.name, max_length=200, preserve_newlines=False)
    if not name:
        raise HTTPException(status_code=400, detail="Customer name is required.")

    existing = (
        db.query(SteelCustomer)
        .filter(
            SteelCustomer.factory_id == factory.factory_id,
            func.lower(SteelCustomer.name) == name.lower(),
            SteelCustomer.is_active.is_(True),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Customer already exists.")

    customer = SteelCustomer(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        name=name,
        phone=payload.phone,
        email=str(payload.email).strip().lower() if payload.email else None,
        address=sanitize_text(payload.address, max_length=500),
        city=sanitize_text(payload.city, max_length=120, preserve_newlines=False),
        state=sanitize_text(payload.state, max_length=120, preserve_newlines=False),
        tax_id=sanitize_text(payload.tax_id, max_length=64, preserve_newlines=False),
        gst_number=(sanitize_text(payload.gst_number, max_length=32, preserve_newlines=False) or "").upper() or None,
        pan_number=(sanitize_text(payload.pan_number, max_length=16, preserve_newlines=False) or "").upper() or None,
        company_type=sanitize_text(payload.company_type, max_length=40, preserve_newlines=False),
        contact_person=sanitize_text(payload.contact_person, max_length=160, preserve_newlines=False),
        designation=sanitize_text(payload.designation, max_length=120, preserve_newlines=False),
        credit_limit=round(float(payload.credit_limit or 0.0), 2),
        payment_terms_days=int(payload.payment_terms_days or 0),
        status=_normalize_customer_status(payload.status),
        notes=sanitize_text(payload.notes, max_length=500),
        created_by_user_id=current_user.id,
    )
    db.add(customer)
    db.flush()
    _ensure_customer_code(customer)
    _apply_customer_verification_state(customer, verification_source="system_check")
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_CUSTOMER_CREATED",
        details=(
            f"customer_id={customer.id} customer_code={customer.customer_code} "
            f"customer_name={customer.name} credit_limit_inr={round(float(customer.credit_limit or 0.0), 2)}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(customer)
    return {"customer": _serialize_steel_customer(customer)}


@router.get("/customers/{customer_id}")
def get_steel_customer_ledger(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=customer_id)
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(SteelSalesInvoice.factory_id == factory.factory_id, SteelSalesInvoice.customer_id == customer.id)
        .order_by(SteelSalesInvoice.invoice_date.desc(), SteelSalesInvoice.created_at.desc())
        .all()
    )
    payments = (
        db.query(SteelCustomerPayment)
        .filter(SteelCustomerPayment.factory_id == factory.factory_id, SteelCustomerPayment.customer_id == customer.id)
        .order_by(SteelCustomerPayment.payment_date.desc(), SteelCustomerPayment.created_at.desc())
        .all()
    )
    allocation_rows = (
        db.query(SteelCustomerPaymentAllocation)
        .filter(
            SteelCustomerPaymentAllocation.factory_id == factory.factory_id,
            SteelCustomerPaymentAllocation.customer_id == customer.id,
        )
        .all()
    )
    follow_up_tasks = (
        db.query(SteelCustomerFollowUpTask)
        .filter(
            SteelCustomerFollowUpTask.factory_id == factory.factory_id,
            SteelCustomerFollowUpTask.customer_id == customer.id,
        )
        .order_by(
            SteelCustomerFollowUpTask.status.asc(),
            SteelCustomerFollowUpTask.due_date.asc().nulls_last(),
            SteelCustomerFollowUpTask.created_at.desc(),
        )
        .all()
    )

    creator_ids = {
        actor_id
        for actor_id in [
            customer.created_by_user_id,
            customer.verified_by_user_id,
            *[row.created_by_user_id for row in invoices],
            *[row.created_by_user_id for row in payments],
            *[row.created_by_user_id for row in follow_up_tasks],
            *[row.assigned_to_user_id for row in follow_up_tasks],
        ]
        if actor_id
    }
    creators = {
        row.id: row for row in db.query(User).filter(User.id.in_(creator_ids)).all()
    } if creator_ids else {}
    invoice_map = {int(row.id): row for row in invoices}
    payment_allocations_by_payment, paid_by_invoice, last_payment_date_by_invoice = _build_payment_allocation_maps(
        payments=payments,
        allocations=allocation_rows,
        invoice_map=invoice_map,
    )

    serialized_invoices = []
    for invoice in invoices:
        total_amount = float(invoice.total_amount or 0.0)
        paid_amount = float(paid_by_invoice.get(int(invoice.id), 0.0))
        outstanding_amount = max(0.0, total_amount - paid_amount)
        overdue_days = (date.today() - invoice.due_date).days if outstanding_amount > 0.005 and invoice.due_date < date.today() else 0
        serialized_invoices.append(
            _serialize_steel_invoice(
                invoice,
                creator=creators.get(invoice.created_by_user_id),
                paid_amount_inr=paid_amount,
                outstanding_amount_inr=outstanding_amount,
                overdue_days=overdue_days,
                is_overdue=overdue_days > 0,
            )
        )
    lifecycle = _compute_customer_lifecycle_summary(
        customer=customer,
        invoices=invoices,
        payments=payments,
        paid_by_invoice=paid_by_invoice,
        last_payment_date_by_invoice=last_payment_date_by_invoice,
    )
    serialized_payments = [
        _serialize_steel_customer_payment(
            row,
            creator=creators.get(row.created_by_user_id),
            customer=customer,
            invoice=invoice_map.get(row.invoice_id) if row.invoice_id else None,
            allocations=payment_allocations_by_payment.get(int(row.id), []),
        )
        for row in payments
    ]
    invoice_ids = {int(row.invoice_id) for row in follow_up_tasks if row.invoice_id}
    task_invoice_map = {
        row.id: row for row in db.query(SteelSalesInvoice).filter(SteelSalesInvoice.id.in_(invoice_ids)).all()
    } if invoice_ids else {}
    serialized_tasks = [
        _serialize_steel_follow_up_task(
            row,
            assignee=creators.get(row.assigned_to_user_id),
            creator=creators.get(row.created_by_user_id),
            invoice=task_invoice_map.get(row.invoice_id) if row.invoice_id else None,
        )
        for row in follow_up_tasks
    ]
    alerts = _build_customer_lifecycle_alerts(customer=customer, lifecycle=lifecycle, follow_up_tasks=follow_up_tasks)
    open_follow_up_count = sum(1 for task in follow_up_tasks if task.status in {"open", "in_progress"})
    next_follow_up_date = min(
        (task.due_date for task in follow_up_tasks if task.status in {"open", "in_progress"} and task.due_date),
        default=None,
    )

    return {
        "factory": {
            "factory_id": factory.factory_id,
            "name": factory.name,
            "factory_code": factory.factory_code,
            "industry_type": factory.industry_type,
        },
        "customer": _serialize_steel_customer(
            customer,
            open_follow_up_count=open_follow_up_count,
            next_follow_up_date=next_follow_up_date,
            verified_by_name=creators.get(customer.verified_by_user_id).name if creators.get(customer.verified_by_user_id) else None,
            **lifecycle,
        ),
        "ledger_summary": {
            "invoice_total_inr": lifecycle["invoice_total_inr"],
            "payments_total_inr": lifecycle["payments_total_inr"],
            "outstanding_amount_inr": lifecycle["outstanding_amount_inr"],
            "advance_amount_inr": lifecycle["advance_amount_inr"],
            "overdue_amount_inr": lifecycle["overdue_amount_inr"],
            "credit_used_percentage": lifecycle["credit_used_percentage"],
            "available_credit_inr": lifecycle["available_credit_inr"],
            "risk_score": lifecycle["risk_score"],
            "risk_level": lifecycle["risk_level"],
            "overdue_days": lifecycle["overdue_days"],
            "late_payment_count": lifecycle["late_payment_count"],
        },
        "invoices": serialized_invoices,
        "payments": serialized_payments,
        "follow_up_tasks": serialized_tasks,
        "alerts": alerts,
    }


@router.post("/customers/{customer_id}/tasks")
def create_steel_customer_follow_up_task(
    customer_id: int,
    payload: SteelCustomerFollowUpTaskCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=customer_id)
    invoice = None
    if payload.invoice_id is not None:
        invoice = _get_invoice_or_404(db, factory_id=factory.factory_id, invoice_id=payload.invoice_id)
        if invoice.customer_id != customer.id:
            raise HTTPException(status_code=400, detail="Follow-up invoice must belong to this customer.")
    assignee = None
    if payload.assigned_to_user_id is not None:
        assignee = db.query(User).filter(User.id == payload.assigned_to_user_id, User.org_id == factory.org_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assigned user not found.")

    task = SteelCustomerFollowUpTask(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        customer_id=customer.id,
        invoice_id=invoice.id if invoice else None,
        title=sanitize_text(payload.title, max_length=160, preserve_newlines=False) or "Follow-up",
        note=sanitize_text(payload.note, max_length=500),
        priority=_normalize_follow_up_task_priority(payload.priority),
        status="open",
        due_date=payload.due_date,
        assigned_to_user_id=assignee.id if assignee else None,
        created_by_user_id=current_user.id,
    )
    db.add(task)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_CUSTOMER_FOLLOW_UP_CREATED",
        details=f"customer_id={customer.id} title={task.title} priority={task.priority}",
        request=request,
    )
    db.commit()
    db.refresh(task)
    return {"task": _serialize_steel_follow_up_task(task, assignee=assignee, creator=current_user, invoice=invoice)}


@router.post("/customers/{customer_id}/tasks/{task_id}/status")
def update_steel_customer_follow_up_task_status(
    customer_id: int,
    task_id: int,
    payload: SteelCustomerFollowUpTaskStatusRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    task = _get_customer_follow_up_task_or_404(db, factory_id=factory.factory_id, customer_id=customer_id, task_id=task_id)
    task.status = _normalize_follow_up_task_status(payload.status)
    if payload.note:
        task.note = sanitize_text(payload.note, max_length=500)
    task.completed_at = datetime.now(timezone.utc) if task.status == "done" else None
    db.add(task)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_CUSTOMER_FOLLOW_UP_UPDATED",
        details=f"customer_id={customer_id} task_id={task.id} status={task.status}",
        request=request,
    )
    db.commit()
    db.refresh(task)
    assignee = db.query(User).filter(User.id == task.assigned_to_user_id).first() if task.assigned_to_user_id else None
    creator = db.query(User).filter(User.id == task.created_by_user_id).first() if task.created_by_user_id else None
    invoice = _get_invoice_or_404(db, factory_id=factory.factory_id, invoice_id=task.invoice_id) if task.invoice_id else None
    return {"task": _serialize_steel_follow_up_task(task, assignee=assignee, creator=creator, invoice=invoice)}


@router.post("/customers/{customer_id}/verification/run-check")
def run_steel_customer_verification_check(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=customer_id)
    _apply_customer_verification_state(customer, verification_source="system_check")
    db.add(customer)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_CUSTOMER_VERIFICATION_CHECKED",
        details=(
            f"customer_id={customer.id} verification_status={customer.verification_status} "
            f"score={round(float(customer.match_score or 0.0), 2)}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(customer)
    return {"customer": _serialize_steel_customer(customer)}


@router.get("/customers/{customer_id}/verification-documents/{document_type}")
def get_steel_customer_verification_document(
    customer_id: int,
    document_type: SteelCustomerVerificationDocType,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    require_any_role(
        current_user,
        {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=customer_id)
    document_name = _customer_verification_document_name(customer, document_type)
    if not document_name:
        raise HTTPException(status_code=404, detail="Verification document not found.")
    safe_name = Path(document_name).name
    if safe_name != document_name:
        raise HTTPException(status_code=404, detail="Verification document not found.")
    document_path = STEEL_VERIFICATION_DOC_DIR / safe_name
    if not document_path.exists():
        raise HTTPException(status_code=404, detail="Verification document not found.")
    media_type = mimetypes.guess_type(document_path.name)[0] or _STEEL_VERIFICATION_ALLOWED_EXTENSIONS.get(document_path.suffix.lower(), "application/octet-stream")
    return FileResponse(document_path, media_type=media_type, filename=document_path.name)


@router.post("/customers/{customer_id}/verification-documents/{document_type}")
async def upload_steel_customer_verification_document(
    customer_id: int,
    document_type: SteelCustomerVerificationDocType,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=customer_id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="Select a document to upload.")
    extension = _guess_verification_document_extension(file)
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded document is empty.")
    if len(file_bytes) > STEEL_VERIFICATION_DOC_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Verification document must be 6 MB or smaller.")

    previous_name = _customer_verification_document_name(customer, document_type)
    saved_name: str | None = None
    try:
        saved_name = _save_customer_verification_document(
            customer_id=customer.id,
            document_type=document_type,
            extension=extension,
            file_bytes=file_bytes,
        )
        _set_customer_verification_document_name(customer, document_type=document_type, document_name=saved_name)
        _apply_customer_verification_state(customer, verification_source="system_check")
        db.add(customer)
        _write_steel_audit(
            db,
            actor=current_user,
            factory_id=factory.factory_id,
            action="STEEL_CUSTOMER_VERIFICATION_DOCUMENT_UPLOADED",
            details=f"customer_id={customer.id} document_type={document_type}",
            request=request,
        )
        db.commit()
        db.refresh(customer)
    except HTTPException:
        if saved_name:
            _delete_customer_verification_document(saved_name)
        raise
    except Exception as error:  # pylint: disable=broad-except
        if saved_name:
            _delete_customer_verification_document(saved_name)
        raise HTTPException(status_code=500, detail="Could not upload verification document.") from error

    if previous_name and previous_name != saved_name:
        _delete_customer_verification_document(previous_name)
    return {"customer": _serialize_steel_customer(customer)}


@router.post("/customers/{customer_id}/verification/review")
def review_steel_customer_verification(
    customer_id: int,
    payload: SteelCustomerVerificationReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=customer_id)
    customer.official_legal_name = sanitize_text(payload.official_legal_name, max_length=200, preserve_newlines=False)
    customer.official_trade_name = sanitize_text(payload.official_trade_name, max_length=200, preserve_newlines=False)
    customer.official_state = sanitize_text(payload.official_state, max_length=120, preserve_newlines=False)

    evaluation = _evaluate_customer_verification(customer)
    source = payload.verification_source or "manual_review"
    if payload.decision == "approve":
        if evaluation["verification_status"] == "mismatch":
            raise HTTPException(status_code=400, detail=evaluation["mismatch_reason"] or "Verification data still has mismatches.")
        _apply_customer_verification_state(
            customer,
            final_status="verified",
            verification_source=source,
            reviewer_user_id=current_user.id,
        )
        customer.mismatch_reason = None
    else:
        _apply_customer_verification_state(
            customer,
            final_status="rejected",
            verification_source=source,
            reviewer_user_id=current_user.id,
        )
        customer.mismatch_reason = sanitize_text(payload.mismatch_reason, max_length=500) or evaluation["mismatch_reason"] or "Rejected during manual review."

    db.add(customer)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_CUSTOMER_VERIFICATION_REVIEWED",
        details=(
            f"customer_id={customer.id} decision={payload.decision} "
            f"status={customer.verification_status} score={round(float(customer.match_score or 0.0), 2)}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(customer)
    return {"customer": _serialize_steel_customer(customer, verified_by_name=current_user.name if customer.verified_by_user_id else None)}


@router.post("/customers/payments")
def create_steel_customer_payment(
    payload: SteelCustomerPaymentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=payload.customer_id)
    if payload.allocations and payload.invoice_id is not None:
        raise HTTPException(status_code=422, detail="Use either a single invoice selection or explicit allocations, not both.")

    invoice = None
    if payload.invoice_id is not None:
        invoice = _get_invoice_or_404(db, factory_id=factory.factory_id, invoice_id=payload.invoice_id)
        if invoice.customer_id is None:
            if invoice.customer_name.strip().lower() != customer.name.strip().lower():
                raise HTTPException(status_code=400, detail="Invoice does not belong to the selected customer.")
            invoice.customer_id = customer.id
        elif int(invoice.customer_id) != int(customer.id):
            raise HTTPException(status_code=400, detail="Invoice does not belong to the selected customer.")
    customer_invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory.factory_id,
            SteelSalesInvoice.customer_id == customer.id,
        )
        .order_by(SteelSalesInvoice.due_date.asc(), SteelSalesInvoice.invoice_date.asc(), SteelSalesInvoice.id.asc())
        .all()
    )
    invoice_map = {int(row.id): row for row in customer_invoices}
    customer_payments = (
        db.query(SteelCustomerPayment)
        .filter(
            SteelCustomerPayment.factory_id == factory.factory_id,
            SteelCustomerPayment.customer_id == customer.id,
        )
        .all()
    )
    allocation_rows = (
        db.query(SteelCustomerPaymentAllocation)
        .filter(
            SteelCustomerPaymentAllocation.factory_id == factory.factory_id,
            SteelCustomerPaymentAllocation.customer_id == customer.id,
        )
        .all()
    )
    _, paid_by_invoice, _ = _build_payment_allocation_maps(
        payments=customer_payments,
        allocations=allocation_rows,
        invoice_map=invoice_map,
    )
    remaining_by_invoice = {
        int(row.id): round(max(0.0, float(row.total_amount or 0.0) - float(paid_by_invoice.get(int(row.id), 0.0))), 2)
        for row in customer_invoices
    }
    requested_allocations: list[tuple[SteelSalesInvoice, float]] = []
    if payload.allocations:
        requested_totals_by_invoice: dict[int, float] = {}
        total_requested = 0.0
        for allocation in payload.allocations:
            target_invoice = invoice_map.get(int(allocation.invoice_id))
            if not target_invoice:
                raise HTTPException(status_code=400, detail="All allocations must belong to the selected customer.")
            requested_totals_by_invoice[int(target_invoice.id)] = round(
                float(requested_totals_by_invoice.get(int(target_invoice.id), 0.0)) + float(allocation.amount or 0.0),
                2,
            )
            if requested_totals_by_invoice[int(target_invoice.id)] - float(remaining_by_invoice.get(int(target_invoice.id), 0.0)) > 0.01:
                raise HTTPException(status_code=400, detail="Payment allocation exceeds the invoice outstanding balance.")
            total_requested = round(total_requested + float(allocation.amount or 0.0), 2)
            requested_allocations.append((target_invoice, round(float(allocation.amount or 0.0), 2)))
        if total_requested - float(payload.amount or 0.0) > 0.01:
            raise HTTPException(status_code=400, detail="Payment allocations exceed the payment amount.")
    elif payload.invoice_id is not None:
        if not invoice:
            raise HTTPException(status_code=400, detail="Invoice selection is invalid.")
        outstanding_amount = float(remaining_by_invoice.get(int(invoice.id), 0.0))
        if float(payload.amount or 0.0) - outstanding_amount > 0.01:
            raise HTTPException(status_code=400, detail="Payment amount exceeds the invoice outstanding balance.")
        requested_allocations.append((invoice, round(float(payload.amount or 0.0), 2)))
    else:
        remaining_payment = round(float(payload.amount or 0.0), 2)
        for target_invoice in customer_invoices:
            outstanding_amount = float(remaining_by_invoice.get(int(target_invoice.id), 0.0))
            if outstanding_amount <= 0.01 or remaining_payment <= 0.01:
                continue
            applied_amount = round(min(remaining_payment, outstanding_amount), 2)
            if applied_amount <= 0:
                continue
            requested_allocations.append((target_invoice, applied_amount))
            remaining_payment = round(remaining_payment - applied_amount, 2)

    payment = SteelCustomerPayment(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        customer_id=customer.id,
        invoice_id=invoice.id if invoice else (requested_allocations[0][0].id if len(requested_allocations) == 1 else None),
        payment_date=payload.payment_date,
        amount=round(float(payload.amount or 0.0), 2),
        payment_mode=payload.payment_mode,
        reference_number=sanitize_text(payload.reference_number, max_length=80, preserve_newlines=False),
        notes=sanitize_text(payload.notes, max_length=500),
        created_by_user_id=current_user.id,
    )
    db.add(payment)
    db.flush()
    created_allocations: list[SteelCustomerPaymentAllocation] = []
    affected_invoice_ids: set[int] = set()
    for target_invoice, allocated_amount in requested_allocations:
        if allocated_amount <= 0:
            continue
        created_allocations.append(
            SteelCustomerPaymentAllocation(
                org_id=factory.org_id,
                factory_id=factory.factory_id,
                customer_id=customer.id,
                payment_id=payment.id,
                invoice_id=target_invoice.id,
                allocated_amount=allocated_amount,
                created_by_user_id=current_user.id,
            )
        )
        affected_invoice_ids.add(int(target_invoice.id))
    for row in created_allocations:
        db.add(row)
    db.flush()
    _refresh_invoice_payment_statuses(db, factory_id=factory.factory_id, invoice_ids=affected_invoice_ids)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_CUSTOMER_PAYMENT_RECORDED",
        details=(
            f"customer_id={customer.id} invoice_id={invoice.id if invoice else 'none'} "
            f"amount_inr={round(float(payment.amount or 0.0), 2)} allocations={len(created_allocations)}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(payment)
    for row in created_allocations:
        db.refresh(row)
    return {
        "payment": _serialize_steel_customer_payment(
            payment,
            creator=current_user,
            customer=customer,
            invoice=invoice,
            allocations=[
                {
                    "invoice_id": int(row.invoice_id),
                    "invoice_number": invoice_map.get(int(row.invoice_id)).invoice_number if invoice_map.get(int(row.invoice_id)) else None,
                    "amount": round(float(row.allocated_amount or 0.0), 2),
                    "payment_date": payment.payment_date.isoformat(),
                }
                for row in created_allocations
            ],
        )
    }


@router.get("/invoices")
def list_steel_invoices(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    limit = max(1, min(limit, 100))
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(SteelSalesInvoice.factory_id == factory.factory_id)
        .order_by(SteelSalesInvoice.invoice_date.desc(), SteelSalesInvoice.created_at.desc())
        .limit(limit)
        .all()
    )
    creator_ids = {row.created_by_user_id for row in invoices if row.created_by_user_id}
    creator_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(creator_ids)).all()
    } if creator_ids else {}
    invoice_ids = [int(row.id) for row in invoices]
    customer_ids = {int(row.customer_id) for row in invoices if row.customer_id is not None}
    payments = (
        db.query(SteelCustomerPayment)
        .filter(
            SteelCustomerPayment.factory_id == factory.factory_id,
            or_(
                SteelCustomerPayment.customer_id.in_(list(customer_ids)) if customer_ids else False,
                SteelCustomerPayment.invoice_id.in_(invoice_ids) if invoice_ids else False,
            ),
        )
        .all()
        if customer_ids or invoice_ids
        else []
    )
    allocation_rows = (
        db.query(SteelCustomerPaymentAllocation)
        .filter(
            SteelCustomerPaymentAllocation.factory_id == factory.factory_id,
            SteelCustomerPaymentAllocation.invoice_id.in_(invoice_ids),
        )
        .all()
        if invoice_ids
        else []
    )
    invoice_map = {int(row.id): row for row in invoices}
    _, paid_by_invoice, _ = _build_payment_allocation_maps(
        payments=payments,
        allocations=allocation_rows,
        invoice_map=invoice_map,
    )
    return {
        "items": [
            _serialize_steel_invoice(
                row,
                creator=creator_map.get(row.created_by_user_id),
                paid_amount_inr=paid_by_invoice.get(int(row.id), 0.0),
                outstanding_amount_inr=max(0.0, float(row.total_amount or 0.0) - float(paid_by_invoice.get(int(row.id), 0.0))),
                overdue_days=(date.today() - row.due_date).days if row.due_date < date.today() and max(0.0, float(row.total_amount or 0.0) - float(paid_by_invoice.get(int(row.id), 0.0))) > 0.005 else 0,
                is_overdue=row.due_date < date.today() and max(0.0, float(row.total_amount or 0.0) - float(paid_by_invoice.get(int(row.id), 0.0))) > 0.005,
            )
            for row in invoices
        ]
    }


@router.get("/invoices/{invoice_id}")
def get_steel_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    invoice = (
        db.query(SteelSalesInvoice)
        .filter(SteelSalesInvoice.id == invoice_id, SteelSalesInvoice.factory_id == factory.factory_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Steel invoice not found.")

    line_rows = (
        db.query(SteelSalesInvoiceLine)
        .filter(SteelSalesInvoiceLine.invoice_id == invoice.id)
        .order_by(SteelSalesInvoiceLine.id.asc())
        .all()
    )
    item_ids = {row.item_id for row in line_rows}
    batch_ids = {row.batch_id for row in line_rows if row.batch_id}
    dispatched_by_line: dict[int, float] = {}
    if line_rows:
        existing_dispatch_lines = (
            db.query(SteelDispatchLine.invoice_line_id, SteelDispatchLine.weight_kg)
            .join(SteelDispatch, SteelDispatch.id == SteelDispatchLine.dispatch_id)
            .filter(
                SteelDispatch.factory_id == factory.factory_id,
                SteelDispatch.invoice_id == invoice.id,
                SteelDispatch.status != "cancelled",
                SteelDispatchLine.invoice_line_id.in_([row.id for row in line_rows]),
            )
            .all()
        )
        for invoice_line_id, weight_kg in existing_dispatch_lines:
            dispatched_by_line[int(invoice_line_id)] = float(dispatched_by_line.get(int(invoice_line_id), 0.0)) + float(weight_kg or 0.0)
    item_map = {
        item.id: item
        for item in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.id.in_(item_ids))
        .all()
    } if item_ids else {}
    batch_map = {
        row.id: row
        for row in db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.factory_id == factory.factory_id, SteelProductionBatch.id.in_(batch_ids))
        .all()
    } if batch_ids else {}
    creator = db.query(User).filter(User.id == invoice.created_by_user_id).first() if invoice.created_by_user_id else None
    payments = (
        db.query(SteelCustomerPayment)
        .filter(
            SteelCustomerPayment.factory_id == factory.factory_id,
            or_(
                SteelCustomerPayment.customer_id == invoice.customer_id if invoice.customer_id is not None else False,
                SteelCustomerPayment.invoice_id == invoice.id,
            ),
        )
        .all()
    )
    allocation_rows = (
        db.query(SteelCustomerPaymentAllocation)
        .filter(
            SteelCustomerPaymentAllocation.factory_id == factory.factory_id,
            SteelCustomerPaymentAllocation.invoice_id == invoice.id,
        )
        .all()
    )
    _, paid_by_invoice, _ = _build_payment_allocation_maps(
        payments=payments,
        allocations=allocation_rows,
        invoice_map={int(invoice.id): invoice},
    )
    serialized_lines = [
        {
            **_serialize_steel_invoice_line(row, item=item_map.get(row.item_id), batch=batch_map.get(row.batch_id)),
            "dispatched_weight_kg": round(float(dispatched_by_line.get(row.id, 0.0)), 3),
            "remaining_weight_kg": round(max(0.0, float(row.weight_kg or 0.0) - float(dispatched_by_line.get(row.id, 0.0))), 3),
        }
        for row in line_rows
    ]
    dispatch_rows = (
        db.query(SteelDispatch)
        .filter(
            SteelDispatch.factory_id == factory.factory_id,
            SteelDispatch.invoice_id == invoice.id,
        )
        .order_by(SteelDispatch.dispatch_date.desc(), SteelDispatch.id.desc())
        .all()
    )
    dispatch_actor_ids = {
        actor_id
        for row in dispatch_rows
        for actor_id in [row.created_by_user_id, row.delivered_by_user_id]
        if actor_id
    }
    dispatch_actor_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(dispatch_actor_ids)).all()
    } if dispatch_actor_ids else {}
    total_dispatched_weight_kg = sum(float(row.total_weight_kg or 0.0) for row in dispatch_rows if row.status != "cancelled")
    active_dispatch_count = sum(1 for row in dispatch_rows if row.status in {"pending", "loaded", "dispatched"})
    delivered_dispatch_count = sum(1 for row in dispatch_rows if row.status == "delivered")
    cancelled_dispatch_count = sum(1 for row in dispatch_rows if row.status == "cancelled")
    last_dispatch_date = max((row.dispatch_date for row in dispatch_rows), default=None)

    audit_rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.factory_id == factory.factory_id,
            AuditLog.details.isnot(None),
            AuditLog.details.like(f"%{invoice.invoice_number}%"),
        )
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .limit(20)
        .all()
    )
    actor_ids = {row.user_id for row in audit_rows if row.user_id}
    audit_actor_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(actor_ids)).all()
    } if actor_ids else {}

    return {
        "factory": {
            "factory_id": factory.factory_id,
            "name": factory.name,
            "factory_code": factory.factory_code,
            "industry_type": factory.industry_type,
        },
        "invoice": _serialize_steel_invoice(
            invoice,
            creator=creator,
            lines=serialized_lines,
            paid_amount_inr=paid_by_invoice.get(int(invoice.id), 0.0),
            outstanding_amount_inr=max(0.0, float(invoice.total_amount or 0.0) - float(paid_by_invoice.get(int(invoice.id), 0.0))),
            overdue_days=(date.today() - invoice.due_date).days if invoice.due_date < date.today() and max(0.0, float(invoice.total_amount or 0.0) - float(paid_by_invoice.get(int(invoice.id), 0.0))) > 0.005 else 0,
              is_overdue=invoice.due_date < date.today() and max(0.0, float(invoice.total_amount or 0.0) - float(paid_by_invoice.get(int(invoice.id), 0.0))) > 0.005,
        ),
        "dispatch_summary": {
            "dispatch_count": len(dispatch_rows),
            "active_count": active_dispatch_count,
            "delivered_count": delivered_dispatch_count,
            "cancelled_count": cancelled_dispatch_count,
            "dispatched_weight_kg": round(total_dispatched_weight_kg, 3),
            "remaining_weight_kg": round(max(0.0, float(invoice.total_weight_kg or 0.0) - total_dispatched_weight_kg), 3),
            "last_dispatch_date": last_dispatch_date.isoformat() if last_dispatch_date else None,
        },
        "dispatches": [
            _serialize_steel_dispatch(
                row,
                creator=dispatch_actor_map.get(row.created_by_user_id),
                delivered_by=dispatch_actor_map.get(row.delivered_by_user_id),
                invoice=invoice,
            )
            for row in dispatch_rows
        ],
        "audit_events": [
            _serialize_steel_audit(row, actor=audit_actor_map.get(row.user_id))
            for row in audit_rows
        ],
    }


@router.post("/invoices")
def create_steel_invoice(
    payload: SteelInvoiceCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    invoice_number = (
        sanitize_text(payload.invoice_number, max_length=40, preserve_newlines=False).upper()
        if payload.invoice_number
        else generate_invoice_number(db, factory)
    )
    if not invoice_number:
        invoice_number = generate_invoice_number(db, factory)
    existing = db.query(SteelSalesInvoice.id).filter(SteelSalesInvoice.invoice_number == invoice_number).first()
    if existing:
        raise HTTPException(status_code=409, detail="Invoice number already exists.")

    customer: SteelCustomer | None = None
    payment_terms_days = int(payload.payment_terms_days or 0)
    if payload.customer_id is not None:
        customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=payload.customer_id)
        customer_name = customer.name
        payment_terms_days = int(payload.payment_terms_days if payload.payment_terms_days is not None else customer.payment_terms_days or 0)
    else:
        customer_name = sanitize_text(payload.customer_name, max_length=200, preserve_newlines=False)
        if not customer_name:
            raise HTTPException(status_code=400, detail="Customer name is required.")
        customer = (
            db.query(SteelCustomer)
            .filter(
                SteelCustomer.factory_id == factory.factory_id,
                func.lower(SteelCustomer.name) == customer_name.lower(),
                SteelCustomer.is_active.is_(True),
            )
            .first()
        )
        if customer is None:
            customer = SteelCustomer(
                org_id=factory.org_id,
                factory_id=factory.factory_id,
                name=customer_name,
                payment_terms_days=payment_terms_days,
                created_by_user_id=current_user.id,
            )
            db.add(customer)
            db.flush()
            _ensure_customer_code(customer)
            _apply_customer_verification_state(customer, verification_source="system_check")
        else:
            payment_terms_days = int(payload.payment_terms_days if payload.payment_terms_days is not None else customer.payment_terms_days or 0)

    if customer and customer.status in {"on_hold", "blocked"}:
        raise HTTPException(status_code=409, detail="This customer is on hold. Invoice creation is blocked until the account is reactivated.")

    subtotal_amount = 0.0
    total_weight_kg = 0.0
    prepared_lines: list[dict[str, Any]] = []
    for line in payload.lines:
        item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=line.item_id)
        if item.category != "finished_goods":
            raise HTTPException(status_code=400, detail="Steel invoicing currently supports finished goods only.")
        batch = None
        if line.batch_id is not None:
            batch = _get_batch_or_404(db, factory_id=factory.factory_id, batch_id=line.batch_id)
            if batch.output_item_id != item.id:
                raise HTTPException(status_code=400, detail="Selected batch does not produce the chosen invoice item.")
        weight_kg = float(line.weight_kg or 0.0)
        rate_per_kg = float(line.rate_per_kg or 0.0)
        line_total = round(weight_kg * rate_per_kg, 2)
        subtotal_amount += line_total
        total_weight_kg += weight_kg
        prepared_lines.append(
            {
                "item": item,
                "batch": batch,
                "description": sanitize_text(line.description, max_length=200),
                "weight_kg": weight_kg,
                "rate_per_kg": rate_per_kg,
                "line_total": line_total,
            }
        )

    if customer and float(customer.credit_limit or 0.0) > 0:
        current_invoice_total = float(
            db.query(func.coalesce(func.sum(SteelSalesInvoice.total_amount), 0))
            .filter(
                SteelSalesInvoice.factory_id == factory.factory_id,
                SteelSalesInvoice.customer_id == customer.id,
            )
            .scalar()
            or 0.0
        )
        current_payment_total = float(
            db.query(func.coalesce(func.sum(SteelCustomerPayment.amount), 0))
            .filter(
                SteelCustomerPayment.factory_id == factory.factory_id,
                SteelCustomerPayment.customer_id == customer.id,
            )
            .scalar()
            or 0.0
        )
        projected_outstanding = max(0.0, current_invoice_total - current_payment_total) + float(subtotal_amount)
        if projected_outstanding - float(customer.credit_limit or 0.0) > 0.01:
            raise HTTPException(status_code=409, detail="Customer credit limit exceeded. Record payment or raise the credit limit before issuing this invoice.")

    invoice = SteelSalesInvoice(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        customer_id=customer.id if customer else None,
        invoice_number=invoice_number,
        invoice_date=payload.invoice_date,
        due_date=payload.invoice_date + timedelta(days=payment_terms_days),
        customer_name=customer_name,
        status="unpaid",
        currency="INR",
        payment_terms_days=payment_terms_days,
        total_weight_kg=round(total_weight_kg, 3),
        subtotal_amount=round(subtotal_amount, 2),
        total_amount=round(subtotal_amount, 2),
        notes=sanitize_text(payload.notes, max_length=500),
        created_by_user_id=current_user.id,
    )
    db.add(invoice)
    db.flush()

    line_rows: list[SteelSalesInvoiceLine] = []
    for line in prepared_lines:
        row = SteelSalesInvoiceLine(
            invoice_id=invoice.id,
            item_id=line["item"].id,
            batch_id=line["batch"].id if line["batch"] else None,
            description=line["description"],
            weight_kg=line["weight_kg"],
            rate_per_kg=line["rate_per_kg"],
            line_total=line["line_total"],
        )
        db.add(row)
        line_rows.append(row)

    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_INVOICE_CREATED",
        details=(
            f"invoice={invoice_number} customer={customer_name} "
            f"weight_kg={round(total_weight_kg, 3)} total_inr={round(subtotal_amount, 2)} "
            f"due_date={invoice.due_date.isoformat()} terms_days={payment_terms_days}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(invoice)
    for row in line_rows:
        db.refresh(row)

    return {
        "invoice": _serialize_steel_invoice(
            invoice,
            creator=current_user,
            paid_amount_inr=0.0,
            outstanding_amount_inr=round(subtotal_amount, 2),
            overdue_days=0,
            is_overdue=False,
            lines=[
                _serialize_steel_invoice_line(row, item=line["item"], batch=line["batch"])
                for row, line in zip(line_rows, prepared_lines)
            ],
        )
    }


@router.get("/dispatches")
def list_steel_dispatches(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    limit = max(1, min(limit, 100))
    rows = (
        db.query(SteelDispatch)
        .filter(SteelDispatch.factory_id == factory.factory_id)
        .order_by(SteelDispatch.dispatch_date.desc(), SteelDispatch.created_at.desc())
        .limit(limit)
        .all()
    )
    creator_ids = {
        user_id
        for user_id in [*[row.created_by_user_id for row in rows], *[row.delivered_by_user_id for row in rows]]
        if user_id
    }
    invoice_ids = {row.invoice_id for row in rows}
    creator_map = {
        user.id: user for user in db.query(User).filter(User.id.in_(creator_ids)).all()
    } if creator_ids else {}
    invoice_map = {
        row.id: row for row in db.query(SteelSalesInvoice).filter(SteelSalesInvoice.id.in_(invoice_ids)).all()
    } if invoice_ids else {}
    return {
        "items": [
            _serialize_steel_dispatch(
                row,
                creator=creator_map.get(row.created_by_user_id),
                delivered_by=creator_map.get(row.delivered_by_user_id),
                invoice=invoice_map.get(row.invoice_id),
            )
            for row in rows
        ]
    }


@router.get("/dispatches/{dispatch_id}")
def get_steel_dispatch_detail(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    dispatch = _get_dispatch_or_404(db, factory_id=factory.factory_id, dispatch_id=dispatch_id)

    invoice = _get_invoice_or_404(db, factory_id=factory.factory_id, invoice_id=dispatch.invoice_id)
    line_rows = (
        db.query(SteelDispatchLine)
        .filter(SteelDispatchLine.dispatch_id == dispatch.id)
        .order_by(SteelDispatchLine.id.asc())
        .all()
    )
    invoice_line_ids = {row.invoice_line_id for row in line_rows}
    item_ids = {row.item_id for row in line_rows}
    batch_ids = {row.batch_id for row in line_rows if row.batch_id}
    creator = db.query(User).filter(User.id == dispatch.created_by_user_id).first() if dispatch.created_by_user_id else None
    delivered_by = db.query(User).filter(User.id == dispatch.delivered_by_user_id).first() if dispatch.delivered_by_user_id else None
    invoice_line_map = {
        row.id: row
        for row in db.query(SteelSalesInvoiceLine)
        .filter(SteelSalesInvoiceLine.id.in_(invoice_line_ids))
        .all()
    } if invoice_line_ids else {}
    item_map = {
        row.id: row
        for row in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.id.in_(item_ids))
        .all()
    } if item_ids else {}
    batch_map = {
        row.id: row
        for row in db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.factory_id == factory.factory_id, SteelProductionBatch.id.in_(batch_ids))
        .all()
    } if batch_ids else {}
    serialized_lines = [
        _serialize_steel_dispatch_line(
            row,
            invoice_line=invoice_line_map.get(row.invoice_line_id),
            item=item_map.get(row.item_id),
            batch=batch_map.get(row.batch_id),
        )
        for row in line_rows
    ]

    movement_rows = (
        db.query(SteelInventoryTransaction)
        .filter(
            SteelInventoryTransaction.factory_id == factory.factory_id,
            SteelInventoryTransaction.reference_type == "steel_dispatch",
            SteelInventoryTransaction.reference_id == dispatch.dispatch_number,
        )
        .order_by(SteelInventoryTransaction.created_at.asc(), SteelInventoryTransaction.id.asc())
        .all()
    )
    actor_ids = {row.created_by_user_id for row in movement_rows if row.created_by_user_id}
    audit_rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.factory_id == factory.factory_id,
            AuditLog.details.isnot(None),
            AuditLog.details.like(f"%{dispatch.dispatch_number}%"),
        )
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .limit(20)
        .all()
    )
    actor_ids.update(row.user_id for row in audit_rows if row.user_id)
    actor_map = {
        user.id: user
        for user in db.query(User).filter(User.id.in_({actor_id for actor_id in actor_ids if actor_id})).all()
    } if actor_ids else {}

    return {
        "factory": {
            "factory_id": factory.factory_id,
            "name": factory.name,
            "factory_code": factory.factory_code,
            "industry_type": factory.industry_type,
        },
        "dispatch": _serialize_steel_dispatch(
            dispatch,
            creator=creator,
            delivered_by=delivered_by,
            invoice=invoice,
            lines=serialized_lines,
        ),
        "ledger_movements": [
            _serialize_steel_transaction(
                row,
                item=item_map.get(row.item_id),
                actor=actor_map.get(row.created_by_user_id),
            )
            for row in movement_rows
        ],
        "audit_events": [
            _serialize_steel_audit(row, actor=actor_map.get(row.user_id))
            for row in audit_rows
        ],
    }


@router.post("/dispatches")
def create_steel_dispatch(
    payload: SteelDispatchCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    invoice = _get_invoice_or_404(db, factory_id=factory.factory_id, invoice_id=payload.invoice_id)
    requested_status = _normalize_dispatch_status(payload.status)
    dispatch_number = (
        sanitize_text(payload.dispatch_number, max_length=40, preserve_newlines=False).upper()
        if payload.dispatch_number
        else generate_dispatch_number(db, factory)
    )
    if not dispatch_number:
        dispatch_number = generate_dispatch_number(db, factory)
    gate_pass_number = (
        sanitize_text(payload.gate_pass_number, max_length=40, preserve_newlines=False).upper()
        if payload.gate_pass_number
        else generate_gate_pass_number(db, factory)
    )
    if not gate_pass_number:
        gate_pass_number = generate_gate_pass_number(db, factory)

    if db.query(SteelDispatch.id).filter(SteelDispatch.dispatch_number == dispatch_number).first():
        raise HTTPException(status_code=409, detail="Dispatch number already exists.")
    if db.query(SteelDispatch.id).filter(SteelDispatch.gate_pass_number == gate_pass_number).first():
        raise HTTPException(status_code=409, detail="Gate pass number already exists.")

    line_rows = (
        db.query(SteelSalesInvoiceLine)
        .filter(SteelSalesInvoiceLine.invoice_id == invoice.id)
        .all()
    )
    invoice_line_map = {row.id: row for row in line_rows}
    if not invoice_line_map:
        raise HTTPException(status_code=400, detail="The selected invoice has no lines to dispatch.")

    existing_dispatch_weights: dict[int, float] = {}
    existing_lines = (
        db.query(SteelDispatchLine.invoice_line_id, SteelDispatchLine.weight_kg)
        .join(SteelDispatch, SteelDispatch.id == SteelDispatchLine.dispatch_id)
        .filter(
            SteelDispatch.factory_id == factory.factory_id,
            SteelDispatch.invoice_id == invoice.id,
            SteelDispatch.status != "cancelled",
            SteelDispatchLine.invoice_line_id.in_(list(invoice_line_map.keys())),
        )
        .all()
    )
    for invoice_line_id, weight_kg in existing_lines:
        existing_dispatch_weights[int(invoice_line_id)] = float(existing_dispatch_weights.get(int(invoice_line_id), 0.0)) + float(weight_kg or 0.0)

    item_ids = {row.item_id for row in line_rows}
    batch_ids = {row.batch_id for row in line_rows if row.batch_id}
    item_map = {
        row.id: row
        for row in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.id.in_(item_ids))
        .all()
    } if item_ids else {}
    batch_map = {
        row.id: row
        for row in db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.factory_id == factory.factory_id, SteelProductionBatch.id.in_(batch_ids))
        .all()
    } if batch_ids else {}

    requested_by_item: dict[int, float] = {}
    prepared_lines: list[dict[str, Any]] = []
    total_weight_kg = 0.0
    invoice_remaining_before_dispatch = sum(
        max(0.0, float(row.weight_kg or 0.0) - float(existing_dispatch_weights.get(row.id, 0.0)))
        for row in line_rows
    )
    for line in payload.lines:
        invoice_line = invoice_line_map.get(line.invoice_line_id)
        if not invoice_line:
            raise HTTPException(status_code=400, detail="Dispatch lines must belong to the selected invoice.")
        requested_weight = float(line.weight_kg or 0.0)
        remaining_weight = float(invoice_line.weight_kg or 0.0) - float(existing_dispatch_weights.get(invoice_line.id, 0.0))
        if requested_weight - remaining_weight > 0.0001:
            raise HTTPException(status_code=400, detail="Dispatch weight exceeds the remaining invoice quantity.")
        requested_by_item[invoice_line.item_id] = float(requested_by_item.get(invoice_line.item_id, 0.0)) + requested_weight
        total_weight_kg += requested_weight
        prepared_lines.append(
            {
                "invoice_line": invoice_line,
                "item": item_map.get(invoice_line.item_id),
                "batch": batch_map.get(invoice_line.batch_id),
                "remaining_weight_before_dispatch": remaining_weight,
                "weight_kg": requested_weight,
            }
        )
    if not prepared_lines:
        raise HTTPException(status_code=400, detail="Add at least one dispatch line.")

    if _dispatch_status_posts_inventory(requested_status):
        balances = stock_balances_for_factory(db, factory.factory_id)
        for item_id, requested_weight in requested_by_item.items():
            available = float(balances.get(item_id, 0.0))
            if available + 0.0001 < requested_weight:
                raise HTTPException(status_code=400, detail="Dispatch would make stock negative for one or more items.")

    truck_number = sanitize_text(payload.truck_number, max_length=40, preserve_newlines=False)
    driver_name = sanitize_text(payload.driver_name, max_length=120, preserve_newlines=False)
    if not truck_number or not driver_name:
        raise HTTPException(status_code=400, detail="Truck number and driver name are required.")
    transporter_name = sanitize_text(payload.transporter_name, max_length=160, preserve_newlines=False)
    driver_license_number = sanitize_text(payload.driver_license_number, max_length=80, preserve_newlines=False)
    entry_time = coerce_utc_datetime(payload.entry_time)
    exit_time = coerce_utc_datetime(payload.exit_time)
    truck_capacity_kg = round(float(payload.truck_capacity_kg or 0.0), 3) if payload.truck_capacity_kg is not None else None
    duplicate_truck_exists = bool(
        db.query(SteelDispatch.id)
        .filter(
            SteelDispatch.factory_id == factory.factory_id,
            SteelDispatch.dispatch_date == payload.dispatch_date,
            func.lower(SteelDispatch.truck_number) == truck_number.lower(),
            SteelDispatch.status != "cancelled",
        )
        .first()
    )

    dispatch = SteelDispatch(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        invoice_id=invoice.id,
        dispatch_number=dispatch_number,
        gate_pass_number=gate_pass_number,
        dispatch_date=payload.dispatch_date,
        truck_number=truck_number,
        transporter_name=transporter_name,
        vehicle_type=payload.vehicle_type,
        truck_capacity_kg=truck_capacity_kg,
        driver_name=driver_name,
        driver_phone=payload.driver_phone,
        driver_license_number=driver_license_number,
        entry_time=entry_time,
        exit_time=exit_time,
        status=requested_status,
        total_weight_kg=round(total_weight_kg, 3),
        notes=sanitize_text(payload.notes, max_length=500),
        delivered_at=datetime.now(timezone.utc) if requested_status == "delivered" else None,
        delivered_by_user_id=current_user.id if requested_status == "delivered" else None,
        created_by_user_id=current_user.id,
    )
    db.add(dispatch)
    db.flush()

    dispatch_line_rows: list[SteelDispatchLine] = []
    for line in prepared_lines:
        dispatch_line = SteelDispatchLine(
            dispatch_id=dispatch.id,
            invoice_line_id=line["invoice_line"].id,
            item_id=line["invoice_line"].item_id,
            batch_id=line["invoice_line"].batch_id,
            weight_kg=line["weight_kg"],
        )
        db.add(dispatch_line)
        dispatch_line_rows.append(dispatch_line)

    if _dispatch_status_posts_inventory(requested_status):
        _create_dispatch_inventory_movements(
            db,
            factory=factory,
            dispatch=dispatch,
            dispatch_lines=dispatch_line_rows,
            current_user=current_user,
        )

    warnings = _dispatch_alerts(
        total_weight_kg=total_weight_kg,
        truck_capacity_kg=truck_capacity_kg,
        remaining_after_dispatch_kg=max(0.0, invoice_remaining_before_dispatch - total_weight_kg),
        duplicate_truck_exists=duplicate_truck_exists,
    )

    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_DISPATCH_CREATED",
        details=(
            f"dispatch={dispatch_number} gate_pass={gate_pass_number} invoice={invoice.invoice_number} "
            f"truck={truck_number} weight_kg={round(total_weight_kg, 3)} status={requested_status}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(dispatch)
    for row in dispatch_line_rows:
        db.refresh(row)

    return {
        "dispatch": _serialize_steel_dispatch(
            dispatch,
            creator=current_user,
            delivered_by=current_user if dispatch.delivered_by_user_id == current_user.id else None,
            invoice=invoice,
            lines=[
                _serialize_steel_dispatch_line(
                    row,
                    invoice_line=line["invoice_line"],
                    item=line["item"],
                    batch=line["batch"],
                )
                for row, line in zip(dispatch_line_rows, prepared_lines)
            ],
        ),
        "warnings": warnings,
    }


@router.post("/dispatches/{dispatch_id}/status")
def update_steel_dispatch_status(
    dispatch_id: int,
    payload: SteelDispatchStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    dispatch = _get_dispatch_or_404(db, factory_id=factory.factory_id, dispatch_id=dispatch_id)
    invoice = _get_invoice_or_404(db, factory_id=factory.factory_id, invoice_id=dispatch.invoice_id)
    next_status = _normalize_dispatch_status(payload.status)
    current_status = _normalize_dispatch_status(dispatch.status)
    if current_status == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled dispatches cannot be updated.")
    if next_status == "cancelled" and _dispatch_has_posted_inventory(dispatch):
        raise HTTPException(status_code=409, detail="Only non-posted draft dispatches can be cancelled.")
    if next_status in {"pending", "loaded"} and _dispatch_has_posted_inventory(dispatch):
        raise HTTPException(status_code=409, detail="Posted dispatches cannot move back to pending or loaded.")

    dispatch.entry_time = coerce_utc_datetime(payload.entry_time) or dispatch.entry_time
    dispatch.exit_time = coerce_utc_datetime(payload.exit_time) or dispatch.exit_time
    dispatch.receiver_name = sanitize_text(payload.receiver_name, max_length=160, preserve_newlines=False) or dispatch.receiver_name
    dispatch.pod_notes = sanitize_text(payload.pod_notes, max_length=500) or dispatch.pod_notes

    line_rows = (
        db.query(SteelDispatchLine)
        .filter(SteelDispatchLine.dispatch_id == dispatch.id)
        .order_by(SteelDispatchLine.id.asc())
        .all()
    )
    if next_status in {"dispatched", "delivered"} and not _dispatch_has_posted_inventory(dispatch):
        requested_by_item: dict[int, float] = {}
        for row in line_rows:
            requested_by_item[row.item_id] = float(requested_by_item.get(row.item_id, 0.0)) + float(row.weight_kg or 0.0)
        balances = stock_balances_for_factory(db, factory.factory_id)
        for item_id, requested_weight in requested_by_item.items():
            available = float(balances.get(item_id, 0.0))
            if available + 0.0001 < requested_weight:
                raise HTTPException(status_code=400, detail="Dispatch would make stock negative for one or more items.")
        _create_dispatch_inventory_movements(
            db,
            factory=factory,
            dispatch=dispatch,
            dispatch_lines=line_rows,
            current_user=current_user,
        )

    if next_status == "delivered":
        dispatch.delivered_at = datetime.now(timezone.utc)
        dispatch.delivered_by_user_id = current_user.id
        if dispatch.exit_time is None:
            dispatch.exit_time = datetime.now(timezone.utc)
    elif next_status != "cancelled":
        dispatch.delivered_at = None if next_status != "delivered" else dispatch.delivered_at
        dispatch.delivered_by_user_id = None if next_status != "delivered" else dispatch.delivered_by_user_id

    dispatch.status = next_status
    db.add(dispatch)
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_DISPATCH_STATUS_UPDATED",
        details=f"dispatch={dispatch.dispatch_number} status={current_status}->{next_status}",
        request=request,
    )
    db.commit()
    db.refresh(dispatch)
    line_rows = (
        db.query(SteelDispatchLine)
        .filter(SteelDispatchLine.dispatch_id == dispatch.id)
        .order_by(SteelDispatchLine.id.asc())
        .all()
    )
    invoice_line_map = {
        row.id: row
        for row in db.query(SteelSalesInvoiceLine)
        .filter(SteelSalesInvoiceLine.id.in_({row.invoice_line_id for row in line_rows}))
        .all()
    } if line_rows else {}
    item_map = {
        row.id: row
        for row in db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.id.in_({row.item_id for row in line_rows}))
        .all()
    } if line_rows else {}
    batch_map = {
        row.id: row
        for row in db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.factory_id == factory.factory_id, SteelProductionBatch.id.in_({row.batch_id for row in line_rows if row.batch_id}))
        .all()
    } if line_rows else {}
    serialized_lines = [
        _serialize_steel_dispatch_line(
            row,
            invoice_line=invoice_line_map.get(row.invoice_line_id),
            item=item_map.get(row.item_id),
            batch=batch_map.get(row.batch_id),
        )
        for row in line_rows
    ]
    return {
        "dispatch": _serialize_steel_dispatch(
            dispatch,
            creator=db.query(User).filter(User.id == dispatch.created_by_user_id).first() if dispatch.created_by_user_id else None,
            delivered_by=db.query(User).filter(User.id == dispatch.delivered_by_user_id).first() if dispatch.delivered_by_user_id else None,
            invoice=invoice,
            lines=serialized_lines,
        )
    }


@router.post("/batches")
def create_steel_batch(
    payload: SteelBatchCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER},
    )
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    input_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.input_item_id)
    output_item = _get_item_or_404(db, factory_id=factory.factory_id, item_id=payload.output_item_id)
    if input_item.id == output_item.id:
        raise HTTPException(status_code=400, detail="Input and output items must be different.")
    if payload.expected_output_kg > payload.input_quantity_kg:
        raise HTTPException(status_code=400, detail="Expected output cannot exceed input quantity.")
    if payload.actual_output_kg > payload.input_quantity_kg:
        raise HTTPException(status_code=400, detail="Actual output cannot exceed input quantity.")

    balances = stock_balances_for_factory(db, factory.factory_id)
    available_input = float(balances.get(input_item.id, 0.0))
    if available_input + 0.0001 < payload.input_quantity_kg:
        raise HTTPException(status_code=400, detail="Not enough input stock for this batch.")

    batch_code = (
        sanitize_text(payload.batch_code, max_length=40, preserve_newlines=False).upper()
        if payload.batch_code
        else generate_batch_code(db, factory)
    )
    if not batch_code:
        batch_code = generate_batch_code(db, factory)
    existing = (
        db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.batch_code == batch_code)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Batch code already exists.")

    loss_kg = float(payload.input_quantity_kg) - float(payload.actual_output_kg)
    loss_percent = (loss_kg / float(payload.input_quantity_kg)) * 100.0 if payload.input_quantity_kg else 0.0
    variance_kg = max(0.0, float(payload.expected_output_kg) - float(payload.actual_output_kg))
    variance_percent = (variance_kg / float(payload.expected_output_kg)) * 100.0 if payload.expected_output_kg else 0.0
    variance_value_inr = variance_kg * float(output_item.current_rate_per_kg or 0.0)
    severity = severity_from_variance(variance_percent)

    batch = SteelProductionBatch(
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        batch_code=batch_code,
        production_date=payload.production_date,
        input_item_id=input_item.id,
        output_item_id=output_item.id,
        operator_user_id=current_user.id,
        created_by_user_id=current_user.id,
        input_quantity_kg=float(payload.input_quantity_kg),
        expected_output_kg=float(payload.expected_output_kg),
        actual_output_kg=float(payload.actual_output_kg),
        loss_kg=loss_kg,
        loss_percent=loss_percent,
        variance_kg=variance_kg,
        variance_percent=variance_percent,
        variance_value_inr=variance_value_inr,
        severity=severity,
        status="recorded",
        notes=sanitize_text(payload.notes, max_length=500),
    )
    db.add(batch)
    db.flush()

    db.add(
        SteelInventoryTransaction(
            org_id=factory.org_id,
            factory_id=factory.factory_id,
            item_id=input_item.id,
            transaction_type="production_issue",
            quantity_kg=-float(payload.input_quantity_kg),
            reference_type="steel_batch",
            reference_id=batch.batch_code,
            notes=f"Issued into batch {batch.batch_code}",
            created_by_user_id=current_user.id,
        )
    )
    db.add(
        SteelInventoryTransaction(
            org_id=factory.org_id,
            factory_id=factory.factory_id,
            item_id=output_item.id,
            transaction_type="production_output",
            quantity_kg=float(payload.actual_output_kg),
            reference_type="steel_batch",
            reference_id=batch.batch_code,
            notes=f"Produced by batch {batch.batch_code}",
            created_by_user_id=current_user.id,
        )
    )
    _write_steel_audit(
        db,
        actor=current_user,
        factory_id=factory.factory_id,
        action="STEEL_BATCH_RECORDED",
        details=(
            f"batch={batch.batch_code} input_item={input_item.item_code} output_item={output_item.item_code} "
            f"variance_kg={round(variance_kg, 3)} severity={severity}"
        ),
        request=request,
    )
    db.commit()
    db.refresh(batch)
    return {
        "batch": serialize_batch(batch, input_item=input_item, output_item=output_item, operator=current_user)
    }
