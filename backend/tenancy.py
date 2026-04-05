"""Helpers for tenant (org/factory) scoping."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.models.user_factory_role import UserFactoryRole


def resolve_org_id(user: Any) -> str | None:
    """Return active org_id from token context or fallback to user.org_id."""
    return getattr(user, "active_org_id", None) or getattr(user, "org_id", None)


def resolve_factory_id(db: Session, user: Any) -> str | None:
    """Return active factory_id from token context or fallback to first assigned factory."""
    active_factory_id = getattr(user, "active_factory_id", None)
    if active_factory_id:
        return active_factory_id
    row = (
        db.query(UserFactoryRole.factory_id)
        .filter(UserFactoryRole.user_id == user.id)
        .order_by(UserFactoryRole.assigned_at.asc())
        .first()
    )
    return row[0] if row else None
