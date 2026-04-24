from __future__ import annotations

from http import HTTPStatus

from backend.database import SessionLocal
from backend.models.admin_alert_recipient import AdminAlertRecipient
from backend.models.phone_verification import PhoneVerificationStatus
from backend.models.user import User
from tests.utils import register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _mark_user_phone_verified(*, user_id: int, phone_e164: str) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        assert user is not None
        user.phone_number = phone_e164
        user.phone_e164 = phone_e164
        user.phone_verification_status = PhoneVerificationStatus.VERIFIED
        db.add(user)
        db.commit()


def test_admin_can_manage_alert_recipients(http_client):
    admin = register_user(http_client, role="admin")
    _mark_user_phone_verified(user_id=admin["user_id"], phone_e164="+919876543210")
    headers = _auth_headers(admin["access_token"])

    created = http_client.post(
        "/settings/alert-recipients",
        json={"phone_number": "+91 98765 43210", "user_id": admin["user_id"]},
        headers=headers,
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    recipient = created.json()
    assert recipient["phone_number"] == "+919876543210"
    assert recipient["is_active"] is True

    listed = http_client.get("/settings/alert-recipients", headers=headers)
    assert listed.status_code == HTTPStatus.OK, listed.text
    payload = listed.json()
    assert payload["active_count"] == 1
    assert payload["limit"] == 2
    assert len(payload["recipients"]) == 1

    updated = http_client.patch(
        f"/settings/alert-recipients/{recipient['id']}",
        json={"is_active": False},
        headers=headers,
    )
    assert updated.status_code == HTTPStatus.OK, updated.text
    assert updated.json()["is_active"] is False

    deleted = http_client.delete(f"/settings/alert-recipients/{recipient['id']}", headers=headers)
    assert deleted.status_code == HTTPStatus.NO_CONTENT, deleted.text


def test_non_admin_cannot_manage_alert_recipients(http_client):
    manager = register_user(http_client, role="manager")
    headers = _auth_headers(manager["access_token"])

    response = http_client.get("/settings/alert-recipients", headers=headers)

    assert response.status_code == HTTPStatus.FORBIDDEN, response.text


def test_free_plan_enforces_two_active_recipients(http_client):
    admin = register_user(http_client, role="admin")
    _mark_user_phone_verified(user_id=admin["user_id"], phone_e164="+911111111111")
    headers = _auth_headers(admin["access_token"])

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == admin["user_id"]).first()
        assert user is not None

        db.add_all(
            [
                AdminAlertRecipient(
                    org_id=user.org_id,
                    user_id=user.id,
                    phone_number="+911111111111",
                    phone_e164="+911111111111",
                    verification_status=PhoneVerificationStatus.VERIFIED.value,
                    is_active=True,
                ),
                AdminAlertRecipient(
                    org_id=user.org_id,
                    phone_number="+922222222222",
                    phone_e164="+922222222222",
                    verification_status=PhoneVerificationStatus.VERIFIED.value,
                    is_active=True,
                ),
            ]
        )
        db.commit()

    blocked = http_client.post(
        "/settings/alert-recipients",
        json={"phone_number": "+919876543212", "user_id": admin["user_id"]},
        headers=headers,
    )

    assert blocked.status_code == HTTPStatus.FORBIDDEN, blocked.text
    assert "max active recipients: 2" in blocked.text.lower()


def test_alert_recipients_reject_duplicates(http_client):
    admin = register_user(http_client, role="admin")
    _mark_user_phone_verified(user_id=admin["user_id"], phone_e164="+919999999999")
    headers = _auth_headers(admin["access_token"])

    first = http_client.post(
        "/settings/alert-recipients",
        json={"phone_number": "+919999999999", "user_id": admin["user_id"]},
        headers=headers,
    )
    duplicate = http_client.post(
        "/settings/alert-recipients",
        json={"phone_number": "919999999999", "user_id": admin["user_id"]},
        headers=headers,
    )

    assert first.status_code == HTTPStatus.CREATED, first.text
    assert duplicate.status_code == HTTPStatus.CONFLICT, duplicate.text


def test_alert_recipient_preferences_use_strict_missing_vs_empty_rules(http_client):
    admin = register_user(http_client, role="admin")
    _mark_user_phone_verified(user_id=admin["user_id"], phone_e164="+919111111111")
    headers = _auth_headers(admin["access_token"])

    created = http_client.post(
        "/settings/alert-recipients",
        json={"phone_number": "+919111111111", "user_id": admin["user_id"]},
        headers=headers,
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    recipient = created.json()
    assert recipient["event_types"] is None
    assert recipient["event_types_mode"] == "all"
    assert recipient["severity_levels"] is None
    assert recipient["severity_levels_mode"] == "all"

    updated = http_client.patch(
        f"/settings/alert-recipients/{recipient['id']}",
        json={"event_types": [], "severity_levels": []},
        headers=headers,
    )
    assert updated.status_code == HTTPStatus.OK, updated.text
    payload = updated.json()
    assert payload["event_types"] == []
    assert payload["event_types_mode"] == "none"
    assert payload["severity_levels"] == []
    assert payload["severity_levels_mode"] == "none"

    listed = http_client.get("/settings/alert-recipients", headers=headers)
    assert listed.status_code == HTTPStatus.OK, listed.text
    rules = listed.json()["preference_rules"]
    assert "missing means all" in rules["event_types"]
    assert "empty list means no" in rules["severity_levels"]
