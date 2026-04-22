"""Production-grade authentication routes (cookie sessions, MFA, CSRF)."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.email_service import send_email
from backend.models.auth_audit_log import AuthAuditLog
from backend.models.auth_password_reset import AuthPasswordReset
from backend.models.auth_user import AuthUser
from backend.auth_security.mfa import generate_secret, provisioning_uri, verify_totp
from backend.auth_security.passwords import hash_password, validate_password_strength, verify_password
from backend.auth_security.rate_limit import RateLimitError, check_rate_limit
from backend.auth_security.sessions import (
    create_session,
    get_current_session,
    get_current_user,
    require_csrf,
    revoke_all_sessions,
    revoke_session,
    touch_session,
)
from backend.auth_security.tokens import build_reset_token, expires_at, generate_token, hash_token, verify_reset_token


router = APIRouter(tags=["AuthSecure"])

AUTH_RATE_LIMIT_WINDOW = int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60"))
AUTH_RATE_LIMIT_MAX = int(os.getenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "5"))
RESET_TTL_MINUTES = int(os.getenv("AUTH_PASSWORD_RESET_TTL_MINUTES", "30"))
RESET_BASE_URL = os.getenv("AUTH_RESET_BASE_URL", "http://127.0.0.1:8765/auth-secure/password/reset")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    mfa_code: str | None = None


class PasswordForgotRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=12, max_length=128)


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=10)


class MfaDisableRequest(BaseModel):
    password: str = Field(min_length=12, max_length=128)
    code: str = Field(min_length=6, max_length=10)


def _log_event(
    db: Session,
    *,
    action: str,
    user_id: str | None,
    request: Request | None,
    meta: dict | None = None,
) -> None:
    ip = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    db.add(
        AuthAuditLog(
            auth_user_id=user_id,
            action=action,
            created_at=datetime.now(timezone.utc),
            ip_hash=hash_token(ip) if ip else None,
            user_agent_hash=hash_token(user_agent) if user_agent else None,
            meta=meta,
        )
    )


def _generic_login_error() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    ip = request.client.host if request.client else "unknown"
    email = payload.email.lower().strip()
    try:
        check_rate_limit(key=f"register:ip:{ip}", max_requests=AUTH_RATE_LIMIT_MAX, window_seconds=AUTH_RATE_LIMIT_WINDOW)
        check_rate_limit(key=f"register:email:{email}", max_requests=AUTH_RATE_LIMIT_MAX, window_seconds=AUTH_RATE_LIMIT_WINDOW)
    except RateLimitError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error.detail) from error
    validate_password_strength(payload.password)
    existing = db.query(AuthUser).filter(AuthUser.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already exists.")
    user = AuthUser(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    _log_event(db, action="AUTH_REGISTER", user_id=user.id, request=request)
    create_session(db, user=user, request=request, response=response)
    db.commit()
    return {"message": "Registration successful."}


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    ip = request.client.host if request.client else "unknown"
    email = payload.email.lower().strip()
    try:
        check_rate_limit(key=f"login:ip:{ip}", max_requests=AUTH_RATE_LIMIT_MAX, window_seconds=AUTH_RATE_LIMIT_WINDOW)
        check_rate_limit(key=f"login:email:{email}", max_requests=AUTH_RATE_LIMIT_MAX, window_seconds=AUTH_RATE_LIMIT_WINDOW)
    except RateLimitError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error.detail) from error

    user = db.query(AuthUser).filter(AuthUser.email == email, AuthUser.is_active.is_(True)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        _log_event(db, action="AUTH_LOGIN_FAILED", user_id=None, request=request, meta={"email": email})
        db.commit()
        raise _generic_login_error()

    if user.mfa_enabled:
        if not payload.mfa_code or not user.mfa_secret_encrypted:
            _log_event(db, action="AUTH_LOGIN_MFA_REQUIRED", user_id=user.id, request=request)
            db.commit()
            raise _generic_login_error()
        if not verify_totp(secret=user.mfa_secret_encrypted, code=payload.mfa_code):
            _log_event(db, action="AUTH_LOGIN_MFA_FAILED", user_id=user.id, request=request)
            db.commit()
            raise _generic_login_error()

    session = create_session(db, user=user, request=request, response=response)
    touch_session(db, session)
    _log_event(db, action="AUTH_LOGIN_SUCCESS", user_id=user.id, request=request)
    db.commit()
    return {"message": "Login successful."}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)
    revoke_session(db, session=session, response=response)
    _log_event(db, action="AUTH_LOGOUT", user_id=session.auth_user_id, request=request)
    db.commit()
    return {"message": "Logged out."}


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    user = get_current_user(db, session)
    touch_session(db, session)
    db.commit()
    return {"id": user.id, "email": user.email, "mfa_enabled": user.mfa_enabled}


@router.post("/password/forgot")
def password_forgot(payload: PasswordForgotRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    email = payload.email.lower().strip()
    user = db.query(AuthUser).filter(AuthUser.email == email, AuthUser.is_active.is_(True)).first()
    if user:
        raw = generate_token(32)
        token_hash = hash_token(raw)
        reset = AuthPasswordReset(
            auth_user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at(RESET_TTL_MINUTES),
        )
        db.add(reset)
        db.flush()
        signed = build_reset_token({"uid": user.id, "token": raw})
        reset_link = f"{RESET_BASE_URL}?token={signed}"
        try:
            send_email(
                subject="Reset your password",
                to_emails=[user.email],
                body=f"Use this link to reset your password (valid {RESET_TTL_MINUTES} minutes):\n{reset_link}",
            )
        except Exception:
            pass
        _log_event(db, action="AUTH_PASSWORD_RESET_REQUESTED", user_id=user.id, request=request)
        db.commit()
    return {"message": "If an account exists for this email, you will receive a reset link."}


@router.post("/password/reset")
def password_reset(payload: PasswordResetRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    validate_password_strength(payload.new_password)
    token_payload = verify_reset_token(payload.token, max_age_minutes=RESET_TTL_MINUTES)
    raw = str(token_payload.get("token") or "")
    user_id = str(token_payload.get("uid") or "")
    if not raw or not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    token_hash = hash_token(raw)
    reset = (
        db.query(AuthPasswordReset)
        .filter(
            AuthPasswordReset.auth_user_id == user_id,
            AuthPasswordReset.token_hash == token_hash,
            AuthPasswordReset.used_at.is_(None),
        )
        .first()
    )
    if not reset or reset.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    user = db.query(AuthUser).filter(AuthUser.id == user_id, AuthUser.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.updated_at = datetime.now(timezone.utc)
    reset.used_at = datetime.now(timezone.utc)
    revoke_all_sessions(db, user_id=user.id)
    _log_event(db, action="AUTH_PASSWORD_RESET", user_id=user.id, request=request)
    db.commit()
    response.delete_cookie(os.getenv("AUTH_SESSION_COOKIE", "auth_session"), path="/")
    response.delete_cookie(os.getenv("AUTH_CSRF_COOKIE", "auth_csrf"), path="/")
    return {"message": "Password reset successful."}


@router.post("/mfa/setup")
def mfa_setup(request: Request, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    if user.mfa_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA already enabled.")
    secret = generate_secret()
    user.mfa_secret_encrypted = secret
    user.mfa_enabled = False
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    _log_event(db, action="AUTH_MFA_SETUP_STARTED", user_id=user.id, request=request)
    db.commit()
    return {"secret": secret, "uri": provisioning_uri(email=user.email, secret=secret)}


@router.post("/mfa/verify")
def mfa_verify(payload: MfaVerifyRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    if not user.mfa_secret_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA setup not initiated.")
    if not verify_totp(secret=user.mfa_secret_encrypted, code=payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA code.")
    user.mfa_enabled = True
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    _log_event(db, action="AUTH_MFA_ENABLED", user_id=user.id, request=request)
    db.commit()
    return {"message": "MFA enabled."}


@router.post("/mfa/disable")
def mfa_disable(payload: MfaDisableRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    if not verify_password(payload.password, user.password_hash):
        raise _generic_login_error()
    if not user.mfa_secret_encrypted or not verify_totp(secret=user.mfa_secret_encrypted, code=payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA code.")
    user.mfa_enabled = False
    user.mfa_secret_encrypted = None
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    revoke_all_sessions(db, user_id=user.id)
    _log_event(db, action="AUTH_MFA_DISABLED", user_id=user.id, request=request)
    db.commit()
    response.delete_cookie(os.getenv("AUTH_SESSION_COOKIE", "auth_session"), path="/")
    response.delete_cookie(os.getenv("AUTH_CSRF_COOKIE", "auth_csrf"), path="/")
    return {"message": "MFA disabled. Please log in again."}
