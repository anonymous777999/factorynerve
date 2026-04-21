"""Password reset helpers for legacy JWT auth."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.password_reset_token import PasswordResetToken
from backend.models.user import User


def _hash_token(token: str) -> str:
    pepper = os.getenv("PASSWORD_RESET_PEPPER") or ""
    return hashlib.sha256((token + pepper).encode("utf-8")).hexdigest()


def _expires_at(ttl_minutes: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=max(1, ttl_minutes))


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def create_reset_token(db: Session, *, user: User, ttl_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)
    raw = secrets.token_urlsafe(32)
    record = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(raw),
        created_at=now,
        expires_at=_expires_at(ttl_minutes),
    )
    db.add(record)
    db.flush()
    return raw


def verify_reset_token(db: Session, *, token: str) -> PasswordResetToken | None:
    token_hash = _hash_token(token)
    now = datetime.now(timezone.utc)
    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
        )
        .first()
    )
    if not record or _to_utc(record.expires_at) <= now:
        return None
    return record


def build_reset_link(token: str) -> str:
    base = os.getenv("PASSWORD_RESET_BASE_URL") or "http://127.0.0.1:3000/reset-password?token="
    if "{token}" in base:
        return base.replace("{token}", token)
    if base.endswith("token=") or base.endswith("reset_token="):
        return f"{base}{token}"
    separator = "&" if "?" in base else "?"
    return f"{base}{separator}token={token}"
