from http import HTTPStatus
from urllib.parse import parse_qs, urlparse

from datetime import datetime, timezone

from backend.auth_security.passwords import hash_password as hash_password_secure
from backend.auth_security.tokens import build_reset_token, expires_at, generate_token, hash_token
from backend.database import SessionLocal
from backend.models.auth_password_reset import AuthPasswordReset
from backend.models.user import User
from backend.models.auth_user import AuthUser
from backend.security import verify_password
from tests.utils import unique_email, unique_factory


def _extract_token(reset_link: str) -> str:
    parsed = urlparse(reset_link)
    params = parse_qs(parsed.query)
    token = params.get("token") or params.get("reset_token")
    assert token, f"Reset link did not contain a token: {reset_link}"
    return token[0]


def _register_verified_legacy_user(http_client) -> dict[str, str]:
    payload = {
        "name": "QA User",
        "email": unique_email(),
        "password": "StrongPassw0rd!",
        "role": "attendance",
        "factory_name": unique_factory(),
        "company_code": None,
        "phone_number": "+910000000000",
    }
    register = http_client.post("/auth/register", json=payload)
    assert register.status_code in (200, 201), register.text
    register_payload = register.json().get("data", register.json())
    verification_link = register_payload.get("verification_link")
    assert verification_link, register_payload
    token = _extract_token(verification_link)
    verify = http_client.post("/auth/email/verify", json={"token": token})
    assert verify.status_code == HTTPStatus.OK, verify.text
    return {"email": payload["email"], "password": payload["password"]}


def test_password_reset_flow(http_client):
    user = _register_verified_legacy_user(http_client)

    forgot = http_client.post("/auth/password/forgot", json={"email": user["email"]})
    assert forgot.status_code == HTTPStatus.OK, forgot.text

    forgot_payload = forgot.json().get("data", forgot.json())
    assert forgot_payload["message"]
    assert forgot_payload.get("reset_link"), forgot_payload

    token = _extract_token(forgot_payload["reset_link"])

    validate = http_client.get("/auth/password/reset/validate", params={"token": token})
    assert validate.status_code == HTTPStatus.OK, validate.text
    validate_payload = validate.json().get("data", validate.json())
    assert validate_payload["valid"] is True

    new_password = "EvenStrongerPassw0rd!"
    reset = http_client.post(
        "/auth/password/reset",
        json={"token": token, "new_password": new_password},
    )
    assert reset.status_code == HTTPStatus.OK, reset.text

    db = SessionLocal()
    try:
        legacy_user = db.query(User).filter(User.email == user["email"]).first()
        assert legacy_user is not None
        assert verify_password(user["password"], legacy_user.password_hash) is False
        assert verify_password(new_password, legacy_user.password_hash) is True
    finally:
        db.close()

    second_use = http_client.post(
        "/auth/password/reset",
        json={"token": token, "new_password": "AnotherStrongPassw0rd!"},
    )
    assert second_use.status_code == HTTPStatus.BAD_REQUEST


def test_legacy_password_reset_syncs_secure_login_password(http_client):
    user = _register_verified_legacy_user(http_client)

    db = SessionLocal()
    try:
        secure_user = db.query(AuthUser).filter(AuthUser.email == user["email"]).first()
        assert secure_user is not None
        secure_user.password_hash = hash_password_secure(user["password"])
        secure_user.is_active = True
        secure_user.is_email_verified = True
        db.commit()
    finally:
        db.close()

    forgot = http_client.post("/auth/password/forgot", json={"email": user["email"]})
    assert forgot.status_code == HTTPStatus.OK, forgot.text
    forgot_payload = forgot.json().get("data", forgot.json())
    token = _extract_token(forgot_payload["reset_link"])

    new_password = "EvenStrongerPassw0rd!"
    reset = http_client.post(
        "/auth/password/reset",
        json={"token": token, "new_password": new_password},
    )
    assert reset.status_code == HTTPStatus.OK, reset.text

    old_login = http_client.post(
        "/auth/v2/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert old_login.status_code == HTTPStatus.UNAUTHORIZED

    new_login = http_client.post(
        "/auth/v2/login",
        json={"email": user["email"], "password": new_password},
    )
    assert new_login.status_code == HTTPStatus.OK, new_login.text


def test_password_reset_creates_missing_secure_user_and_allows_immediate_secure_login(http_client):
    user = _register_verified_legacy_user(http_client)

    db = SessionLocal()
    try:
        secure_user = db.query(AuthUser).filter(AuthUser.email == user["email"]).first()
        if secure_user:
            db.delete(secure_user)
            db.commit()
    finally:
        db.close()

    forgot = http_client.post("/auth/password/forgot", json={"email": user["email"]})
    assert forgot.status_code == HTTPStatus.OK, forgot.text
    forgot_payload = forgot.json().get("data", forgot.json())
    token = _extract_token(forgot_payload["reset_link"])

    new_password = "EvenStrongerPassw0rd!Reset2"
    reset = http_client.post(
        "/auth/password/reset",
        json={"token": token, "new_password": new_password},
    )
    assert reset.status_code == HTTPStatus.OK, reset.text

    db = SessionLocal()
    try:
        secure_user = db.query(AuthUser).filter(AuthUser.email == user["email"]).first()
        assert secure_user is not None
        assert secure_user.is_active is True
        assert secure_user.is_email_verified is True
    finally:
        db.close()

    new_login = http_client.post(
        "/auth/v2/login",
        json={"email": user["email"], "password": new_password},
    )
    assert new_login.status_code == HTTPStatus.OK, new_login.text


def test_verified_registration_creates_secure_user_for_v2_login(http_client):
    user = _register_verified_legacy_user(http_client)

    login = http_client.post(
        "/auth/v2/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert login.status_code == HTTPStatus.OK, login.text
    payload = login.json().get("data", login.json())
    assert payload["user"]["email"] == user["email"]
    assert payload["user"]["role_revision"] >= 0
    assert "access_token" in payload
    assert "refresh_token" in payload


def test_secure_password_reset_syncs_legacy_user_password(http_client):
    user = _register_verified_legacy_user(http_client)

    db = SessionLocal()
    try:
        secure_user = db.query(AuthUser).filter(AuthUser.email == user["email"]).first()
        assert secure_user is not None
        secure_user.password_hash = hash_password_secure(user["password"])
        secure_user.is_active = True
        secure_user.is_email_verified = True
        raw_token = generate_token(32)
        db.add(
            AuthPasswordReset(
                auth_user_id=secure_user.id,
                token_hash=hash_token(raw_token),
                expires_at=expires_at(30),
            )
        )
        db.commit()
        signed_token = build_reset_token({"uid": secure_user.id, "token": raw_token})
    finally:
        db.close()

    reset = http_client.post(
        "/auth/v2/password/reset",
        json={"token": signed_token, "new_password": "EvenStrongerPassw0rd!Secure"},
    )
    assert reset.status_code == HTTPStatus.OK, reset.text

    db = SessionLocal()
    try:
        legacy_user = db.query(User).filter(User.email == user["email"]).first()
        secure_user = db.query(AuthUser).filter(AuthUser.email == user["email"]).first()
        assert legacy_user is not None
        assert secure_user is not None
        assert verify_password(user["password"], legacy_user.password_hash) is False
        assert verify_password("EvenStrongerPassw0rd!Secure", legacy_user.password_hash) is True
        password_changed_at = (
            secure_user.password_changed_at
            if secure_user.password_changed_at.tzinfo is not None
            else secure_user.password_changed_at.replace(tzinfo=timezone.utc)
        )
        assert password_changed_at <= datetime.now(timezone.utc)
    finally:
        db.close()
