from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import uuid

from fastapi.testclient import TestClient

from backend.database import SessionLocal, init_db
from backend.main import app
from backend.models.ops_alert_event import OpsAlertEvent
from backend.services.ops_alerts.service import apply_whatsapp_delivery_update, recover_stale_dispatching_events
from backend.routers import whatsapp_webhook


def _sign_payload(payload: bytes, *, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _status_payload(*, message_id: str, status: str, timestamp: int, recipient_id: str, errors: list[dict] | None = None) -> dict:
    status_item = {
        "id": message_id,
        "status": status,
        "timestamp": str(timestamp),
        "recipient_id": recipient_id,
    }
    if errors is not None:
        status_item["errors"] = errors
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "waba-test",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "statuses": [status_item],
                        },
                    }
                ],
            }
        ],
    }


def _current_epoch(offset_seconds: int = 0) -> int:
    return int(datetime.now(timezone.utc).timestamp()) + offset_seconds


def _seed_alert_delivery(*, provider_message_id: str, ref_id: str | None = None, created_at: datetime | None = None) -> str:
    init_db()
    resolved_ref_id = ref_id or f"wh-{uuid.uuid4().hex[:8]}"
    timestamp = created_at or datetime.now(timezone.utc)
    with SessionLocal() as db:
        db.add(
            OpsAlertEvent(
                ref_id=resolved_ref_id,
                org_id="org-webhook",
                org_name="Webhook Org",
                event_type="server_exception",
                severity="HIGH",
                status="dispatching",
                dedup_key=f"dedup:{resolved_ref_id}:root",
                summary="Webhook root row",
                recipient_phone=None,
                meta={},
                provider="meta",
                delivery_status="dispatching",
                created_at=timestamp,
            )
        )
        db.add(
            OpsAlertEvent(
                ref_id=resolved_ref_id,
                org_id="org-webhook",
                org_name="Webhook Org",
                event_type="server_exception",
                severity="HIGH",
                status="dispatching",
                dedup_key=f"dedup:{resolved_ref_id}:recipient",
                summary="Webhook recipient row",
                recipient_phone="whatsapp:+919999999999",
                meta={"dispatch": {"provider_message_id": provider_message_id}},
                provider="meta",
                delivery_status="dispatching",
                provider_message_id=provider_message_id,
                created_at=timestamp,
            )
        )
        db.commit()
    return resolved_ref_id


def _fetch_rows(*, ref_id: str) -> tuple[OpsAlertEvent, OpsAlertEvent]:
    with SessionLocal() as db:
        rows = (
            db.query(OpsAlertEvent)
            .filter(OpsAlertEvent.ref_id == ref_id)
            .order_by(OpsAlertEvent.recipient_phone.asc().nullsfirst(), OpsAlertEvent.id.asc())
            .all()
        )
        root = next(row for row in rows if row.recipient_phone is None)
        recipient = next(row for row in rows if row.recipient_phone is not None)
        db.expunge(root)
        db.expunge(recipient)
        return root, recipient


def test_webhook_verification_success(monkeypatch):
    monkeypatch.setenv("META_WA_WEBHOOK_VERIFY_TOKEN", "verify-token")

    with TestClient(app) as client:
        response = client.get(
            "/webhooks/whatsapp",
            params={"hub.mode": "subscribe", "hub.verify_token": "verify-token", "hub.challenge": "12345"},
        )

    assert response.status_code == 200
    assert response.text == "12345"


def test_webhook_verification_failure(monkeypatch):
    monkeypatch.setenv("META_WA_WEBHOOK_VERIFY_TOKEN", "verify-token")

    with TestClient(app) as client:
        response = client.get(
            "/webhooks/whatsapp",
            params={"hub.mode": "subscribe", "hub.verify_token": "wrong-token", "hub.challenge": "12345"},
        )

    assert response.status_code == 403


