from __future__ import annotations

import asyncio
import json
import sys
import threading
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session as SASession

sys.modules.setdefault(
    "razorpay",
    SimpleNamespace(
        Client=lambda auth: SimpleNamespace(order=SimpleNamespace(create=lambda payload: payload)),
        Utility=SimpleNamespace(verify_webhook_signature=lambda *_: True),
    ),
)

from backend.database import SessionLocal, _audit_writes, get_db, init_db
from backend.main import app
from backend.models.ops_alert_event import OpsAlertEvent
from backend.models.organization import Organization
from backend.models.payment_order import PaymentOrder
from backend.models.subscription import Subscription
from backend.models.user import User, UserRole
from backend.models.webhook_event import WebhookEvent
from backend.routers import billing as billing_router
from backend.services.billing import razorpay_adapter as razorpay_adapter_module
from backend.services.billing.razorpay_adapter import RazorpayPaymentAdapter
from backend.services.billing_manager import enforce_expired_grace_periods, recover_stale_dispatching_events


def _seed_user_and_order() -> dict[str, object]:
    init_db()
    db = SessionLocal()
    try:
        org_id = str(uuid4())
        user = User(
            org_id=org_id,
            user_code=10000 + int(uuid4().hex[:4], 16),
            name="Phase 5 Owner",
            email=f"phase5_{uuid4().hex[:10]}@example.com",
            password_hash="hashed",
            role=UserRole.OWNER,
            factory_name="Phase5 Factory",
            is_active=True,
        )
        db.add(Organization(org_id=org_id, name="Phase5 Org", plan="operator", is_active=True))
        db.add(user)
        db.commit()
        db.refresh(user)
        order_id = f"order_{uuid4().hex[:10]}"
        db.add(
            PaymentOrder(
                org_id=org_id,
                user_id=user.id,
                plan_id="operator",
                plan="operator",
                amount_paise=49900,
                amount=49900,
                currency="INR",
                provider="razorpay",
                razorpay_order_id=order_id,
                provider_order_id=order_id,
                receipt_id=f"dpr_{user.id}_{int(datetime.now(timezone.utc).timestamp())}",
                receipt=f"dpr_{user.id}_{int(datetime.now(timezone.utc).timestamp())}",
                status="created",
                idempotency_key=str(uuid4()),
            )
        )
        db.commit()
        return {"user_id": user.id, "org_id": user.org_id, "order_id": order_id}
    finally:
        db.close()


def _payment_captured_payload(*, order_id: str, user_id: int, event_id: str) -> dict[str, object]:
    return {
        "id": event_id,
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_{event_id[-8:]}",
                    "order_id": order_id,
                    "amount": 49900,
                    "currency": "INR",
                    "notes": {
                        "plan": "operator",
                        "billing_cycle": "monthly",
                        "user_id": str(user_id),
                    },
                }
            },
            "order": {
                "entity": {
                    "id": order_id,
                    "amount": 49900,
                    "currency": "INR",
                    "receipt": f"dpr_{user_id}_receipt",
                    "notes": {
                        "plan": "operator",
                        "billing_cycle": "monthly",
                        "user_id": str(user_id),
                    },
                }
            },
        },
    }


def _request_from_payload(payload: dict[str, object], signature: str = "good") -> Request:
    body = json.dumps(payload).encode("utf-8")

    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/billing/webhook/razorpay",
        "headers": [(b"x-razorpay-signature", signature.encode("utf-8"))],
        "client": ("127.0.0.1", 5000),
    }
    return Request(scope, receive)


def test_duplicate_webhook_on_concurrent_requests(monkeypatch):
    seeded = _seed_user_and_order()
    event_id = f"evt_{uuid4().hex[:10]}"
    payload = _payment_captured_payload(order_id=str(seeded["order_id"]), user_id=int(seeded["user_id"]), event_id=event_id)
    expected_event_id = billing_router._resolve_event_id(payload, json.dumps(payload).encode("utf-8"))
    activate_calls: list[str] = []
    start_gate = threading.Barrier(2)

    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "secret")
    monkeypatch.setitem(sys.modules, "razorpay", SimpleNamespace(Utility=SimpleNamespace(verify_webhook_signature=lambda *_: True)))

    def wrapped_activate(*args, **kwargs):
        activate_calls.append(str(kwargs.get("provider_order_id")))
        db = args[0]
        subscription = db.query(Subscription).filter(Subscription.org_id == str(seeded["org_id"])).first()
        if not subscription:
            subscription = Subscription(
                org_id=str(seeded["org_id"]),
                user_id=int(seeded["user_id"]),
                plan=str(kwargs["plan"]),
                status="active",
            )
        subscription.user_id = int(seeded["user_id"])
        subscription.plan = str(kwargs["plan"])
        subscription.status = "active"
        db.add(subscription)
        db.flush()

    monkeypatch.setattr(billing_router, "_activate_paid_order", wrapped_activate)
    event.remove(SASession, "before_flush", _audit_writes)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            results: list[int] = []

            def worker() -> None:
                start_gate.wait()
                response = client.post(
                    "/billing/webhook/razorpay",
                    content=json.dumps(payload),
                    headers={"x-razorpay-signature": "valid"},
                )
                results.append(response.status_code)

            first = threading.Thread(target=worker)
            second = threading.Thread(target=worker)
            first.start()
            second.start()
            first.join()
            second.join()
    finally:
        event.listen(SASession, "before_flush", _audit_writes)

    with SessionLocal() as db:
        webhook_rows = db.query(WebhookEvent).filter(WebhookEvent.razorpay_event_id == expected_event_id).all()
        active_subscriptions = (
            db.query(Subscription)
            .filter(Subscription.org_id == str(seeded["org_id"]), Subscription.status == "active")
            .all()
        )

    assert sorted(results) == [200, 200]
    assert len(webhook_rows) == 1
    assert len(activate_calls) == 1
    assert len(active_subscriptions) == 1


