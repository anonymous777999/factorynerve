"""Helpers for org-scoped user-facing IDs."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.user import User


MIN_USER_CODE = 10000
MAX_USER_CODE_ATTEMPTS = 12


def next_user_code(db: Session, *, org_id: str) -> int:
    max_code = (
        db.query(func.max(User.user_code))
        .filter(User.org_id == org_id)
        .scalar()
    )
    if not max_code or int(max_code) < MIN_USER_CODE:
        return MIN_USER_CODE
    return int(max_code) + 1


def is_user_code_collision(error: IntegrityError) -> bool:
    message = str(getattr(error, "orig", error)).lower()
    return "user_code" in message and "org_id" in message
