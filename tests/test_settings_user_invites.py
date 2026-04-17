from http import HTTPStatus
from urllib.parse import parse_qs, urlparse

from backend.database import SessionLocal, init_db
from backend.models.pending_registration import PendingRegistration
from backend.models.user import User
from tests.utils import register_user, unique_email


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_admin_invite_requires_email_acceptance_before_user_creation(http_client):
    admin = register_user(http_client, role="admin")
    invited_email = unique_email()

    response = http_client.post(
        "/settings/users/invite",
        headers=_auth_headers(admin["access_token"]),
        json={
            "name": "Invited Supervisor",
            "email": invited_email,
            "role": "supervisor",
            "factory_name": admin["factory_name"],
        },
    )
    assert response.status_code == HTTPStatus.CREATED, response.text
    payload = response.json()
    assert "no account will be created" in payload["message"].lower()
    verification_link = payload.get("verification_link")
    assert verification_link

    with SessionLocal() as db:
        pending = db.query(PendingRegistration).filter(PendingRegistration.email == invited_email.lower()).first()
        assert pending is not None
        assert pending.invited_by_user_id == admin["user_id"]
        assert pending.org_id is not None
        assert db.query(User).filter(User.email == invited_email.lower()).first() is None

    parsed = urlparse(verification_link)
    token = (parse_qs(parsed.query).get("token") or [None])[0]
    assert token

    verify = http_client.post(
        "/auth/email/verify/accept",
        json={"token": token, "password": "StrongPassw0rd!"},
    )
    assert verify.status_code == HTTPStatus.OK, verify.text

    with SessionLocal() as db:
        created_user = db.query(User).filter(User.email == invited_email.lower()).first()
        assert created_user is not None
        assert created_user.role.value == "supervisor"


def test_admin_invite_blocks_email_already_registered_in_other_org(http_client):
    existing_user = register_user(http_client, role="admin", email=unique_email())
    other_org_admin = register_user(http_client, role="admin")

    response = http_client.post(
        "/settings/users/invite",
        headers=_auth_headers(other_org_admin["access_token"]),
        json={
            "name": "Blocked Invite",
            "email": existing_user["email"],
            "role": "operator",
            "factory_name": other_org_admin["factory_name"],
        },
    )
    assert response.status_code == HTTPStatus.CONFLICT, response.text
    assert "another organization" in response.text.lower()


def test_admin_invite_blocks_pending_invite_from_other_org(http_client):
    init_db()
    first_admin = register_user(http_client, role="admin")
    second_admin = register_user(http_client, role="admin")
    invited_email = unique_email()

    first = http_client.post(
        "/settings/users/invite",
        headers=_auth_headers(first_admin["access_token"]),
        json={
            "name": "First Invite",
            "email": invited_email,
            "role": "operator",
            "factory_name": first_admin["factory_name"],
        },
    )
    assert first.status_code == HTTPStatus.CREATED, first.text

    second = http_client.post(
        "/settings/users/invite",
        headers=_auth_headers(second_admin["access_token"]),
        json={
            "name": "Second Invite",
            "email": invited_email,
            "role": "operator",
            "factory_name": second_admin["factory_name"],
        },
    )
    assert second.status_code == HTTPStatus.CONFLICT, second.text
    assert "pending signup or invitation in another organization" in second.text.lower()
