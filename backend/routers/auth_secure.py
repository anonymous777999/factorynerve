"""Production-grade authentication routes (cookie sessions, MFA, CSRF)."""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.email_utils import queue_and_send_email
from backend.models.report import AuditLog
from backend.models.auth_password_reset import AuthPasswordReset
from backend.models.auth_user import AuthUser
from backend.models.auth_session import AuthSession
from backend.models.user import User, UserReadSchema, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.utils import ensure_utc, sanitize_text
from backend.schemas.auth import PermissionsSchema
from backend.services.registration_service import resolve_registration_context
from backend.services.user_code_service import next_user_code, MAX_USER_CODE_ATTEMPTS, is_user_code_collision
from backend.models.subscription import Subscription
from backend.plans import DEFAULT_PLAN
from backend.models.factory import Factory
from backend.models.organization import Organization
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
from backend.services.auth_service import AuthService
from backend.database import hash_ip_address
from backend.factory_profiles import get_factory_profile
from backend.factory_templates import (
    default_workflow_template_key,
    get_workflow_template,
    serialize_workflow_template,
)


router = APIRouter(tags=["AuthSecure"])
logger = logging.getLogger(__name__)

AUTH_RATE_LIMIT_WINDOW = int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60"))
AUTH_RATE_LIMIT_MAX = int(os.getenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "5"))
RESET_TTL_MINUTES = int(os.getenv("AUTH_PASSWORD_RESET_TTL_MINUTES", "30"))
RESET_BASE_URL = os.getenv("AUTH_RESET_BASE_URL", "http://127.0.0.1:8765/auth-secure/password/reset")


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    company_code: str | None = Field(default=None, max_length=32)
    factory_name: str = Field(min_length=2, max_length=255)


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


def _normalize_user_id(user_id: int | str | None) -> int | None:
    """Normalize user_id to int for AuditLog.user_id (FK to users.id).

    Handles both int user IDs and string UUIDs from old auth_user_id values.
    UUID-based auth_user_ids (pre-consolidation) cannot be converted to int
    and result in None (no FK reference), which is correct for old sessions.
    """
    if user_id is None:
        return None
    if isinstance(user_id, int):
        return user_id
    # String — try int (new-style user.id), fall back to None for UUIDs
    try:
        return int(user_id)
    except (ValueError, TypeError):
        return None


