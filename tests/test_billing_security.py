from __future__ import annotations

import asyncio
import hashlib
import json
import sys
import types
from http import HTTPStatus

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.database import SessionLocal, init_db
from backend.models.organization import Organization
from backend.models.payment_order import PaymentOrder
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.routers.billing import CreateOrderRequest, create_order, razorpay_webhook
from tests.utils import register_user, unique_email


def test_manual_plan_override_is_disabled_by_default(http_client):
    user = register_user(http_client, role="owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.put("/settings/org/plan", json={"plan": "starter"}, headers=headers)

    assert response.status_code == HTTPStatus.FORBIDDEN, response.text
    assert "disabled" in response.text.lower()


def test_create_order_rejects_non_inr_currency(http_client):
    user = register_user(http_client, role="owner")

    init_db()
    db = SessionLocal()
    try:
        current_user = db.query(User).filter(User.email == user["email"]).first()
        assert current_user is not None
        with pytest.raises(HTTPException) as raised:
            create_order(
                CreateOrderRequest(
                    plan="starter",
                    billing_cycle="monthly",
                    requested_users=1,
                    requested_factories=1,
                    currency="USD",
                ),
                db=db,
                current_user=current_user,
            )
    finally:
        db.close()

    assert raised.value.status_code == HTTPStatus.BAD_REQUEST
    assert "only inr billing is supported" in str(raised.value.detail).lower()


def test_failed_payment_order_can_create_a_fresh_retry(http_client, monkeypatch):
    user = register_user(http_client, role="owner")
    idempotency_seed = "fixed-retry-key"
    stored_order_id: dict[str, str] = {}

    class DummyOrderApi:
        def create(self, payload):
            stored_order_id["value"] = "order_retry_123"
            return {
                "id": stored_order_id["value"],
                "amount": payload["amount"],
                "currency": payload["currency"],
                "receipt": payload["receipt"],
                "status": "created",
            }

    class DummyClient:
        def __init__(self, auth):
            self.order = DummyOrderApi()

    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "rzp_test_secret")
    monkeypatch.setitem(sys.modules, "razorpay", types.SimpleNamespace(Client=DummyClient))

    init_db()
    db = SessionLocal()
    try:
        current_user = db.query(User).filter(User.email == user["email"]).first()
        assert current_user is not None
        db.add(
            PaymentOrder(
                user_id=current_user.id,
                plan="starter",
                amount=49900,
                currency="INR",
                provider="razorpay",
                provider_order_id="order_old_failed",
                receipt="dpr_old_failed",
                status="failed",
                idempotency_key=hashlib.sha256(idempotency_seed.encode("utf-8")).hexdigest(),
            )
        )
        db.commit()

        response = create_order(
            CreateOrderRequest(
                plan="starter",
                billing_cycle="monthly",
                requested_users=1,
                requested_factories=1,
                currency="INR",
                idempotency_key=idempotency_seed,
            ),
            db=db,
            current_user=current_user,
        )

        rows = (
            db.query(PaymentOrder)
            .filter(PaymentOrder.user_id == current_user.id)
            .order_by(PaymentOrder.id.asc())
            .all()
        )
    finally:
        db.close()

    assert response["order"]["id"] == "order_retry_123"
    assert len(rows) == 2
    assert rows[0].provider_order_id == "order_old_failed"
    assert rows[1].provider_order_id == "order_retry_123"
    assert rows[1].currency == "INR"


def test_create_order_enforces_real_org_footprint(http_client, monkeypatch):
    user = register_user(http_client, role="owner")

    class DummyOrderApi:
        def create(self, payload):
            return {
                "id": "order_should_not_be_called",
                "amount": payload["amount"],
                "currency": payload["currency"],
                "receipt": payload["receipt"],
                "status": "created",
            }

    class DummyClient:
        def __init__(self, auth):
            self.order = DummyOrderApi()

    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "rzp_test_secret")
    monkeypatch.setitem(sys.modules, "razorpay", types.SimpleNamespace(Client=DummyClient))

    init_db()
    db = SessionLocal()
    try:
        current_user = db.query(User).filter(User.email == user["email"]).first()
        assert current_user is not None
        max_user_code = current_user.user_code
        for index in range(8):
            max_user_code += 1
            db.add(
                User(
                    org_id=current_user.org_id,
                    user_code=max_user_code,
                    name=f"Extra User {index}",
                    email=unique_email(),
                    password_hash="not-used",
                    role="attendance",
                    factory_name=current_user.factory_name,
                    factory_code=current_user.factory_code,
                    is_active=True,
                )
            )
        db.commit()

        with pytest.raises(HTTPException) as raised:
            create_order(
                CreateOrderRequest(
                    plan="starter",
                    billing_cycle="monthly",
                    requested_users=1,
                    requested_factories=1,
                    currency="INR",
                ),
                db=db,
                current_user=current_user,
            )
    finally:
        db.close()

    assert raised.value.status_code == HTTPStatus.BAD_REQUEST
    assert "currently has 9 active users" in str(raised.value.detail).lower()


