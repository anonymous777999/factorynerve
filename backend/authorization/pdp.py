"""Policy Decision Point (PDP) — evaluates permission requests against the catalog.

Supports two modes:
- "strict" (default): raises HTTPException(403) immediately on deny.
- "advisory": returns PDPDecision with outcome but does not raise.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session


logger = logging.getLogger(__name__)

from backend.authorization.permission_catalog import (
    PermissionCatalog,
    PermissionDef,
    ResourceContext,
    ScopeLevel,
)
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.security import get_current_user
from backend.cache import build_cache_key, get_json


# ── PDP Modes ─────────────────────────────────────────────────────────────────
PDP_MODE_STRICT = "strict"
PDP_MODE_ADVISORY = "advisory"
PDP_MODE = PDP_MODE_STRICT  # default; can be overridden via env in the future


# ── Decision Data ─────────────────────────────────────────────────────────────
@dataclass
class PDPDecision:
    """Outcome of a PDP permission evaluation."""

    result: str  # "allowed", "denied", "approval_required"
    permission_key: str
    reason: str | None = None
    instance_id: str | None = None  # populated when approval_required
    requires_mfa: bool = False

    @property
    def is_allowed(self) -> bool:
        return self.result == "allowed"

    @property
    def is_denied(self) -> bool:
        return self.result == "denied"


# ── Request Context ───────────────────────────────────────────────────────────
def build_request_context(request: Any = None) -> dict[str, Any]:
    """Extract a lightweight context dict from the incoming request (IP, user-agent, path).

    This is a stub that can be enhanced when FastAPI Request is available. For now it
    returns a minimal dict. The full implementation in handlers receives the actual Request.
    """
    ctx: dict[str, Any] = {}
    if request is not None:
        ctx["ip"] = getattr(request.client, "host", None) if hasattr(request, "client") else None
        ctx["user_agent"] = request.headers.get("user-agent") if hasattr(request, "headers") else None
        ctx["path"] = request.url.path if hasattr(request, "url") and request.url is not None else None
    return ctx


# ── PDP Class ─────────────────────────────────────────────────────────────────
class PDP:
    """Policy Decision Point.

    Evaluates whether *actor* (a User) has *permission_key* in the given *resource*
    scope and *request_context*.

    Usage (direct):
        pdp = PDP(db=db)
        decision = pdp.check_permission(actor=user, permission_key="production.entry.create")
        if decision.is_denied:
            raise HTTPException(status_code=403, detail=decision.reason)

    Usage (with auto-raise):
        pdp = PDP(db=db)
        pdp.require_permission(actor=user, permission_key="production.entry.create")
    """

    def __init__(self, db: Session, *, mode: str = PDP_MODE) -> None:
        self._db = db
        self._mode = mode

    # ── Public API ─────────────────────────────────────────────────────────────

    def require_permission(
        self,
        actor: User,
        permission_key: str,
        resource: ResourceContext | None = None,
        request_context: dict[str, Any] | None = None,
    ) -> PDPDecision:
        """Check permission and raise 403 if denied. Returns the decision if allowed.

        Performs a quick role_revision freshness check using the Redis-backed
        cache (D-18). If the cached role_revision differs from the actor's
        current role_revision, it means the role was modified externally.
        The DB already has the latest value (actor is loaded fresh), so no
        additional action is needed, but the discrepancy is logged.
        """
        # ── Role revision freshness check ───────────────────────────────
        cached_revision = get_json(build_cache_key("role_revision", actor.id))
        if cached_revision is not None and cached_revision != actor.role_revision:
            logger.info(
                "Role revision changed for user_id=%s: cached=%s current=%s. "
                "Role may have been modified externally.",
                actor.id,
                cached_revision,
                actor.role_revision,
            )

        decision = self.check_permission(
            actor=actor,
            permission_key=permission_key,
            resource=resource,
            request_context=request_context,
        )
        if decision.result == "denied":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=decision.reason or "Access denied.",
            )
        return decision

    def check_permission(
        self,
        actor: User,
        permission_key: str,
        resource: ResourceContext | None = None,
        request_context: dict[str, Any] | None = None,
    ) -> PDPDecision:
        """Evaluate permission without raising. Returns a PDPDecision."""
        # 1. Look up permission in catalog
        entry = PermissionCatalog.get(permission_key)
        if entry is None:
            return PDPDecision(
                result="denied",
                permission_key=permission_key,
                reason=f"Unknown permission key: {permission_key}.",
            )

        # 2. Role check — does the actor's role have this permission?
        if actor.role not in entry.default_roles:
            return PDPDecision(
                result="denied",
                permission_key=permission_key,
                reason=f"Role '{actor.role.value}' does not have the '{permission_key}' permission.",
            )

        # 3. Scope check — skip scope checks for PLATFORM permissions if the
        #    actor is a platform admin. Otherwise, check factory/org match.
        if entry.scope_level == ScopeLevel.PLATFORM:
            if not self._check_platform_scope(actor):
                return PDPDecision(
                    result="denied",
                    permission_key=permission_key,
                    reason="Platform-level permission requires platform admin access.",
                )
        elif entry.scope_level == ScopeLevel.FACTORY:
            if not self._check_factory_scope(actor, resource):
                return PDPDecision(
                    result="denied",
                    permission_key=permission_key,
                    reason="Actor does not have access to the requested factory scope.",
                )
        elif entry.scope_level == ScopeLevel.ORG:
            if not self._check_org_scope(actor, resource):
                return PDPDecision(
                    result="denied",
                    permission_key=permission_key,
                    reason="Actor does not have access to the requested org scope.",
                )

        # 4. MFA requirement check
        mfa_required = entry.requires_mfa
        if mfa_required and not self._check_mfa(actor):
            return PDPDecision(
                result="denied",
                permission_key=permission_key,
                reason="MFA verification is required for this action.",
                requires_mfa=True,
            )

        # 5. All checks passed — allowed
        return PDPDecision(
            result="allowed",
            permission_key=permission_key,
            requires_mfa=mfa_required,
        )

    # ── Scope Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _check_platform_scope(actor: User) -> bool:
        """PLATFORM-scoped permissions are reserved for platform admins / superadmins.

        FIX (PDP-02): Requires BOTH the is_platform_admin flag AND an ADMIN/OWNER
        role. Previously having ADMIN/OWNER role alone was sufficient, which could
        grant unintended platform-level access to org-level admins.
        """
        if not bool(getattr(actor, "is_platform_admin", False)):
            return False
        return actor.role in {
            UserRole.ADMIN,
            UserRole.OWNER,
        }

    def _check_factory_scope(self, actor: User, resource: ResourceContext | None) -> bool:
        """FACTORY-scoped: actor must have an explicit role binding to the requested factory.

        Queries UserFactoryRole to verify the actor has a direct role assignment
        to the factory identified by resource.factory_id.
        """
        if resource is None or resource.factory_id is None:
            return True
        # Reject if actor has no org context at all
        if not actor.org_id:
            return False
        # Verify direct factory membership via UserFactoryRole
        return (
            self._db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == actor.id,
                UserFactoryRole.factory_id == resource.factory_id,
            )
            .first()
            is not None
        )

    @staticmethod
    def _check_org_scope(actor: User, resource: ResourceContext | None) -> bool:
        """ORG-scoped: actor must belong to the requested org."""
        if resource is None or resource.org_id is None:
            return True
        return actor.org_id == resource.org_id

    def _check_mfa(self, actor: User) -> bool:
        """Check whether the actor has passed MFA verification for the current session.

        Uses the unified User model (auth consolidation Phase 2+). MFA fields
        are now on the User model directly, so no AuthUser query is needed.

        Returns True if:
        - The token payload contains `mfa_verified: True`, OR
        - The user does NOT have MFA enabled (no MFA requirement)

        Returns False only when the user has MFA enabled but the current token was
        NOT issued after an MFA verification (i.e., they logged in without MFA).

        FIX (PDP-01): When payload is None (no token available), we now check
        whether the user has MFA enabled. Previously this fell through to True,
        allowing MFA-required actions to proceed without verification. If MFA
        is enabled and we can't verify it, we require it.
        """
        payload = getattr(actor, "current_token_payload", None)

        # If payload explicitly confirms MFA verification, allow
        if payload is not None and payload.get("mfa_verified"):
            return True

        # MFA fields are now directly on the User model (auth consolidation).
        # No more AuthUser lookup — actor IS the user with all auth fields.
        if actor.mfa_enabled:
            # MFA is enabled — if payload is None or mfa_verified is False, block
            return False

        # User doesn't have MFA enabled — always allowed
        return True


# ── FastAPI Dependency ────────────────────────────────────────────────────────

class RequirePermission:
    """FastAPI dependency that evaluates a permission and raises 403 if denied.

    Usage:
        @router.get("/entries")
        def list_entries(
            _: None = Depends(RequirePermission("production.entry.view")),
            ...
        ):
            ...

    The dependency also accepts optional resource-context parameters:
        @router.post("/batches/{id}/approve")
        def approve_batch(
            _: None = Depends(RequirePermission(
                "production.batch.variance.approve",
                factory_id=lambda: resolve_factory_id(db, current_user),
            )),
            ...
        ):
            ...
    """

    def __init__(
        self,
        permission_key: str,
        *,
        factory_id: str | None = None,
        org_id: str | None = None,
        mode: str = PDP_MODE,
    ) -> None:
        self._permission_key = permission_key
        self._factory_id = factory_id
        self._org_id = org_id
        self._mode = mode

    def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> None:
        pdp = PDP(db=db, mode=self._mode)
        resource = ResourceContext(
            factory_id=self._factory_id,
            org_id=self._org_id,
        )
        pdp.require_permission(
            actor=current_user,
            permission_key=self._permission_key,
            resource=resource,
        )
