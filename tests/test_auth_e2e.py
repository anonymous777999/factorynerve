from http import HTTPStatus
from urllib.parse import parse_qs, urlparse

import pytest
from starlette.requests import Request

from backend.database import SessionLocal, init_db
from backend.models.pending_registration import PendingRegistration
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.routers import auth as auth_router
from backend.services.auth_service import get_or_create_google_user
from tests.utils import register_user, unique_email, unique_factory


def test_cookie_session_flow(http_client, base_url):
    user = register_user(http_client, use_cookies=True)

    csrf = http_client.cookies.get("dpr_csrf")
    assert csrf, "CSRF cookie not set on login/register."

    access_cookie = None
    for cookie in http_client.cookies.jar:
        if cookie.name == "dpr_access":
            access_cookie = cookie
            break
    assert access_cookie is not None, "Access cookie not set. Did backend receive X-Use-Cookies?"
    if access_cookie.secure and base_url.startswith("http://"):
        pytest.skip("Secure cookies are not sent over http. Set JWT_COOKIE_SECURE=0 for local dev.")

    me = http_client.get("/auth/me")
    assert me.status_code == HTTPStatus.OK, me.text

    logout = http_client.post("/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logout.status_code == HTTPStatus.OK, logout.text

    assert http_client.cookies.get("dpr_access") is None
    assert http_client.cookies.get("dpr_refresh") is None

    after = http_client.get("/auth/me")
    assert after.status_code == HTTPStatus.UNAUTHORIZED


def test_safe_get_restores_missing_csrf_cookie_for_cookie_session(http_client, base_url):
    register_user(http_client, use_cookies=True)

    csrf_cookie = None
    for cookie in http_client.cookies.jar:
        if cookie.name == "dpr_csrf":
            csrf_cookie = cookie
            break
    assert csrf_cookie is not None, "CSRF cookie not set on login/register."

    if csrf_cookie.secure and base_url.startswith("http://"):
        pytest.skip("Secure cookies are not sent over http. Set JWT_COOKIE_SECURE=0 for local dev.")

    http_client.cookies.jar.clear(domain=csrf_cookie.domain, path=csrf_cookie.path, name=csrf_cookie.name)
    assert http_client.cookies.get("dpr_csrf") is None

    me = http_client.get("/auth/me")
    assert me.status_code == HTTPStatus.OK, me.text
    restored = http_client.cookies.get("dpr_csrf")
    assert restored, "Expected GET /auth/me to restore missing CSRF cookie."

    logout = http_client.post("/auth/logout", headers={"X-CSRF-Token": restored})
    assert logout.status_code == HTTPStatus.OK, logout.text


def test_safe_get_exposes_csrf_header_for_cookie_session(http_client, base_url):
    register_user(http_client, use_cookies=True)

    csrf_cookie = None
    for cookie in http_client.cookies.jar:
        if cookie.name == "dpr_csrf":
            csrf_cookie = cookie
            break
    assert csrf_cookie is not None, "CSRF cookie not set on login/register."

    if csrf_cookie.secure and base_url.startswith("http://"):
        pytest.skip("Secure cookies are not sent over http. Set JWT_COOKIE_SECURE=0 for local dev.")

    me = http_client.get("/auth/me")
    assert me.status_code == HTTPStatus.OK, me.text
    assert me.headers.get("X-CSRF-Token") == http_client.cookies.get("dpr_csrf")


def test_session_timeout_behaves_like_unauthorized(http_client):
    user = register_user(http_client)
    bad = http_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {user['access_token']}invalid"},
    )
    assert bad.status_code == HTTPStatus.UNAUTHORIZED


def test_public_registration_bootstraps_first_workspace_creator_as_admin(http_client):
    email = unique_email()
    password = "StrongPassw0rd!"
    response = http_client.post(
        "/auth/register",
        json={
            "name": "Workspace Creator",
            "email": email,
            "password": password,
            "role": "operator",
            "factory_name": unique_factory(),
            "phone_number": "+910000000000",
        },
    )

    assert response.status_code == HTTPStatus.CREATED, response.text
    payload = response.json()
    assert payload["verification_required"] is True
    assert payload.get("verification_link")
    token = (parse_qs(urlparse(payload["verification_link"]).query).get("token") or [""])[0]
    verify = http_client.post("/auth/email/verify", json={"token": token})
    assert verify.status_code == HTTPStatus.OK, verify.text
    login = http_client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == HTTPStatus.OK, login.text
    assert login.json()["user"]["role"] == "admin"
    assert login.json()["organization"]["accessible_factories"] == 1


def test_public_registration_blocks_high_roles_for_existing_workspace(http_client):
    admin = register_user(http_client, role="admin")

    response = http_client.post(
        "/auth/register",
        json={
            "name": "Joined Manager",
            "email": unique_email(),
            "password": "StrongPassw0rd!",
            "role": "manager",
            "factory_name": admin["factory_name"],
            "company_code": admin["company_code"],
            "phone_number": "+910000000000",
        },
    )

    assert response.status_code == HTTPStatus.FORBIDDEN, response.text
    assert "attendance accounts" in response.text.lower()


