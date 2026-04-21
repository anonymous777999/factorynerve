"""Session helpers for secure cookie auth."""

from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.models.auth_session import AuthSession
from backend.models.auth_user import AuthUser
from backend.auth_security.tokens import generate_token, hash_token


SESSION_COOKIE = os.getenv("AUTH_SESSION_COOKIE", "auth_session")
CSRF_COOKIE = os.getenv("AUTH_CSRF_COOKIE", "auth_csrf")
CSRF_HEADER = os.getenv("AUTH_CSRF_HEADER", "X-CSRF-Token")
SESSION_TTL_MINUTES = int(os.getenv("AUTH_SESSION_TTL_MINUTES", "1440"))
SESSION_SAMESITE = os.getenv("AUTH_SESSION_SAMESITE", "Strict")
SESSION_SECURE = str(os.getenv("AUTH_SESSION_SECURE", "1")).lower() in {"1", "true", "yes", "on"}


def _expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES)


def _cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": SESSION_SECURE,
        "samesite": SESSION_SAMESITE,
        "path": "/",
    }


def _csrf_cookie_kwargs() -> dict:
    return {
        "httponly": False,
        "secure": SESSION_SECURE,
        "samesite": SESSION_SAMESITE,
        "path": "/",
    }


def create_session(db: Session, *, user: AuthUser, request: Request, response: Response) -> AuthSession:
    raw_token = generate_token(32)
    csrf_token = generate_token(16)
    token_hash = hash_token(raw_token)
    csrf_hash = hash_token(csrf_token)
    now = datetime.now(timezone.utc)
    session = AuthSession(
        auth_user_id=user.id,
        token_hash=token_hash,
        csrf_hash=csrf_hash,
        created_at=now,
        expires_at=_expires_at(),
        ip_hash=_hash_value(request.client.host if request.client else None),
        user_agent_hash=_hash_value(request.headers.get("user-agent")),
    )
    db.add(session)
    db.flush()
    response.set_cookie(SESSION_COOKIE, raw_token, **_cookie_kwargs())
    response.set_cookie(CSRF_COOKIE, csrf_token, **_csrf_cookie_kwargs())
    return session


def revoke_session(db: Session, *, session: AuthSession, response: Response) -> None:
    session.revoked_at = datetime.now(timezone.utc)
    db.add(session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def revoke_all_sessions(db: Session, *, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    db.query(AuthSession).filter(
        AuthSession.auth_user_id == user_id,
        AuthSession.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)


def require_csrf(request: Request, session: AuthSession) -> None:
    csrf_header = request.headers.get(CSRF_HEADER) or ""
    csrf_cookie = request.cookies.get(CSRF_COOKIE) or ""
    if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed.")
    if hash_token(csrf_header) != session.csrf_hash:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed.")


def get_current_session(db: Session, request: Request) -> AuthSession:
    raw_token = request.cookies.get(SESSION_COOKIE)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    token_hash = hash_token(raw_token)
    session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
    if not session or session.revoked_at or session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")
    return session


def get_current_user(db: Session, session: AuthSession) -> AuthUser:
    user = db.query(AuthUser).filter(AuthUser.id == session.auth_user_id, AuthUser.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    if session.created_at < user.password_changed_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated.")
    return user


def touch_session(db: Session, session: AuthSession) -> None:
    session.last_used_at = datetime.now(timezone.utc)
    db.add(session)


def _hash_value(value: str | None) -> str | None:
    if not value:
        return None
    return hash_token(value)