def test_webhook_verification_missing_verify_token(monkeypatch):
    monkeypatch.delenv("META_WA_WEBHOOK_VERIFY_TOKEN", raising=False)

    with TestClient(app) as client:
        response = client.get(
            "/webhooks/whatsapp",
            params={"hub.mode": "subscribe", "hub.verify_token": "anything", "hub.challenge": "12345"},
        )

    assert response.status_code == 403


def test_webhook_valid_signature_updates_delivered(monkeypatch):
    secret = "meta-secret"
    monkeypatch.setenv("META_WA_APP_SECRET", secret)
    with whatsapp_webhook._WEBHOOK_EVENT_CACHE_LOCK:
        whatsapp_webhook._WEBHOOK_EVENT_CACHE.clear()
    ref_id = _seed_alert_delivery(provider_message_id="wamid.delivered.1")
    payload_dict = _status_payload(
        message_id="wamid.delivered.1",
        status="delivered",
        timestamp=_current_epoch(60),
        recipient_id="919999999999",
    )
    body = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")

    with TestClient(app) as client:
        response = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={"X-Hub-Signature-256": _sign_payload(body, secret=secret)},
        )

    assert response.status_code == 200
    assert response.json()["processed"] == 1
    root, recipient = _fetch_rows(ref_id=ref_id)
    assert recipient.delivery_status == "delivered"
    assert recipient.delivered_at is not None
    assert root.delivery_status == "delivered"


def test_webhook_invalid_signature_rejected(monkeypatch):
    secret = "meta-secret"
    monkeypatch.setenv("META_WA_APP_SECRET", secret)
    ref_id = _seed_alert_delivery(provider_message_id="wamid.invalid.1")
    payload_dict = _status_payload(
        message_id="wamid.invalid.1",
        status="delivered",
        timestamp=_current_epoch(60),
        recipient_id="919999999999",
    )
    body = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")

    with TestClient(app) as client:
        response = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={"X-Hub-Signature-256": _sign_payload(body, secret="wrong-secret")},
        )

    assert response.status_code == 401
    _, recipient = _fetch_rows(ref_id=ref_id)
    assert recipient.delivery_status == "dispatching"


def test_webhook_malformed_json_returns_safe_400(monkeypatch):
    secret = "meta-secret"
    monkeypatch.setenv("META_WA_APP_SECRET", secret)
    body = b"{bad-json"

    with TestClient(app) as client:
        response = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={"X-Hub-Signature-256": _sign_payload(body, secret=secret)},
        )

    assert response.status_code == 400


def test_webhook_duplicate_events_are_suppressed(monkeypatch):
    secret = "meta-secret"
    monkeypatch.setenv("META_WA_APP_SECRET", secret)
    with whatsapp_webhook._WEBHOOK_EVENT_CACHE_LOCK:
        whatsapp_webhook._WEBHOOK_EVENT_CACHE.clear()
    ref_id = _seed_alert_delivery(provider_message_id="wamid.dup.1")
    payload_dict = _status_payload(
        message_id="wamid.dup.1",
        status="delivered",
        timestamp=_current_epoch(60),
        recipient_id="919999999999",
    )
    body = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")
    signature = _sign_payload(body, secret=secret)

    with TestClient(app) as client:
        first = client.post("/webhooks/whatsapp", content=body, headers={"X-Hub-Signature-256": signature})
        second = client.post("/webhooks/whatsapp", content=body, headers={"X-Hub-Signature-256": signature})

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["duplicates"] == 1
    root, recipient = _fetch_rows(ref_id=ref_id)
    assert recipient.delivery_status == "delivered"
    assert root.delivery_status == "delivered"


