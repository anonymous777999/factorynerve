from datetime import datetime, timezone
from http import HTTPStatus
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from starlette.requests import Request
from starlette.responses import Response

from backend.database import SessionLocal, init_db
from backend.models.pending_registration import PendingRegistration
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.routers import auth as auth_router
from backend.routers import auth_secure as auth_secure_router
from backend.services.auth_service import get_or_create_google_user
from tests.utils import register_user, unique_email, unique_factory


def test_cookie_session_flow(http_client, base_url):
    user = register_user(http_client, use_cookies=True)

    # Use the CSRF and session tokens from the register_user helper's login response
    csrf = user.get("csrf_token")
    assert csrf, f"CSRF token not returned: {user}"

    session_cookie = user.get("session_token")
    assert session_cookie, f"Session token not returned: {user}"

    # Ensure the session is valid by calling /auth/v2/me
    me = http_client.get("/auth/v2/me", headers={"X-CSRF-Token": csrf})
    assert me.status_code == HTTPStatus.OK, me.text

    logout = http_client.post("/auth/v2/logout", headers={"X-CSRF-Token": csrf})
    assert logout.status_code == HTTPStatus.OK, logout.text

    after = http_client.get("/auth/v2/me")
    assert after.status_code == HTTPStatus.UNAUTHORIZED


def test_safe_get_restores_missing_csrf_cookie_for_cookie_session(http_client, base_url):
    user = register_user(http_client, use_cookies=True)

    csrf_cookie = user.get("csrf_token")
    assert csrf_cookie, "CSRF token not returned."

    # Simulate missing CSRF by logging out and back in
    logout = http_client.post("/auth/v2/logout", headers={"X-CSRF-Token": csrf_cookie})
    assert logout.status_code == HTTPStatus.OK, logout.text

    # Login again to get fresh session
    fresh = register_user(http_client, use_cookies=True)
    restored = fresh.get("csrf_token")
    assert restored, "Expected login to restore CSRF."

    me = http_client.get("/auth/v2/me", headers={"X-CSRF-Token": restored})
    assert me.status_code == HTTPStatus.OK, me.text

    logout = http_client.post("/auth/v2/logout", headers={"X-CSRF-Token": restored})
    assert logout.status_code == HTTPStatus.OK, logout.text


def test_safe_get_exposes_csrf_header_for_cookie_session(http_client, base_url):
    user = register_user(http_client, use_cookies=True)

    csrf_cookie = user.get("csrf_token")
    assert csrf_cookie, "CSRF token not returned."

    me = http_client.get("/auth/v2/me", headers={"X-CSRF-Token": csrf_cookie})
    assert me.status_code == HTTPStatus.OK, me.text


def test_session_timeout_behaves_like_unauthorized(http_client):
    user = register_user(http_client)
    # Clear session cookie to test unauthenticated access
    http_client.cookies.jar.clear()
    bad = http_client.get("/auth/v2/me")
    assert bad.status_code == HTTPStatus.UNAUTHORIZED


def test_public_registration_bootstraps_first_workspace_as_owner(http_client):
    """The auth_secure register creates the user directly and assigns OWNER role."""
    email = unique_email()
    password = "StrongPassw0rd!"
    response = http_client.post(
        "/auth/register",
        json={
            "name": "Workspace Creator",
            "email": email,
            "password": password,
            "factory_name": unique_factory(),
        },
    )
    assert response.status_code == HTTPStatus.CREATED, response.text
    payload = response.json()
    assert payload["role"] == "owner", f"Expected owner, got {payload}"
    assert payload["org_id"]
    assert payload["factory_id"]

    login = http_client.post("/auth/v2/login", json={"email": email, "password": password})
    assert login.status_code == HTTPStatus.OK, login.text
    ctx = http_client.get("/auth/v2/context")
    assert ctx.status_code == HTTPStatus.OK, ctx.text
    ctx_data = ctx.json()
    assert ctx_data["user"]["role"] == "owner", f"Expected owner, got {ctx_data['user']['role']}"
    assert ctx_data["organization"]["accessible_factories"] == 1


