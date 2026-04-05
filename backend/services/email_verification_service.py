"""Email verification helpers for live JWT auth."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.email_verification_token import EmailVerificationToken
from backend.models.user import User


def _hash_token(token: str) -> str:
    pepper = os.getenv("EMAIL_VERIFICATION_PEPPER") or ""
    return hashlib.sha256((token + pepper).encode("utf-8")).hexdigest()


def _expires_at(ttl_hours: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=max(1, ttl_hours))


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def create_verification_token(db: Session, *, user: User, ttl_hours: int) -> str:
    raw = secrets.token_urlsafe(32)
    record = EmailVerificationToken(
        user_id=user.id,
        token_hash=_hash_token(raw),
        expires_at=_expires_at(ttl_hours),
    )
    db.add(record)
    db.flush()
    return raw


def verify_verification_token(db: Session, *, token: str) -> EmailVerificationToken | None:
    token_hash = _hash_token(token)
    now = datetime.now(timezone.utc)
    record = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.used_at.is_(None),
        )
        .first()
    )
    if not record or _to_utc(record.expires_at) <= now:
        return None
    return record


def build_verification_link(token: str) -> str:
    base = os.getenv("EMAIL_VERIFICATION_BASE_URL") or "http://127.0.0.1:3000/verify-email?token="
    if "{token}" in base:
        return base.replace("{token}", token)
    if base.endswith("token=") or base.endswith("verification_token="):
        return f"{base}{token}"
    separator = "&" if "?" in base else "?"
    return f"{base}{separator}token={token}"