def test_public_registration_defaults_existing_workspace_users_to_attendance_role(http_client):
    admin = register_user(http_client, role="admin")
    email = unique_email()
    password = "StrongPassw0rd!"

    response = http_client.post(
        "/auth/register",
        json={
            "name": "Joined Worker",
            "email": email,
            "password": password,
            "role": "operator",
            "factory_name": admin["factory_name"],
            "company_code": admin["company_code"],
            "phone_number": "+910000000000",
        },
    )

    assert response.status_code == HTTPStatus.CREATED, response.text
    payload = response.json()
    token = (parse_qs(urlparse(payload["verification_link"]).query).get("token") or [""])[0]
    verify = http_client.post("/auth/email/verify", json={"token": token})
    assert verify.status_code == HTTPStatus.OK, verify.text
    login = http_client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == HTTPStatus.OK, login.text
    assert login.json()["user"]["role"] == "attendance"


def test_local_registration_requires_email_verification_before_login(http_client):
    email = unique_email()
    password = "StrongPassw0rd!"

    registration = http_client.post(
        "/auth/register",
        json={
            "name": "Needs Verification",
            "email": email,
            "password": password,
            "role": "attendance",
            "factory_name": unique_factory(),
            "phone_number": "+910000000000",
        },
    )

    assert registration.status_code == HTTPStatus.CREATED, registration.text
    verification_link = registration.json()["verification_link"]

    blocked = http_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert blocked.status_code == HTTPStatus.FORBIDDEN, blocked.text
    assert "verify your email" in blocked.text.lower()

    token = (parse_qs(urlparse(verification_link).query).get("token") or [""])[0]
    verify = http_client.post("/auth/email/verify", json={"token": token})
    assert verify.status_code == HTTPStatus.OK, verify.text

    login = http_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == HTTPStatus.OK, login.text


def test_register_email_mode_sends_verification_without_existing_user(monkeypatch):
    init_db()
    email = unique_email()
    captured: dict[str, str] = {}

    def fake_send_auth_email(*, subject: str, to_email: str, body: str, context: str) -> bool:
        captured["subject"] = subject
        captured["to_email"] = to_email
        captured["body"] = body
        captured["context"] = context
        return True

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/auth/register",
        "headers": [(b"origin", b"http://127.0.0.1:3000")],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8765),
        "scheme": "http",
        "query_string": b"",
    }

    monkeypatch.setenv("EMAIL_VERIFICATION_EXPOSE_LINK", "0")
    monkeypatch.setattr(auth_router, "_send_auth_email", fake_send_auth_email)

    with SessionLocal() as db:
        response = auth_router.register_user(
            payload=auth_router.RegisterRequest(
                name="Email Mode User",
                email=email,
                password="StrongPassw0rd!",
                role=UserRole.ATTENDANCE,
                factory_name=unique_factory(),
                phone_number="+910000000000",
            ),
            request=Request(scope),
            db=db,
        )

    assert response.verification_required is True
    assert response.delivery_mode == "email"
    assert response.verification_link is None
    assert captured["to_email"] == email.lower()
    assert captured["context"] == "registration_verification"
    assert "Verify your email address to activate your account." in captured["body"]


def test_register_email_mode_keeps_pending_signup_when_delivery_fails(monkeypatch):
    init_db()
    email = unique_email()

    def fake_send_auth_email(*, subject: str, to_email: str, body: str, context: str) -> bool:
        return False

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/auth/register",
        "headers": [(b"origin", b"http://127.0.0.1:3000")],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8765),
        "scheme": "http",
        "query_string": b"",
    }

    monkeypatch.setenv("EMAIL_VERIFICATION_EXPOSE_LINK", "0")
    monkeypatch.setattr(auth_router, "_send_auth_email", fake_send_auth_email)

    with SessionLocal() as db:
        response = auth_router.register_user(
            payload=auth_router.RegisterRequest(
                name="Pending Email Failure",
                email=email,
                password="StrongPassw0rd!",
                role=UserRole.ATTENDANCE,
                factory_name=unique_factory(),
                phone_number="+910000000000",
            ),
            request=Request(scope),
            db=db,
        )

    assert response.verification_required is True
    assert response.delivery_mode == "email_failed"
    assert response.verification_link is None
    assert "Signup saved" in response.message

    with SessionLocal() as db:
        pending = db.query(PendingRegistration).filter(PendingRegistration.email == email.lower()).first()
        assert pending is not None
        existing_user = db.query(User).filter(User.email == email.lower()).first()
        assert existing_user is None
        audit_rows = (
            db.query(AuditLog)
            .filter(AuditLog.action == "update_pendingregistration")
            .order_by(AuditLog.id.desc())
            .all()
        )
        assert audit_rows
        assert audit_rows[0].user_id is None


def test_google_onboarding_bootstraps_new_workspace_as_admin():
    init_db()
    email = unique_email()

    with SessionLocal() as db:
        user, org_id, factory_id = get_or_create_google_user(
            db,
            email=email,
            name="Google Bootstrap",
            google_id=f"google-{email}",
            picture=None,
        )
        db.commit()

        membership = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == user.id, UserFactoryRole.factory_id == factory_id)
            .first()
        )

    assert user.org_id == org_id
    assert user.role == UserRole.ADMIN
    assert membership is not None
    assert membership.role == UserRole.ADMIN
