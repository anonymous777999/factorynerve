"""Policy Decision Point (PDP) infrastructure for role-based and permission-based access control.

This package provides:
- PermissionCatalog: registry of all permission keys with role grants, scope, and MFA requirements.
- PDP (Policy Decision Point): evaluates whether an actor has a specific permission.
- ResourceContext: context for scoped permission checks (factory, org).
- PDPDecision: result of a permission evaluation.
- RequirePermission: FastAPI dependency for declarative permission checks in route handlers.
"""

from backend.authorization.pdp import PDP, PDPDecision, PDP_MODE, RequirePermission
from backend.authorization.permission_catalog import PermissionCatalog, ResourceContext

__all__ = [
    "PDP",
    "PDPDecision",
    "PDP_MODE",
    "RequirePermission",
    "PermissionCatalog",
    "ResourceContext",
]
