"""Billing state management helpers."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.invoice import Invoice
from backend.models.organization import Organization
from backend.models.org_subscription_addon import OrgSubscriptionAddon
from backend.models.report import AuditLog
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.models.user_plan import UserPlan
from backend.plans import get_addon, normalize_addon_quantities, normalize_plan
from backend.tenancy import resolve_factory_id, resolve_org_id


logger = logging.getLogger(__name__)


def apply_plan_change(
    db: Session,
    *,
    user_id: int,
    plan: str,
    provider: str | None = None,
    current_period_end_at: datetime | None = None,
    audit_details: str | None = None,
    audit_action: str = "PLAN_UPDATED",
) -> None:
    normalized = normalize_plan(plan)
    if not normalized:
        return
    now = datetime.now(timezone.utc)
    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if sub:
        sub.plan = normalized
        sub.status = "active"
        sub.provider = provider or sub.provider
        if current_period_end_at:
            sub.current_period_end_at = current_period_end_at
        sub.trial_end_at = None
        sub.pending_plan = None
        sub.pending_plan_effective_at = None
        sub.updated_at = now
        db.add(sub)
    else:
        db.add(
            Subscription(
                user_id=user_id,
                plan=normalized,
                status="active",
                provider=provider,
                trial_start_at=None,
                trial_end_at=None,
                current_period_end_at=current_period_end_at,
            )
        )

    plan_row = db.query(UserPlan).filter(UserPlan.user_id == user_id).first()
    if plan_row:
        plan_row.plan = normalized
        plan_row.updated_at = now
        db.add(plan_row)
    else:
        db.add(UserPlan(user_id=user_id, plan=normalized))

    user = db.query(User).filter(User.id == user_id).first()
    if user and user.org_id:
        org = db.query(Organization).filter(Organization.org_id == user.org_id).first()
        if org:
            org.plan = normalized
            org.plan_expires_at = current_period_end_at
            db.add(org)

    if audit_details and user:
        db.add(
            AuditLog(
                user_id=user_id,
                org_id=resolve_org_id(user),
                factory_id=resolve_factory_id(db, user),
                action=audit_action,
                details=audit_details,
                ip_address=None,
                user_agent=None,
                timestamp=now,
            )
        )


def schedule_downgrade(
    db: Session,
    *,
    user_id: int,
    plan: str,
    effective_at: datetime | None = None,
) -> Subscription:
    normalized = normalize_plan(plan)
    if not normalized:
        raise ValueError("Invalid plan.")
    now = datetime.now(timezone.utc)
    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if not sub:
        sub = Subscription(user_id=user_id, plan="free", status="trialing")
        db.add(sub)
        db.flush()
    if not effective_at:
        effective_at = sub.current_period_end_at or sub.trial_end_at or (now + timedelta(days=30))
    sub.pending_plan = normalized
    sub.pending_plan_effective_at = effective_at
    sub.updated_at = now
    db.add(sub)
    return sub


def cancel_scheduled_downgrade(db: Session, *, user_id: int) -> None:
    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if not sub:
        return
    sub.pending_plan = None
    sub.pending_plan_effective_at = None
    sub.updated_at = datetime.now(timezone.utc)
    db.add(sub)


def apply_due_downgrades(db: Session, *, user_id: int | None = None) -> int:
    now = datetime.now(timezone.utc)
    query = db.query(Subscription).filter(
        Subscription.pending_plan.isnot(None),
        Subscription.pending_plan_effective_at.isnot(None),
        Subscription.pending_plan_effective_at <= now,
    )
    if user_id:
        query = query.filter(Subscription.user_id == user_id)
    rows = query.all()
    for sub in rows:
        apply_plan_change(
            db,
            user_id=sub.user_id,
            plan=str(sub.pending_plan),
            provider=sub.provider,
            current_period_end_at=sub.current_period_end_at,
            audit_details=f"scheduled_downgrade_to={sub.pending_plan}",
            audit_action="PLAN_DOWNGRADED",
        )
    return len(rows)


def record_invoice(
    db: Session,
    *,
    user_id: int,
    plan: str,
    provider: str | None,
    provider_invoice_id: str | None,
    amount: float,
    currency: str,
    status: str,
    issued_at: datetime | None,
    pdf_url: str | None = None,
    tax_amount: float = 0.0,
) -> Invoice:
    invoice = Invoice(
        user_id=user_id,
        provider=provider,
        provider_invoice_id=provider_invoice_id,
        plan=normalize_plan(plan),
        status=status,
        amount=amount,
        currency=currency,
        tax_amount=tax_amount,
        pdf_url=pdf_url,
        issued_at=issued_at,
    )
    db.add(invoice)
    return invoice


def list_invoices(db: Session, *, user_id: int) -> list[Invoice]:
    return (
        db.query(Invoice)
        .filter(Invoice.user_id == user_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )


def activate_org_addons(
    db: Session,
    *,
    org_id: str,
    addon_quantities: dict[str, int] | None = None,
    addon_ids: list[str] | tuple[str, ...] | set[str] | None = None,
    purchased_by_user_id: int | None,
    billing_cycle: str,
    provider: str | None = None,
    provider_order_id: str | None = None,
    current_period_end_at: datetime | None = None,
) -> list[OrgSubscriptionAddon]:
    normalized_quantities = normalize_addon_quantities(addon_quantities, addon_ids=addon_ids)
    now = datetime.now(timezone.utc)
    activated: list[OrgSubscriptionAddon] = []
    for addon_id, quantity in normalized_quantities.items():
        addon = get_addon(addon_id)
        if not addon:
            continue
        row = (
            db.query(OrgSubscriptionAddon)
            .filter(
                OrgSubscriptionAddon.org_id == org_id,
                OrgSubscriptionAddon.addon_id == addon_id,
            )
            .first()
        )
        if not row:
            row = OrgSubscriptionAddon(
                org_id=org_id,
                addon_id=addon_id,
                feature_key=str(addon.get("feature_key") or addon_id),
                name=str(addon.get("name") or addon_id),
                unit_price=int(addon.get("price", 0) or 0),
                quantity=max(1, int(quantity or 1)),
                billing_cycle=billing_cycle,
                status="active",
                provider=provider,
                provider_order_id=provider_order_id,
                purchased_by_user_id=purchased_by_user_id,
                current_period_end_at=current_period_end_at,
            )
        else:
            row.feature_key = str(addon.get("feature_key") or row.feature_key or addon_id)
            row.name = str(addon.get("name") or row.name or addon_id)
            row.unit_price = int(addon.get("price", row.unit_price) or 0)
            row.quantity = max(1, int(quantity or 1))
            row.billing_cycle = billing_cycle
            row.status = "active"
            row.provider = provider or row.provider
            row.provider_order_id = provider_order_id or row.provider_order_id
            row.purchased_by_user_id = purchased_by_user_id or row.purchased_by_user_id
            row.current_period_end_at = current_period_end_at
            row.updated_at = now
        db.add(row)
        activated.append(row)
    return activated
