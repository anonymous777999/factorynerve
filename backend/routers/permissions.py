"""Permissions router — exposes the current user's effective permissions for frontend use.

GET /auth/permissions returns:
- The list of permission keys the current user has based on their role.
- A version number that increments on role/permission changes (for cache invalidation).
- Scope-level groupings for UI rendering.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.authorization import PermissionCatalog
from backend.authorization.permission_catalog import ScopeLevel
from backend.database import get_db
from backend.models.user import User
from backend.security import get_current_user


router = APIRouter(tags=["Permissions"])


class PermissionManifestResponse(BaseModel):
    """Response schema for the permissions manifest endpoint."""

    user_id: int
    role: str
    permissions: list[str] = Field(description="All permission keys the user has.")
    by_scope: dict[str, list[str]] = Field(
        description="Permissions grouped by scope level (FACTORY, ORG, PLATFORM)."
    )
    version: int = Field(
        description="Monotonically increasing org-level version. "
        "Frontend must invalidate its cached manifest when this changes."
    )


@router.get("/permissions", response_model=PermissionManifestResponse)
def get_permissions_manifest(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PermissionManifestResponse:
    """Return the current user's effective permission manifest.

    The frontend caches this response and uses it to show/hide UI elements.
    When a 403 response includes a higher version number, the frontend must
    re-fetch this manifest and re-evaluate the action.
    """
    role = current_user.role

    # Resolve all permission keys for this user's role
    permissions = PermissionCatalog.permission_keys_for_role(role)

    # Group by scope level
    by_scope: dict[str, list[str]] = {}
    for key in permissions:
        entry = PermissionCatalog.get(key)
        if entry is not None:
            by_scope.setdefault(entry.scope_level.value, []).append(key)

    # Version is derived from the user's role_revision (incremented on role change)
    version = int(getattr(current_user, "role_revision", 0) or 0)

    return PermissionManifestResponse(
        user_id=current_user.id,
        role=role.value if hasattr(role, "value") else str(role),
        permissions=permissions,
        by_scope=by_scope,
        version=version,
    )
