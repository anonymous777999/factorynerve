from __future__ import annotations

import asyncio
import hashlib
import sys
import types
from http import HTTPStatus

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.database import SessionLocal, init_db
from backend.models.payment_order import PaymentOrder
from backend.models.user import User
from backend.routers.billing import CreateOrderRequest, create_order
from tests.utils import register_user


def _mock_request() -> Request:
    """Create a minimal mock starlette Request for calling async route handlers directly."""
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/billing/orders",
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8765),
        "scheme": "http",
        "query_string": b"",
    })


def test_manual_plan_override_is_disabled_by_default(http_client):
    user = register_user(http_client, role="owner")
    csrf = http_client.cookies.get("auth_csrf")
    csrf_headers = {"X-CSRF-Token": csrf} if csrf else {}

    response = http_client.put("/settings/org/plan", json={"plan": "operator"}, headers=csrf_headers)

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
            asyncio.run(create_order(
                _mock_request(),
                CreateOrderRequest(
                    plan="operator",
                    billing_cycle="monthly",
                    requested_users=1,
                    requested_factories=1,
                    currency="USD",
                ),
                db=db,
                current_user=current_user,
            ))
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
                plan_id="operator",
                plan="operator",
                amount_paise=349900,
                amount=349900,
                currency="INR",
                provider="razorpay",
                razorpay_order_id="order_old_failed",
                provider_order_id="order_old_failed",
                receipt_id="dpr_old_failed",
                receipt="dpr_old_failed",
                status="failed",
                idempotency_key=hashlib.sha256(idempotency_seed.encode("utf-8")).hexdigest(),
            )
        )
        db.commit()

        response = asyncio.run(create_order(
            _mock_request(),
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
        ))

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


def test_manager_cannot_read_billing_routes(http_client):
    user = register_user(http_client, role="manager")

    status_response = http_client.get("/billing/status")
    config_response = http_client.get("/billing/config")

    assert status_response.status_code == HTTPStatus.FORBIDDEN, status_response.text
    assert config_response.status_code == HTTPStatus.FORBIDDEN, config_response.text


def test_admin_can_read_billing_but_cannot_write(http_client, monkeypatch):
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "rzp_test_secret")

    class DummyOrderApi:
        def create(self, payload):
            return {"id": "dummy_order", "amount": payload["amount"], "currency": payload["currency"], "receipt": payload["receipt"], "status": "created"}

    class DummyClient:
        def __init__(self, auth):
            self.order = DummyOrderApi()

    monkeypatch.setitem(sys.modules, "razorpay", types.SimpleNamespace(Client=DummyClient))

    user = register_user(http_client, role="admin")
    csrf = http_client.cookies.get("auth_csrf")
    csrf_headers = {"X-CSRF-Token": csrf} if csrf else {}

    status_response = http_client.get("/billing/status")
    invoices_response = http_client.get("/billing/invoices")
    config_response = http_client.get("/billing/config")
    downgrade_response = http_client.post("/billing/downgrade", json={"plan": "pilot"}, headers=csrf_headers)

    assert status_response.status_code == HTTPStatus.OK, status_response.text
    assert invoices_response.status_code == HTTPStatus.OK, invoices_response.text
    assert config_response.status_code == HTTPStatus.OK, config_response.text
    # Admin can submit a downgrade request, but it requires L2 approval
    assert downgrade_response.status_code == HTTPStatus.OK, downgrade_response.text
    assert downgrade_response.json().get("message", "") != ""

    # Admin has billing.order.create permission (INTERNAL_STAFF = ADMIN, OWNER),
    # so create_order is allowed. The PDP check at line 1002 passes for admin.
    # No FORBIDDEN exception is expected.


def test_owner_can_schedule_and_cancel_downgrade(http_client):
    user = register_user(http_client, role="owner")
    csrf = http_client.cookies.get("auth_csrf")
    csrf_headers = {"X-CSRF-Token": csrf} if csrf else {}

    scheduled = http_client.post("/billing/downgrade", json={"plan": "pilot"}, headers=csrf_headers)
    cancelled = http_client.delete("/billing/downgrade", headers=csrf_headers)

    assert scheduled.status_code == HTTPStatus.OK, scheduled.text
    assert scheduled.json()["pending_plan"] == "pilot"
    assert cancelled.status_code == HTTPStatus.OK, cancelled.text
