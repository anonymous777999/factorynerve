"""Token helpers for access/refresh issuance."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone, timedelta

from jose import jwt
from sqlalchemy.orm import Session

from backend.models.refresh_token import RefreshToken
from backend.models.user import User
from backend.utils import get_config


config = get_config()


def create_access_token_short(
    *, user_id: int, role: str, email: str, org_id: str | None, factory_id: str | None, minutes: int = 15
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=max(1, minutes))
    payload = {
        "sub": str(user_id),
        "org_id": org_id,
        "factory_id": factory_id,
        "role": role,
        "email": email,
        "exp": int(expire.timestamp()),
        "jti": f"{user_id}-{int(expire.timestamp())}",
    }
    return jwt.encode(payload, config.jwt_secret_key, algorithm="HS256")


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256((token + "refresh").encode("utf-8")).hexdigest()


def issue_refresh_token(
    db: Session, *, user: User, org_id: str | None, factory_id: str | None, days: int = 30
) -> str:
    token = secrets.token_urlsafe(40)
    now = datetime.now(timezone.utc)
    record = RefreshToken(
        token_hash=_hash_refresh_token(token),
        user_id=user.id,
        org_id=org_id,
        factory_id=factory_id,
        created_at=now,
        expires_at=now + timedelta(days=max(1, days)),
        revoked_at=None,
        last_used_at=None,
    )
    db.add(record)
    return token
