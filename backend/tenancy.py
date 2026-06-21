"""Helpers for tenant (org/factory) scoping."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from backend.models.user_factory_role import UserFactoryRole

logger = logging.getLogger(__name__)


def resolve_org_id(user: Any) -> str | None:
    """Return active org_id from token context or fallback to user.org_id."""
    return getattr(user, "active_org_id", None) or getattr(user, "org_id", None)


def resolve_factory_id(db: Session, user: Any) -> str | None:
    """Return active factory_id from token context or fallback to first assigned factory.

    SAFETY: This function MUST return a factory_id scoped to the user's org.
    Queries that omit a factory_id filter can leak data across factories within
    the same org. If no explicit factory_id is set in the JWT token, we fall
    back to the first assigned factory role — but only if the user has at least
    one factory role. Callers should always pass the returned factory_id as a
    query filter to prevent cross-factory data leaks.
    """
    active_factory_id = getattr(user, "active_factory_id", None)
    if active_factory_id:
        # Validate the factory belongs to the user's org
        if hasattr(user, "org_id") and user.org_id:
            factory_org = (
                db.query(UserFactoryRole.org_id)
                .filter(
                    UserFactoryRole.user_id == user.id,
                    UserFactoryRole.factory_id == active_factory_id,
                )
                .first()
            )
            if factory_org and factory_org[0] == user.org_id:
                return active_factory_id
            # Token has a factory_id that doesn't belong to the user's org —
            # this is either a stale token or a possible tenancy violation.
            # Return None to force an upstream 400 rather than silently
            # switching to a different factory.
            logger.warning(
                "[tenancy] active_factory_id %s does not belong to org %s for user %s — returning None",
                active_factory_id,
                user.org_id,
                getattr(user, "id", "?"),
            )
            return None
        return active_factory_id
    row = (
        db.query(UserFactoryRole.factory_id)
        .filter(UserFactoryRole.user_id == user.id)
        .order_by(UserFactoryRole.assigned_at.asc())
        .first()
    )
    return row[0] if row else None
