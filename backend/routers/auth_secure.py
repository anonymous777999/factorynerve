"""Production-grade authentication routes (cookie sessions, MFA, CSRF)."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.email_service import send_email
from backend.auth_cookies import clear_auth_cookies, set_access_cookie
from backend.security import create_access_token
from backend.models.auth_audit_log import AuthAuditLog
from backend.models.auth_password_reset import AuthPasswordReset
from backend.models.auth_user import AuthUser
from backend.models.user import User
from backend.models.user_factory_role import UserFactoryRole
from backend.auth_security.mfa import generate_secret, provisioning_uri, verify_totp
from backend.auth_security.passwords import hash_password, validate_password_strength, verify_password
from backend.security import verify_password as verify_password_legacy
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
from backend.services.auth_sync_service import (
    detect_password_hash_algorithm,
    ensure_auth_user_for_legacy_user,
    hash_prefix as sync_hash_prefix,
)


router = APIRouter(tags=["AuthSecure"])
logger = logging.getLogger(__name__)

AUTH_RATE_LIMIT_WINDOW = int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60"))
AUTH_RATE_LIMIT_MAX = int(os.getenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "5"))
RESET_TTL_MINUTES = int(os.getenv("AUTH_PASSWORD_RESET_TTL_MINUTES", "30"))
RESET_BASE_URL = os.getenv("AUTH_RESET_BASE_URL", "http://127.0.0.1:8765/auth-secure/password/reset")


def _hash_prefix(value: str | None, *, visible: int = 12) -> str:
    return sync_hash_prefix(value, visible=visible)


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


def _issue_legacy_access_cookie(db: Session, *, auth_user: AuthUser, request: Request, response: Response) -> None:
    legacy_user = db.query(User).filter(User.email == auth_user.email, User.is_active.is_(True)).first()
    if not legacy_user:
        return

    role_row = (
        db.query(UserFactoryRole)
        .filter(UserFactoryRole.user_id == legacy_user.id)
        .order_by(UserFactoryRole.assigned_at.asc())
        .first()
    )
    access_token = create_access_token(
        user_id=legacy_user.id,
        role=role_row.role.value if role_row else legacy_user.role.value,
        email=legacy_user.email,
        org_id=role_row.org_id if role_row else legacy_user.org_id,
        factory_id=role_row.factory_id if role_row else None,
    )
    set_access_cookie(response=response, access_token=access_token, request=request)


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

    user = db.query(AuthUser).filter(AuthUser.email == email).first()
    legacy_user = (
        db.query(User)
        .filter(
            User.email == email,
            User.is_active.is_(True),
            User.auth_provider == "local",
        )
        .first()
    )
    auth_user_exists = bool(user)
    auth_disabled_flag = bool(user and not user.is_active)
    user_active_flag = bool(user.is_active) if user else False
    auth_user_email_verified_flag = bool(getattr(user, "is_email_verified", False)) if user else False
    verify_result = verify_password(payload.password, user.password_hash) if user and user.is_active else False
    legacy_verify_result = (
        verify_password_legacy(payload.password, legacy_user.password_hash)
        if legacy_user
        else False
    )
    secure_repair_applied = False
    lookup_source = "AuthUser.email"
    if legacy_verify_result and (
        user is None
        or not user.is_active
        or not verify_result
        or detect_password_hash_algorithm(user.password_hash) != "argon2"
    ):
        sync_result = ensure_auth_user_for_legacy_user(
            db,
            legacy_user=legacy_user,
            raw_password=payload.password,
            is_active=True,
            is_email_verified=bool(legacy_user.email_verified_at),
        )
        user = sync_result.auth_user
        auth_user_exists = True
        auth_disabled_flag = False
        user_active_flag = bool(user.is_active)
        auth_user_email_verified_flag = bool(user.is_email_verified)
        verify_result = verify_password(payload.password, user.password_hash)
        secure_repair_applied = sync_result.created or sync_result.updated
        lookup_source = "AuthUser.repaired_from_legacy_user"
    password_hash_value = getattr(user, "password_hash", None)
    password_hash_algorithm = detect_password_hash_algorithm(password_hash_value)
    hash_starts_with_argon2 = bool(password_hash_value and password_hash_value.strip().startswith("$argon2"))
    hash_starts_with_bcrypt = bool(
        password_hash_value
        and (
            password_hash_value.strip().startswith("$2a$")
            or password_hash_value.strip().startswith("$2b$")
            or password_hash_value.strip().startswith("$2y$")
        )
    )
    login_rejection_reason = "none"
    jwt_generation_reached = False
    mfa_gate_reached = False
    if not auth_user_exists:
        login_rejection_reason = "auth_user_not_found"
    elif auth_disabled_flag:
        login_rejection_reason = "auth_user_inactive"
    elif not verify_result:
        login_rejection_reason = "verify_password_false"
    logger.info(
        "AUTH_DIAGNOSTIC_LOGIN_V2",
        extra={
            "auth_flow_selected": "auth_v2_login",
            "login_comparison_path": "AuthUser.password_hash -> backend.auth_security.passwords.verify_password",
            "normalized_email": email,
            "user_lookup_result": auth_user_exists,
            "auth_user_id": getattr(user, "id", None),
            "lookup_source": lookup_source,
            "secure_repair_applied": secure_repair_applied,
            "verify_password_result": verify_result,
            "password_hash_algorithm_detected": password_hash_algorithm,
            "password_hash_prefix": _hash_prefix(password_hash_value),
            "hash_starts_with_argon2_marker": hash_starts_with_argon2,
            "hash_starts_with_bcrypt_marker": hash_starts_with_bcrypt,
            "login_rejection_reason": login_rejection_reason,
            "jwt_generation_reached": jwt_generation_reached,
            "mfa_gate_reached": mfa_gate_reached,
            "auth_disabled_flag": auth_disabled_flag,
            "user_active_flag": user_active_flag,
            "auth_user_email_verified_flag": auth_user_email_verified_flag,
        },
    )
    if not user or auth_disabled_flag or not verify_result:
        _log_event(db, action="AUTH_LOGIN_FAILED", user_id=None, request=request, meta={"email": email})
        db.commit()
        raise _generic_login_error()

    if user.mfa_enabled:
        mfa_gate_reached = True
        if not payload.mfa_code or not user.mfa_secret_encrypted:
            logger.info(
                "AUTH_DIAGNOSTIC_LOGIN_V2",
                extra={
                    "auth_flow_selected": "auth_v2_login",
                    "normalized_email": email,
                    "user_lookup_result": True,
                    "auth_user_id": user.id,
                    "lookup_source": lookup_source,
                    "secure_repair_applied": secure_repair_applied,
                    "verify_password_result": verify_result,
                    "password_hash_algorithm_detected": password_hash_algorithm,
                    "password_hash_prefix": _hash_prefix(password_hash_value),
                    "hash_starts_with_argon2_marker": hash_starts_with_argon2,
                    "hash_starts_with_bcrypt_marker": hash_starts_with_bcrypt,
                    "login_rejection_reason": "mfa_required_or_secret_missing",
                    "jwt_generation_reached": jwt_generation_reached,
                    "mfa_gate_reached": mfa_gate_reached,
                    "auth_disabled_flag": auth_disabled_flag,
                    "user_active_flag": user_active_flag,
                    "auth_user_email_verified_flag": auth_user_email_verified_flag,
                },
            )
            _log_event(db, action="AUTH_LOGIN_MFA_REQUIRED", user_id=user.id, request=request)
            db.commit()
            raise _generic_login_error()
        if not verify_totp(secret=user.mfa_secret_encrypted, code=payload.mfa_code):
            logger.info(
                "AUTH_DIAGNOSTIC_LOGIN_V2",
                extra={
                    "auth_flow_selected": "auth_v2_login",
                    "normalized_email": email,
                    "user_lookup_result": True,
                    "auth_user_id": user.id,
                    "lookup_source": lookup_source,
                    "secure_repair_applied": secure_repair_applied,
                    "verify_password_result": verify_result,
                    "password_hash_algorithm_detected": password_hash_algorithm,
                    "password_hash_prefix": _hash_prefix(password_hash_value),
                    "hash_starts_with_argon2_marker": hash_starts_with_argon2,
                    "hash_starts_with_bcrypt_marker": hash_starts_with_bcrypt,
                    "login_rejection_reason": "mfa_verification_failed",
                    "jwt_generation_reached": jwt_generation_reached,
                    "mfa_gate_reached": mfa_gate_reached,
                    "auth_disabled_flag": auth_disabled_flag,
                    "user_active_flag": user_active_flag,
                    "auth_user_email_verified_flag": auth_user_email_verified_flag,
                },
            )
            _log_event(db, action="AUTH_LOGIN_MFA_FAILED", user_id=user.id, request=request)
            db.commit()
            raise _generic_login_error()

    jwt_generation_reached = True
    session = create_session(db, user=user, request=request, response=response)
    touch_session(db, session)
    _issue_legacy_access_cookie(db, auth_user=user, request=request, response=response)
    _log_event(db, action="AUTH_LOGIN_SUCCESS", user_id=user.id, request=request)
    db.commit()
    logger.info(
        "AUTH_DIAGNOSTIC_LOGIN_V2_COMMIT",
        extra={
            "auth_flow_selected": "auth_v2_login",
            "auth_user_id": user.id,
            "lookup_source": lookup_source,
            "secure_repair_applied": secure_repair_applied,
            "verify_password_result": verify_result,
            "password_hash_algorithm_detected": password_hash_algorithm,
            "password_hash_prefix": _hash_prefix(password_hash_value),
            "hash_starts_with_argon2_marker": hash_starts_with_argon2,
            "hash_starts_with_bcrypt_marker": hash_starts_with_bcrypt,
            "login_rejection_reason": "none",
            "jwt_generation_reached": jwt_generation_reached,
            "mfa_gate_reached": mfa_gate_reached,
            "auth_disabled_flag": auth_disabled_flag,
            "user_active_flag": user_active_flag,
            "auth_user_email_verified_flag": auth_user_email_verified_flag,
            "commit_success": True,
        },
    )
    return {"message": "Login successful."}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)
    revoke_session(db, session=session, response=response)
    clear_auth_cookies(response=response)
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
        except Exception as error:  # pylint: disable=broad-except
            raise HTTPException(status_code=502, detail="Could not deliver the password reset email.") from error
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
