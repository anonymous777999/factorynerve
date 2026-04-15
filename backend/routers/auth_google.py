"""Google OAuth login endpoints."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
import requests
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from jose import jwt
from google.oauth2 import id_token  # type: ignore
from google.auth.transport import requests as grequests  # type: ignore
from sqlalchemy.orm import Session

from backend.auth_cookies import set_auth_cookies
from backend.database import get_db
from backend.models.user_factory_role import UserFactoryRole
from backend.routers.auth import _issue_refresh_token, _log_auth_event, _resolve_active_factory_id
from backend.security import create_access_token
from backend.services.auth_service import get_or_create_google_user
from backend.utils import get_config


router = APIRouter(tags=["Authentication"])
config = get_config()
_google_http_client = httpx.Client(timeout=httpx.Timeout(8.0, connect=3.0))
_google_verify_session = requests.Session()
_google_verify_request = grequests.Request(session=_google_verify_session)


def _google_config() -> tuple[str, str, str]:
    client_id = os.getenv("GOOGLE_CLIENT_ID") or ""
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET") or ""
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or ""
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")
    return client_id, client_secret, redirect_uri


def _frontend_redirect_url() -> str:
    return os.getenv("FRONTEND_OAUTH_REDIRECT") or "http://127.0.0.1:3000"


def _sanitize_next_path(raw: str | None) -> str:
    if not raw or not raw.startswith("/") or raw.startswith("//"):
        return "/"
    if raw in {"/login", "/register"}:
        return "/"
    return raw


def _build_frontend_redirect(
    path: str,
    params: dict[str, str] | None = None,
    *,
    allow_auth_path: bool = False,
) -> str:
    base = _frontend_redirect_url().rstrip("/")
    parsed = urlparse(base)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=500, detail="Frontend OAuth redirect is invalid.")
    next_path = path if allow_auth_path else _sanitize_next_path(path)
    next_parsed = urlparse(next_path)
    base_path = parsed.path.rstrip("/")
    final_path = f"{base_path}{next_parsed.path}" if base_path else next_parsed.path
    query_items = parse_qsl(parsed.query, keep_blank_values=True)
    query_items.extend(parse_qsl(next_parsed.query, keep_blank_values=True))
    if params:
        query_items.extend(params.items())
    query = urlencode(query_items)
    return urlunparse(parsed._replace(path=final_path, query=query))


def _login_error_redirect(message: str) -> RedirectResponse:
    return RedirectResponse(
        _build_frontend_redirect(
            "/login",
            {"oauth_error": message},
            allow_auth_path=True,
        )
    )


def _exchange_google_token(
    *,
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
):
    return _google_http_client.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    )


def _verify_google_id_token(raw_id_token: str, client_id: str):
    return id_token.verify_oauth2_token(raw_id_token, _google_verify_request, client_id)


def _encode_state(remember: bool, next_path: str) -> str:
    payload = {
        "nonce": secrets.token_urlsafe(16),
        "remember": bool(remember),
        "next": _sanitize_next_path(next_path),
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()),
    }
    return jwt.encode(payload, config.jwt_secret_key, algorithm="HS256")


def _decode_state(state: str) -> dict:
    try:
        return jwt.decode(state, config.jwt_secret_key, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")


@router.get("/google/login")
def google_login(request: Request) -> RedirectResponse:
    try:
        client_id, _secret, redirect_uri = _google_config()
    except HTTPException:
        return _login_error_redirect("Google sign-in is not configured yet.")
    remember = request.query_params.get("remember") == "1"
    next_path = _sanitize_next_path(request.query_params.get("next"))
    state = _encode_state(remember, next_path)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/google/callback")
def google_callback(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    code = request.query_params.get("code")
    state = request.query_params.get("state") or ""
    if not code:
        return _login_error_redirect("Google sign-in did not return an authorization code.")
    try:
        state_payload = _decode_state(state)
    except HTTPException:
        return _login_error_redirect("Google sign-in expired. Please try again.")
    next_path = _sanitize_next_path(str(state_payload.get("next") or "/"))

    try:
        client_id, client_secret, redirect_uri = _google_config()
    except HTTPException:
        return _login_error_redirect("Google sign-in is not configured yet.")
    try:
        token_resp = _exchange_google_token(
            code=code,
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
        )
    except httpx.RequestError:
        return _login_error_redirect("Could not reach Google during sign-in.")
    if token_resp.status_code != 200:
        return _login_error_redirect("Google rejected the sign-in request.")

    token_data = token_resp.json()
    raw_id_token = token_data.get("id_token")
    if not raw_id_token:
        return _login_error_redirect("Google did not return an ID token.")

    try:
        id_info = _verify_google_id_token(raw_id_token, client_id)
    except Exception:
        return _login_error_redirect("Could not verify the Google account response.")

    issuer = id_info.get("iss")
    if issuer not in {"https://accounts.google.com", "accounts.google.com"}:
        return _login_error_redirect("Google sign-in returned an invalid issuer.")

    email = id_info.get("email")
    name = id_info.get("name") or email
    picture = id_info.get("picture")
    google_id = id_info.get("sub")
    email_verified = id_info.get("email_verified")
    if not email or not google_id:
        return _login_error_redirect("Your Google account did not provide an email address.")
    if email_verified not in {True, "true", "True", 1, "1"}:
        return _login_error_redirect("Your Google account email is not verified.")

    user, org_id, factory_id = get_or_create_google_user(
        db,
        email=email,
        name=name,
        google_id=google_id,
        picture=picture,
    )
    active_factory_id = _resolve_active_factory_id(
        db,
        user_id=user.id,
        preferred_factory_id=None,
    )
    role_row = None
    if active_factory_id:
        role_row = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == user.id,
                UserFactoryRole.factory_id == active_factory_id,
            )
            .first()
        )
    if not role_row:
        role_row = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == user.id)
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )
        active_factory_id = role_row.factory_id if role_row else factory_id
    active_role = role_row.role.value if role_row else user.role.value
    user.last_login = datetime.now(timezone.utc)
    _log_auth_event(
        db,
        "USER_LOGIN",
        "Google login successful.",
        user.id,
        request,
        org_id=user.org_id,
        factory_id=active_factory_id,
    )
    refresh_token = _issue_refresh_token(
        db,
        user=user,
        org_id=user.org_id,
        factory_id=active_factory_id,
    )
    db.commit()

    access_token = create_access_token(
        user_id=user.id,
        role=active_role,
        email=user.email,
        org_id=org_id,
        factory_id=active_factory_id,
    )
    final = _build_frontend_redirect(next_path)
    response = RedirectResponse(final)
    csrf_token = set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        request=request,
    )
    response.headers["X-CSRF-Token"] = csrf_token
    return response
