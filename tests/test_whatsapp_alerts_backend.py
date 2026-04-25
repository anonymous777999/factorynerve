from __future__ import annotations

import time
from collections import deque
from http import HTTPStatus

from fastapi.testclient import TestClient
import pytest

from backend.database import SessionLocal, engine, init_db
from backend.main import app
from backend.models.alert_log import AlertLog, AlertLogStatus
from backend.models.alert_preference import AlertPreference
from backend.models.alert_recipient import AlertRecipient
from backend.routers.whatsapp_standalone import get_whatsapp_sender
from backend.services.whatsapp_sender import WhatsAppSendResult

class FakeWhatsAppSender:
    provider_name = "fake"

    def __init__(self, *, results: list[WhatsAppSendResult] | None = None) -> None:
        self.results = deque(results or [])
        self.sent: list[tuple[str, str]] = []

    def validate_config(self) -> None:
        return None

    async def send_whatsapp_message(self, to: str, message: str) -> WhatsAppSendResult:
        self.sent.append((to, message))
        if self.results:
            return self.results.popleft()
        return WhatsAppSendResult(
            success=True,
            provider=self.provider_name,
            retryable=False,
            provider_message_id=f"msg-{len(self.sent)}",
            response_data={"status": "accepted"},
        )


def _reset_alert_tables() -> None:
    AlertLog.__table__.drop(bind=engine, checkfirst=True)
    AlertPreference.__table__.drop(bind=engine, checkfirst=True)
    AlertRecipient.__table__.drop(bind=engine, checkfirst=True)
    AlertRecipient.__table__.create(bind=engine, checkfirst=True)
    AlertPreference.__table__.create(bind=engine, checkfirst=True)
    AlertLog.__table__.create(bind=engine, checkfirst=True)


def _wait_for_status(recipient_phone: str, expected_status: AlertLogStatus, timeout_seconds: float = 2.5) -> AlertLog:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        with SessionLocal() as db:
            row = (
                db.query(AlertLog)
                .join(AlertRecipient, AlertRecipient.id == AlertLog.recipient_id)
                .filter(AlertRecipient.phone_e164 == recipient_phone)
                .order_by(AlertLog.id.desc())
                .first()
            )
            if row is not None and row.status == expected_status:
                return row
        time.sleep(0.05)
    raise AssertionError(f"Alert log for {recipient_phone} did not reach status {expected_status}.")


@pytest.fixture
def whatsapp_client():
    init_db()
    _reset_alert_tables()
    sender = FakeWhatsAppSender()
    app.dependency_overrides[get_whatsapp_sender] = lambda: sender
    with TestClient(app) as client:
        yield client, sender
    app.dependency_overrides.clear()
    _reset_alert_tables()


def test_can_create_list_and_toggle_recipients(whatsapp_client):
    client, _sender = whatsapp_client

    created = client.post(
        "/recipients",
        json={
            "name": "Plant Manager",
            "phone_e164": "+91 98765 43210",
            "alert_types": ["critical"],
        },
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    payload = created.json()
    assert payload["phone_e164"] == "+919876543210"
    assert payload["preferences"][0]["alert_type"] == "critical"

    listed = client.get("/recipients")
    assert listed.status_code == HTTPStatus.OK, listed.text
    assert len(listed.json()) == 1

    toggled = client.patch(f"/recipients/{payload['id']}", json={"is_active": False})
    assert toggled.status_code == HTTPStatus.OK, toggled.text
    assert toggled.json()["is_active"] is False


def test_recipients_reject_duplicates(whatsapp_client):
    client, _sender = whatsapp_client

    first = client.post("/recipients", json={"name": "Ops", "phone_e164": "+919999999999"})
    duplicate = client.post("/recipients", json={"name": "Ops 2", "phone_e164": "919999999999"})

    assert first.status_code == HTTPStatus.CREATED, first.text
    assert duplicate.status_code == HTTPStatus.CONFLICT, duplicate.text


def test_send_alert_queues_logs_for_matching_active_recipients_only(whatsapp_client):
    client, sender = whatsapp_client

    create_one = client.post(
        "/recipients",
        json={
            "name": "Critical Lead",
            "phone_e164": "+919111111111",
            "alert_types": ["critical"],
        },
    )
    assert create_one.status_code == HTTPStatus.CREATED, create_one.text

    create_two = client.post(
        "/recipients",
        json={
            "name": "Warnings Only",
            "phone_e164": "+919222222222",
            "alert_types": ["warning"],
        },
    )
    assert create_two.status_code == HTTPStatus.CREATED, create_two.text

    send = client.post("/alerts/send", json={"alert_type": "critical", "message": "Machine 4 has stopped."})
    assert send.status_code == HTTPStatus.ACCEPTED, send.text
    assert send.json()["queued_logs"] == 1

    row = _wait_for_status("+919111111111", AlertLogStatus.SENT)
    assert row.recipient_id is not None
    assert len(sender.sent) == 1
    assert sender.sent[0][0] == "+919111111111"


def test_send_alert_retries_temporary_failures_and_logs_attempt_count():
    init_db()
    _reset_alert_tables()
    sender = FakeWhatsAppSender(
        results=[
            WhatsAppSendResult(success=False, provider="fake", retryable=True, error="temporary failure"),
            WhatsAppSendResult(success=True, provider="fake", retryable=False, provider_message_id="retry-ok"),
        ]
    )
    app.dependency_overrides[get_whatsapp_sender] = lambda: sender
    with TestClient(app) as client:
        created = client.post("/recipients", json={"name": "Retry", "phone_e164": "+918888888888"})
        assert created.status_code == HTTPStatus.CREATED, created.text

        send = client.post("/alerts/send", json={"alert_type": "critical", "message": "Retryable provider outage."})
        assert send.status_code == HTTPStatus.ACCEPTED, send.text

    row = _wait_for_status("+918888888888", AlertLogStatus.SENT)
    assert row.attempt_count == 2
    app.dependency_overrides.clear()
    _reset_alert_tables()
