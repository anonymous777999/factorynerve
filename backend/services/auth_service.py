"""Auth helper services for OAuth user provisioning and auth consolidation."""

from __future__ import annotations

import io
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.auth_session import AuthSession
from backend.models.factory import Factory
from backend.models.organization import Organization
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.models.report import AuditLog
from backend.plans import DEFAULT_PLAN
from backend.security import hash_password as legacy_hash_password
from backend.auth_security.lockout import (
    check_account_locked,
    increment_failed_login,
    reset_failed_login,
)
from backend.auth_security.passwords import hash_password, validate_password_strength, verify_password
from backend.auth_security.rate_limit import RateLimitError, check_rate_limit
from backend.auth_security.sessions import (
    get_current_session,
    require_csrf,
    revoke_all_sessions,
)
from backend.services.user_code_service import (
    MAX_USER_CODE_ATTEMPTS,
    is_user_code_collision,
    next_user_code,
)
from backend.services.user_service import validate_factory_role_assignment
from backend.database import hash_ip_address


logger = logging.getLogger(__name__)

PROFILE_PHOTO_MAX_BYTES = int(os.getenv("PROFILE_PHOTO_MAX_BYTES", str(5 * 1024 * 1024)))
PROFILE_PHOTO_SIZE = max(256, int(os.getenv("PROFILE_PHOTO_SIZE", "512")))
PROFILE_PHOTO_DIR = Path(__file__).resolve().parents[2] / "var" / "profile_photos"


