"""Security helpers for authentication and authorization."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.auth_security.sessions import (
    get_current_session as get_v2_session,
    SESSION_COOKIE,
)


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
    # Use v2 session cookie to authenticate
    from backend.models.auth_user import AuthUser

    session = get_v2_session(db, request)
    auth_user = db.query(AuthUser).filter(
        AuthUser.id == session.auth_user_id,
        AuthUser.is_active.is_(True),
    ).first()
    if not auth_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    # Resolve the legacy User record by email
    user = db.query(User).filter(
        User.email == auth_user.email,
        User.is_active.is_(True),
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    # Resolve active factory from the v2 session's stored factory field
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
    return user


def is_admin(user: User) -> bool:
    return user.role in {UserRole.ADMIN, UserRole.OWNER}
