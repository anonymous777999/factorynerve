"""PostgreSQL Row-Level Security (RLS) context management.

Provides thread-local tenant context for RLS session parameters,
a SQLAlchemy checkout event to automatically set GUCs on every
connection from the pool, and a FastAPI middleware to bridge
request authentication with database-level tenant isolation.

Usage (application code — auto-wired by main.py)::

    from backend.middleware.rls_context import set_rls_context, clear_rls_context

    # After authenticating a user:
    set_rls_context(org_id="550e8400-...", user_id=42, factory_id="550e8400-...")

    # At end of request (FastAPI middleware handles this automatically):
    clear_rls_context()

Background workers MUST also call ``set_rls_context`` before
creating a database session::

    from backend.middleware.rls_context import set_rls_context, clear_rls_context

    def my_worker(org_id: str, user_id: int | None = None):
        set_rls_context(org_id=org_id, user_id=user_id, factory_id=None)
        try:
            with SessionLocal() as db:
                ...
        finally:
            clear_rls_context()
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Engine
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


logger = logging.getLogger(__name__)


# ── Thread-Local RLS Context ─────────────────────────────────────────────

_rls = threading.local()


def set_rls_context(
    *,
    org_id: str | None,
    user_id: int | None,
    factory_id: str | None,
) -> None:
    """Set RLS context for the current thread/request.

    Parameters
    ----------
    org_id : str | None
        The current tenant's organization UUID.
        Set to ``""`` (empty string) for platform-admin bypass
        (all rows become visible). Set to ``None`` to leave
        unset (rows with NULL org_id may be visible).
    user_id : int | None
        The current user's integer ID. Set to ``None`` for
        background workers that don't have a user context.
    factory_id : str | None
        The current factory UUID, or ``None`` if factory-scoped
        isolation is not needed. Set to ``""`` for platform-admin
        bypass (same semantics as ``org_id``).
    """
    # Store as simple attributes for speed — no locking needed
    # because each request/worker runs in its own thread.
    _rls.org_id = org_id
    _rls.user_id = user_id
    _rls.factory_id = factory_id


def clear_rls_context() -> None:
    """Clear RLS context for the current thread.

    MUST be called at the end of each request or background job
    to prevent context leaking to the next unit of work.
    """
    _rls.org_id = None
    _rls.user_id = None
    _rls.factory_id = None


def get_rls_context() -> dict[str, Any]:
    """Return the current RLS context (for logging / debugging)."""
    return {
        "org_id": getattr(_rls, "org_id", None),
        "user_id": getattr(_rls, "user_id", None),
        "factory_id": getattr(_rls, "factory_id", None),
    }


# ── PostgreSQL Connection Pool Event ────────────────────────────────────


def _register_checkout_event(engine: Engine) -> None:
    """Register the ``checkout`` event listener on *engine*.

    This is called once during application startup from ``main.py``.
    The listener sets PostgreSQL RLS GUCs on every connection
    pulled from the pool, ensuring each request gets the correct
    tenant context even if the connection was previously used by
    a different tenant.

    Calling this multiple times with the same engine is safe —
    SQLAlchemy deduplicates listeners.
    """

    @event.listens_for(engine, "checkout")
    def _set_rls_on_checkout(
        dbapi_connection: Any,
        _connection_record: Any,
        _connection_proxy: Any,
    ) -> None:
        """Set PostgreSQL session parameters on each connection checkout."""
        org_id = getattr(_rls, "org_id", None)
        user_id = getattr(_rls, "user_id", None)
        factory_id = getattr(_rls, "factory_id", None)

        cursor = dbapi_connection.cursor()
        try:
            if org_id is not None:
                cursor.execute(
                    "SET SESSION app.current_org_id = %s",
                    (org_id,),
                )
            if user_id is not None:
                cursor.execute(
                    "SET SESSION app.current_user_id = %s",
                    (str(user_id),),
                )
            if factory_id is not None:
                cursor.execute(
                    "SET SESSION app.current_factory_id = %s",
                    (factory_id,),
                )
            if org_id is not None or user_id is not None or factory_id is not None:
                logger.debug(
                    "RLS context set on connection checkout: "
                    "org_id=%s user_id=%s factory_id=%s",
                    org_id,
                    user_id,
                    factory_id,
                )
        except Exception:
            logger.exception(
                "Failed to set RLS session parameters on connection checkout. "
                "This may cause incorrect tenant isolation."
            )
        finally:
            cursor.close()

    logger.info("RLS checkout event registered on engine %s", engine)


# ── FastAPI Middleware ───────────────────────────────────────────────────


class RLSContextMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that sets RLS context from the authenticated user.

    The middleware runs during the dispatch phase. If the request has been
    authenticated and ``request.state.user`` is set, it extracts the tenant
    context and stores it in the thread-local ``_rls``.

    The SQLAlchemy ``checkout`` event (see ``_register_checkout_event``)
    reads this thread-local state and sets PostgreSQL GUCs accordingly.

    Place this middleware **after** authentication middleware so that
    the user is available on ``request.state``.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        user = getattr(request.state, "user", None)
        if user is not None:
            # Platform admin → bypass signal (empty string = see all rows)
            is_platform_admin = bool(
                getattr(user, "is_platform_admin", False)
            )
            if is_platform_admin:
                set_rls_context(
                    org_id="",
                    user_id=getattr(user, "id", None),
                    factory_id="",
                )
            else:
                set_rls_context(
                    org_id=getattr(user, "org_id", None),
                    user_id=getattr(user, "id", None),
                    factory_id=getattr(
                        user, "active_factory_id", None
                    ),
                )
        else:
            # Unauthenticated request — clear context
            clear_rls_context()

        try:
            response = await call_next(request)
        finally:
            # Important: always clear to prevent context leaking between
            # requests via the thread-pool (if Starlette reuses threads).
            clear_rls_context()

        return response
