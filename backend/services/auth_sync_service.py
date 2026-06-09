"""Helpers for keeping legacy User and secure AuthUser auth state synchronized."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from backend.auth_security.passwords import hash_password as hash_password_secure
from backend.auth_security.passwords import verify_password as verify_password_secure
from backend.models.auth_user import AuthUser
from backend.models.user import User
from backend.security import verify_password as verify_password_legacy


def normalize_auth_email(email: str | None) -> str:
    return (email or "").strip().lower()


def hash_prefix(value: str | None, *, visible: int = 12) -> str:
    if not value:
        return "missing"
    trimmed = value.strip()
    if not trimmed:
        return "missing"
    return f"{trimmed[:visible]}***"


def detect_password_hash_algorithm(password_hash: str | None) -> str:
    if not password_hash:
        return "missing"
    trimmed = password_hash.strip()
    if not trimmed:
        return "missing"
    if trimmed.startswith("$argon2"):
        return "argon2"
    if trimmed.startswith("$2a$") or trimmed.startswith("$2b$") or trimmed.startswith("$2y$"):
        return "bcrypt"
    return "unknown"


@dataclass(frozen=True)
class AuthUserSyncResult:
    auth_user: AuthUser
    created: bool
    updated: bool
    rows_updated: int
    normalized_email: str


def ensure_auth_user(
    db: Session,
    *,
    email: str,
    raw_password: str | None = None,
    secure_password_hash: str | None = None,
    is_active: bool | None = None,
    is_email_verified: bool | None = None,
) -> AuthUserSyncResult:
    normalized_email = normalize_auth_email(email)
    if not normalized_email:
        raise ValueError("Email is required to synchronize AuthUser.")
    if secure_password_hash is None and raw_password is not None:
        secure_password_hash = hash_password_secure(raw_password)

    auth_user = db.query(AuthUser).filter(AuthUser.email == normalized_email).first()
    created = False
    updated = False

    if auth_user is None:
        if secure_password_hash is None:
            raise ValueError("Raw password or secure password hash is required to create AuthUser.")
        auth_user = AuthUser(
            email=normalized_email,
            password_hash=secure_password_hash,
            is_active=True if is_active is None else bool(is_active),
            is_email_verified=False if is_email_verified is None else bool(is_email_verified),
        )
        db.add(auth_user)
        db.flush()
        created = True
        return AuthUserSyncResult(
            auth_user=auth_user,
            created=True,
            updated=False,
            rows_updated=1,
            normalized_email=normalized_email,
        )

    if auth_user.email != normalized_email:
        auth_user.email = normalized_email
        updated = True
    if secure_password_hash is not None and auth_user.password_hash != secure_password_hash:
        auth_user.password_hash = secure_password_hash
        updated = True
    if is_active is not None and auth_user.is_active != bool(is_active):
        auth_user.is_active = bool(is_active)
        updated = True
    if is_email_verified is not None and auth_user.is_email_verified != bool(is_email_verified):
        auth_user.is_email_verified = bool(is_email_verified)
        updated = True
    if updated:
        db.add(auth_user)
        db.flush()
    return AuthUserSyncResult(
        auth_user=auth_user,
        created=created,
        updated=updated,
        rows_updated=1 if updated else 0,
        normalized_email=normalized_email,
    )


def ensure_auth_user_for_legacy_user(
    db: Session,
    *,
    legacy_user: User,
    raw_password: str | None = None,
    secure_password_hash: str | None = None,
    is_active: bool | None = None,
    is_email_verified: bool | None = None,
) -> AuthUserSyncResult:
    return ensure_auth_user(
        db,
        email=legacy_user.email,
        raw_password=raw_password,
        secure_password_hash=secure_password_hash,
        is_active=legacy_user.is_active if is_active is None else is_active,
        is_email_verified=bool(legacy_user.email_verified_at) if is_email_verified is None else is_email_verified,
    )


def inspect_auth_state(db: Session, *, email: str, password_probe: str | None = None) -> dict[str, object]:
    normalized_email = normalize_auth_email(email)
    legacy_user = (
        db.query(User)
        .filter(User.email == normalized_email)
        .first()
    )
    auth_user = (
        db.query(AuthUser)
        .filter(AuthUser.email == normalized_email)
        .first()
    )
    fresh_secure_probe_hash = hash_password_secure(password_probe) if password_probe else None
    return {
        "normalized_email": normalized_email,
        "legacy_user_exists": bool(legacy_user),
        "secure_user_exists": bool(auth_user),
        "legacy_user_id": getattr(legacy_user, "id", None),
        "auth_user_id": getattr(auth_user, "id", None),
        "legacy_user_active_flag": getattr(legacy_user, "is_active", None),
        "auth_user_active_flag": getattr(auth_user, "is_active", None),
        "legacy_email_verified_flag": bool(getattr(legacy_user, "email_verified_at", None)) if legacy_user else None,
        "auth_user_email_verified_flag": getattr(auth_user, "is_email_verified", None),
        "legacy_hash_prefix": hash_prefix(getattr(legacy_user, "password_hash", None)),
        "secure_hash_prefix": hash_prefix(getattr(auth_user, "password_hash", None)),
        "legacy_hash_algorithm": detect_password_hash_algorithm(getattr(legacy_user, "password_hash", None)),
        "secure_hash_algorithm": detect_password_hash_algorithm(getattr(auth_user, "password_hash", None)),
        "secure_hash_starts_with_argon2_marker": bool(
            getattr(auth_user, "password_hash", None)
            and str(auth_user.password_hash).strip().startswith("$argon2")
        ),
        "secure_hash_starts_with_bcrypt_marker": bool(
            getattr(auth_user, "password_hash", None)
            and (
                str(auth_user.password_hash).strip().startswith("$2a$")
                or str(auth_user.password_hash).strip().startswith("$2b$")
                or str(auth_user.password_hash).strip().startswith("$2y$")
            )
        ),
        "legacy_verify_password_probe_result": (
            verify_password_legacy(password_probe, legacy_user.password_hash)
            if password_probe and legacy_user
            else None
        ),
        "secure_verify_password_probe_result": (
            verify_password_secure(password_probe, auth_user.password_hash)
            if password_probe and auth_user
            else None
        ),
        "fresh_secure_hash_prefix": hash_prefix(fresh_secure_probe_hash),
        "fresh_secure_hash_algorithm": detect_password_hash_algorithm(fresh_secure_probe_hash),
        "fresh_secure_verify_probe_result": (
            verify_password_secure(password_probe, fresh_secure_probe_hash)
            if password_probe and fresh_secure_probe_hash
            else None
        ),
    }
