from __future__ import annotations

from fastapi.testclient import TestClient
import fakeredis
import pytest

from backend.database import SessionLocal, init_db
from backend.main import app
from backend.models.admin_alert_recipient import AdminAlertRecipient
from backend.models.organization import Organization
from backend.models.phone_verification import PhoneVerificationStatus
from backend.models.user import User
from backend.routers.alert_recipients import get_otp_service as get_alert_recipient_otp_service
from backend.routers.phone_auth import get_otp_service as get_phone_otp_service
from backend.services.ops_alerts.recipients import resolve_alert_delivery_targets
from backend.services.ops_alerts.types import AlertCandidate, AlertEventType, AlertSeverity
from backend.services.otp_service import OTPService
from backend.services.rate_limit_service import RateLimitService
from backend.services.sms_service import MockSMSProvider
from tests.utils import register_user


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _build_override_service() -> tuple[OTPService, MockSMSProvider]:
    provider = MockSMSProvider()
    service = OTPService(
        sms_provider=provider,
        rate_limits=RateLimitService(client=fakeredis.FakeStrictRedis(decode_responses=True)),
    )
    return service, provider


@pytest.fixture
def otp_client():
    init_db()
    service, provider = _build_override_service()
    app.dependency_overrides[get_phone_otp_service] = lambda: service
    app.dependency_overrides[get_alert_recipient_otp_service] = lambda: service
    with TestClient(app) as client:
        yield client, provider
    app.dependency_overrides.clear()


def _mark_user_verified(*, user_id: int, phone_e164: str) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        assert user is not None
        user.phone_number = phone_e164
        user.phone_e164 = phone_e164
        user.phone_verification_status = PhoneVerificationStatus.VERIFIED
        db.add(user)
        db.commit()


def test_user_phone_verification_happy_path(otp_client):
    client, provider = otp_client
    user = register_user(client, role="admin")
    headers = _headers(user["access_token"])
    phone = "+919876543220"

    started = client.post("/auth/phone/start-verification", json={"phone": phone}, headers=headers)
    assert started.status_code == 200, started.text
    otp_code = provider.sent[phone]

    confirmed = client.post(
        "/auth/phone/confirm-verification",
        json={"phone": phone, "otp": otp_code},
        headers=headers,
    )
    assert confirmed.status_code == 200, confirmed.text

    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user["user_id"]).first()
        assert db_user is not None
        assert db_user.phone_e164 == phone
        assert db_user.phone_verification_status == PhoneVerificationStatus.VERIFIED


def test_alert_recipient_verification_happy_path(otp_client):
    client, provider = otp_client
    admin = register_user(client, role="admin")
    headers = _headers(admin["access_token"])

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == admin["user_id"]).first()
        assert user is not None
        recipient = AdminAlertRecipient(
            org_id=user.org_id,
            phone_number="+919876543221",
            phone_e164="+919876543221",
            verification_status=PhoneVerificationStatus.PENDING.value,
            is_active=False,
        )
        db.add(recipient)
        db.commit()
        db.refresh(recipient)
        recipient_id = recipient.id

    started = client.post(
        f"/settings/alert-recipients/{recipient_id}/start-verification",
        json={"phone": "+919876543221"},
        headers=headers,
    )
    assert started.status_code == 200, started.text
    otp_code = provider.sent["+919876543221"]

    confirmed = client.post(
        f"/settings/alert-recipients/{recipient_id}/confirm-verification",
        json={"phone": "+919876543221", "otp": otp_code},
        headers=headers,
    )
    assert confirmed.status_code == 200, confirmed.text

    with SessionLocal() as db:
        recipient = db.query(AdminAlertRecipient).filter(AdminAlertRecipient.id == recipient_id).first()
        assert recipient is not None
        assert recipient.verification_status == PhoneVerificationStatus.VERIFIED.value
        assert recipient.verified_at is not None


def test_alert_delivery_skips_unverified_recipient():
    init_db()
    with SessionLocal() as db:
        org = Organization(org_id="org-unverified", name="Unverified Org", plan="free")
        db.add(org)
        db.commit()
        recipient = AdminAlertRecipient(
            org_id=org.org_id,
            phone_number="+919876543222",
            phone_e164="+919876543222",
            verification_status=PhoneVerificationStatus.PENDING.value,
            is_active=True,
        )
        db.add(recipient)
        db.commit()
        targets = resolve_alert_delivery_targets(
            db,
            org_id=org.org_id,
            candidate=AlertCandidate(
                event_type=AlertEventType.OCR_FAILURE_SPIKE,
                severity=AlertSeverity.HIGH,
                summary="OCR failed.",
                dedup_key="ocr:unverified",
                org_id=org.org_id,
            ),
        )

    assert targets == []


def test_profile_phone_change_resets_verification_status(otp_client):
    client, _provider = otp_client
    user = register_user(client, role="admin")
    _mark_user_verified(user_id=user["user_id"], phone_e164="+919876543223")
    headers = _headers(user["access_token"])

    response = client.put(
        "/auth/profile",
        headers=headers,
        json={"phone_number": "+919876543224"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["phone_number"] == "+919876543224"
    assert payload["phone_verification_status"] == PhoneVerificationStatus.PENDING.value
    assert payload["phone_verified_at"] is None
