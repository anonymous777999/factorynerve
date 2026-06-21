from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from backend.models.user import UserRole
from backend.routers import settings as settings_router
from backend.authorization import PDP
from backend.services.approval_service import approval_service, ApprovalDecision


class QueryStub:
    def __init__(self, memberships):
        self.memberships = memberships

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self.memberships


class DbStub:
    def __init__(self, memberships):
        self.memberships = memberships
        self.committed = False

    def query(self, model):
        return QueryStub(self.memberships)

    def commit(self):
        self.committed = True



def invoke_update(monkeypatch, *, actor_role, target_role, new_role):
    actor = SimpleNamespace(id=1, role=actor_role)
    target = SimpleNamespace(id=2, role=target_role, role_revision=0, user_code=2001, name="Target")
    memberships = [SimpleNamespace(role=target_role)]
    db = DbStub(memberships)

    # Monkeypatch PDP.require_permission (replaces old settings_router.require_role)
    monkeypatch.setattr(PDP, "require_permission", lambda self, **kwargs: None)
    # Monkeypatch ApprovalService to skip workflow (return no_approval_required)
    monkeypatch.setattr(approval_service, "initiate_approval", lambda *args, **kwargs: ApprovalDecision(result="no_approval_required", instance_id=None))
    monkeypatch.setattr(approval_service, "complete_approval", lambda *args, **kwargs: None)
    monkeypatch.setattr(settings_router, "resolve_org_id", lambda current_user: "org-1")
    monkeypatch.setattr(settings_router, "resolve_factory_id", lambda db, current_user: "factory-1")
    monkeypatch.setattr(
        settings_router,
        "_scoped_users_query",
        lambda db, current_user: SimpleNamespace(filter=lambda *args, **kwargs: SimpleNamespace(first=lambda: target)),
    )
    monkeypatch.setattr(settings_router, "_assert_role_update_allowed", lambda *args, **kwargs: None)
    monkeypatch.setattr(settings_router, "_has_other_privileged_user", lambda *args, **kwargs: True)
    monkeypatch.setattr(settings_router, "_write_admin_audit", lambda *args, **kwargs: None)

    return settings_router.update_user_role(
        2,
        settings_router.RoleUpdateRequest(role=new_role),
        request=SimpleNamespace(client=None, headers={}),
        db=db,
        current_user=actor,
    ), target, memberships, db


def test_manager_promotes_to_owner(monkeypatch):
    with pytest.raises(HTTPException) as exc:
        invoke_update(
            monkeypatch,
            actor_role=UserRole.MANAGER,
            target_role=UserRole.OPERATOR,
            new_role=UserRole.OWNER,
        )
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "INSUFFICIENT_RANK"


def test_manager_modifies_admin(monkeypatch):
    with pytest.raises(HTTPException) as exc:
        invoke_update(
            monkeypatch,
            actor_role=UserRole.MANAGER,
            target_role=UserRole.ADMIN,
            new_role=UserRole.OPERATOR,
        )
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "TARGET_OUTRANKS_YOU"


def test_admin_promotes_manager_to_admin(monkeypatch):
    with pytest.raises(HTTPException) as exc:
        invoke_update(
            monkeypatch,
            actor_role=UserRole.ADMIN,
            target_role=UserRole.MANAGER,
            new_role=UserRole.ADMIN,
        )
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "INSUFFICIENT_RANK"


def test_owner_promotes_manager_to_admin(monkeypatch):
    response, target, memberships, db = invoke_update(
        monkeypatch,
        actor_role=UserRole.OWNER,
        target_role=UserRole.MANAGER,
        new_role=UserRole.ADMIN,
    )
    assert response == {"message": "Role updated."}
    assert target.role == UserRole.ADMIN
    assert target.role_revision == 1
    assert memberships[0].role == UserRole.ADMIN
    assert db.committed is True


def test_admin_promotes_operator_to_manager(monkeypatch):
    response, target, memberships, db = invoke_update(
        monkeypatch,
        actor_role=UserRole.ADMIN,
        target_role=UserRole.OPERATOR,
        new_role=UserRole.MANAGER,
    )
    assert response == {"message": "Role updated."}
    assert target.role == UserRole.MANAGER
    assert target.role_revision == 1
    assert memberships[0].role == UserRole.MANAGER
    assert db.committed is True
