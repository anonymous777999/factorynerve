import pytest

from backend.models.user import UserRole
from backend.services.user_service import validate_factory_role_assignment


def test_assigning_factory_role_manager_to_operator_global_role_raises_value_error():
    with pytest.raises(ValueError, match="exceeds global role"):
        validate_factory_role_assignment(UserRole.OPERATOR, UserRole.MANAGER)


def test_assigning_factory_role_operator_to_operator_global_role_succeeds():
    validate_factory_role_assignment(UserRole.OPERATOR, UserRole.OPERATOR)


def test_assigning_factory_role_admin_to_admin_global_role_succeeds():
    validate_factory_role_assignment(UserRole.ADMIN, UserRole.ADMIN)


def test_assigning_factory_role_owner_to_admin_global_role_raises_value_error():
    with pytest.raises(ValueError, match="exceeds global role"):
        validate_factory_role_assignment(UserRole.ADMIN, UserRole.OWNER)