def test_webhook_read_transition_updates_existing_delivery():
    ref_id = _seed_alert_delivery(provider_message_id="wamid.read.1")
    delivered = apply_whatsapp_delivery_update(
        provider_message_id="wamid.read.1",
        delivery_status="delivered",
        status_timestamp=datetime.now(timezone.utc) + timedelta(minutes=1),
        recipient_phone="+919999999999",
        payload_excerpt={"status": "delivered"},
    )
    read = apply_whatsapp_delivery_update(
        provider_message_id="wamid.read.1",
        delivery_status="read",
        status_timestamp=datetime.now(timezone.utc) + timedelta(minutes=2),
        recipient_phone="+919999999999",
        payload_excerpt={"status": "read"},
    )

    assert delivered["updated"] == 1
    assert read["updated"] == 1
    root, recipient = _fetch_rows(ref_id=ref_id)
    assert recipient.delivery_status == "read"
    assert recipient.read_at is not None
    assert root.delivery_status == "read"


def test_webhook_failed_transition_preserves_failure_metadata(monkeypatch):
    secret = "meta-secret"
    monkeypatch.setenv("META_WA_APP_SECRET", secret)
    ref_id = _seed_alert_delivery(provider_message_id="wamid.failed.1")
    payload_dict = _status_payload(
        message_id="wamid.failed.1",
        status="failed",
        timestamp=_current_epoch(60),
        recipient_id="919999999999",
        errors=[
            {
                "code": 131026,
                "title": "Message Undeliverable",
                "message": "Recipient phone number is not a WhatsApp phone number.",
                "error_data": {"details": "unsupported recipient"},
            }
        ],
    )
    body = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")

    with TestClient(app) as client:
        response = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={"X-Hub-Signature-256": _sign_payload(body, secret=secret)},
        )

    assert response.status_code == 200
    _, recipient = _fetch_rows(ref_id=ref_id)
    assert recipient.delivery_status == "failed"
    assert recipient.provider_error_code == "131026"
    assert recipient.provider_error_title == "Message Undeliverable"
    assert recipient.last_error == "unsupported recipient"


def test_webhook_stale_state_rejection_keeps_newer_status():
    ref_id = _seed_alert_delivery(provider_message_id="wamid.stale.1")
    apply_whatsapp_delivery_update(
        provider_message_id="wamid.stale.1",
        delivery_status="read",
        status_timestamp=datetime.now(timezone.utc) + timedelta(minutes=2),
        recipient_phone="+919999999999",
        payload_excerpt={"status": "read"},
    )

    result = apply_whatsapp_delivery_update(
        provider_message_id="wamid.stale.1",
        delivery_status="delivered",
        status_timestamp=datetime.now(timezone.utc) + timedelta(minutes=1),
        recipient_phone="+919999999999",
        payload_excerpt={"status": "delivered"},
    )

    assert result["updated"] == 0
    assert result["reason"] == "stale"
    root, recipient = _fetch_rows(ref_id=ref_id)
    assert recipient.delivery_status == "read"
    assert root.delivery_status == "read"


def test_startup_recovery_sweep_resets_stale_dispatching_rows():
    old_timestamp = datetime.now(timezone.utc) - timedelta(hours=2)
    ref_id = _seed_alert_delivery(
        provider_message_id="wamid.recovery.1",
        ref_id="recovery-test",
        created_at=old_timestamp,
    )

    recovered = recover_stale_dispatching_events(stale_after_seconds=60)

    assert recovered >= 2
    root, recipient = _fetch_rows(ref_id=ref_id)
    assert root.delivery_status == "pending"
    assert recipient.delivery_status == "pending"
    assert recipient.last_error == "startup_recovery_reset_from_dispatching"


def test_webhook_ignores_unknown_payload_shapes_without_crashing(monkeypatch):
    secret = "meta-secret"
    monkeypatch.setenv("META_WA_APP_SECRET", secret)
    body = json.dumps(
        {
            "object": "whatsapp_business_account",
            "entry": [{"changes": [{"field": "messages", "value": {"messages": [{"from": "919999999999"}]}}]}],
        },
        separators=(",", ":"),
    ).encode("utf-8")

    with TestClient(app) as client:
        response = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={"X-Hub-Signature-256": _sign_payload(body, secret=secret)},
        )

    assert response.status_code == 200
    assert response.json()["processed"] == 0
