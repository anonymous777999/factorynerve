"""User security helpers."""

from __future__ import annotations

from backend.models.user import UserRole, role_rank


def validate_factory_role_assignment(
    global_role: UserRole,
    factory_role: UserRole,
) -> None:
    if role_rank(factory_role) > role_rank(global_role):
        raise ValueError(
            f"Factory role '{factory_role.value}' exceeds global role '{global_role.value}'. "
            "Factory role must be <= global role."
        )
