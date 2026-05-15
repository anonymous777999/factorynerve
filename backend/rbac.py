"""RBAC helpers for consistent permission checks."""

from __future__ import annotations

from fastapi import HTTPException

from backend.models.user import User, UserRole


ROLE_ORDER = {
    UserRole.ATTENDANCE: 0,
    UserRole.OPERATOR: 1,
    UserRole.ACCOUNTANT: 2,
    UserRole.SUPERVISOR: 3,
    UserRole.MANAGER: 4,
    UserRole.ADMIN: 5,
    UserRole.OWNER: 6,
}

STOCK_VARIANCE_APPROVAL_THRESHOLD = 5.0  # percent


def role_rank(role: UserRole) -> int:
    return ROLE_ORDER.get(role, 0)


def require_role(user: User, minimum: UserRole) -> None:
    if role_rank(user.role) < role_rank(minimum):
        raise HTTPException(status_code=403, detail="Access denied.")


def require_any_role(user: User, roles: set[UserRole]) -> None:
    if user.role not in roles:
        raise HTTPException(status_code=403, detail="Access denied.")


def assert_not_self_approval(record_user_id: int, current_user_id: int) -> None:
    if record_user_id == current_user_id:
        raise HTTPException(status_code=403, detail="You cannot approve or reject your own record.")


def is_admin_or_owner(user: User) -> bool:
    return user.role in {UserRole.ADMIN, UserRole.OWNER}


def is_manager_or_admin(user: User) -> bool:
    return user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}


def is_supervisor_or_higher(user: User) -> bool:
    return role_rank(user.role) >= role_rank(UserRole.SUPERVISOR)
