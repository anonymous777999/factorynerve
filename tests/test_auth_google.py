from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlencode, urlparse

from starlette.requests import Request

from backend.database import SessionLocal, init_db
from backend.models.factory import Factory
from backend.models.refresh_token import RefreshToken
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.routers.auth_google import (
    _build_frontend_redirect,
    _encode_state,
    _sanitize_next_path,
    google_callback,
    google_login,
)
from tests.utils import register_user, unique_factory


def _make_request(path: str, *, scheme: str = "https", host: str = "www.factorynerve.online") -> Request:
    raw_path, _, raw_query = path.partition("?")
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": scheme,
        "path": raw_path,
        "raw_path": raw_path.encode("utf-8"),
        "query_string": raw_query.encode("utf-8"),
        "headers": [
            (b"host", host.encode("utf-8")),
            (b"user-agent", b"pytest"),
        ],
        "client": ("127.0.0.1", 12345),
        "server": (host, 443 if scheme == "https" else 80),
    }
    return Request(scope)


def _fake_google_token_response():
    return SimpleNamespace(status_code=200, json=lambda: {"id_token": "raw-google-id-token"})


def test_sanitize_next_path_rejects_external_or_auth_routes():
    assert _sanitize_next_path(None) == "/"
    assert _sanitize_next_path("https://example.com") == "/"
    assert _sanitize_next_path("//evil.test") == "/"
    assert _sanitize_next_path("/login") == "/"
    assert _sanitize_next_path("/register") == "/"


def test_sanitize_next_path_keeps_safe_internal_routes():
    assert _sanitize_next_path("/dashboard") == "/dashboard"
    assert _sanitize_next_path("/approvals?tab=pending") == "/approvals?tab=pending"


def test_build_frontend_redirect_uses_base_origin_and_query(monkeypatch):
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://www.factorynerve.online")

    redirect = _build_frontend_redirect("/approvals", {"oauth_error": "Google sign-in failed"})

    assert redirect == "https://www.factorynerve.online/approvals?oauth_error=Google+sign-in+failed"


def test_build_frontend_redirect_preserves_existing_next_query(monkeypatch):
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://www.factorynerve.online")

    redirect = _build_frontend_redirect(
        "/approvals?tab=pending",
        {"oauth_error": "Google sign-in failed"},
    )

    assert (
        redirect
        == "https://www.factorynerve.online/approvals?tab=pending&oauth_error=Google+sign-in+failed"
    )


def test_build_frontend_redirect_supports_base_path(monkeypatch):
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://factorynerve.online/app")

    redirect = _build_frontend_redirect("/dashboard")

    assert redirect == "https://factorynerve.online/app/dashboard"


def test_build_frontend_redirect_can_target_login_when_explicit(monkeypatch):
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://www.factorynerve.online")

    redirect = _build_frontend_redirect(
        "/login",
        {"oauth_error": "Google sign-in failed"},
        allow_auth_path=True,
    )

    assert redirect == "https://www.factorynerve.online/login?oauth_error=Google+sign-in+failed"


def test_google_login_redirect_does_not_force_offline_consent(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://www.factorynerve.online/api/auth/google/callback")

    response = google_login(_make_request("/auth/google/login?next=/dashboard"))
    redirect_url = urlparse(response.headers["location"])
    params = parse_qs(redirect_url.query)

    assert redirect_url.netloc == "accounts.google.com"
    assert params["scope"] == ["openid email profile"]
    assert "prompt" not in params
    assert "access_type" not in params


def test_google_callback_rejects_unverified_google_email(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://www.factorynerve.online/api/auth/google/callback")
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://www.factorynerve.online")
    monkeypatch.setattr(
        "backend.routers.auth_google._exchange_google_token",
        lambda *args, **kwargs: _fake_google_token_response(),
    )
    monkeypatch.setattr(
        "backend.routers.auth_google.id_token.verify_oauth2_token",
        lambda *args, **kwargs: {
            "iss": "https://accounts.google.com",
            "email": "worker@example.com",
            "email_verified": False,
            "sub": "google-sub-1",
        },
    )

    state = _encode_state(False, "/dashboard")
    request = _make_request(f"/auth/google/callback?code=oauth-code&state={state}")

    with SessionLocal() as db:
        response = google_callback(request, db)

    location = urlparse(response.headers["location"])
    params = parse_qs(location.query)
    assert location.path == "/login"
    assert params["oauth_error"] == ["Your Google account email is not verified."]


def test_google_callback_restores_recent_factory_context(monkeypatch, http_client):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://www.factorynerve.online/api/auth/google/callback")
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://www.factorynerve.online")
    monkeypatch.setattr(
        "backend.routers.auth_google._exchange_google_token",
        lambda *args, **kwargs: _fake_google_token_response(),
    )

    account = register_user(http_client, role="admin")
    state = _encode_state(False, "/dashboard")

    init_db()
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == account["email"]).first()
        assert user is not None

        now = datetime.now(timezone.utc)
        db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update(
            {
                "revoked_at": now - timedelta(minutes=10),
                "last_used_at": now - timedelta(minutes=10),
            },
            synchronize_session=False,
        )

        second_factory = Factory(
            org_id=user.org_id,
            name=unique_factory(),
            timezone="Asia/Kolkata",
            industry_type="steel",
            workflow_template_key="steel-core-pack",
        )
        db.add(second_factory)
        db.flush()

        db.add(
            UserFactoryRole(
                user_id=user.id,
                factory_id=second_factory.factory_id,
                org_id=user.org_id,
                role=UserRole.ADMIN,
                assigned_at=now + timedelta(seconds=1),
            )
        )

        db.add(
            RefreshToken(
                token_hash="a" * 64,
                user_id=user.id,
                org_id=user.org_id,
                factory_id=second_factory.factory_id,
                created_at=now - timedelta(minutes=1),
                last_used_at=now,
                expires_at=now + timedelta(days=30),
            )
        )
        db.commit()
        second_factory_id = second_factory.factory_id

    monkeypatch.setattr(
        "backend.routers.auth_google.id_token.verify_oauth2_token",
        lambda *args, **kwargs: {
            "iss": "https://accounts.google.com",
            "email": account["email"],
            "email_verified": True,
            "name": "QA User",
            "sub": "google-linked-sub",
        },
    )

    request = _make_request(f"/auth/google/callback?code=oauth-code&state={state}")
    with SessionLocal() as db:
        response = google_callback(request, db)

    assert response.headers["location"] == "https://www.factorynerve.online/dashboard"

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == account["email"]).first()
        assert user is not None
        latest_token = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
            .order_by(RefreshToken.id.desc())
            .first()
        )

    assert latest_token is not None
    assert latest_token.factory_id == second_factory_id
