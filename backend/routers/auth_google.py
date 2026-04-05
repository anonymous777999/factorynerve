"""Google OAuth login endpoints."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

import httpx
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from jose import jwt
from google.oauth2 import id_token  # type: ignore
from google.auth.transport import requests as grequests  # type: ignore
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.auth_service import get_or_create_google_user
from backend.services.token_service import create_access_token_short, issue_refresh_token
from backend.utils import get_config


router = APIRouter(tags=["Authentication"])
config = get_config()


def _google_config() -> tuple[str, str, str]:
    client_id = os.getenv("GOOGLE_CLIENT_ID") or ""
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET") or ""
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or ""
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")
    return client_id, client_secret, redirect_uri


def _frontend_redirect_url() -> str:
    return os.getenv("FRONTEND_OAUTH_REDIRECT") or "http://127.0.0.1:8502"


def _encode_state(remember: bool) -> str:
    payload = {
        "nonce": secrets.token_urlsafe(16),
        "remember": bool(remember),
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
    client_id, _secret, redirect_uri = _google_config()
    remember = request.query_params.get("remember") == "1"
    state = _encode_state(remember)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/google/callback")
def google_callback(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    code = request.query_params.get("code")
    state = request.query_params.get("state") or ""
    if not code:
        raise HTTPException(status_code=400, detail="Missing OAuth code.")
    state_payload = _decode_state(state)

    client_id, client_secret, redirect_uri = _google_config()
    token_url = "https://oauth2.googleapis.com/token"
    try:
        token_resp = httpx.post(
            token_url,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Google token exchange failed.")
    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Google token exchange rejected.")

    token_data = token_resp.json()
    raw_id_token = token_data.get("id_token")
    if not raw_id_token:
        raise HTTPException(status_code=400, detail="Missing ID token from Google.")

    try:
        id_info = id_token.verify_oauth2_token(raw_id_token, grequests.Request(), client_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to verify Google ID token.")

    issuer = id_info.get("iss")
    if issuer not in {"https://accounts.google.com", "accounts.google.com"}:
        raise HTTPException(status_code=400, detail="Invalid token issuer.")

    email = id_info.get("email")
    name = id_info.get("name") or email
    picture = id_info.get("picture")
    google_id = id_info.get("sub")
    if not email or not google_id:
        raise HTTPException(status_code=400, detail="Google account missing email.")

    user, org_id, factory_id = get_or_create_google_user(
        db,
        email=email,
        name=name,
        google_id=google_id,
        picture=picture,
    )

    access_token = create_access_token_short(
        user_id=user.id,
        role=user.role.value,
        email=user.email,
        org_id=org_id,
        factory_id=factory_id,
        minutes=15,
    )
    refresh_days = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
    refresh_token = issue_refresh_token(db, user=user, org_id=org_id, factory_id=factory_id, days=refresh_days)
    db.commit()

    redirect = _frontend_redirect_url()
    parsed = urlparse(redirect)
    params = dict(parse_qsl(parsed.query))
    if state_payload.get("remember"):
        params["remember"] = "1"
    params.update({"access_token": access_token, "refresh_token": refresh_token, "provider": "google"})
    final = urlunparse(parsed._replace(query=urlencode(params)))
    return RedirectResponse(final)