def _log_event(
    db: Session,
    *,
    action: str,
    user_id: int | str | None,
    request: Request | None = None,
    meta: dict | None = None,
    details: str | None = None,
    org_id: str | None = None,
    factory_id: str | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=_normalize_user_id(user_id),
            org_id=org_id,
            factory_id=factory_id,
            action=action,
            details=details or action,
            ip_address=hash_ip_address(request.client.host) if request and request.client else None,
            user_agent=request.headers.get("user-agent") if request else None,
            timestamp=datetime.now(timezone.utc),
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

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already exists.")

    # Resolve or create organization and factory
    requested_factory = (
        sanitize_text(payload.factory_name, max_length=255, preserve_newlines=False)
        or payload.factory_name.strip()
    )
    organization, factory, factory_code, resolved_factory_name = resolve_registration_context(
        db,
        requested_factory=requested_factory,
        provided_code=payload.company_code,
    )

    # Determine role: OWNER if first user in org, otherwise ATTENDANCE
    has_existing_org_user = (
        db.query(User.id)
        .filter(User.org_id == organization.org_id, User.is_active.is_(True))
        .first()
        is not None
    )
    assigned_role = UserRole.OWNER if not has_existing_org_user else UserRole.ATTENDANCE

    now = datetime.now(timezone.utc)
    user = User(
        name=sanitize_text(payload.name, max_length=120, preserve_newlines=False) or payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        password_hash_version="argon2",
        password_changed_at=now,
        role=assigned_role,
        factory_name=resolved_factory_name,
        factory_code=factory_code,
        org_id=organization.org_id,
        is_email_verified=True,
        is_active=True,
        created_at=now,
        updated_at=now,
    )

    # Generate unique user_code with retry on collision
    last_error: Exception | None = None
    for _ in range(MAX_USER_CODE_ATTEMPTS):
        user.user_code = next_user_code(db, org_id=organization.org_id)
        try:
            with db.begin_nested():
                db.add(user)
                db.flush()
            break
        except IntegrityError as error:
            last_error = error
            if not is_user_code_collision(error):
                raise
    else:
        raise HTTPException(
            status_code=500,
            detail="Could not generate a unique user ID. Please try again.",
        ) from last_error

    # Assign factory role
    db.add(
        UserFactoryRole(
            user_id=user.id,
            factory_id=factory.factory_id,
            org_id=organization.org_id,
            role=assigned_role,
        )
    )

    # Create trial subscription if this is the first subscription for the org
    if not db.query(Subscription).filter(Subscription.org_id == organization.org_id).first():
        trial_days = int(os.getenv("TRIAL_DAYS", "7"))
        db.add(
            Subscription(
                org_id=organization.org_id,
                user_id=user.id,
                plan=DEFAULT_PLAN,
                status="trialing",
                trial_start_at=now,
                trial_end_at=now + timedelta(days=trial_days),
            )
        )

    _log_event(db, action="AUTH_REGISTER", user_id=user.id, request=request, org_id=organization.org_id, factory_id=factory.factory_id)

    # Create session so the user is logged in immediately after registration
    create_session(db, user=user, request=request, response=response, factory_id=factory.factory_id)

    db.commit()
    return {
        "message": "Registration successful.",
        "org_id": organization.org_id,
        "factory_id": factory.factory_id,
        "role": assigned_role.value,
    }


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    ip = request.client.host if request.client else "unknown"
    email = payload.email.lower().strip()
    try:
        check_rate_limit(key=f"login:ip:{ip}", max_requests=AUTH_RATE_LIMIT_MAX, window_seconds=AUTH_RATE_LIMIT_WINDOW)
        check_rate_limit(key=f"login:email:{email}", max_requests=AUTH_RATE_LIMIT_MAX, window_seconds=AUTH_RATE_LIMIT_WINDOW)
    except RateLimitError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error.detail) from error

    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()

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
        _log_event(
            db, action="AUTH_LOGIN_FAILED",
            user_id=None, request=request,
            meta={"email": email, "reason": "user_not_found"},
        )
        db.commit()
        raise _generic_login_error()

    # Unified password verification — supports both argon2 and bcrypt hashes.
    # The argon2 verify_password handles both formats via the password_hash prefix.
    password_matches = verify_password(payload.password, user.password_hash)

    # Fall back to bcrypt for legacy hashes (pre-auth-consolidation).
    # Treat NULL password_hash_version as "bcrypt" for backward compatibility
    # with migrated databases where the column was added without server_default.
    _hash_version = (user.password_hash_version or "bcrypt")
    if not password_matches and _hash_version == "bcrypt":
        password_matches = legacy_verify_password(payload.password, user.password_hash)
        if password_matches:
            # Upgrade to argon2 on successful login
            now = datetime.now(timezone.utc)
            user.password_hash = hash_password(payload.password)
            user.password_hash_version = "argon2"
            user.password_changed_at = now
            user.updated_at = now
            logger.info(
                "Upgraded password hash for %s (id=%s) from bcrypt to argon2 on login.",
                email, user.id,
            )

    if not password_matches:
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

    # Resolve the user's active factory from their UserFactoryRole
    mfa_verified = user.mfa_enabled
    factory_id = None
    role_row = (
        db.query(UserFactoryRole)
        .filter(UserFactoryRole.user_id == user.id)
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
    # Prefer session.user_id (int FK) over session.auth_user_id (UUID str) for audit
    logout_user_id = session.user_id if session.user_id is not None else session.auth_user_id
    _log_event(db, action="AUTH_LOGOUT", user_id=logout_user_id, request=request)
    db.commit()
    return {"message": "Logged out."}


@router.post("/logout-all")
def logout_all(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)

    # Revoke all sessions for this user (prefers user_id, falls back to auth_user_id)
    user_id = session.user_id if session.user_id is not None else session.auth_user_id
    revoke_all_sessions(db, user_id=user_id)

    # Clear cookies
    response.delete_cookie(os.getenv("AUTH_SESSION_COOKIE", "auth_session"), path="/")
    response.delete_cookie(os.getenv("AUTH_CSRF_COOKIE", "auth_csrf"), path="/")

    _log_event(db, action="AUTH_LOGOUT_ALL", user_id=user_id, request=request)
    db.commit()
    return {"message": "Logged out from all devices successfully."}


def _build_me_permissions(auth_user: User) -> PermissionsSchema:
    """Build permissions from the User role."""
    from backend.models.user import UserRole, role_rank
    role_value = auth_user.role.value if isinstance(auth_user.role, UserRole) else str(auth_user.role)
    role = auth_user.role if isinstance(auth_user.role, UserRole) else None
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

    Uses the unified User model directly (auth consolidation Phase 2+).
    """
    from backend.routers.auth import _build_auth_context, _resolve_active_factory_id

    session = get_current_session(db, request)
    user = get_current_user(db, session)
    touch_session(db, session)

    active_factory_id = getattr(user, "active_factory_id", None)
    if not active_factory_id:
        active_factory_id = _resolve_active_factory_id(
            db, user_id=user.id, preferred_factory_id=None
        )
    context = _build_auth_context(db, user=user, active_factory_id=active_factory_id)
    context["user"] = UserReadSchema.model_validate(user)
    db.commit()
    return context


@router.get("/me")
def me(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = get_current_session(db, request)
    user = get_current_user(db, session)
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

    user_payload = UserReadSchema.model_validate(user)
    return {
        **user_payload.model_dump(),
        "permissions": _build_me_permissions(user),
    }


@router.post("/password/forgot")
def password_forgot(payload: PasswordForgotRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if user:
        try:
            raw = generate_token(32)
            token_hash = hash_token(raw)
            # Resolve the auth_user_id UUID from the AuthUser record.
            # auth_user_id is a FK to auth_users.id (UUID), while user.id
            # is an integer — str(user.id) would cause a FK mismatch.
            auth_user_record = db.query(AuthUser).filter(AuthUser.email == user.email).first()
            if not auth_user_record:
                # Auto-create AuthUser record (matching create_session behavior in sessions.py)
                # so that password_forgot can proceed even when auth_users table is empty
                # (e.g., freshly-migrated database where init_db + stamp head skipped
                # the AuthUser population migration).
                logger.warning(
                    "No AuthUser record found for %s — auto-creating one to satisfy FK.",
                    email,
                )
                now = datetime.now(timezone.utc)
                auth_user_record = AuthUser(
                    id=str(user.id),
                    email=user.email,
                    password_hash=hash_password(secrets.token_urlsafe(32)),
                    is_active=True,
                    is_email_verified=True,
                    password_changed_at=user.password_changed_at or now,
                    created_at=now,
                    updated_at=now,
                )
                db.add(auth_user_record)
                db.flush()
            reset = AuthPasswordReset(
                auth_user_id=auth_user_record.id,
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at(RESET_TTL_MINUTES),
            )
            db.add(reset)
            db.flush()
            signed = build_reset_token({"uid": str(user.id), "token": raw})
            reset_link = f"{RESET_BASE_URL}?token={signed}"

            result = queue_and_send_email(
                subject="Reset your password",
                to_emails=[user.email],
                body=f"Use this link to reset your password (valid {RESET_TTL_MINUTES} minutes):\n{reset_link}",
                user_id=user.id,
                factory_name="FactoryNerve",
            )
            # queue_and_send_email catches all exceptions internally and returns
            # a result dict. It NEVER raises, so the old try/except was dead code.
            # Check the return value to detect silent delivery failures.
            sent = result.get("sent", False)
            dry_run = result.get("dry_run", False)
            error_msg = result.get("error")
            queue_id = result.get("queue_id")
            if not sent and not dry_run:
                logger.error(
                    "Password reset email delivery failed for %s (queue_id=%s, error=%s). "
                    "Check SMTP/RESEND_API_KEY configuration in Render dashboard.",
                    user.email,
                    queue_id,
                    error_msg or "unknown",
                )
            elif sent:
                logger.debug(
                    "Password reset email sent to %s (queue_id=%s).",
                    user.email,
                    queue_id,
                )
            _log_event(db, action="AUTH_PASSWORD_RESET_REQUESTED", user_id=user.id, request=request)
            db.commit()
        except Exception:
            logger.exception(
                "Password reset token/email flow failed for %s — returning generic response.",
                email,
            )
            db.rollback()
    return {"message": "If an account exists for this email, you will receive a reset link."}


@router.post("/password/reset")
def password_reset(payload: PasswordResetRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    validate_password_strength(payload.new_password)
    token_payload = verify_reset_token(payload.token, max_age_minutes=RESET_TTL_MINUTES)
    raw = str(token_payload.get("token") or "")
    user_id_str = str(token_payload.get("uid") or "")
    if not raw or not user_id_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    token_hash = hash_token(raw)
    # Look up the reset token — prefer user_id (direct FK) over auth_user_id
    # for the new consolidated auth system (AUTH-01).
    try:
        uid = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    reset = (
        db.query(AuthPasswordReset)
        .filter(
            db.or_(
                AuthPasswordReset.user_id == uid,
                AuthPasswordReset.auth_user_id == user_id_str,
            ),
            AuthPasswordReset.token_hash == token_hash,
            AuthPasswordReset.used_at.is_(None),
        )
        .first()
    )
    if not reset or ensure_utc(reset.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    user = db.query(User).filter(User.id == uid, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
    user.password_hash = hash_password(payload.new_password)
    user.password_hash_version = "argon2"
    user.password_changed_at = datetime.now(timezone.utc)
    user.updated_at = datetime.now(timezone.utc)
    reset.used_at = datetime.now(timezone.utc)
    # Invalidate all other pending reset tokens for this user
    from backend.models.auth_password_reset import AuthPasswordReset
    now = datetime.now(timezone.utc)
    db.query(AuthPasswordReset).filter(
        db.or_(
            AuthPasswordReset.user_id == user.id,
            AuthPasswordReset.auth_user_id == user_id_str,
        ),
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


# ── New request schemas for consolidated endpoints ────────────────────────


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone_number: str | None = Field(default=None, max_length=32)


class SelectFactoryRequest(BaseModel):
    factory_id: str = Field(min_length=4, max_length=36)


class FactoryAccess(BaseModel):
    factory_id: str
    name: str
    role: str
    factory_code: str | None = None
    industry_type: str = "general"
    industry_label: str = "General Manufacturing"
    workflow_template_key: str | None = None
    workflow_template_label: str | None = None
    location: str | None = None
    timezone: str | None = None


class OrganizationContext(BaseModel):
    org_id: str
    name: str
    plan: str
    total_factories: int
    accessible_factories: int


class ActiveWorkflowTemplateResponse(BaseModel):
    factory_id: str | None = None
    factory_name: str | None = None
    factory_code: str | None = None
    industry_type: str
    industry_label: str
    workflow_template_key: str
    workflow_template_label: str
    starter_modules: list[str] = Field(default_factory=list)
    template: dict[str, object]


# ── Helpers (shared context builders) ────────────────────────────────────


def _get_factory_access(db: Session, *, user_id: int) -> list[FactoryAccess]:
    rows = (
        db.query(UserFactoryRole, Factory)
        .join(Factory, Factory.factory_id == UserFactoryRole.factory_id)
        .filter(UserFactoryRole.user_id == user_id, Factory.is_active.is_(True))
        .order_by(Factory.name.asc())
        .all()
    )
    access_rows: list[FactoryAccess] = []
    for role, factory in rows:
        profile = get_factory_profile(factory.industry_type)
        template = get_workflow_template(factory.workflow_template_key)
        access_rows.append(
            FactoryAccess(
                factory_id=factory.factory_id,
                name=factory.name,
                role=str(role.role.value),
                factory_code=factory.factory_code,
                industry_type=profile.key,
                industry_label=profile.label,
                workflow_template_key=factory.workflow_template_key,
                workflow_template_label=template.label if template else None,
                location=factory.location,
                timezone=factory.timezone,
            )
        )
    return access_rows


def _get_org_context(
    db: Session,
    *,
    org_id: str | None,
    fallback_user_id: int,
    accessible_factories: int,
) -> OrganizationContext | None:
    if not org_id:
        return None
    org = db.query(Organization).filter(Organization.org_id == org_id, Organization.is_active.is_(True)).first()
    if not org:
        return None
    from backend.plans import get_org_plan
    total_factories = (
        db.query(Factory.factory_id)
        .filter(Factory.org_id == org_id, Factory.is_active.is_(True))
        .count()
    )
    return OrganizationContext(
        org_id=org.org_id,
        name=org.name,
        plan=get_org_plan(db, org_id=org.org_id, fallback_user_id=fallback_user_id),
        total_factories=total_factories,
        accessible_factories=accessible_factories,
    )


def _resolve_active_factory_id(
    db: Session, *, user_id: int, preferred_factory_id: str | None
) -> str | None:
    if preferred_factory_id:
        row = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == user_id,
                UserFactoryRole.factory_id == preferred_factory_id,
            )
            .first()
        )
        if row:
            return preferred_factory_id
    row = (
        db.query(UserFactoryRole)
        .filter(UserFactoryRole.user_id == user_id)
        .order_by(UserFactoryRole.assigned_at.asc())
        .first()
    )
    return row.factory_id if row else None


def _build_active_template_context(
    db: Session,
    *,
    user: User,
    active_factory_id: str | None,
) -> ActiveWorkflowTemplateResponse:
    factory: Factory | None = None
    if active_factory_id:
        factory = (
            db.query(Factory)
            .filter(Factory.factory_id == active_factory_id, Factory.is_active.is_(True))
            .first()
        )
    if not factory:
        factory = (
            db.query(Factory)
            .join(UserFactoryRole, UserFactoryRole.factory_id == Factory.factory_id)
            .filter(UserFactoryRole.user_id == user.id, Factory.is_active.is_(True))
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )

    profile = get_factory_profile(factory.industry_type if factory else None)
    template_key = (
        factory.workflow_template_key
        if factory and factory.workflow_template_key
        else default_workflow_template_key(profile.key)
    )
    template = get_workflow_template(template_key)
    if not template:
        template_key = default_workflow_template_key(profile.key)
        template = get_workflow_template(template_key)
    return ActiveWorkflowTemplateResponse(
        factory_id=factory.factory_id if factory else active_factory_id,
        factory_name=factory.name if factory else user.factory_name,
        factory_code=factory.factory_code if factory else user.factory_code,
        industry_type=profile.key,
        industry_label=profile.label,
        workflow_template_key=template_key,
        workflow_template_label=template.label if template else template_key,
        starter_modules=list(profile.starter_modules),
        template=serialize_workflow_template(template) if template else {},
    )


# ── Consolidated endpoints ───────────────────────────────────────────────


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    AuthService.change_password(db, user, old_password=payload.old_password, new_password=payload.new_password, request=request)
    _log_event(db, action="PASSWORD_CHANGED", user_id=user.id, request=request, details="User changed password.")
    db.commit()
    response.delete_cookie(os.getenv("AUTH_SESSION_COOKIE", "auth_session"), path="/")
    response.delete_cookie(os.getenv("AUTH_CSRF_COOKIE", "auth_csrf"), path="/")
    return {"message": "Password changed successfully. Please log in again."}


@router.put("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserReadSchema:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    try:
        if payload.name is not None:
            from backend.utils import sanitize_text
            cleaned_name = sanitize_text(payload.name, max_length=120, preserve_newlines=False) or ""
            if len(cleaned_name) < 2:
                raise HTTPException(status_code=400, detail="Full name must be at least 2 characters.")
            user.name = cleaned_name
        if payload.phone_number is not None:
            from backend.phone_utils import normalize_phone_e164
            from backend.services.otp_service import apply_user_phone_change
            next_phone = normalize_phone_e164(payload.phone_number) if payload.phone_number else None
            if next_phone != user.phone_e164:
                apply_user_phone_change(user, next_phone)
        _log_event(db, action="PROFILE_UPDATED", user_id=user.id, request=request, details="User updated their profile.")
        db.commit()
        db.refresh(user)
        return UserReadSchema.model_validate(user)
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.exception("Profile update failed.")
        raise HTTPException(status_code=500, detail="Could not update profile.") from error


@router.post("/profile-photo")
async def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UserReadSchema:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    if not file.filename:
        raise HTTPException(status_code=400, detail="Upload a profile photo to continue.")
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Profile photo must be an image.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    max_bytes = AuthService.get_profile_photo_max_bytes()
    if len(image_bytes) > max_bytes:
        max_mb = max_bytes / (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Profile photo must be {max_mb:.0f} MB or smaller.")

    saved_photo_path: str | None = None
    previous_photo_path = user.profile_picture
    try:
        processed_photo = AuthService.prepare_profile_photo(image_bytes)
        saved_photo_path = AuthService.save_profile_photo(user_id=user.id, image_bytes=processed_photo)
        user.profile_picture = saved_photo_path
        _log_event(db, action="PROFILE_PHOTO_UPDATED", user_id=user.id, request=request, details="User updated their profile photo.")
        db.commit()
        db.refresh(user)
    except HTTPException:
        db.rollback()
        if saved_photo_path:
            AuthService.delete_profile_photo(saved_photo_path)
        raise
    except Exception as error:
        db.rollback()
        if saved_photo_path:
            AuthService.delete_profile_photo(saved_photo_path)
        logger.exception("Profile photo upload failed.")
        raise HTTPException(status_code=500, detail="Could not upload profile photo.") from error

    if previous_photo_path and previous_photo_path != user.profile_picture:
        AuthService.delete_profile_photo(previous_photo_path)
    return UserReadSchema.model_validate(user)


@router.delete("/profile-photo")
def delete_profile_photo(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> UserReadSchema:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    previous_photo_path = user.profile_picture
    try:
        user.profile_picture = None
        _log_event(db, action="PROFILE_PHOTO_REMOVED", user_id=user.id, request=request, details="User removed their profile photo.")
        db.commit()
        db.refresh(user)
    except Exception as error:
        db.rollback()
        logger.exception("Profile photo removal failed.")
        raise HTTPException(status_code=500, detail="Could not remove profile photo.") from error

    AuthService.delete_profile_photo(previous_photo_path)
    return UserReadSchema.model_validate(user)


@router.get("/profile-photo/{photo_name}")
def get_profile_photo(
    photo_name: str,
    request: Request,
    db: Session = Depends(get_db),
) -> FileResponse:
    session = get_current_session(db, request)
    user = get_current_user(db, session)
    current_photo_name = AuthService.extract_profile_photo_name(user.profile_picture)
    if current_photo_name != photo_name:
        raise HTTPException(status_code=404, detail="Profile photo not found.")
    photo_path = AuthService.get_profile_photo_dir() / photo_name
    if not photo_path.exists():
        raise HTTPException(status_code=404, detail="Profile photo not found.")
    return FileResponse(
        photo_path,
        media_type="image/jpeg",
        filename=photo_name,
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )


@router.post("/select-factory")
def select_factory(
    payload: SelectFactoryRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    session = get_current_session(db, request)
    require_csrf(request, session)
    user = get_current_user(db, session)
    role_row = (
        db.query(UserFactoryRole)
        .filter(
            UserFactoryRole.user_id == user.id,
            UserFactoryRole.factory_id == payload.factory_id,
        )
        .first()
    )
    if not role_row:
        raise HTTPException(status_code=403, detail="Access denied.")

    _log_event(db, action="FACTORY_SWITCH", user_id=user.id, request=request, details=f"Switched to factory {payload.factory_id}.")
    db.commit()
    return {
        "message": "Factory switched successfully.",
        "active_factory_id": payload.factory_id,
    }


@router.get("/session-summary")
def get_session_summary(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    session = get_current_session(db, request)
    user = get_current_user(db, session)
    return AuthService.get_session_summary(user, db)


@router.get("/active-workflow-template", response_model=ActiveWorkflowTemplateResponse)
def get_active_workflow_template(
    request: Request,
    db: Session = Depends(get_db),
) -> ActiveWorkflowTemplateResponse:
    session = get_current_session(db, request)
    user = get_current_user(db, session)
    active_factory_id = getattr(user, "active_factory_id", None)
    if not active_factory_id:
        active_factory_id = _resolve_active_factory_id(db, user_id=user.id, preferred_factory_id=None)
    return _build_active_template_context(db, user=user, active_factory_id=active_factory_id)
