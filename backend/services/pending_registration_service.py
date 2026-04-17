"""Helpers for verify-first public signup flow."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.pending_registration import PendingRegistration
from backend.models.user import UserRole


def _hash_token(token: str) -> str:
    pepper = os.getenv("EMAIL_VERIFICATION_PEPPER") or ""
    return hashlib.sha256((token + pepper).encode("utf-8")).hexdigest()


def _expires_at(ttl_hours: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=max(1, ttl_hours))


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def create_or_update_pending_registration(
    db: Session,
    *,
    name: str,
    email: str,
    org_id: str | None,
    invited_by_user_id: int | None,
    password_hash: str,
    requested_role: UserRole,
    factory_name: str,
    company_code: str | None,
    phone_number: str | None,
    custom_note: str | None,
    ttl_hours: int,
) -> str:
    now = datetime.now(timezone.utc)
    raw = secrets.token_urlsafe(32)
    record = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    if not record:
        record = PendingRegistration(
            name=name,
            email=email,
            org_id=org_id,
            invited_by_user_id=invited_by_user_id,
            password_hash=password_hash,
            requested_role=requested_role,
            factory_name=factory_name,
            company_code=company_code,
            phone_number=phone_number,
            custom_note=custom_note,
            token_hash=_hash_token(raw),
            created_at=now,
            updated_at=now,
            verification_sent_at=now,
            expires_at=_expires_at(ttl_hours),
            used_at=None,
        )
        db.add(record)
        db.flush()
        return raw

    record.name = name
    record.org_id = org_id
    record.invited_by_user_id = invited_by_user_id
    record.password_hash = password_hash
    record.requested_role = requested_role
    record.factory_name = factory_name
    record.company_code = company_code
    record.phone_number = phone_number
    record.custom_note = custom_note
    record.token_hash = _hash_token(raw)
    record.updated_at = now
    record.verification_sent_at = now
    record.expires_at = _expires_at(ttl_hours)
    record.used_at = None
    db.add(record)
    db.flush()
    return raw


def verify_pending_registration_token(db: Session, *, token: str) -> PendingRegistration | None:
    token_hash = _hash_token(token)
    now = datetime.now(timezone.utc)
    record = (
        db.query(PendingRegistration)
        .filter(
            PendingRegistration.token_hash == token_hash,
            PendingRegistration.used_at.is_(None),
        )
        .first()
    )
    if not record or _to_utc(record.expires_at) <= now:
        return None
    return record