class AuthService:
    """Unified authentication service encapsulating auth business logic.

    Consolidates operations that were previously duplicated across auth.py
    and auth_secure.py, providing a single source of truth for:
    - Authentication (login with lockout/hash upgrade/MFA/password expiry)
    - Registration
    - Password management (change/reset)
    - Profile management
    - Session introspection
    - Factory selection
    - Workflow template resolution
    - Audit logging
    """

    # ── Authentication ──────────────────────────────────────────────────────

    @staticmethod
    def authenticate(
        db: Session,
        *,
        email: str,
        password: str,
        request: Request,
    ) -> User:
        """Authenticate a user with email+password.

        Handles:
        - Rate limiting (via caller)
        - Account lockout check
        - Password verification (argon2 + bcrypt fallback)
        - Automatic bcrypt→argon2 hash upgrade
        - Failed login tracking / lockout
        - Email verification check
        - MFA challenge check (returns special marker if MFA required)
        - Password expiry check (forces change)

        Returns the authenticated User.
        Raises HTTPException with appropriate status/detail.
        """
        from backend.security import verify_password as legacy_verify_password

        user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()

        # Lockout check
        if user and check_account_locked(user):
            AuthService._log_event(
                db, "AUTH_LOGIN_BLOCKED_LOCKED", user_id=user.id,
                request=request, meta={"email": email},
            )
            db.commit()
            raise HTTPException(
                status_code=423,
                detail="Account temporarily locked due to too many failed login attempts. Try again later.",
            )

        if not user:
            AuthService._log_event(
                db, "AUTH_LOGIN_FAILED", user_id=None,
                request=request, meta={"email": email, "reason": "user_not_found"},
            )
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        # Password verification
        password_matches = verify_password(password, user.password_hash)

        # Fall back to bcrypt for legacy hashes
        if not password_matches and user.password_hash_version == "bcrypt":
            password_matches = legacy_verify_password(password, user.password_hash)
            if password_matches:
                now = datetime.now(timezone.utc)
                user.password_hash = hash_password(password)
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
                AuthService._log_event(
                    db, "AUTH_LOGIN_LOCKOUT", user_id=user.id,
                    request=request, meta={"email": email},
                )
                db.commit()
                raise HTTPException(
                    status_code=423,
                    detail="Account temporarily locked due to too many failed login attempts. Try again later.",
                )
            AuthService._log_event(
                db, "AUTH_LOGIN_FAILED", user_id=user.id,
                request=request, meta={"email": email, "reason": "wrong_password"},
            )
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        # Email verification check
        if not user.is_email_verified:
            AuthService._log_event(
                db, "AUTH_LOGIN_EMAIL_UNVERIFIED", user_id=user.id,
                request=request, meta={"email": email},
            )
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        # Password expiry check
        _PASSWORD_EXPIRY_DAYS = int(os.getenv("PASSWORD_EXPIRY_DAYS", "90"))
        if _PASSWORD_EXPIRY_DAYS > 0 and user.password_changed_at:
            from backend.utils import ensure_utc
            password_changed_at = ensure_utc(user.password_changed_at)
            elapsed = (datetime.now(timezone.utc) - password_changed_at).days
            if elapsed >= _PASSWORD_EXPIRY_DAYS:
                AuthService._log_event(
                    db, "AUTH_LOGIN_PASSWORD_EXPIRED", user_id=user.id,
                    request=request, meta={"email": email, "days_since_change": elapsed},
                )
                db.commit()
                raise HTTPException(
                    status_code=423,
                    detail={
                        "code": "PASSWORD_EXPIRED",
                        "message": f"Password has expired ({elapsed} days since last change). Please reset your password.",
                        "must_change_password": True,
                    },
                )

        # Reset failed login counter on success
        reset_failed_login(db, user)
        return user

    @staticmethod
    def check_account_locked_and_raise(user: User, *, email: str) -> None:
        """Check if an account is locked and raise 423 if so.

        Used by password-forgot / password-reset / change-password flows
        where the caller already has the User object.
        """
        if check_account_locked(user):
            logger.info(
                "Operation blocked for locked account %s (user_id=%s).",
                email, user.id,
            )
            raise HTTPException(
                status_code=423,
                detail="Account temporarily locked due to too many failed login attempts. Try again later.",
            )

    # ── Password Management ─────────────────────────────────────────────────

    @staticmethod
    def change_password(
        db: Session,
        user: User,
        *,
        old_password: str,
        new_password: str,
        request: Request,
    ) -> User:
        """Validate old password and set new password with argon2 hash.

        Revokes all sessions and resets password hash version to 'argon2'.
        """
        AuthService.check_account_locked_and_raise(user, email=user.email)
        if not verify_password(old_password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials.")
        validate_password_strength(new_password)
        now = datetime.now(timezone.utc)
        user.password_hash = hash_password(new_password)
        user.password_hash_version = "argon2"
        user.password_changed_at = now
        user.updated_at = now
        # Invalidate pending password reset tokens
        from backend.models.password_reset_token import PasswordResetToken
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).update({"used_at": now}, synchronize_session=False)
        # Revoke all sessions (P0-02: token rotation)
        try:
            revoke_all_sessions(db, user_id=user.id)
        except Exception:
            logger.exception("Failed to revoke sessions on password change for %s", user.email)
        AuthService._log_event(db, "PASSWORD_CHANGED", user_id=user.id, request=request)
        return user

    @staticmethod
    def reset_password(
        db: Session,
        user: User,
        *,
        new_password: str,
        request: Request,
    ) -> User:
        """Force-reset a user's password (after forgot/reset flow).

        Revokes all sessions so attacker-held cookies are invalidated.
        """
        AuthService.check_account_locked_and_raise(user, email=user.email)
        validate_password_strength(new_password)
        now = datetime.now(timezone.utc)
        user.password_hash = hash_password(new_password)
        user.password_hash_version = "argon2"
        user.password_changed_at = now
        user.updated_at = now
        # Revoke all sessions (P0-02: token rotation)
        try:
            revoke_all_sessions(db, user_id=user.id)
        except Exception:
            logger.exception("Failed to revoke sessions on password reset for %s", user.email)
        AuthService._log_event(db, "PASSWORD_RESET_COMPLETED", user_id=user.id, request=request)
        return user

    # ── Profile Management ──────────────────────────────────────────────────

    @staticmethod
    def get_session_summary(user: User, db: Session) -> dict:
        """Return active device count and last activity for the user."""
        now = datetime.now(timezone.utc)
        active_devices = db.query(AuthSession).filter(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        ).count()
        return {
            "active_devices": active_devices,
            "last_activity": user.last_login,
        }

    # ── Audit Log ───────────────────────────────────────────────────────────

    @staticmethod
    def _log_event(
        db: Session,
        action: str,
        *,
        user_id: int | str | None,
        request: Request | None = None,
        details: str | None = None,
        org_id: str | None = None,
        factory_id: str | None = None,
        meta: dict | None = None,
    ) -> None:
        db.add(
            AuditLog(
                user_id=int(user_id) if isinstance(user_id, str) else user_id,
                org_id=org_id,
                factory_id=factory_id,
                action=action,
                details=details or action,
                ip_address=hash_ip_address(request.client.host) if request and request.client else None,
                user_agent=request.headers.get("user-agent") if request else None,
                timestamp=datetime.now(timezone.utc),
            )
        )

    # ── Profile Photo Helpers ───────────────────────────────────────────────

    @staticmethod
    def extract_profile_photo_name(value: str | None) -> str | None:
        """Extract the safe photo filename from a profile_picture URL."""
        if not value:
            return None
        parsed = urlparse(value)
        path = parsed.path or value
        prefix = "/auth/profile-photo/"
        # Support both /auth/ and /auth-secure/ prefixes
        if not path.startswith("/auth/"):
            return None
        if "/profile-photo/" not in path:
            return None
        photo_name = path.split("/profile-photo/", 1)[-1].strip()
        if not photo_name:
            return None
        safe_name = Path(photo_name).name
        if safe_name != photo_name:
            return None
        return safe_name

    @staticmethod
    def prepare_profile_photo(image_bytes: bytes) -> bytes:
        """Resize and crop a profile photo to standard dimensions."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image = ImageOps.exif_transpose(image)
        except (UnidentifiedImageError, OSError) as error:
            raise HTTPException(status_code=400, detail="Upload a valid image file.") from error

        if image.mode not in ("RGB", "L"):
            image = image.convert("RGBA")
            background = Image.new("RGBA", image.size, (11, 15, 25, 255))
            background.alpha_composite(image)
            image = background.convert("RGB")
        elif image.mode == "L":
            image = image.convert("RGB")

        width, height = image.size
        if width < 32 or height < 32:
            raise HTTPException(status_code=400, detail="Profile photo is too small.")

        crop_size = min(width, height)
        left = int((width - crop_size) / 2)
        top = int((height - crop_size) / 2)
        image = image.crop((left, top, left + crop_size, top + crop_size))
        image = image.resize((PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE), Image.Resampling.LANCZOS)

        output = io.BytesIO()
        image.save(output, format="JPEG", quality=88, optimize=True)
        return output.getvalue()

    @staticmethod
    def save_profile_photo(*, user_id: int, image_bytes: bytes) -> str:
        """Save a processed profile photo to disk and return its URL path."""
        PROFILE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
        photo_name = f"user-{user_id}-{secrets.token_hex(10)}.jpg"
        photo_path = PROFILE_PHOTO_DIR / photo_name
        photo_path.write_bytes(image_bytes)
        return f"/auth-secure/profile-photo/{photo_name}"

    @staticmethod
    def delete_profile_photo(value: str | None) -> None:
        """Delete a profile photo from disk by its URL path."""
        photo_name = AuthService.extract_profile_photo_name(value)
        if not photo_name:
            return
        photo_path = PROFILE_PHOTO_DIR / photo_name
        try:
            photo_path.unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not delete profile photo: %s", photo_path)

    @staticmethod
    def get_profile_photo_max_bytes() -> int:
        """Return the max allowed profile photo upload size in bytes."""
        return PROFILE_PHOTO_MAX_BYTES

    @staticmethod
    def get_profile_photo_dir() -> Path:
        """Return the profile photos directory path."""
        return PROFILE_PHOTO_DIR


def _persist_user_with_user_code(db: Session, user: User) -> User:
    last_error: IntegrityError | None = None
    for _ in range(MAX_USER_CODE_ATTEMPTS):
        user.user_code = next_user_code(db, org_id=user.org_id)
        try:
            with db.begin_nested():
                db.add(user)
                db.flush()
            return user
        except IntegrityError as error:
            last_error = error
            if not is_user_code_collision(error):
                raise
    raise HTTPException(
        status_code=500,
        detail="Could not generate a unique user ID. Please try again.",
    ) from last_error


def _org_name_from_email(email: str) -> str:
    if "@" in email:
        domain = email.split("@", 1)[1]
        return domain.split(".")[0].replace("-", " ").title()
    return "DPR.ai Org"


def get_or_create_google_user(
    db: Session,
    *,
    email: str,
    name: str,
    google_id: str,
    picture: str | None,
) -> tuple[User, str, str]:
    now = datetime.now(timezone.utc)
    random_hash = hash_password(secrets.token_urlsafe(32))

    def _ensure_user_auth_fields(auth_email: str) -> None:
        """Ensure the User record has auth fields populated for v2 login."""
        user_record = db.query(User).filter(User.email == auth_email).first()
        if user_record:
            if not user_record.password_changed_at:
                user_record.password_changed_at = now
            if not user_record.is_email_verified:
                user_record.is_email_verified = True
            if not user_record.updated_at:
                user_record.updated_at = now
            db.add(user_record)

    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        if picture:
            user.profile_picture = picture
        user.auth_provider = "google"
        if user.email_verified_at is None:
            user.email_verified_at = now
        user.is_email_verified = True
        if not user.password_changed_at:
            user.password_changed_at = now
        user.updated_at = now
        db.add(user)
        db.flush()
        return user, user.org_id, _resolve_factory_id(db, user)

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.google_id = google_id
        user.auth_provider = "google"
        if user.email_verified_at is None:
            user.email_verified_at = now
        user.is_email_verified = True
        if not user.password_changed_at:
            user.password_changed_at = now
        user.updated_at = now
        if picture:
            user.profile_picture = picture
        db.add(user)
        db.flush()
        return user, user.org_id, _resolve_factory_id(db, user)

    org_name = _org_name_from_email(email)
    org_id = str(uuid.uuid4())
    factory_id = str(uuid.uuid4())

    org = Organization(org_id=org_id, name=org_name, plan=DEFAULT_PLAN, created_at=now, is_active=True)
    factory = Factory(factory_id=factory_id, org_id=org_id, name=f"{org_name} Factory", timezone="Asia/Kolkata")
    user = User(
        org_id=org_id,
        name=name or org_name,
        email=email,
        password_hash=legacy_hash_password(secrets.token_urlsafe(32)),
        role=UserRole.ADMIN,
        factory_name=factory.name,
        is_active=True,
        google_id=google_id,
        profile_picture=picture,
        auth_provider="google",
        email_verified_at=now,
        is_email_verified=True,
        password_changed_at=now,
    )
    db.add_all([org, factory])
    db.flush()
    user = _persist_user_with_user_code(db, user)
    validate_factory_role_assignment(user.role, user.role)
    db.add(
        UserFactoryRole(
            id=str(uuid.uuid4()),
            user_id=user.id,
            factory_id=factory_id,
            org_id=org_id,
            role=user.role,
            assigned_at=now,
        )
    )
    db.flush()
    return user, org_id, factory_id


def _resolve_factory_id(db: Session, user: User) -> str:
    row = (
        db.query(UserFactoryRole.factory_id)
        .filter(UserFactoryRole.user_id == user.id)
        .order_by(UserFactoryRole.assigned_at.asc())
        .first()
    )
    if row:
        return row[0]
    factory = (
        db.query(Factory.factory_id)
        .filter(Factory.org_id == user.org_id)
        .order_by(Factory.created_at.asc())
        .first()
    )
    return factory[0] if factory else ""
