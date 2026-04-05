"""Canonical plan catalog and helpers."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.models.factory import Factory
from backend.models.org_subscription_addon import OrgSubscriptionAddon
from backend.models.organization import Organization
from backend.models.user import User
from backend.models.user_factory_role import UserFactoryRole
from backend.models.user_plan import UserPlan


ALLOWED_PLANS = {"free", "starter", "growth", "factory", "business", "enterprise"}
PLAN_ALIASES = {
    "pro": "growth",
    "biz": "business",
}
PLAN_ORDER = {
    "free": 0,
    "starter": 1,
    "growth": 2,
    "factory": 3,
    "business": 4,
    "enterprise": 5,
}


def normalize_plan(plan: str | None) -> str:
    key = (plan or "").strip().lower()
    if not key:
        return "free"
    key = PLAN_ALIASES.get(key, key)
    return key if key in ALLOWED_PLANS else "free"


def plan_rank(plan: str | None) -> int:
    return PLAN_ORDER.get(normalize_plan(plan), 0)


DEFAULT_PLAN = normalize_plan(os.getenv("OCR_DEFAULT_PLAN") or "free")
HARD_USER_FACTORY_CAPS = True
ENTERPRISE_CUSTOM_ONLY = True


PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "free": {
        "id": "free",
        "name": "Free",
        "subtitle": "Solo operators, trial",
        "monthly_price": 0,
        "display_price": "₹0",
        "badge": None,
        "user_limit": 3,
        "factory_limit": 1,
        "limits": {"ocr": 0, "summary": 10, "email": 0, "smart": 30},
        "unlimited_limits": [],
        "features": {
            "accountant": False,
            "emailSummary": False,
            "whatsapp": False,
            "priority": False,
            "pdf": False,
            "excel": True,
            "analytics": False,
            "templates": False,
            "api": False,
            "onPremise": False,
            "nlq": False,
        },
    },
    "starter": {
        "id": "starter",
        "name": "Starter",
        "subtitle": "Workshops, 5-20 workers",
        "monthly_price": 499,
        "display_price": "₹499/mo",
        "badge": "new",
        "user_limit": 8,
        "factory_limit": 1,
        "limits": {"ocr": 0, "summary": 30, "email": 0, "smart": 100},
        "unlimited_limits": [],
        "features": {
            "accountant": False,
            "emailSummary": False,
            "whatsapp": False,
            "priority": False,
            "pdf": True,
            "excel": True,
            "analytics": False,
            "templates": False,
            "api": False,
            "onPremise": False,
            "nlq": False,
        },
    },
    "growth": {
        "id": "growth",
        "name": "Growth",
        "subtitle": "SME, 20-80 workers",
        "monthly_price": 1299,
        "display_price": "₹1,299/mo",
        "badge": None,
        "user_limit": 20,
        "factory_limit": 2,
        "limits": {"ocr": 0, "summary": 150, "email": 150, "smart": 300},
        "unlimited_limits": [],
        "features": {
            "accountant": True,
            "emailSummary": True,
            "whatsapp": False,
            "priority": False,
            "pdf": True,
            "excel": True,
            "analytics": True,
            "templates": False,
            "api": False,
            "onPremise": False,
            "nlq": False,
        },
    },
    "factory": {
        "id": "factory",
        "name": "Factory",
        "subtitle": "Mid-factories, 80-300 workers",
        "monthly_price": 2999,
        "display_price": "₹2,999/mo",
        "badge": "popular",
        "user_limit": 60,
        "factory_limit": 5,
        "limits": {"ocr": 100, "summary": 600, "email": 600, "smart": 1500},
        "unlimited_limits": [],
        "features": {
            "accountant": True,
            "emailSummary": True,
            "whatsapp": True,
            "priority": False,
            "pdf": True,
            "excel": True,
            "analytics": True,
            "templates": True,
            "api": False,
            "onPremise": False,
            "nlq": False,
        },
    },
    "business": {
        "id": "business",
        "name": "Business",
        "subtitle": "Factory groups, 2-8 plants",
        "monthly_price": 6999,
        "display_price": "₹6,999/mo",
        "badge": "new",
        "user_limit": 150,
        "factory_limit": 10,
        "limits": {"ocr": 150, "summary": 0, "email": 0, "smart": 0},
        "unlimited_limits": ["summary", "email", "smart"],
        "features": {
            "accountant": True,
            "emailSummary": True,
            "whatsapp": True,
            "priority": True,
            "pdf": True,
            "excel": True,
            "analytics": True,
            "templates": True,
            "api": True,
            "onPremise": False,
            "nlq": True,
        },
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "subtitle": "Industrial groups, 8+ plants",
        "monthly_price": 0,
        "display_price": "Contact sales",
        "custom_price_hint": "₹20k–₹80k/mo",
        "sales_only": True,
        "badge": None,
        "user_limit": 0,
        "factory_limit": 0,
        "limits": {"ocr": 0, "summary": 0, "email": 0, "smart": 0},
        "unlimited_limits": ["ocr", "summary", "email", "smart"],
        "features": {
            "accountant": True,
            "emailSummary": True,
            "whatsapp": True,
            "priority": True,
            "pdf": True,
            "excel": True,
            "analytics": True,
            "templates": True,
            "api": True,
            "onPremise": True,
            "nlq": True,
        },
    },
}

PRICING_META = {
    "currency": "INR",
    "currency_symbol": "₹",
    "yearly_multiplier": 10,
}

ADDONS = [
    {
        "id": "ocr_light",
        "feature_key": "ocr_pack",
        "kind": "ocr_pack",
        "name": "OCR Light Pack",
        "price": 349,
        "description": "200 scans per month for teams that only digitize a few ledgers or sheets.",
        "scan_quota": 200,
        "sort_order": 1,
        "quantity_allowed": True,
    },
    {
        "id": "ocr_standard",
        "feature_key": "ocr_pack",
        "kind": "ocr_pack",
        "name": "OCR Standard Pack",
        "price": 749,
        "description": "500 scans per month for regular OCR-driven production logs.",
        "scan_quota": 500,
        "sort_order": 2,
        "quantity_allowed": True,
    },
    {
        "id": "ocr_heavy",
        "feature_key": "ocr_pack",
        "kind": "ocr_pack",
        "name": "OCR Heavy Pack",
        "price": 2499,
        "description": "2,000 scans per month for bulk paper-to-digital workflows.",
        "scan_quota": 2000,
        "sort_order": 3,
        "quantity_allowed": True,
    },
]
ADDON_CATALOG = {str(item["id"]): item for item in ADDONS}
FEATURE_ADDON_MAP = {
    str(item["feature_key"]): str(item["id"])
    for item in ADDONS
    if item.get("kind") == "feature" and item.get("feature_key")
}


def get_plan(plan: str | None) -> dict[str, Any]:
    key = normalize_plan(plan)
    return PLAN_CATALOG.get(key, PLAN_CATALOG["free"])


def plan_has_hard_caps() -> bool:
    return HARD_USER_FACTORY_CAPS


def is_sales_only_plan(plan: str | None) -> bool:
    return ENTERPRISE_CUSTOM_ONLY and bool(get_plan(plan).get("sales_only"))


def plan_limit(plan: str | None, limit_key: str) -> int:
    plan_info = get_plan(plan)
    return int(plan_info.get("limits", {}).get(limit_key, 0) or 0)


def plan_limit_is_unlimited(plan: str | None, limit_key: str) -> bool:
    unlimited = get_plan(plan).get("unlimited_limits", []) or []
    return str(limit_key) in {str(item) for item in unlimited}


def get_addon(addon_id: str | None) -> dict[str, Any] | None:
    key = (addon_id or "").strip().lower()
    if not key:
        return None
    return ADDON_CATALOG.get(key)


def addon_kind(addon_id: str | None) -> str | None:
    addon = get_addon(addon_id)
    kind = addon.get("kind") if addon else None
    return str(kind) if kind else None


def addon_scan_quota(addon_id: str | None) -> int:
    addon = get_addon(addon_id)
    return int(addon.get("scan_quota", 0) or 0) if addon else 0


def normalize_addon_ids(addon_ids: list[str] | tuple[str, ...] | set[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in addon_ids or []:
        addon = get_addon(raw)
        if not addon:
            continue
        addon_id = str(addon["id"])
        if addon_id in seen:
            continue
        seen.add(addon_id)
        normalized.append(addon_id)
    return normalized


def normalize_addon_quantities(
    addon_quantities: dict[str, int] | None,
    *,
    addon_ids: list[str] | tuple[str, ...] | set[str] | None = None,
) -> dict[str, int]:
    normalized: dict[str, int] = {}
    if addon_quantities:
        for raw_id, raw_quantity in addon_quantities.items():
            addon = get_addon(raw_id)
            if not addon:
                continue
            quantity = int(raw_quantity or 0)
            if quantity <= 0:
                continue
            normalized[str(addon["id"])] = quantity
    for addon_id in normalize_addon_ids(addon_ids):
        normalized.setdefault(addon_id, 1)
    return normalized


def add_on_feature_key(addon_id: str | None) -> str | None:
    addon = get_addon(addon_id)
    feature_key = addon.get("feature_key") if addon else None
    return str(feature_key) if feature_key else None


def addon_grants_feature(addon_id: str | None, feature_key: str) -> bool:
    return addon_kind(addon_id) == "feature" and add_on_feature_key(addon_id) == (feature_key or "").strip()


def has_plan_feature(plan: str | None, feature_key: str) -> bool:
    info = get_plan(plan)
    features = info.get("features", {}) or {}
    return bool(features.get(feature_key))


def addon_included_in_plan(plan: str | None, addon_id: str | None) -> bool:
    feature_key = add_on_feature_key(addon_id)
    if not feature_key or addon_kind(addon_id) != "feature":
        return False
    return has_plan_feature(plan, feature_key)


def min_plan_for_feature(feature_key: str) -> str:
    ordered = sorted(PLAN_ORDER.items(), key=lambda item: item[1])
    for plan_key, _rank in ordered:
        if has_plan_feature(plan_key, feature_key):
            return plan_key
    return "enterprise"


def _active_factory_user_ids_query(
    db: Session,
    *,
    factory_name: str,
    org_id: str | None = None,
    factory_id: str | None = None,
):
    membership_query = (
        db.query(UserFactoryRole.user_id.label("user_id"))
        .join(User, User.id == UserFactoryRole.user_id)
        .filter(User.is_active.is_(True))
    )
    if factory_id:
        membership_query = membership_query.filter(UserFactoryRole.factory_id == factory_id)
    else:
        membership_query = (
            membership_query.join(Factory, Factory.factory_id == UserFactoryRole.factory_id)
            .filter(
                Factory.name == factory_name,
                Factory.is_active.is_(True),
            )
        )
    if org_id:
        membership_query = membership_query.filter(UserFactoryRole.org_id == org_id, User.org_id == org_id)

    legacy_query = db.query(User.id.label("user_id")).filter(
        User.factory_name == factory_name,
        User.is_active.is_(True),
    )
    if org_id:
        legacy_query = legacy_query.filter(User.org_id == org_id)

    return membership_query.union(legacy_query).subquery()


def get_effective_factory_plan(
    db: Session,
    factory_name: str,
    *,
    org_id: str | None = None,
    factory_id: str | None = None,
) -> str:
    active_user_ids = _active_factory_user_ids_query(
        db,
        factory_name=factory_name,
        org_id=org_id,
        factory_id=factory_id,
    )
    rows = (
        db.query(UserPlan.plan)
        .join(active_user_ids, active_user_ids.c.user_id == UserPlan.user_id)
        .all()
    )
    if not rows:
        return DEFAULT_PLAN
    best = DEFAULT_PLAN
    for (plan,) in rows:
        if plan_rank(plan) > plan_rank(best):
            best = normalize_plan(plan)
    return best


def get_org_plan(db: Session, *, org_id: str | None, fallback_user_id: int | None = None) -> str:
    if org_id:
        org = db.query(Organization).filter(Organization.org_id == org_id).first()
        if org and org.plan:
            return normalize_plan(org.plan)
    if fallback_user_id is not None:
        plan_row = db.query(UserPlan).filter(UserPlan.user_id == fallback_user_id).first()
        if plan_row and plan_row.plan:
            return normalize_plan(plan_row.plan)
    return DEFAULT_PLAN


def get_org_active_addons(db: Session, *, org_id: str | None) -> list[OrgSubscriptionAddon]:
    if not org_id:
        return []
    now = datetime.now(timezone.utc)
    rows = (
        db.query(OrgSubscriptionAddon)
        .filter(
            OrgSubscriptionAddon.org_id == org_id,
            OrgSubscriptionAddon.status == "active",
        )
        .order_by(OrgSubscriptionAddon.created_at.asc())
        .all()
    )
    return [
        row
        for row in rows
        if int(getattr(row, "quantity", 1) or 0) > 0
        and (not row.current_period_end_at or row.current_period_end_at >= now)
    ]


def get_org_addon_ids(db: Session, *, org_id: str | None) -> list[str]:
    return [row.addon_id for row in get_org_active_addons(db, org_id=org_id)]


def get_org_addon_quantity_map(db: Session, *, org_id: str | None) -> dict[str, int]:
    quantities: dict[str, int] = {}
    for row in get_org_active_addons(db, org_id=org_id):
        quantities[row.addon_id] = int(getattr(row, "quantity", 1) or 0)
    return quantities


def get_org_ocr_scan_allowance(db: Session, *, org_id: str | None) -> int:
    quantities = get_org_addon_quantity_map(db, org_id=org_id)
    total = 0
    for addon_id, quantity in quantities.items():
        if addon_kind(addon_id) != "ocr_pack":
            continue
        total += addon_scan_quota(addon_id) * max(0, int(quantity or 0))
    return total


def has_org_feature(
    db: Session,
    *,
    org_id: str | None,
    fallback_user_id: int | None,
    feature_key: str,
) -> bool:
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=fallback_user_id)
    if has_plan_feature(plan, feature_key):
        return True
    addon_id = FEATURE_ADDON_MAP.get((feature_key or "").strip())
    if not addon_id:
        return False
    return addon_id in get_org_addon_ids(db, org_id=org_id)


def org_has_ocr_access(
    db: Session,
    *,
    org_id: str | None,
    fallback_user_id: int | None,
) -> bool:
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=fallback_user_id)
    if plan_limit(plan, "ocr") > 0 or plan_limit_is_unlimited(plan, "ocr"):
        return True
    return get_org_ocr_scan_allowance(db, org_id=org_id) > 0


def serialize_addon_catalog() -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    for addon in sorted(ADDONS, key=lambda item: int(item.get("sort_order", 0) or 0)):
        addon_id = str(addon["id"])
        payload.append(
            {
                **addon,
                "included_in": [
                    plan_id
                    for plan_id in PLAN_CATALOG
                    if addon_included_in_plan(plan_id, addon_id)
                ],
            }
        )
    return payload


def enforce_user_limit(
    db: Session,
    factory_name: str,
    plan: str,
    *,
    org_id: str | None = None,
    factory_id: str | None = None,
) -> None:
    plan_info = get_plan(plan)
    limit = int(plan_info.get("user_limit", 0) or 0)
    if limit <= 0:
        return
    active_user_ids = _active_factory_user_ids_query(
        db,
        factory_name=factory_name,
        org_id=org_id,
        factory_id=factory_id,
    )
    active_users = db.query(active_user_ids.c.user_id).count()
    if active_users >= limit:
        raise ValueError(f"User limit reached for {plan_info.get('name', 'plan')}. Please upgrade.")


def enforce_factory_limit(db: Session, *, org_id: str | None, plan: str) -> None:
    plan_info = get_plan(plan)
    limit = int(plan_info.get("factory_limit", 0) or 0)
    if limit <= 0 or not org_id:
        return
    active_factories = (
        db.query(Factory.factory_id)
        .filter(Factory.org_id == org_id, Factory.is_active.is_(True))
        .count()
    )
    if active_factories >= limit:
        raise ValueError(f"Factory limit reached for {plan_info.get('name', 'plan')}. Please upgrade.")
