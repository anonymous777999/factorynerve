from datetime import datetime, timezone
from types import SimpleNamespace

from backend.models.user import UserRole
from backend.routers.auth_secure import _build_me_permissions as get_me


def _make_user(role: UserRole):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=1,
        org_id="org-1",
        user_code=1001,
        name="QA User",
        email="qa@example.com",
        role=role,
        role_revision=0,
        factory_name="Factory A",
        factory_code="F001",
        phone_number=None,
        phone_e164=None,
        is_platform_admin=False,
        is_active=True,
        phone_verification_status="pending",
        phone_verified_at=None,
        phone_last_otp_sent_at=None,
        phone_otp_attempts=0,
        email_verified_at=now,
        verification_sent_at=now,
        created_at=now,
        last_login=None,
        profile_picture=None,
    )


def test_owner_role_returns_can_manage_billing_true():
    permissions = get_me(_make_user(UserRole.OWNER))
    assert permissions.can_manage_billing is True


def test_manager_role_returns_can_manage_billing_false():
    permissions = get_me(_make_user(UserRole.MANAGER))
    assert permissions.can_manage_billing is False


def test_operator_role_returns_can_view_analytics_false():
    permissions = get_me(_make_user(UserRole.OPERATOR))
    assert permissions.can_view_analytics is False


def test_supervisor_role_returns_can_approve_entries_true():
    permissions = get_me(_make_user(UserRole.SUPERVISOR))
    assert permissions.can_approve_entries is True


def test_permissions_dict_keys_are_consistent_across_all_7_roles():
    expected_keys = {
        "can_view_billing",
        "can_manage_users",
        "can_view_analytics",
        "can_approve_entries",
        "can_export_data",
        "can_manage_billing",
        "can_view_admin_panel",
    }
    for role in UserRole:
        permissions = get_me(_make_user(role))
        assert set(permissions.model_dump().keys()) == expected_keys
