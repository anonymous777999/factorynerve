"""Billing router (Razorpay scaffolding + trial status)."""

from __future__ import annotations

import json
import os
import re
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.subscription import Subscription
from backend.models.payment_order import PaymentOrder
from backend.models.webhook_event import WebhookEvent
from backend.models.factory import Factory
from backend.models.user import User, UserRole
from backend.security import get_current_user
from backend.rbac import require_role
from backend.plans import (
    PRICING_META,
    addon_kind,
    addon_included_in_plan,
    get_addon,
    get_org_active_addons,
    get_org_addon_quantity_map,
    get_org_plan,
    get_plan,
    is_sales_only_plan,
    normalize_addon_quantities,
    normalize_plan,
)
from backend.tenancy import resolve_org_id
from backend.services.billing_manager import (
    activate_org_addons,
    apply_plan_change,
    schedule_downgrade,
    cancel_scheduled_downgrade,
    apply_due_downgrades,
    record_invoice,
    list_invoices,
)


router = APIRouter(tags=["Billing"])

TRIAL_DAYS = int(os.getenv("TRIAL_DAYS", "7"))
BILLING_GRACE_DAYS = int(os.getenv("BILLING_GRACE_DAYS", "3"))
SUPPORTED_CURRENCY = "INR"
REUSABLE_ORDER_STATUSES = {"created", "attempted", "authorized"}
PAID_ORDER_STATUSES = {"paid", "captured"}
RETRYABLE_ORDER_STATUSES = {"failed", "cancelled", "expired"}


def _org_level_role(current_user: User) -> UserRole:
    role = getattr(current_user, "org_role", None) or current_user.role
    if isinstance(role, UserRole):
        return role
    return UserRole(str(role))


def _require_billing_owner(current_user: User) -> None:
    if _org_level_role(current_user) != UserRole.OWNER and current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Access denied.")


class CreateOrderRequest(BaseModel):
    plan: str = Field(default="starter")
    billing_cycle: str = Field(default="monthly")
    requested_users: int | None = Field(default=None, ge=1)
    requested_factories: int | None = Field(default=None, ge=1)
    addon_ids: list[str] = Field(default_factory=list)
    addon_quantities: dict[str, int] = Field(default_factory=dict)
    currency: str = Field(default="INR")
    idempotency_key: str | None = Field(default=None, max_length=120)


_RECEIPT_RE = re.compile(r"^dpr_(\d+)_")


def _extract_order_entity(data: dict) -> dict:
    payload = data.get("payload", {}) or {}
    order = payload.get("order", {}) or {}
    return order.get("entity", {}) or {}


def _extract_payment_entity(data: dict) -> dict:
    payload = data.get("payload", {}) or {}
    payment = payload.get("payment", {}) or {}
    return payment.get("entity", {}) or {}


def _extract_plan(data: dict) -> str | None:
    for entity in (_extract_order_entity(data), _extract_payment_entity(data)):
        notes = entity.get("notes", {}) or {}
        plan = notes.get("plan")
        if plan:
            return normalize_plan(plan)
    return None


def _extract_billing_cycle(data: dict) -> str | None:
    for entity in (_extract_order_entity(data), _extract_payment_entity(data)):
        notes = entity.get("notes", {}) or {}
        cycle = str(notes.get("billing_cycle") or "").strip().lower()
        if cycle in {"monthly", "yearly"}:
            return cycle
    return None


def _extract_addon_quantities(data: dict) -> dict[str, int]:
    for entity in (_extract_order_entity(data), _extract_payment_entity(data)):
        notes = entity.get("notes", {}) or {}
        raw = str(notes.get("addon_quantities") or "").strip()
        if raw:
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = None
            if isinstance(payload, dict):
                return normalize_addon_quantities(
                    {str(key): int(value) for key, value in payload.items() if value is not None}
                )
        raw_ids = str(notes.get("addon_ids") or "").strip()
        if raw_ids:
            return normalize_addon_quantities(
                None,
                addon_ids=[part.strip() for part in raw_ids.split(",") if part.strip()],
            )
    return {}