def test_org_owner_can_create_order_even_if_factory_role_is_admin(http_client, monkeypatch):
    user = register_user(http_client, role="owner")

    class DummyOrderApi:
        def create(self, payload):
            return {
                "id": "order_owner_ok_123",
                "amount": payload["amount"],
                "currency": payload["currency"],
                "receipt": payload["receipt"],
                "status": "created",
            }

    class DummyClient:
        def __init__(self, auth):
            self.order = DummyOrderApi()

    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "rzp_test_secret")
    monkeypatch.setitem(sys.modules, "razorpay", types.SimpleNamespace(Client=DummyClient))

    init_db()
    db = SessionLocal()
    try:
        current_user = db.query(User).filter(User.email == user["email"]).first()
        assert current_user is not None
        membership = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == current_user.id)
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )
        assert membership is not None
        membership.role = UserRole.ADMIN
        db.add(membership)
        db.commit()

        current_user = db.query(User).filter(User.email == user["email"]).first()
        assert current_user is not None
        current_user.role = UserRole.ADMIN
        setattr(current_user, "org_role", UserRole.OWNER)

        response = create_order(
            CreateOrderRequest(
                plan="starter",
                billing_cycle="monthly",
                requested_users=1,
                requested_factories=1,
                currency="INR",
            ),
            db=db,
            current_user=current_user,
        )
    finally:
        db.close()

    assert response["order"]["id"] == "order_owner_ok_123"


def test_webhook_amount_mismatch_marks_order_and_skips_upgrade(http_client, monkeypatch):
    user = register_user(http_client, role="owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    class DummyUtility:
        @staticmethod
        def verify_webhook_signature(payload, signature, secret):
            return True

    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "secret")
    monkeypatch.setitem(sys.modules, "razorpay", types.SimpleNamespace(Utility=DummyUtility))

    init_db()
    db = SessionLocal()
    try:
        current_user = db.query(User).filter(User.email == user["email"]).first()
        assert current_user is not None
        db.add(
            PaymentOrder(
                user_id=current_user.id,
                plan="starter",
                amount=49900,
                currency="INR",
                provider="razorpay",
                provider_order_id="order_mismatch_123",
                receipt="dpr_mismatch_123",
                status="created",
                idempotency_key=hashlib.sha256(b"mismatch").hexdigest(),
            )
        )
        db.commit()
    finally:
        db.close()

    payload = json.dumps(
        {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_mismatch_123",
                        "order_id": "order_mismatch_123",
                        "amount": 59900,
                        "currency": "INR",
                        "notes": {},
                    }
                }
            },
        }
    ).encode("utf-8")

    async def receive():
        return {"type": "http.request", "body": payload, "more_body": False}

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/billing/webhook/razorpay",
            "headers": [(b"x-razorpay-signature", b"test-signature")],
        },
        receive,
    )
    db = SessionLocal()
    try:
        result = asyncio.run(razorpay_webhook(request, db))
    finally:
        db.close()

    assert result["status"] == "ok"

    db = SessionLocal()
    try:
        payment_order = (
            db.query(PaymentOrder)
            .filter(PaymentOrder.provider_order_id == "order_mismatch_123")
            .first()
        )
        owner = db.query(User).filter(User.email == user["email"]).first()
        assert payment_order is not None
        assert owner is not None
        org = db.query(Organization).filter(Organization.org_id == owner.org_id).first()
        assert org is not None
    finally:
        db.close()

    assert payment_order.status == "mismatch"
    assert org.plan == "free"


def test_manager_cannot_read_billing_routes(http_client):
    user = register_user(http_client, role="manager")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    status_response = http_client.get("/billing/status", headers=headers)
    config_response = http_client.get("/billing/config", headers=headers)

    assert status_response.status_code == HTTPStatus.FORBIDDEN, status_response.text
    assert config_response.status_code == HTTPStatus.FORBIDDEN, config_response.text


def test_admin_can_read_billing_but_cannot_write(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    status_response = http_client.get("/billing/status", headers=headers)
    invoices_response = http_client.get("/billing/invoices", headers=headers)
    config_response = http_client.get("/billing/config", headers=headers)
    downgrade_response = http_client.post("/billing/downgrade", json={"plan": "free"}, headers=headers)
    order_response = http_client.post("/billing/orders", json={"plan": "starter"}, headers=headers)

    assert status_response.status_code == HTTPStatus.OK, status_response.text
    assert invoices_response.status_code == HTTPStatus.OK, invoices_response.text
    assert config_response.status_code == HTTPStatus.OK, config_response.text
    assert downgrade_response.status_code == HTTPStatus.FORBIDDEN, downgrade_response.text
    assert order_response.status_code == HTTPStatus.FORBIDDEN, order_response.text


def test_owner_can_schedule_and_cancel_downgrade(http_client):
    user = register_user(http_client, role="owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    scheduled = http_client.post("/billing/downgrade", json={"plan": "free"}, headers=headers)
    cancelled = http_client.delete("/billing/downgrade", headers=headers)

    assert scheduled.status_code == HTTPStatus.OK, scheduled.text
    assert scheduled.json()["pending_plan"] == "free"
    assert cancelled.status_code == HTTPStatus.OK, cancelled.text
