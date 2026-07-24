"""Security helpers for authentication and authorization."""

from __future__ import annotations

import logging

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.auth_security.sessions import (
    get_current_session as get_v2_session,
    get_current_user as get_user_from_session,
)
from backend.middleware.rls_context import set_rls_context
from backend.cache import build_cache_key, set_json


logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def validate_password_strength(password: str) -> None:
    if len(password) < 12:
        raise ValueError("Password must be at least 12 characters.")
    if password.islower() or password.isupper():
        raise ValueError("Password must include mixed case.")
    if password.isalpha() or password.isdigit():
        raise ValueError("Password must include letters and numbers.")
    if not any(char for char in password if not char.isalnum()):
        raise ValueError("Password must include at least one symbol.")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Authenticate the current request via v2 session cookie.

    Uses the unified session.user_id FK when available (auth consolidation
    Phase 2+), falling back to the AuthUser email bridge for sessions
    created before migration (transition period).
    """
    session = get_v2_session(db, request)
    user = get_user_from_session(db, session)

    # Resolve active factory from the session's stored factory field
    active_factory_id = getattr(session, "factory_id", None)
    if active_factory_id:
        membership = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == user.id,
                UserFactoryRole.factory_id == active_factory_id,
                UserFactoryRole.org_id == user.org_id,
            )
            .first()
        )
        if not membership:
            active_factory_id = None

    setattr(user, "active_org_id", user.org_id)
    setattr(user, "active_factory_id", active_factory_id)

    # ── Set RLS context for PostgreSQL Row-Level Security ────────────
    # This sets the thread-local context that the SQLAlchemy checkout
    # event uses to configure PostgreSQL GUCs (app.current_org_id,
    # app.current_user_id, app.current_factory_id) on every connection
    # from the pool. Platform admins get an empty-string bypass signal
    # so their queries can see all tenants.
    is_platform_admin = bool(getattr(user, "is_platform_admin", False))
    if is_platform_admin:
        set_rls_context(
            org_id="",
            user_id=user.id,
            factory_id="",
        )
    else:
        set_rls_context(
            org_id=user.org_id,
            user_id=user.id,
            factory_id=active_factory_id,
        )

    # Cache role_revision for this user so the PDP can use it as a
    # fast-path freshness check on subsequent requests within the TTL.
    # Redis-backed (via cache.py) so it survives server restarts.
    set_json(build_cache_key("role_revision", user.id), user.role_revision, 300)

    return user


def is_admin(user: User) -> bool:
    return user.role in {UserRole.ADMIN, UserRole.OWNER}
