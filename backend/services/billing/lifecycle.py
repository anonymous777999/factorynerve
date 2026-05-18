from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.invoice import Invoice
from backend.models.payment_order import PaymentOrder
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.models.webhook_event import WebhookEvent
from backend.plans import PLAN_CATALOG, PRICING_META, normalize_plan
from backend.services.billing_logger import log_billing_event
from backend.services.billing.provider_adapter import AbstractPaymentProvider, PaymentResult


logger = logging.getLogger(__name__)
SUPPORTED_BILLING_CYCLES = {"monthly", "annual"}


@dataclass(frozen=True)
class PlanCatalogEntry:
    plan_id: str
    price_monthly: int
    price_annual: int


def _yearly_multiplier() -> int:
    return int(PRICING_META.get("yearly_multiplier", 10) or 10)


def get_plan_catalog_entry(plan_id: str) -> PlanCatalogEntry:
    normalized = normalize_plan(plan_id)
    raw = PLAN_CATALOG.get(normalized)
    if raw is None:
        raise KeyError(plan_id)
    monthly = int(raw.get("monthly_price", 0) or 0)
    return PlanCatalogEntry(
        plan_id=str(raw.get("id") or normalized),
        price_monthly=monthly,
        price_annual=monthly * _yearly_multiplier(),
    )


def calculate_amount_paise(plan: PlanCatalogEntry, billing_cycle: Literal["monthly", "annual"]) -> int:
    if billing_cycle not in SUPPORTED_BILLING_CYCLES:
        raise ValueError("Invalid billing cycle.")
    amount = plan.price_annual if billing_cycle == "annual" else plan.price_monthly
    return int(amount) * 100


async def create_payment_order(
    db: Session,
    *,
    provider: AbstractPaymentProvider,
    org_id: str,
    user_id: int | None,
    plan_id: str,
    billing_cycle: Literal["monthly", "annual"],
    currency: str = "INR",
) -> dict[str, Any]:
    plan = get_plan_catalog_entry(plan_id)
    amount_paise = calculate_amount_paise(plan, billing_cycle)
    receipt_id = f"{org_id}-{uuid4().hex[:8]}"
    order = await provider.create_order(amount_paise, currency, receipt_id, {"plan_id": plan.plan_id, "org_id": org_id})
    row = PaymentOrder(
        org_id=org_id,
        user_id=user_id,
        plan_id=plan.plan_id,
        plan=plan.plan_id,
        amount_paise=amount_paise,
        amount=amount_paise,
        currency=order.currency,
        provider="razorpay",
        razorpay_order_id=order.id,
        provider_order_id=order.id,
        receipt_id=receipt_id,
        receipt=receipt_id,
        status="pending",
        idempotency_key=receipt_id,
    )
    db.add(row)
    db.commit()
    return {
        "order_id": order.id,
        "amount_paise": amount_paise,
        "currency": order.currency,
    }


def next_invoice_number(db: Session, org_id: str) -> str:
    count = db.query(Invoice.id).filter(Invoice.org_id == org_id).count()
    return f"{org_id}-INV-{count + 1:04d}"


def create_paid_invoice(
    db: Session,
    *,
    org_id: str,
    sub_id: int,
    payment_event_id: str,
    payment_id: str,
    amount_paise: int,
    period_start: datetime,
    period_end: datetime,
) -> Invoice:
    invoice = Invoice(
        org_id=org_id,
        sub_id=sub_id,
        payment_event_id=payment_event_id,
        amount_paise=amount_paise,
        amount=float(amount_paise) / 100.0,
        currency="INR",
        status="paid",
        provider="razorpay",
        razorpay_payment_id=payment_id,
        provider_invoice_id=payment_id,
        period_start=period_start,
        period_end=period_end,
        invoice_number=next_invoice_number(db, org_id),
        issued_at=datetime.now(timezone.utc),
        plan="free",
    )
    db.add(invoice)
    return invoice


def _resolve_cycle_period(
    *,
    now: datetime,
    billing_cycle: Literal["monthly", "annual"],
) -> tuple[datetime, datetime]:
    if billing_cycle == "annual":
        return now, now + timedelta(days=365)
    return now, now + timedelta(days=30)


