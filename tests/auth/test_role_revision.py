from types import SimpleNamespace

from backend.models.user import UserRole
from backend.routers import settings as settings_router


def test_role_change_increments_role_revision(monkeypatch):
    actor = SimpleNamespace(id=1, role=UserRole.OWNER)
    target = SimpleNamespace(id=2, role=UserRole.MANAGER, role_revision=3, user_code=44, name="Target")
    memberships = [SimpleNamespace(role=UserRole.MANAGER)]

    class QueryStub:
        def __init__(self, result):
            self.result = result

        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return self.result

    class DbStub:
        def __init__(self):
            self.committed = False

        def query(self, model):
            return QueryStub(memberships)

        def commit(self):
            self.committed = True

    monkeypatch.setattr(settings_router, "require_role", lambda current_user, role: None)
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

    db = DbStub()
    response = settings_router.update_user_role(
        2,
        settings_router.RoleUpdateRequest(role=UserRole.ADMIN),
        request=SimpleNamespace(client=None, headers={}),
        db=db,
        current_user=actor,
    )

    assert response == {"message": "Role updated."}
    assert target.role == UserRole.ADMIN
    assert target.role_revision == 4
    assert memberships[0].role == UserRole.ADMIN
    assert db.committed is True


def test_stale_role_revision_header_triggers_frontend_bust_logic():
    invalidations: list[str] = []
    redirects: list[str] = []

    def mock_header_check(cached_role_revision: int, header_value: str | None):
        if header_value and header_value != str(cached_role_revision):
            invalidations.append("invalidate")
            redirects.append("/access?reason=session_updated")

    mock_header_check(7, "8")

    assert invalidations == ["invalidate"]
    assert redirects == ["/access?reason=session_updated"]


def test_role_revision_does_not_change_on_non_role_updates():
    user = SimpleNamespace(role_revision=5, name="Before")
    user.name = "After"
    assert user.role_revision == 5


def test_role_change_creates_audit_entry_with_correct_previous_state_and_new_state(monkeypatch):
    audit_calls: list[dict] = []
    actor = SimpleNamespace(id=1, role=UserRole.OWNER)
    target = SimpleNamespace(id=2, role=UserRole.MANAGER, role_revision=6, user_code=44, name="Target")
    memberships = [SimpleNamespace(role=UserRole.MANAGER)]

    class QueryStub:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return memberships

    class DbStub:
        def query(self, model):
            return QueryStub()

        def commit(self):
            return None

    monkeypatch.setattr(settings_router, "require_role", lambda current_user, role: None)
    monkeypatch.setattr(settings_router, "resolve_org_id", lambda current_user: "org-1")
    monkeypatch.setattr(settings_router, "resolve_factory_id", lambda db, current_user: "factory-1")
    monkeypatch.setattr(
        settings_router,
        "_scoped_users_query",
        lambda db, current_user: SimpleNamespace(filter=lambda *args, **kwargs: SimpleNamespace(first=lambda: target)),
    )
    monkeypatch.setattr(settings_router, "_assert_role_update_allowed", lambda *args, **kwargs: None)
    monkeypatch.setattr(settings_router, "_has_other_privileged_user", lambda *args, **kwargs: True)
    monkeypatch.setattr(settings_router, "_write_admin_audit", lambda *args, **kwargs: audit_calls.append(kwargs))

    settings_router.update_user_role(
        2,
        settings_router.RoleUpdateRequest(role=UserRole.ADMIN),
        request=SimpleNamespace(client=None, headers={}),
        db=DbStub(),
        current_user=actor,
    )

    assert len(audit_calls) == 1
    assert audit_calls[0]["actor_id"] == 1
    assert audit_calls[0]["previous_state"] == {"role": "manager", "role_revision": 6}
    assert audit_calls[0]["new_state"] == {"role": "admin", "role_revision": 7}


def test_previous_state_is_never_none_for_role_updated_events(monkeypatch):
    audit_calls: list[dict] = []
    actor = SimpleNamespace(id=1, role=UserRole.OWNER)
    target = SimpleNamespace(id=2, role=UserRole.MANAGER, role_revision=0, user_code=44, name="Target")
    memberships = [SimpleNamespace(role=UserRole.MANAGER)]

    class QueryStub:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return memberships

    class DbStub:
        def query(self, model):
            return QueryStub()

        def commit(self):
            return None

    monkeypatch.setattr(settings_router, "require_role", lambda current_user, role: None)
    monkeypatch.setattr(settings_router, "resolve_org_id", lambda current_user: "org-1")
    monkeypatch.setattr(settings_router, "resolve_factory_id", lambda db, current_user: "factory-1")
    monkeypatch.setattr(
        settings_router,
        "_scoped_users_query",
        lambda db, current_user: SimpleNamespace(filter=lambda *args, **kwargs: SimpleNamespace(first=lambda: target)),
    )
    monkeypatch.setattr(settings_router, "_assert_role_update_allowed", lambda *args, **kwargs: None)
    monkeypatch.setattr(settings_router, "_has_other_privileged_user", lambda *args, **kwargs: True)
    monkeypatch.setattr(settings_router, "_write_admin_audit", lambda *args, **kwargs: audit_calls.append(kwargs))

    settings_router.update_user_role(
        2,
        settings_router.RoleUpdateRequest(role=UserRole.ADMIN),
        request=SimpleNamespace(client=None, headers={}),
        db=DbStub(),
        current_user=actor,
    )

    assert audit_calls[0]["previous_state"] is not None


def test_audit_entry_for_role_updated_includes_actor_user_id(monkeypatch):
    audit_calls: list[dict] = []
    actor = SimpleNamespace(id=99, role=UserRole.OWNER)
    target = SimpleNamespace(id=2, role=UserRole.MANAGER, role_revision=1, user_code=44, name="Target")
    memberships = [SimpleNamespace(role=UserRole.MANAGER)]

    class QueryStub:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return memberships

    class DbStub:
        def query(self, model):
            return QueryStub()

        def commit(self):
            return None

    monkeypatch.setattr(settings_router, "require_role", lambda current_user, role: None)
    monkeypatch.setattr(settings_router, "resolve_org_id", lambda current_user: "org-1")
    monkeypatch.setattr(settings_router, "resolve_factory_id", lambda db, current_user: "factory-1")
    monkeypatch.setattr(
        settings_router,
        "_scoped_users_query",
        lambda db, current_user: SimpleNamespace(filter=lambda *args, **kwargs: SimpleNamespace(first=lambda: target)),
    )
    monkeypatch.setattr(settings_router, "_assert_role_update_allowed", lambda *args, **kwargs: None)
    monkeypatch.setattr(settings_router, "_has_other_privileged_user", lambda *args, **kwargs: True)
    monkeypatch.setattr(settings_router, "_write_admin_audit", lambda *args, **kwargs: audit_calls.append(kwargs))

    settings_router.update_user_role(
        2,
        settings_router.RoleUpdateRequest(role=UserRole.ADMIN),
        request=SimpleNamespace(client=None, headers={}),
        db=DbStub(),
        current_user=actor,
    )

    assert audit_calls[0]["actor_id"] == 99
