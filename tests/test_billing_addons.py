from __future__ import annotations

from http import HTTPStatus

import pytest
from fastapi import HTTPException

from backend.database import SessionLocal, init_db
from backend.models.org_subscription_addon import OrgSubscriptionAddon
from backend.models.user import User
from backend.plans import get_addon
from backend.routers.billing import _resolve_checkout_quote
from tests.utils import register_user


def _grant_addon(email: str, addon_id: str, *, quantity: int = 1) -> User:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        addon = get_addon(addon_id)
        assert addon is not None
        row = (
            db.query(OrgSubscriptionAddon)
            .filter(
                OrgSubscriptionAddon.org_id == user.org_id,
                OrgSubscriptionAddon.addon_id == addon_id,
            )
            .first()
        )
        if not row:
            row = OrgSubscriptionAddon(
                org_id=user.org_id,
                addon_id=addon_id,
                feature_key=str(addon["feature_key"]),
                name=str(addon["name"]),
                unit_price=int(addon["price"]),
                quantity=quantity,
                billing_cycle="monthly",
                status="active",
                purchased_by_user_id=user.id,
            )
        else:
            row.quantity = quantity
            row.status = "active"
            row.billing_cycle = "monthly"
        db.add(row)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def test_checkout_quote_only_charges_new_ocr_pack_quantities(http_client):
    user = register_user(http_client, role="admin")
    init_db()
    db_user = _grant_addon(user["email"], "ocr_standard", quantity=1)

    db = SessionLocal()
    try:
        persisted_user = db.query(User).filter(User.id == db_user.id).first()
        assert persisted_user is not None
        quote = _resolve_checkout_quote(
            db,
            current_user=persisted_user,
            plan="free",
            billing_cycle="monthly",
            requested_users=3,
            requested_factories=1,
            addon_quantities={"ocr_standard": 1, "ocr_heavy": 1},
        )
    finally:
        db.close()

    assert quote["addon_monthly_total"] == 2499
    assert quote["already_active_addon_ids"] == ["ocr_standard"]
    assert quote["chargeable_addon_quantities"] == {"ocr_heavy": 1}
    assert quote["monthly_total"] == 2499
    assert quote["amount_paise"] == 249900


def test_free_plan_ocr_pack_unlocks_template_access(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    blocked = http_client.get("/ocr/templates", headers=headers)
    assert blocked.status_code == HTTPStatus.PAYMENT_REQUIRED

    _grant_addon(user["email"], "ocr_light", quantity=1)

    allowed = http_client.get("/ocr/templates", headers=headers)
    assert allowed.status_code == HTTPStatus.OK, allowed.text


def test_enterprise_is_sales_only_in_checkout_quote(http_client):
    user = register_user(http_client, role="admin")

    init_db()
    db = SessionLocal()
    try:
        persisted_user = db.query(User).filter(User.email == user["email"]).first()
        assert persisted_user is not None
        with pytest.raises(HTTPException) as raised:
            _resolve_checkout_quote(
                db,
                current_user=persisted_user,
                plan="enterprise",
                billing_cycle="monthly",
                requested_users=200,
                requested_factories=12,
            )
    finally:
        db.close()

    assert raised.value.status_code == HTTPStatus.BAD_REQUEST
    assert "sales-assisted" in str(raised.value.detail).lower()