def _extract_order_entity(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload", {}) or {}
    order = payload.get("order", {}) or {}
    return order.get("entity", {}) or {}


def _extract_payment_entity(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload", {}) or {}
    payment = payload.get("payment", {}) or {}
    return payment.get("entity", {}) or {}


def _extract_subscription_entity(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload", {}) or {}
    subscription = payload.get("subscription", {}) or {}
    return subscription.get("entity", {}) or {}


def _billing_cycle_from_notes(event: dict[str, Any]) -> Literal["monthly", "annual"]:
    for entity in (_extract_order_entity(event), _extract_payment_entity(event), _extract_subscription_entity(event)):
        notes = entity.get("notes", {}) or {}
        raw = str(notes.get("billing_cycle") or "").strip().lower()
        if raw == "annual":
            return "annual"
    return "monthly"


def _event_payment_id(event: dict[str, Any]) -> str:
    payment_id = str(_extract_payment_entity(event).get("id") or "").strip()
    if not payment_id:
        raise HTTPException(status_code=400, detail="Missing payment id in webhook.")
    return payment_id


def _event_order_id(event: dict[str, Any]) -> str:
    order_id = str(_extract_order_entity(event).get("id") or _extract_payment_entity(event).get("order_id") or "").strip()
    if not order_id:
        raise HTTPException(status_code=400, detail="Missing order id in webhook.")
    return order_id


def _resolve_payment_order(db: Session, order_id: str) -> PaymentOrder:
    order = db.query(PaymentOrder).filter(PaymentOrder.razorpay_order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Payment order not found.")
    return order


def _resolve_subscription(db: Session, org_id: str) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.org_id == org_id).first()
    if not sub:
        sub = Subscription(org_id=org_id, user_id=None, plan="free", status="inactive")
        db.add(sub)
        db.flush()
    return sub


def _set_webhook_log(
    *,
    org_id: str | None,
    event_type: str,
    event_id: str,
    outcome: str,
    duration_ms: int,
) -> None:
    log_billing_event(
        event_type,
        org_id,
        outcome,
        razorpay_event_id=event_id,
        duration_ms=duration_ms,
    )
    logger.info(
        "billing_webhook org_id=%s event_type=%s event_id=%s outcome=%s duration_ms=%s",
        org_id or "-",
        event_type,
        event_id,
        outcome,
        duration_ms,
    )


def process_payment_captured(
    db: Session,
    *,
    event: dict[str, Any],
    event_id: str,
    payment: PaymentResult | None = None,
) -> tuple[str, str]:
    order_id = _event_order_id(event)
    payment_id = payment.id if payment else _event_payment_id(event)
    order = _resolve_payment_order(db, order_id)
    org_id = str(order.org_id or "")
    if not org_id:
        raise HTTPException(status_code=400, detail="Payment order missing org_id.")
    billing_cycle = _billing_cycle_from_notes(event)
    plan = get_plan_catalog_entry(order.plan_id)
    amount_paise = calculate_amount_paise(plan, billing_cycle)
    now = datetime.now(timezone.utc)
    period_start, period_end = _resolve_cycle_period(now=now, billing_cycle=billing_cycle)

    sub = _resolve_subscription(db, org_id)
    sub.plan = order.plan_id
    sub.status = "active"
    sub.user_id = order.user_id
    sub.current_period_end_at = period_end
    sub.grace_period_end_at = None
    sub.pending_plan = None
    sub.pending_plan_effective_at = None
    sub.provider = "razorpay"
    sub.updated_at = now
    db.add(sub)

    order.status = "paid"
    db.add(order)

    create_paid_invoice(
        db,
        org_id=org_id,
        sub_id=int(sub.id),
        payment_event_id=event_id,
        payment_id=payment_id,
        amount_paise=amount_paise,
        period_start=period_start,
        period_end=period_end,
    )
    return org_id, "processed"


def process_payment_failed(db: Session, *, event: dict[str, Any]) -> tuple[str, str]:
    order = _resolve_payment_order(db, _event_order_id(event))
    org_id = str(order.org_id or "")
    if not org_id:
        raise HTTPException(status_code=400, detail="Payment order missing org_id.")
    sub = _resolve_subscription(db, org_id)
    now = datetime.now(timezone.utc)
    sub.status = "past_due"
    sub.grace_period_end_at = now + timedelta(days=7)
    sub.updated_at = now
    order.status = "failed"
    db.add(sub)
    db.add(order)
    return org_id, "processed"


def process_subscription_halted(db: Session, *, event: dict[str, Any]) -> tuple[str, str]:
    order = _resolve_payment_order(db, _event_order_id(event))
    org_id = str(order.org_id or "")
    if not org_id:
        raise HTTPException(status_code=400, detail="Payment order missing org_id.")
    sub = _resolve_subscription(db, org_id)
    sub.status = "suspended"
    sub.updated_at = datetime.now(timezone.utc)
    db.add(sub)
    return org_id, "processed"


def process_subscription_cancelled(db: Session, *, event: dict[str, Any]) -> tuple[str, str]:
    order = _resolve_payment_order(db, _event_order_id(event))
    org_id = str(order.org_id or "")
    if not org_id:
        raise HTTPException(status_code=400, detail="Payment order missing org_id.")
    sub = _resolve_subscription(db, org_id)
    sub.status = "cancelled"
    sub.updated_at = datetime.now(timezone.utc)
    db.add(sub)
    return org_id, "processed"


def process_webhook_event(
    db: Session,
    *,
    event: dict[str, Any],
    event_id: str,
    payment: PaymentResult | None = None,
) -> tuple[str | None, str]:
    event_type = str(event.get("event") or "").strip()
    if event_type == "payment.captured":
        return process_payment_captured(db, event=event, event_id=event_id, payment=payment)
    if event_type == "payment.failed":
        return process_payment_failed(db, event=event)
    if event_type == "subscription.halted":
        return process_subscription_halted(db, event=event)
    if event_type == "subscription.cancelled":
        return process_subscription_cancelled(db, event=event)
    order_id = str(_extract_order_entity(event).get("id") or _extract_payment_entity(event).get("order_id") or "").strip()
    org_id = None
    if order_id:
        order = db.query(PaymentOrder).filter(PaymentOrder.razorpay_order_id == order_id).first()
        org_id = str(order.org_id) if order and order.org_id else None
    return org_id, "skipped"


async def handle_razorpay_webhook(
    db: Session,
    *,
    raw_body: bytes,
    signature: str,
    provider: AbstractPaymentProvider,
) -> dict[str, Any]:
    started = time.perf_counter()
    if not provider.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Malformed webhook payload.") from error

    event_id = str(event.get("id") or "").strip()
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing webhook event id.")
    event_type = str(event.get("event") or "unknown").strip()

    existing = db.query(WebhookEvent).filter(WebhookEvent.razorpay_event_id == event_id).first()
    if existing:
        duration_ms = int((time.perf_counter() - started) * 1000)
        _set_webhook_log(
            org_id=existing.org_id,
            event_type=event_type,
            event_id=event_id,
            outcome="duplicate",
            duration_ms=duration_ms,
        )
        return {"status": "ok", "duplicate": True}

    payment = None
    if event_type == "payment.captured":
        payment = await provider.fetch_payment(_event_payment_id(event))

    org_id: str | None = None
    outcome = "processed"
    try:
        with db.begin():
            persisted_event = WebhookEvent(
                org_id=None,
                razorpay_event_id=event_id,
                provider="razorpay",
                event_id=event_id,
                event_type=event_type,
                status="received",
                outcome="received",
                duration_ms=None,
                payload=json.dumps(event, separators=(",", ":")),
            )
            db.add(persisted_event)
            db.flush()
            org_id, outcome = process_webhook_event(db, event=event, event_id=event_id, payment=payment)
            persisted_event.org_id = org_id
            persisted_event.status = outcome
            persisted_event.outcome = outcome
    except IntegrityError:
        db.rollback()
        duration_ms = int((time.perf_counter() - started) * 1000)
        _set_webhook_log(
            org_id=org_id,
            event_type=event_type,
            event_id=event_id,
            outcome="duplicate",
            duration_ms=duration_ms,
        )
        return {"status": "ok", "duplicate": True}

    duration_ms = int((time.perf_counter() - started) * 1000)
    persisted = db.query(WebhookEvent).filter(WebhookEvent.razorpay_event_id == event_id).first()
    if persisted:
        persisted.duration_ms = duration_ms
        db.add(persisted)
        db.commit()
    _set_webhook_log(
        org_id=org_id,
        event_type=event_type,
        event_id=event_id,
        outcome=outcome,
        duration_ms=duration_ms,
    )
    return {"status": "ok", "outcome": outcome}
