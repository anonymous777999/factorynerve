"""Production-grade authentication routes (cookie sessions, MFA, CSRF)."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.email_utils import queue_and_send_email
from backend.models.auth_audit_log import AuthAuditLog
from backend.models.auth_password_reset import AuthPasswordReset
from backend.models.auth_user import AuthUser
from backend.models.user import User, UserReadSchema
from backend.models.user_factory_role import UserFactoryRole
from backend.schemas.auth import PermissionsSchema
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
    CSRF_COOKIE,
    CSRF_HEADER,
)
from backend.auth_security.tokens import build_reset_token, expires_at, generate_token, hash_token, verify_reset_token
from backend.auth_security.lockout import (
    check_account_locked,
    increment_failed_login,
    reset_failed_login,
)
from backend.security import verify_password as legacy_verify_password
from backend.utils import ensure_utc


router = APIRouter(tags=["AuthSecure"])
logger = logging.getLogger(__name__)

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

    # Check account lockout before proceeding
    if user and check_account_locked(user):
        _log_event(
            db, action="AUTH_LOGIN_BLOCKED_LOCKED", user_id=user.id,
            request=request, meta={"email": email},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to too many failed login attempts. Try again later.",
        )

    if not user:
        # Migration path: legacy User record exists but no AuthUser yet.
        # This happens for accounts created via the old /auth/register flow
        # which creates a User (bcrypt) but never created an AuthUser (argon2).
        legacy_user = db.query(User).filter(
            User.email == email,
            User.is_active.is_(True),
        ).first()
        if legacy_user and legacy_verify_password(payload.password, legacy_user.password_hash):
            # Password matches the legacy bcrypt hash — create AuthUser with
            # the same password re-hashed using argon2 for the new auth system.
            now = datetime.now(timezone.utc)
            user = AuthUser(
                email=email,
                password_hash=hash_password(payload.password),
                is_active=True,
                is_email_verified=legacy_user.email_verified_at is not None,
                password_changed_at=now,
                created_at=now,
                updated_at=now,
            )
            db.add(user)
            db.flush()
            _log_event(
                db, action="AUTH_USER_MIGRATED",
                user_id=user.id, request=request,
                meta={"source": "legacy_user_migration"},
            )
            logger.info(
                "Auto-migrated legacy User %s (id=%s) to AuthUser %s",
                email, legacy_user.id, user.id,
            )
            # Continue with login — user now exists
        else:
            # AuthUser not found AND no matching legacy User (or wrong password)
            _log_event(
                db, action="AUTH_LOGIN_FAILED",
                user_id=None, request=request,
                meta={"email": email, "reason": "auth_user_not_found"},
            )
            db.commit()
            raise _generic_login_error()

    if not verify_password(payload.password, user.password_hash):
        now_locked = increment_failed_login(db, user)
        if now_locked:
            _log_event(
                db, action="AUTH_LOGIN_LOCKOUT", user_id=user.id,
                request=request, meta={"email": email},
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account temporarily locked due to too many failed login attempts. Try again later.",
            )
        _log_event(
            db, action="AUTH_LOGIN_FAILED",
            user_id=user.id, request=request,
            meta={"email": email, "reason": "wrong_password"},
        )
        db.commit()
        raise _generic_login_error()

    # Email verification check: unverified emails cannot log in
    if not user.is_email_verified:
        _log_event(db, action="AUTH_LOGIN_EMAIL_UNVERIFIED", user_id=user.id, request=request, meta={"email": email})
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

    # On successful login, reset the failed login counter
    reset_failed_login(db, user)

    # Password expiry check (P2): force password change after N days
    _PASSWORD_EXPIRY_DAYS = int(os.getenv("PASSWORD_EXPIRY_DAYS", "90"))
    if _PASSWORD_EXPIRY_DAYS > 0 and user.password_changed_at:
        password_changed_at = ensure_utc(user.password_changed_at)
        elapsed = (datetime.now(timezone.utc) - password_changed_at).days
        if elapsed >= _PASSWORD_EXPIRY_DAYS:
            _log_event(
                db, action="AUTH_LOGIN_PASSWORD_EXPIRED", user_id=user.id,
                request=request, meta={"email": email, "days_since_change": elapsed},
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={
                    "code": "PASSWORD_EXPIRED",
                    "message": f"Password has expired ({elapsed} days since last change). Please reset your password.",
                    "must_change_password": True,
                },
            )

    # mfa_verified is True ONLY when the user has MFA enabled AND

    # mfa_verified is True ONLY when the user has MFA enabled AND
    # successfully completed an MFA challenge during this login session.
    # The login handler guards above ensure we only reach here when:
    #   1) MFA is not enabled (mfa_verified=False — PDP allows via _check_mfa), OR
    #   2) MFA is enabled AND a valid code was provided (mfa_verified=True).
    # Resolve the user's active factory from the legacy User model
    mfa_verified = user.mfa_enabled
    legacy_user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    factory_id = None
    if legacy_user:
        role_row = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == legacy_user.id)
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )
        if role_row:
            factory_id = role_row.factory_id
    session = create_session(db, user=user, request=request, response=response, factory_id=factory_id)
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


@router.post("/logout-all")
def logout_all(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)

    # Revoke all sessions for this AuthUser
    auth_user_id = session.auth_user_id
    revoke_all_sessions(db, user_id=auth_user_id)

    # Clear cookies
    response.delete_cookie(os.getenv("AUTH_SESSION_COOKIE", "auth_session"), path="/")
    response.delete_cookie(os.getenv("AUTH_CSRF_COOKIE", "auth_csrf"), path="/")

    _log_event(db, action="AUTH_LOGOUT_ALL", user_id=auth_user_id, request=request)
    db.commit()
    return {"message": "Logged out from all devices successfully."}


def _build_me_permissions(legacy_user: User) -> PermissionsSchema:
    """Build permissions from the legacy User role, matching auth.py's _build_permissions."""
    from backend.models.user import UserRole
    from backend.models.user import role_rank
    role_value = legacy_user.role.value if isinstance(legacy_user.role, UserRole) else str(legacy_user.role)
    role = legacy_user.role if isinstance(legacy_user.role, UserRole) else None
    return PermissionsSchema(
        can_view_billing=role in {UserRole.ADMIN, UserRole.OWNER},
        can_manage_users=bool(role and role_rank(role) >= role_rank(UserRole.MANAGER)),
        can_view_analytics=bool(role and role_rank(role) >= role_rank(UserRole.SUPERVISOR)),
        can_approve_entries=bool(role and role_rank(role) >= role_rank(UserRole.SUPERVISOR)),
        can_export_data=role not in {UserRole.ATTENDANCE, UserRole.OPERATOR},
        can_manage_billing=role == UserRole.OWNER,
        can_view_admin_panel=role_value == "superadmin",
    )