def test_db_transaction_failure_during_webhook(monkeypatch):
    seeded = _seed_user_and_order()
    event_id = f"evt_{uuid4().hex[:10]}"
    payload = _payment_captured_payload(order_id=str(seeded["order_id"]), user_id=int(seeded["user_id"]), event_id=event_id)
    expected_event_id = billing_router._resolve_event_id(payload, json.dumps(payload).encode("utf-8"))

    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "secret")
    monkeypatch.setitem(sys.modules, "razorpay", SimpleNamespace(Utility=SimpleNamespace(verify_webhook_signature=lambda *_: True)))

    class CommitFailingSession:
        def __init__(self, inner):
            self._inner = inner
            self.bind = inner.bind
            self._commit_calls = 0

        def __getattr__(self, name):
            return getattr(self._inner, name)

        def in_transaction(self):
            return True

        def begin(self):
            class _NoopContext:
                def __enter__(self_inner):
                    return self

                def __exit__(self_inner, exc_type, exc, tb):
                    return False

            return _NoopContext()

        def commit(self):
            self._commit_calls += 1
            raise OperationalError("COMMIT", {}, RuntimeError("boom"))

        def rollback(self):
            return self._inner.rollback()

        def close(self):
            return self._inner.close()

    def override_db():
        raw = SessionLocal()
        wrapped = CommitFailingSession(raw)
        try:
            yield wrapped
        finally:
            raw.rollback()
            raw.close()

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post(
                "/billing/webhook/razorpay",
                content=json.dumps(payload),
                headers={"x-razorpay-signature": "valid"},
            )
        assert response.status_code >= 500
    finally:
        app.dependency_overrides.pop(get_db, None)

    with SessionLocal() as verify_db:
        subscription = verify_db.query(Subscription).filter(Subscription.org_id == str(seeded["org_id"])).first()
        event = verify_db.query(WebhookEvent).filter(WebhookEvent.razorpay_event_id == expected_event_id).first()

    assert subscription is None or subscription.status != "active"
    assert event is None


def test_server_restart_mid_dispatch():
    init_db()
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=15)
    with SessionLocal() as db:
        db.add(
            OpsAlertEvent(
                ref_id="phase5-recovery",
                org_id="org-recovery",
                org_name="Recovery Org",
                event_type="server_exception",
                severity="HIGH",
                status="DISPATCHING",
                dedup_key="phase5:recovery",
                summary="Dispatch in progress",
                recipient_phone=None,
                meta={},
                provider="meta",
                delivery_status="dispatching",
                created_at=stale_time,
            )
        )
        db.commit()
        recovered = asyncio.run(recover_stale_dispatching_events(db))
        db.commit()

    with SessionLocal() as db:
        row = db.query(OpsAlertEvent).filter(OpsAlertEvent.ref_id == "phase5-recovery").first()

    assert recovered == 1
    assert row is not None
    assert row.status == "FAILED"
    assert row.last_error == "Recovered on restart: process died mid-dispatch"


def test_razorpay_5xx_retried_once_then_fails(monkeypatch):
    attempts = {"count": 0}

    class FakeOrderApi:
        def create(self, payload):
            attempts["count"] += 1
            request = httpx.Request("POST", "https://api.razorpay.com/v1/orders")
            response = httpx.Response(500, request=request)
            raise httpx.HTTPStatusError("boom", request=request, response=response)

    class FakeClient:
        def __init__(self, auth):
            self.order = FakeOrderApi()

    monkeypatch.setattr(razorpay_adapter_module, "razorpay", SimpleNamespace(Client=FakeClient))
    adapter = RazorpayPaymentAdapter(
        settings=SimpleNamespace(
            RAZORPAY_KEY_ID="rzp_test_key",
            RAZORPAY_KEY_SECRET="secret",
            RAZORPAY_WEBHOOK_SECRET="whsec",
        )
    )

    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(adapter.create_order(349900, "INR", "receipt-1", {"plan": "operator"}))

    assert attempts["count"] == 2


def test_past_due_grace_period_expires():
    init_db()
    with SessionLocal() as db:
        org_id = str(uuid4())
        db.add(Organization(org_id=org_id, name="Grace Expiry Org", plan="operator", is_active=True))
        sub = Subscription(
            org_id=org_id,
            user_id=None,
            plan="operator",
            status="past_due",
            grace_period_end_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db.add(sub)
        db.commit()
        changed = enforce_expired_grace_periods(db)
        db.commit()
        db.refresh(sub)

    assert changed == 1
    assert sub.status == "suspended"
