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
SESSION_IDLE_TIMEOUT_MINUTES = int(os.getenv("SESSION_IDLE_TIMEOUT_MINUTES", "30"))
SESSION_ABSOLUTE_TIMEOUT_HOURS = int(os.getenv("SESSION_ABSOLUTE_TIMEOUT_HOURS", "24"))
SESSION_SAMESITE = os.getenv("AUTH_SESSION_SAMESITE", "Lax")

# Raw env var — None means "auto-detect from request scheme"
_SESSION_SECURE_RAW: str | None = os.getenv("AUTH_SESSION_SECURE")


def _should_use_secure_cookie(request: Request) -> bool:
    """Determine whether to set cookie Secure flag.

    Respect explicit env var if set; otherwise auto-detect from request
    scheme (Secure only for HTTPS).  This mirrors the pattern in
    backend/auth_cookies.py so cookies work over plain HTTP in local dev.
    """
    if _SESSION_SECURE_RAW is not None:
        return _SESSION_SECURE_RAW.strip().lower() in {"1", "true", "yes", "on"}
    return request.url.scheme == "https"


def _expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES)


def _cookie_kwargs(*, request: Request) -> dict:
    return {
        "httponly": True,
        "secure": _should_use_secure_cookie(request),
        "samesite": SESSION_SAMESITE,
        "path": "/",
    }


def _csrf_cookie_kwargs(*, request: Request) -> dict:
    return {
        "httponly": False,
        "secure": _should_use_secure_cookie(request),
        "samesite": SESSION_SAMESITE,
        "path": "/",
    }


def create_session(db: Session, *, user: AuthUser, request: Request, response: Response, factory_id: str | None = None) -> AuthSession:
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
        factory_id=factory_id,
    )
    db.add(session)
    db.flush()
    response.set_cookie(SESSION_COOKIE, raw_token, **_cookie_kwargs(request=request))
    response.set_cookie(CSRF_COOKIE, csrf_token, **_csrf_cookie_kwargs(request=request))
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


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _session_expired_message(reason: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Session expired: {reason}.",
        headers={"X-Session-Expired": reason},
    )


def get_current_session(db: Session, request: Request) -> AuthSession:
    raw_token = request.cookies.get(SESSION_COOKIE)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    token_hash = hash_token(raw_token)
    session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
    if not session or session.revoked_at:
        raise _session_expired_message("not_found_or_revoked")

    now = datetime.now(timezone.utc)
    created_at = _ensure_utc(session.created_at)
    expires_at = _ensure_utc(session.expires_at)

    # Absolute timeout from creation (max session lifetime)
    absolute_deadline = created_at + timedelta(hours=SESSION_ABSOLUTE_TIMEOUT_HOURS)
    if absolute_deadline <= now:
        session.revoked_at = now
        db.add(session)
        db.flush()
        raise _session_expired_message("absolute_timeout")

    # Expires_at check (legacy absolute expiry from SESSION_TTL_MINUTES)
    if expires_at <= now:
        session.revoked_at = now
        db.add(session)
        db.flush()
        raise _session_expired_message("expired")

    # Idle timeout check — if last_used_at is older than threshold
    if session.last_used_at is not None:
        last_used = _ensure_utc(session.last_used_at)
        idle_deadline = last_used + timedelta(minutes=SESSION_IDLE_TIMEOUT_MINUTES)
        if idle_deadline <= now:
            session.revoked_at = now
            db.add(session)
            db.flush()
            raise _session_expired_message("idle_timeout")

    # Touch session — update last_used_at on every successful auth check
    touch_session(db, session)
    db.flush()
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