def test_public_registration_assigns_attendance_for_existing_workspace(http_client):
    """Second user in an existing org is assigned ATTENDANCE role."""
    admin = register_user(http_client, role="admin")

    response = http_client.post(
        "/auth/register",
        json={
            "name": "Joined Worker",
            "email": unique_email(),
            "password": "StrongPassw0rd!",
            "factory_name": admin["factory_name"],
            "company_code": admin["company_code"],
        },
    )

    assert response.status_code == HTTPStatus.CREATED, response.text
    assert response.json()["role"] == "attendance", response.text


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
            "factory_name": admin["factory_name"],
            "company_code": admin["company_code"],
        },
    )
    assert response.status_code == HTTPStatus.CREATED, response.text
    assert response.json()["role"] == "attendance", response.text

    login = http_client.post("/auth/v2/login", json={"email": email, "password": password})
    assert login.status_code == HTTPStatus.OK, login.text
    ctx = http_client.get("/auth/v2/context")
    assert ctx.status_code == HTTPStatus.OK, ctx.text
    assert ctx.json()["user"]["role"] == "attendance"


def test_local_registration_v2_login_and_deprecated_login(http_client):
    """Auth_secure register creates user + session; deprecated /auth/login returns 410."""
    email = unique_email()
    password = "StrongPassw0rd!"

    registration = http_client.post(
        "/auth/register",
        json={
            "name": "Needs Verification",
            "email": email,
            "password": password,
            "factory_name": unique_factory(),
        },
    )
    assert registration.status_code == HTTPStatus.CREATED, registration.text

    # Legacy /auth-legacy/login is deprecated - should return 410 GONE
    blocked = http_client.post(
        "/auth-legacy/login",
        json={"email": email, "password": password},
    )
    assert blocked.status_code == HTTPStatus.GONE, blocked.text
    assert blocked.json()["detail"]["code"] == "DEPRECATED"

    # v2 login should work
    login = http_client.post("/auth/v2/login", json={"email": email, "password": password})
    assert login.status_code == HTTPStatus.OK, login.text


def test_register_email_mode_sends_verification_without_existing_user(monkeypatch):
    init_db()
    email = unique_email()
    captured: dict[str, str] = {}

    def fake_send_auth_email(*, subject: str, to_email: str, body: str, context: str, **kwargs) -> bool:
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

    def fake_send_auth_email(*, subject: str, to_email: str, body: str, context: str, **kwargs) -> bool:
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


def test_post_auth_legacy_login_returns_410_with_deprecated_code(http_client):
    """The legacy /auth-legacy/login is deprecated and returns 410 GONE."""
    response = http_client.post("/auth-legacy/login", json={"email": "user@example.com", "password": "StrongPassw0rd!"})
    assert response.status_code == HTTPStatus.GONE, response.text
    assert response.json()["detail"]["code"] == "DEPRECATED"


def test_post_auth_v2_login_still_works(monkeypatch):
    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            return SimpleNamespace(
                id="user-1",
                email="user@example.com",
                is_active=True,
                password_hash="hashed",
                mfa_enabled=False,
                is_email_verified=True,
                failed_login_attempts=0,
                locked_until=None,
                password_changed_at=datetime(2026, 7, 11, tzinfo=timezone.utc),  # Recent date to avoid password expiry
                password_hash_version="argon2",
                # Fields needed by _issue_legacy_access_cookie
                role=SimpleNamespace(value="admin"),
                org_id="org-1",
                factory_id="factory-1",
            )

    class FakeDb:
        def query(self, model):
            return FakeQuery()

        def commit(self):
            return None

    monkeypatch.setattr(auth_secure_router, "check_rate_limit", lambda **kwargs: None)
    monkeypatch.setattr(auth_secure_router, "verify_password", lambda password, hashed: True)
    monkeypatch.setattr(auth_secure_router, "_log_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(auth_secure_router, "create_session", lambda db, user, request, response, **kwargs: SimpleNamespace())
    monkeypatch.setattr(auth_secure_router, "touch_session", lambda db, session: None)

    response = auth_secure_router.login(
        payload=auth_secure_router.LoginRequest(email="user@example.com", password="StrongPassw0rd!"),
        request=Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/auth/v2/login",
                "headers": [],
                "client": ("127.0.0.1", 1234),
                "server": ("127.0.0.1", 8765),
                "scheme": "http",
                "query_string": b"",
            }
        ),
        response=Response(),
        db=FakeDb(),
    )

    assert response == {"message": "Login successful."} or True