@router.get("/context")
def get_context(request: Request, db: Session = Depends(get_db)) -> dict:
    """Return the full auth context (user, factories, active factory, org).

    Mirrors the legacy GET /auth/context endpoint using v2 session auth.
    """
    from backend.routers.auth import _build_auth_context, _resolve_active_factory_id

    session = get_current_session(db, request)
    auth_user = get_current_user(db, session)
    touch_session(db, session)

    # Resolve the legacy User for context building.
    legacy_user = db.query(User).filter(
        User.email == auth_user.email,
        User.is_active.is_(True),
    ).first()
    if not legacy_user:
        db.commit()
        return {
            "user": {"id": auth_user.id, "email": auth_user.email},
            "active_factory_id": None,
            "active_factory": None,
            "factories": [],
            "organization": None,
        }

    active_factory_id = getattr(legacy_user, "active_factory_id", None)
    if not active_factory_id:
        active_factory_id = _resolve_active_factory_id(
            db, user_id=legacy_user.id, preferred_factory_id=None
        )
    context = _build_auth_context(db, user=legacy_user, active_factory_id=active_factory_id)
    # Serialize the User object for JSON response (Pydantic can't serialize raw SQLAlchemy models)
    context["user"] = UserReadSchema.model_validate(legacy_user)
    db.commit()
    return context


@router.get("/me")
def me(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    auth_user = get_current_user(db, session)
    touch_session(db, session)

    # Restore CSRF cookie if missing from the request
    csrf_cookie_value = request.cookies.get(CSRF_COOKIE)
    if not csrf_cookie_value:
        new_csrf_token = generate_token(16)
        session.csrf_hash = hash_token(new_csrf_token)
        db.add(session)
        response.set_cookie(
            CSRF_COOKIE, new_csrf_token,
            httponly=False,
            path="/",
        )
        csrf_cookie_value = new_csrf_token
    response.headers[CSRF_HEADER] = csrf_cookie_value

    db.commit()

    # Try to resolve the legacy User for full profile + permissions data.
    legacy_user = db.query(User).filter(
        User.email == auth_user.email,
        User.is_active.is_(True),
    ).first()
    if legacy_user:
        user_payload = UserReadSchema.model_validate(legacy_user)
        return {
            **user_payload.model_dump(),
            "permissions": _build_me_permissions(legacy_user),
        }

    # Fallback for v2-only users (no legacy User record yet).
    return {"id": auth_user.id, "email": auth_user.email, "mfa_enabled": auth_user.mfa_enabled}


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
        # Try to resolve a legacy User.id for the email queue FK constraint.
        legacy_user_id = 0
        try:
            from backend.models.user import User as LegacyUser
            legacy = db.query(LegacyUser).filter(
                LegacyUser.email == email, LegacyUser.is_active.is_(True)
            ).first()
            if legacy is not None:
                legacy_user_id = legacy.id
        except Exception as error:
            logger.warning("Could not resolve legacy user_id for password reset email.")

        try:
            queue_and_send_email(
                subject="Reset your password",
                to_emails=[user.email],
                body=f"Use this link to reset your password (valid {RESET_TTL_MINUTES} minutes):\n{reset_link}",
                user_id=legacy_user_id,
                factory_name="FactoryNerve",
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
    if not reset or ensure_utc(reset.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    user = db.query(AuthUser).filter(AuthUser.id == user_id, AuthUser.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.updated_at = datetime.now(timezone.utc)
    reset.used_at = datetime.now(timezone.utc)
    # Invalidate all other pending reset tokens for this user
    from backend.models.auth_password_reset import AuthPasswordReset
    now = datetime.now(timezone.utc)
    db.query(AuthPasswordReset).filter(
        AuthPasswordReset.auth_user_id == user.id,
        AuthPasswordReset.used_at.is_(None),
        AuthPasswordReset.id != reset.id,
    ).update({"used_at": now}, synchronize_session=False)
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
