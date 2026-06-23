"""Account lockout service — track failed login attempts and enforce lockout."""

from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.auth_user import AuthUser
logger = logging.getLogger(__name__)

# Config from env vars
LOCKOUT_THRESHOLD = int(os.getenv("AUTH_LOCKOUT_THRESHOLD", "5"))  # attempts before lockout
LOCKOUT_DURATION_MINUTES = int(os.getenv("AUTH_LOCKOUT_DURATION_MINUTES", "15"))  # auto-unlock after N minutes
PERSISTENT_LOCKOUT_ATTEMPTS = int(
    os.getenv("AUTH_PERSISTENT_LOCKOUT_ATTEMPTS", "20")
)  # after this many consecutive failures, requires admin unlock


def check_account_locked(user: AuthUser) -> bool:
    """Check if an account is currently locked.

    Auto-unlocks if the lockout duration has passed.
    Returns True if the account is locked, False otherwise.
    """
    if user.locked_until is None:
        return False
    now = datetime.now(timezone.utc)
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if locked_until <= now:
        user.locked_until = None
        user.failed_login_attempts = 0
        return False
    return True


def increment_failed_login(db: Session, user: AuthUser) -> bool:
    """Record a failed login attempt.

    Locks the account if threshold is reached.
    Returns True if the account is now locked, False otherwise.
    """
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    attempts = user.failed_login_attempts

    if attempts >= PERSISTENT_LOCKOUT_ATTEMPTS:
        # Persistent lockout — requires admin intervention (long expiry)
        user.locked_until = datetime.now(timezone.utc) + timedelta(days=365)
        logger.warning(
            "Persistent lockout triggered for user %s after %d failed attempts.",
            user.email,
            attempts,
        )
        db.add(user)
        return True

    if attempts >= LOCKOUT_THRESHOLD:
        # Temporary lockout with auto-unlock
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        logger.info(
            "Account locked for user %s after %d failed attempts. Auto-unlock at %s.",
            user.email,
            attempts,
            user.locked_until.isoformat(),
        )
        db.add(user)
        return True

    db.add(user)
    return False


def reset_failed_login(db: Session, user: AuthUser) -> None:
    """Reset failed login counter and unlock the account after a successful login."""
    if user.failed_login_attempts > 0 or user.locked_until is not None:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.add(user)


def admin_unlock_account(db: Session, *, email: str) -> bool:
    """Admin-only: unlock a locked account by email. Returns True if found and unlocked."""
    user = db.query(AuthUser).filter(AuthUser.email == email, AuthUser.is_active.is_(True)).first()
    if not user:
        return False
    user.failed_login_attempts = 0
    user.locked_until = None
    db.add(user)
    logger.info("Admin unlocked account for %s.", email)
    return True
