"""User security helpers."""

from __future__ import annotations

from backend.models.user import UserRole


ROLE_ORDER = {
    UserRole.ATTENDANCE: 0,
    UserRole.OPERATOR: 1,
    UserRole.SUPERVISOR: 2,
    UserRole.ACCOUNTANT: 2,
    UserRole.MANAGER: 3,
    UserRole.ADMIN: 4,
    UserRole.OWNER: 5,
}


def validate_factory_role_assignment(
    global_role: UserRole,
    factory_role: UserRole,
) -> None:
    if ROLE_ORDER[factory_role] > ROLE_ORDER[global_role]:
        raise ValueError(
            f"Factory role '{factory_role.value}' exceeds global role '{global_role.value}'. "
            "Factory role must be <= global role."
        )
