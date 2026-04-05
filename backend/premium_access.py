"""Premium access guards for high-tier analytics surfaces."""

from __future__ import annotations

import inspect
from functools import wraps
from typing import Any, Callable, TypeVar, cast

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.plans import get_org_plan, normalize_plan, plan_rank
from backend.tenancy import resolve_org_id


F = TypeVar("F", bound=Callable[..., Any])


def require_premium_plan(
    db: Session,
    current_user: Any,
    *,
    min_plan: str = "factory",
) -> str:
    required = normalize_plan(min_plan)
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=getattr(current_user, "id", None))
    if plan_rank(plan) < plan_rank(required):
        raise HTTPException(
            status_code=402,
            detail=f"Premium analytics requires {required.title()} plan. Current plan: {plan.title()}.",
        )
    return plan


def premium_required(*, min_plan: str = "factory") -> Callable[[F], F]:
    """Decorator for FastAPI endpoints that already expose db/current_user dependencies."""

    def decorator(func: F) -> F:
        signature = inspect.signature(func)

        if inspect.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any):
                db = kwargs.get("db")
                current_user = kwargs.get("current_user")
                if not isinstance(db, Session) or current_user is None:
                    raise RuntimeError("premium_required expects 'db' and 'current_user' endpoint arguments.")
                require_premium_plan(db, current_user, min_plan=min_plan)
                return await func(*args, **kwargs)

            async_wrapper.__signature__ = signature  # type: ignore[attr-defined]
            return cast(F, async_wrapper)

        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any):
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            if not isinstance(db, Session) or current_user is None:
                raise RuntimeError("premium_required expects 'db' and 'current_user' endpoint arguments.")
            require_premium_plan(db, current_user, min_plan=min_plan)
            return func(*args, **kwargs)

        sync_wrapper.__signature__ = signature  # type: ignore[attr-defined]
        return cast(F, sync_wrapper)

    return decorator