def _extract_amount(data: dict) -> int | None:
    for entity in (_extract_order_entity(data), _extract_payment_entity(data)):
        amount = entity.get("amount")
        if isinstance(amount, int):
            return amount
        if isinstance(amount, str) and amount.isdigit():
            return int(amount)
    return None


def _resolve_billing_cycle(plan: str | None, amount_paise: int | None) -> str | None:
    if not plan or not amount_paise:
        return None
    info = get_plan(plan)
    monthly_price = int(info.get("monthly_price", 0) or 0)
    if monthly_price <= 0:
        return None
    yearly_multiplier = int(PRICING_META.get("yearly_multiplier", 12) or 12)
    monthly_paise = monthly_price * 100
    yearly_paise = monthly_paise * yearly_multiplier
    if amount_paise >= int(yearly_paise * 0.9):
        return "yearly"
    return "monthly"


def _manual_plan_override_enabled() -> bool:
    value = str(os.getenv("ENABLE_BILLING_PLAN_OVERRIDE", "")).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _user_id_from_receipt(receipt: str) -> int | None:
    match = _RECEIPT_RE.match(receipt or "")
    if not match:
        return None
    return int(match.group(1))


def _extract_user_id(data: dict) -> int | None:
    order_entity = _extract_order_entity(data)
    receipt = str(order_entity.get("receipt") or "")
    user_id = _user_id_from_receipt(receipt)
    if user_id:
        return user_id
    payment_entity = _extract_payment_entity(data)
    notes = payment_entity.get("notes", {}) or {}
    if "user_id" in notes:
        try:
            return int(notes["user_id"])
        except (TypeError, ValueError):
            return None
    return None


def _extract_order_id(data: dict) -> str | None:
    order_entity = _extract_order_entity(data)
    if order_entity.get("id"):
        return str(order_entity["id"])
    payment_entity = _extract_payment_entity(data)
    if payment_entity.get("order_id"):
        return str(payment_entity["order_id"])
    return None


def _mark_payment_order_status(db: Session, *, order_id: str | None, status: str | None) -> None:
    if not order_id or not status:
        return
    row = (
        db.query(PaymentOrder)
        .filter(PaymentOrder.provider == "razorpay", PaymentOrder.provider_order_id == order_id)
        .first()
    )
    if not row:
        return
    row.status = str(status)
    db.add(row)


def _get_payment_order(db: Session, *, order_id: str | None) -> PaymentOrder | None:
    if not order_id:
        return None
    return (
        db.query(PaymentOrder)
        .filter(PaymentOrder.provider == "razorpay", PaymentOrder.provider_order_id == order_id)
        .first()
    )


def _current_org_footprint(db: Session, *, current_user: User) -> dict[str, int]:
    org_id = resolve_org_id(current_user)
    if not org_id:
        return {"active_users": 1, "active_factories": 1}
    active_users = (
        db.query(User.id)
        .filter(User.org_id == org_id, User.is_active.is_(True))
        .count()
    )
    active_factories = (
        db.query(Factory.factory_id)
        .filter(Factory.org_id == org_id, Factory.is_active.is_(True))
        .count()
    )
    return {
        "active_users": max(1, int(active_users or 0)),
        "active_factories": max(1, int(active_factories or 0)),
    }


def _resolve_event_id(data: dict, payload: bytes) -> str:
    event_type = str(data.get("event", ""))
    payment_entity = _extract_payment_entity(data)
    payment_id = payment_entity.get("id")
    if payment_id:
        return f"{event_type}:pay:{payment_id}"
    order_entity = _extract_order_entity(data)
    order_id = order_entity.get("id") or _extract_order_id(data)
    if order_id:
        return f"{event_type}:order:{order_id}"
    digest = hashlib.sha256(payload).hexdigest()[:16]
    return f"{event_type}:hash:{digest}"


