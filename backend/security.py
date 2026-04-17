"""Security helpers for authentication and authorization."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
import secrets
from typing import Any

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value

from backend.database import get_db
from backend.models.report import TokenBlacklist
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.utils import get_config
from backend.auth_cookies import get_access_cookie


logger = logging.getLogger(__name__)
config = get_config()
_auth_scheme = HTTPBearer(auto_error=False)


def _coerce_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def make_unusable_password_hash(label: str = "oauth") -> str:
    return f"!{label}!{secrets.token_urlsafe(24)}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(
    *,
    user_id: int,
    role: str,
    email: str,
    org_id: str | None = None,
    factory_id: str | None = None,
) -> str:
    issued_at = datetime.now(timezone.utc)
    expire = issued_at + timedelta(hours=config.jwt_expire_hours)
    payload = {
        "sub": str(user_id),
        "org_id": org_id,
        "factory_id": factory_id,
        "role": role,
        "email": email,
        "iat": int(issued_at.timestamp()),
        "iat_ms": int(issued_at.timestamp() * 1000),
        "exp": int(expire.timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, config.jwt_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, config.jwt_secret_key, algorithms=["HS256"])
    except JWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from error


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
    credentials: HTTPAuthorizationCredentials | None = Depends(_auth_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else None
    if not token and request is not None:
        token = get_access_cookie(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    payload = decode_access_token(token)
    org_id = payload.get("org_id")
    factory_id = payload.get("factory_id")
    jti = str(payload.get("jti"))
    if db.query(TokenBlacklist).filter(TokenBlacklist.token_jti == jti).first():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked.")

    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    issued_at_ms = payload.get("iat_ms")
    if not isinstance(issued_at_ms, (int, float)):
        issued_at = payload.get("iat")
        if isinstance(issued_at, (int, float)):
            issued_at_ms = int(issued_at) * 1000
    if not isinstance(issued_at_ms, (int, float)):
        exp = payload.get("exp")
        if isinstance(exp, (int, float)):
            issued_at_seconds = int(exp) - int(timedelta(hours=config.jwt_expire_hours).total_seconds())
            issued_at_ms = issued_at_seconds * 1000
    if user.session_invalidated_at and isinstance(issued_at_ms, (int, float)):
        invalidated_at = _coerce_utc(user.session_invalidated_at)
        if int(issued_at_ms) <= int(invalidated_at.timestamp() * 1000):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated. Please log in again.")
    if org_id and user.org_id and org_id != user.org_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated. Please log in again.")
    active_factory_id = None
    active_org_id = user.org_id
    effective_role = user.role
    if factory_id:
        membership = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == user.id,
                UserFactoryRole.factory_id == factory_id,
            )
            .first()
        )
        if not membership:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated. Please log in again.")
        if org_id and membership.org_id and membership.org_id != org_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated. Please log in again.")
        active_factory_id = factory_id
        active_org_id = membership.org_id or user.org_id
        effective_role = membership.role
    set_committed_value(user, "role", effective_role)
    setattr(user, "active_org_id", active_org_id)
    setattr(user, "active_factory_id", active_factory_id)
    return user


def is_admin(user: User) -> bool:
    return user.role in {UserRole.ADMIN, UserRole.OWNER}