def _fetch_order_entity(order_id: str | None) -> dict | None:
    if not order_id:
        return None
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        return None
    try:
        import razorpay  # type: ignore
    except Exception:
        return None
    try:
        client = razorpay.Client(auth=(key_id, key_secret))
        return client.order.fetch(order_id) or None
    except Exception:
        return None


def _apply_plan_upgrade(
    db: Session,
    *,
    user_id: int,
    plan: str,
    provider: str | None = None,
    current_period_end_at: datetime | None = None,
    audit_details: str | None = None,
) -> None:
    apply_plan_change(
        db,
        user_id=user_id,
        plan=plan,
        provider=provider,
        current_period_end_at=current_period_end_at,
        audit_details=audit_details,
        audit_action="PLAN_UPGRADED",
    )


def _should_activate(event_type: str) -> bool:
    return event_type in {"payment.captured", "order.paid"}


def _should_downgrade(event_type: str) -> bool:
    return event_type in {"payment.failed", "subscription.halted", "subscription.completed"}


def _ensure_trial(db: Session, user_id: int, plan: str) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if sub:
        return sub
    now = datetime.now(timezone.utc)
    sub = Subscription(
        user_id=user_id,
        plan=normalize_plan(plan),
        status="trialing",
        trial_start_at=now,
        trial_end_at=now + timedelta(days=TRIAL_DAYS),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def _merge_usage_summaries(*summaries: dict | None) -> dict | None:
    merged: dict = {}
    for summary in summaries:
        if not isinstance(summary, dict):
            continue
        for key, value in summary.items():
            if value is not None:
                merged[key] = value
    return merged or None


def _fallback_ocr_usage_summary(plan: str) -> dict:
    return {
        "plan": normalize_plan(plan),
        "requests_used": 0,
        "credits_used": 0,
        "max_requests": -1,
        "max_credits": -1,
        "rate_limit_per_minute": 0,
    }


def _resolve_checkout_quote(
    db: Session,
    *,
    current_user: User,
    plan: str,
    billing_cycle: str,
    requested_users: int | None = None,
    requested_factories: int | None = None,
    addon_ids: list[str] | None = None,
    addon_quantities: dict[str, int] | None = None,
) -> dict:
    plan_info = get_plan(plan)
    if is_sales_only_plan(plan):
        raise HTTPException(status_code=400, detail=f"{plan_info.get('name', 'This plan')} is sales-assisted and cannot be self-checked out.")
    monthly_price = int(plan_info.get("monthly_price", 0) or 0)
    cycle = (billing_cycle or "monthly").strip().lower()
    if cycle not in {"monthly", "yearly"}:
        raise HTTPException(status_code=400, detail="Invalid billing cycle.")
    multiplier = 1 if cycle == "monthly" else int(PRICING_META.get("yearly_multiplier", 12) or 12)
    included_users = int(plan_info.get("user_limit", 0) or 0)
    included_factories = int(plan_info.get("factory_limit", 0) or 0)
    footprint = _current_org_footprint(db, current_user=current_user)
    effective_users = max(int(requested_users or 0), int(footprint["active_users"]))
    effective_factories = max(int(requested_factories or 0), int(footprint["active_factories"]))

    if included_users > 0 and effective_users > included_users:
        raise HTTPException(
            status_code=400,
            detail=f"{plan_info.get('name', 'This plan')} supports up to {included_users} users, but your organization currently has {effective_users} active users. Choose a higher plan.",
        )
    if included_factories > 0 and effective_factories > included_factories:
        raise HTTPException(
            status_code=400,
            detail=f"{plan_info.get('name', 'This plan')} supports up to {included_factories} factories, but your organization currently has {effective_factories} active factories. Choose a higher plan.",
        )

    extra_users = max(0, effective_users - included_users) if included_users > 0 else 0
    extra_factories = max(0, effective_factories - included_factories) if included_factories > 0 else 0
    extra_user_monthly = 0
    extra_factory_monthly = 0
    org_id = resolve_org_id(current_user)
    active_addon_quantities = get_org_addon_quantity_map(db, org_id=org_id)
    selected_addon_quantities = normalize_addon_quantities(addon_quantities, addon_ids=addon_ids)
    included_addons: list[dict] = []
    already_active_addons: list[dict] = []
    chargeable_addons: list[dict] = []
    addon_monthly_total = 0

    for addon_id, selected_quantity in selected_addon_quantities.items():
        addon = get_addon(addon_id)
        if not addon:
            continue
        active_quantity = int(active_addon_quantities.get(addon_id, 0) or 0)
        incremental_quantity = max(0, int(selected_quantity or 0) - active_quantity)
        addon_payload = {
            "id": addon_id,
            "name": str(addon.get("name") or addon_id),
            "price": int(addon.get("price", 0) or 0),
            "feature_key": str(addon.get("feature_key") or addon_id),
            "kind": str(addon.get("kind") or ""),
            "quantity": int(selected_quantity or 0),
            "active_quantity": active_quantity,
            "incremental_quantity": incremental_quantity,
            "scan_quota": int(addon.get("scan_quota", 0) or 0),
        }
        if addon_included_in_plan(plan, addon_id):
            included_addons.append(addon_payload)
            continue
        if incremental_quantity <= 0 and active_quantity > 0:
            already_active_addons.append(addon_payload)
            continue
        chargeable_addons.append(addon_payload)
        addon_monthly_total += addon_payload["price"] * incremental_quantity
    monthly_total = monthly_price + extra_user_monthly + extra_factory_monthly + addon_monthly_total
    if monthly_total <= 0:
        raise HTTPException(status_code=400, detail="Selected configuration is not billable.")
    return {
        "billing_cycle": cycle,
        "amount_paise": monthly_total * multiplier * 100,
        "base_monthly_price": monthly_price,
        "included_users": included_users,
        "included_factories": included_factories,
        "requested_users": effective_users,
        "requested_factories": effective_factories,
        "organization_active_users": footprint["active_users"],
        "organization_active_factories": footprint["active_factories"],
        "extra_users": extra_users,
        "extra_factories": extra_factories,
        "extra_user_monthly": extra_user_monthly,
        "extra_factory_monthly": extra_factory_monthly,
        "selected_addon_ids": list(selected_addon_quantities.keys()),
        "selected_addon_quantities": selected_addon_quantities,
        "chargeable_addon_ids": [item["id"] for item in chargeable_addons],
        "chargeable_addon_quantities": {item["id"]: int(item["incremental_quantity"] or 0) for item in chargeable_addons},
        "included_addon_ids": [item["id"] for item in included_addons],
        "already_active_addon_ids": [item["id"] for item in already_active_addons],
        "chargeable_addons": chargeable_addons,
        "included_addons": included_addons,
        "already_active_addons": already_active_addons,
        "addon_monthly_total": addon_monthly_total,
        "monthly_total": monthly_total,
        "multiplier": multiplier,
    }


@router.get("/config")
def get_billing_config(current_user: User = Depends(get_current_user)) -> dict:
    require_role(current_user, UserRole.ADMIN)
    key_id = os.getenv("RAZORPAY_KEY_ID")
    return {
        "configured": bool(key_id and os.getenv("RAZORPAY_KEY_SECRET")),
        "provider": "razorpay",
        "key_id": key_id,
        "currency": SUPPORTED_CURRENCY,
        "yearly_multiplier": int(PRICING_META.get("yearly_multiplier", 12) or 12),
        "manual_plan_override_enabled": _manual_plan_override_enabled(),
    }


@router.get("/status")
def get_billing_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    sub = _ensure_trial(db, current_user.id, plan)
    apply_due_downgrades(db, user_id=current_user.id)
    db.commit()
    try:
        from backend.ocr_limits import get_org_usage_summary, get_usage_summary
    except Exception:
        get_org_usage_summary = None
        get_usage_summary = None
    usage = None
    try:
        if get_org_usage_summary and org_id:
            # Org-scoped usage already receives the effective org plan.
            usage = get_org_usage_summary(db, org_id=org_id, plan=plan)
        elif get_usage_summary:
            # For personal workspaces (no org), ensure that the usage limits
            # reflect the same plan we expose on the billing dashboard,
            # avoiding mismatches like showing Growth limits on a Free plan.
            usage = get_usage_summary(db, user_id=current_user.id, plan=plan)
    except HTTPException as error:
        detail = error.detail if isinstance(error.detail, dict) else {}
        if error.status_code == 403 and detail.get("error") in {"ocr_not_available", "ocr_pack_required"}:
            usage = _fallback_ocr_usage_summary(plan)
        else:
            raise
    try:
        from backend.feature_limits import (
            get_feature_usage_summary,
            get_org_feature_usage_summary,
        )
    except Exception:
        get_feature_usage_summary = None
        get_org_feature_usage_summary = None
    ai_usage = None
    if get_org_feature_usage_summary and org_id:
        ai_usage = get_org_feature_usage_summary(db, org_id=org_id, plan=plan)
    elif get_feature_usage_summary:
        ai_usage = get_feature_usage_summary(db, user_id=current_user.id, plan=plan)
    usage = _merge_usage_summaries(usage, ai_usage)
    active_addons = [
        {
            "id": row.addon_id,
            "name": row.name,
            "feature_key": row.feature_key,
            "price": row.unit_price,
            "quantity": int(getattr(row, "quantity", 1) or 1),
            "kind": addon_kind(row.addon_id) or "feature",
            "scan_quota": int(get_addon(row.addon_id).get("scan_quota", 0) or 0) if get_addon(row.addon_id) else 0,
            "billing_cycle": row.billing_cycle,
            "status": row.status,
            "provider": row.provider,
            "current_period_end_at": row.current_period_end_at,
        }
        for row in get_org_active_addons(db, org_id=org_id)
    ]
    footprint = _current_org_footprint(db, current_user=current_user)
    return {
        "plan": sub.plan,
        "status": sub.status,
        "trial_start_at": sub.trial_start_at,
        "trial_end_at": sub.trial_end_at,
        "current_period_end_at": sub.current_period_end_at,
        "pending_plan": sub.pending_plan,
        "pending_plan_effective_at": sub.pending_plan_effective_at,
        "active_addons": active_addons,
        "footprint": footprint,
        "usage": usage,
    }


@router.get("/orders/{provider_order_id}")
def get_order_status(
    provider_order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    row = _get_payment_order(db, order_id=provider_order_id)
    if not row:
        raise HTTPException(status_code=404, detail="Billing order not found.")
    order_user = db.query(User).filter(User.id == row.user_id).first()
    if not order_user or resolve_org_id(order_user) != resolve_org_id(current_user):
        raise HTTPException(status_code=404, detail="Billing order not found.")
    current_plan = get_org_plan(db, org_id=resolve_org_id(order_user), fallback_user_id=order_user.id)
    status = str(row.status or "created").strip().lower()
    return {
        "order_id": row.provider_order_id,
        "status": status,
        "plan": row.plan,
        "amount": row.amount,
        "currency": row.currency,
        "created_at": row.created_at,
        "is_paid": status in PAID_ORDER_STATUSES,
        "is_terminal": status in (PAID_ORDER_STATUSES | RETRYABLE_ORDER_STATUSES | {"mismatch"}),
        "is_plan_active": status in PAID_ORDER_STATUSES and current_plan == normalize_plan(row.plan),
        "current_plan": current_plan,
    }


@router.get("/invoices")
def get_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    require_role(current_user, UserRole.ADMIN)
    rows = list_invoices(db, user_id=current_user.id)
    return [
        {
            "id": row.id,
            "plan": row.plan,
            "status": row.status,
            "currency": row.currency,
            "amount": float(row.amount or 0),
            "issued_at": row.issued_at,
            "provider": row.provider,
            "provider_invoice_id": row.provider_invoice_id,
            "pdf_url": row.pdf_url,
        }
        for row in rows
    ]


class DowngradeRequest(BaseModel):
    plan: str = Field(default="free")


@router.post("/downgrade")
def schedule_plan_downgrade(
    payload: DowngradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_billing_owner(current_user)
    normalized = normalize_plan(payload.plan)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid plan.")
    sub = schedule_downgrade(db, user_id=current_user.id, plan=normalized)
    db.commit()
    return {
        "pending_plan": sub.pending_plan,
        "pending_plan_effective_at": sub.pending_plan_effective_at,
    }


@router.delete("/downgrade")
def cancel_plan_downgrade(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_billing_owner(current_user)
    cancel_scheduled_downgrade(db, user_id=current_user.id)
    db.commit()
    return {"message": "Scheduled downgrade cancelled."}


@router.post("/orders")
def create_order(
    payload: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_billing_owner(current_user)
    normalized_plan = normalize_plan(payload.plan)
    if is_sales_only_plan(normalized_plan):
        raise HTTPException(status_code=400, detail=f"{get_plan(normalized_plan).get('name', 'This plan')} requires a custom sales quote.")
    requested_currency = str(payload.currency or SUPPORTED_CURRENCY).strip().upper()
    if requested_currency != SUPPORTED_CURRENCY:
        raise HTTPException(status_code=400, detail=f"Only {SUPPORTED_CURRENCY} billing is supported.")
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=400,
            detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        )
    try:
        import razorpay  # type: ignore
    except Exception as error:
        raise HTTPException(status_code=500, detail="Razorpay SDK not installed.") from error

    client = razorpay.Client(auth=(key_id, key_secret))
    quote = _resolve_checkout_quote(
        db,
        current_user=current_user,
        plan=normalized_plan,
        billing_cycle=payload.billing_cycle,
        requested_users=payload.requested_users,
        requested_factories=payload.requested_factories,
        addon_ids=payload.addon_ids,
        addon_quantities=payload.addon_quantities,
    )
    amount_paise = int(quote["amount_paise"])
    billing_cycle = str(quote["billing_cycle"])
    chargeable_quantities_slug = ",".join(
        f"{addon_id}:{quantity}"
        for addon_id, quantity in sorted((quote["chargeable_addon_quantities"] or {}).items())
    )
    raw_idempotency = payload.idempotency_key or (
        f"{current_user.id}:{normalized_plan}:{billing_cycle}:{payload.requested_users or 0}:{payload.requested_factories or 0}:{chargeable_quantities_slug}:{payload.currency}:{datetime.now(timezone.utc).date().isoformat()}"
    )
    idempotency_key = hashlib.sha256(raw_idempotency.encode("utf-8")).hexdigest()
    existing_order = (
        db.query(PaymentOrder)
        .filter(PaymentOrder.idempotency_key == idempotency_key)
        .first()
    )
    if existing_order:
        existing_status = str(existing_order.status or "created").strip().lower()
        if existing_status in PAID_ORDER_STATUSES:
            raise HTTPException(
                status_code=409,
                detail="This checkout has already been paid. Refresh billing before creating a new order.",
            )
        if existing_status not in REUSABLE_ORDER_STATUSES:
            retry_seed = f"{raw_idempotency}:{existing_status}:{datetime.now(timezone.utc).isoformat()}"
            idempotency_key = hashlib.sha256(retry_seed.encode("utf-8")).hexdigest()
        else:
            return {
                "order": {
                    "id": existing_order.provider_order_id,
                    "amount": existing_order.amount,
                    "currency": existing_order.currency,
                    "receipt": existing_order.receipt,
                    "status": existing_order.status,
                },
                "plan": normalized_plan,
                "billing_cycle": billing_cycle,
                "amount": existing_order.amount,
                "quote": quote,
                "idempotent": True,
            }
    notes = {
        "plan": normalized_plan,
        "billing_cycle": billing_cycle,
        "user_id": str(current_user.id),
    }
    if payload.requested_users:
        notes["requested_users"] = str(payload.requested_users)
    if payload.requested_factories:
        notes["requested_factories"] = str(payload.requested_factories)
    if quote["chargeable_addon_ids"]:
        notes["addon_ids"] = ",".join(quote["chargeable_addon_ids"])
    if quote["chargeable_addon_quantities"]:
        notes["addon_quantities"] = json.dumps(quote["chargeable_addon_quantities"], separators=(",", ":"))
    receipt = f"dpr_{current_user.id}_{int(datetime.now().timestamp())}"
    order = client.order.create(
        {
            "amount": amount_paise,
            "currency": SUPPORTED_CURRENCY,
            "receipt": receipt,
            "notes": notes,
        }
    )
    try:
        db.add(
            PaymentOrder(
                user_id=current_user.id,
                plan=normalized_plan,
                amount=amount_paise,
                currency=SUPPORTED_CURRENCY,
                provider="razorpay",
                provider_order_id=str(order.get("id")),
                receipt=receipt,
                status=str(order.get("status") or "created"),
                idempotency_key=idempotency_key,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
    return {
        "order": order,
        "plan": normalized_plan,
        "billing_cycle": billing_cycle,
        "amount": amount_paise,
        "quote": quote,
    }


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    payload = await request.body()
    if not secret:
        raise HTTPException(status_code=400, detail="Webhook secret not configured.")
    try:
        import razorpay  # type: ignore
    except Exception as error:
        raise HTTPException(status_code=500, detail="Razorpay SDK not installed.") from error

    signature = request.headers.get("x-razorpay-signature", "")
    try:
        razorpay.Utility.verify_webhook_signature(payload, signature, secret)
    except Exception as error:
        raise HTTPException(status_code=400, detail="Invalid webhook signature.") from error

    data = json.loads(payload.decode("utf-8"))
    event_id = _resolve_event_id(data, payload)
    event_type = data.get("event", "unknown")
    existing = (
        db.query(WebhookEvent)
        .filter(WebhookEvent.provider == "razorpay", WebhookEvent.event_id == event_id)
        .first()
    )
    if existing:
        return {"status": "ok", "idempotent": True}
    if _should_activate(event_type):
        order_id = _extract_order_id(data)
        payment_order = _get_payment_order(db, order_id=order_id)
        plan = _extract_plan(data)
        user_id = _extract_user_id(data)
        amount = _extract_amount(data)
        cycle = _extract_billing_cycle(data) or _resolve_billing_cycle(plan, amount)
        addon_quantities = _extract_addon_quantities(data)
        currency = str(
            _extract_order_entity(data).get("currency")
            or _extract_payment_entity(data).get("currency")
            or SUPPORTED_CURRENCY
        ).upper()
        period_end = None
        if cycle == "yearly":
            period_end = datetime.now(timezone.utc) + timedelta(days=365)
        elif cycle == "monthly":
            period_end = datetime.now(timezone.utc) + timedelta(days=30)
        if payment_order:
            mismatch = False
            if amount is not None and int(amount) != int(payment_order.amount):
                mismatch = True
            if currency and currency != str(payment_order.currency or SUPPORTED_CURRENCY).upper():
                mismatch = True
            if mismatch:
                payment_order.status = "mismatch"
                db.add(payment_order)
                plan = None
                user_id = None
            else:
                payment_order.status = "paid"
                db.add(payment_order)
                plan = normalize_plan(payment_order.plan)
                user_id = int(payment_order.user_id)
        if not plan or not user_id:
            order_entity = _fetch_order_entity(order_id)
            if order_entity:
                if not plan:
                    plan_note = (order_entity.get("notes", {}) or {}).get("plan")
                    if plan_note:
                        plan = normalize_plan(plan_note)
                if not user_id:
                    user_id = _user_id_from_receipt(str(order_entity.get("receipt") or ""))
                if amount is None:
                    amount = order_entity.get("amount") if isinstance(order_entity.get("amount"), int) else amount
                if not cycle:
                    cycle = _resolve_billing_cycle(plan, amount)
                if not addon_quantities:
                    notes = order_entity.get("notes", {}) or {}
                    raw_quantities = str(notes.get("addon_quantities") or "").strip()
                    if raw_quantities:
                        try:
                            parsed_quantities = json.loads(raw_quantities)
                        except json.JSONDecodeError:
                            parsed_quantities = None
                        if isinstance(parsed_quantities, dict):
                            addon_quantities = normalize_addon_quantities(
                                {str(key): int(value) for key, value in parsed_quantities.items() if value is not None}
                            )
                    if not addon_quantities:
                        raw_addons = str(notes.get("addon_ids") or "").strip()
                        if raw_addons:
                            addon_quantities = normalize_addon_quantities(
                                None,
                                addon_ids=[part.strip() for part in raw_addons.split(",") if part.strip()],
                            )
                if cycle == "yearly":
                    period_end = datetime.now(timezone.utc) + timedelta(days=365)
                elif cycle == "monthly":
                    period_end = datetime.now(timezone.utc) + timedelta(days=30)
        if plan and user_id:
            detail_parts = [f"plan={plan}", f"event={event_type}"]
            if cycle:
                detail_parts.append(f"cycle={cycle}")
            if amount:
                detail_parts.append(f"amount_paise={amount}")
            if addon_quantities:
                detail_parts.append(
                    "addons="
                    + ",".join(
                        f"{addon_id}:{quantity}"
                        for addon_id, quantity in sorted(addon_quantities.items())
                    )
                )
            order_id = _extract_order_id(data)
            if order_id:
                detail_parts.append(f"order_id={order_id}")
            audit_details = "; ".join(detail_parts)
            _apply_plan_upgrade(
                db,
                user_id=user_id,
                plan=plan,
                provider="razorpay",
                current_period_end_at=period_end,
                audit_details=audit_details,
            )
            user = db.query(User).filter(User.id == user_id).first()
            org_id = resolve_org_id(user) if user else None
            if org_id and addon_quantities:
                activate_org_addons(
                    db,
                    org_id=org_id,
                    addon_quantities=addon_quantities,
                    purchased_by_user_id=user_id,
                    billing_cycle=cycle or "monthly",
                    provider="razorpay",
                    provider_order_id=order_id,
                    current_period_end_at=period_end,
                )
            try:
                amount_value = float(amount or 0) / 100.0
                record_invoice(
                    db,
                    user_id=user_id,
                    plan=plan,
                    provider="razorpay",
                    provider_invoice_id=_extract_order_id(data),
                    amount=amount_value,
                    currency=currency,
                    status="paid",
                    issued_at=datetime.now(timezone.utc),
                )
            except Exception:
                pass
            db.flush()
    elif _should_downgrade(event_type):
        if event_type == "payment.failed":
            _mark_payment_order_status(db, order_id=_extract_order_id(data), status="failed")
        user_id = _extract_user_id(data)
        if not user_id:
            order_entity = _fetch_order_entity(_extract_order_id(data))
            if order_entity:
                user_id = _user_id_from_receipt(str(order_entity.get("receipt") or ""))
        if user_id:
            effective_at = datetime.now(timezone.utc) + timedelta(days=BILLING_GRACE_DAYS)
            schedule_downgrade(db, user_id=user_id, plan="free", effective_at=effective_at)
            db.flush()

    event = WebhookEvent(provider="razorpay", event_id=event_id, event_type=event_type, payload=json.dumps(data))
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"status": "ok", "idempotent": True}
    return {"status": "ok"}
