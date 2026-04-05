from http import HTTPStatus

from tests.utils import register_user, set_org_plan_for_user_email, unique_email, unique_factory


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_auth_context_and_factory_switch_with_cookies(http_client):
    user = register_user(http_client, role="admin", use_cookies=True)
    csrf = http_client.cookies.get("dpr_csrf")
    assert csrf, "CSRF cookie not set during registration."

    auth_headers = _auth_headers(user["access_token"])
    set_org_plan_for_user_email(user["email"], "growth")

    second_factory_name = unique_factory()
    created = http_client.post(
        "/settings/factories",
        headers=auth_headers,
        json={
            "name": second_factory_name,
            "location": "Plant 2",
            "address": "Expansion Zone",
            "timezone": "Asia/Kolkata",
            "industry_type": "steel",
            "workflow_template_key": "steel-core-pack",
        },
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    second_factory_id = created.json()["factory"]["factory_id"]

    initial_context = http_client.get("/auth/context")
    assert initial_context.status_code == HTTPStatus.OK, initial_context.text
    initial_payload = initial_context.json()
    assert len(initial_payload["factories"]) >= 2
    assert initial_payload["active_factory_id"] != second_factory_id
    assert initial_payload["organization"]["accessible_factories"] >= 2

    switched = http_client.post(
        "/auth/select-factory",
        headers={"X-CSRF-Token": csrf},
        json={"factory_id": second_factory_id},
    )
    assert switched.status_code == HTTPStatus.OK, switched.text
    switched_payload = switched.json()
    assert switched_payload["active_factory_id"] == second_factory_id
    assert switched_payload["active_factory"]["industry_type"] == "steel"

    refreshed_context = http_client.get("/auth/context")
    assert refreshed_context.status_code == HTTPStatus.OK, refreshed_context.text
    refreshed_payload = refreshed_context.json()
    assert refreshed_payload["active_factory_id"] == second_factory_id
    assert refreshed_payload["active_factory"]["workflow_template_key"] == "steel-core-pack"


def test_factory_templates_match_industry_profiles(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])

    general = http_client.get("/settings/factory/templates?industry_type=general", headers=headers)
    assert general.status_code == HTTPStatus.OK, general.text
    general_payload = general.json()
    assert general_payload["active_template_key"] == "general-ops-pack"
    assert any(section["key"] == "manpower_rollup" for section in general_payload["active_template"]["sections"])

    steel = http_client.get("/settings/factory/templates?industry_type=steel", headers=headers)
    assert steel.status_code == HTTPStatus.OK, steel.text
    steel_payload = steel.json()
    assert steel_payload["active_template_key"] == "steel-core-pack"
    assert any(section["key"] == "steel_traceability" for section in steel_payload["active_template"]["sections"])

    mismatch = http_client.put(
        "/settings/factory",
        headers=headers,
        json={
            "factory_name": user["factory_name"],
            "industry_type": "general",
            "workflow_template_key": "steel-core-pack",
            "target_morning": 10,
            "target_evening": 10,
            "target_night": 10,
        },
    )
    assert mismatch.status_code == HTTPStatus.BAD_REQUEST, mismatch.text
    assert "Workflow template does not match" in mismatch.text


def test_active_workflow_template_tracks_selected_factory(http_client):
    user = register_user(http_client, role="admin", use_cookies=True)
    csrf = http_client.cookies.get("dpr_csrf")
    assert csrf

    headers = _auth_headers(user["access_token"])
    set_org_plan_for_user_email(user["email"], "growth")

    initial_template = http_client.get("/auth/active-workflow-template")
    assert initial_template.status_code == HTTPStatus.OK, initial_template.text
    initial_payload = initial_template.json()
    assert initial_payload["workflow_template_key"] == "general-ops-pack"
    assert initial_payload["template"]["key"] == "general-ops-pack"

    second_factory_name = unique_factory()
    created = http_client.post(
        "/settings/factories",
        headers=headers,
        json={
            "name": second_factory_name,
            "industry_type": "steel",
            "workflow_template_key": "steel-core-pack",
        },
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    second_factory_id = created.json()["factory"]["factory_id"]

    switched = http_client.post(
        "/auth/select-factory",
        headers={"X-CSRF-Token": csrf},
        json={"factory_id": second_factory_id},
    )
    assert switched.status_code == HTTPStatus.OK, switched.text

    switched_template = http_client.get("/auth/active-workflow-template")
    assert switched_template.status_code == HTTPStatus.OK, switched_template.text
    switched_payload = switched_template.json()
    assert switched_payload["workflow_template_key"] == "steel-core-pack"
    assert switched_payload["industry_type"] == "steel"
    assert any(section["key"] == "steel_traceability" for section in switched_payload["template"]["sections"])


def test_admin_can_assign_manager_to_multiple_factories(http_client):
    admin = register_user(http_client, role="admin")
    headers = _auth_headers(admin["access_token"])
    set_org_plan_for_user_email(admin["email"], "growth")

    created = http_client.post(
        "/settings/factories",
        headers=headers,
        json={
            "name": unique_factory(),
            "location": "Rolling Mill 2",
            "address": "Expansion Yard",
            "timezone": "Asia/Kolkata",
            "industry_type": "steel",
            "workflow_template_key": "steel-core-pack",
        },
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    second_factory_id = created.json()["factory"]["factory_id"]

    manager_email = unique_email()
    invited = http_client.post(
        "/settings/users/invite",
        headers=headers,
        json={
            "name": "QA Multi Factory Manager",
            "email": manager_email,
            "role": "manager",
            "factory_name": admin["factory_name"],
        },
    )
    assert invited.status_code == HTTPStatus.CREATED, invited.text
    invited_payload = invited.json()
    temp_password = invited_payload["temp_password"]

    users = http_client.get("/settings/users", headers=headers)
    assert users.status_code == HTTPStatus.OK, users.text
    manager_row = next((row for row in users.json() if row["email"] == manager_email), None)
    assert manager_row is not None
    assert manager_row["factory_count"] == 1

    access = http_client.get(f"/settings/users/{manager_row['id']}/factory-access", headers=headers)
    assert access.status_code == HTTPStatus.OK, access.text
    access_payload = access.json()
    assigned_factory_ids = [item["factory_id"] for item in access_payload["factories"] if item["has_access"]]
    assert len(assigned_factory_ids) == 1

    updated = http_client.put(
        f"/settings/users/{manager_row['id']}/factory-access",
        headers=headers,
        json={"factory_ids": [assigned_factory_ids[0], second_factory_id]},
    )
    assert updated.status_code == HTTPStatus.OK, updated.text
    updated_payload = updated.json()
    assert updated_payload["user"]["factory_count"] == 2
    assert {
        item["factory_id"] for item in updated_payload["factories"] if item["has_access"]
    } == {assigned_factory_ids[0], second_factory_id}

    refreshed_users = http_client.get("/settings/users", headers=headers)
    assert refreshed_users.status_code == HTTPStatus.OK, refreshed_users.text
    refreshed_manager = next((row for row in refreshed_users.json() if row["email"] == manager_email), None)
    assert refreshed_manager is not None
    assert refreshed_manager["factory_count"] == 2

    login = http_client.post(
        "/auth/login",
        json={"email": manager_email, "password": temp_password},
    )
    assert login.status_code == HTTPStatus.OK, login.text
    manager_headers = _auth_headers(login.json()["access_token"])

    context = http_client.get("/auth/context", headers=manager_headers)
    assert context.status_code == HTTPStatus.OK, context.text
    context_payload = context.json()
    assert len(context_payload["factories"]) == 2
    assert context_payload["organization"]["accessible_factories"] == 2

    switched = http_client.post(
        "/auth/select-factory",
        headers=manager_headers,
        json={"factory_id": second_factory_id},
    )
    assert switched.status_code == HTTPStatus.OK, switched.text
    assert switched.json()["active_factory_id"] == second_factory_id


def test_factory_user_limit_counts_multi_factory_memberships(http_client):
    admin = register_user(http_client, role="admin")
    headers = _auth_headers(admin["access_token"])
    set_org_plan_for_user_email(admin["email"], "growth")

    created = http_client.post(
        "/settings/factories",
        headers=headers,
        json={
            "name": unique_factory(),
            "location": "Rolling Mill 2",
            "address": "Expansion Yard",
            "timezone": "Asia/Kolkata",
            "industry_type": "steel",
            "workflow_template_key": "steel-core-pack",
        },
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    second_factory_id = created.json()["factory"]["factory_id"]

    worker_emails = [unique_email(), unique_email()]
    for email in worker_emails:
        invited = http_client.post(
            "/settings/users/invite",
            headers=headers,
            json={
                "name": "QA Multi Factory Operator",
                "email": email,
                "role": "operator",
                "factory_name": admin["factory_name"],
            },
        )
        assert invited.status_code == HTTPStatus.CREATED, invited.text

    users = http_client.get("/settings/users", headers=headers)
    assert users.status_code == HTTPStatus.OK, users.text
    worker_rows = [row for row in users.json() if row["email"] in worker_emails]
    assert len(worker_rows) == 2

    for worker in worker_rows:
        access = http_client.get(f"/settings/users/{worker['id']}/factory-access", headers=headers)
        assert access.status_code == HTTPStatus.OK, access.text
        assigned_factory_ids = [item["factory_id"] for item in access.json()["factories"] if item["has_access"]]
        updated = http_client.put(
            f"/settings/users/{worker['id']}/factory-access",
            headers=headers,
            json={"factory_ids": [*assigned_factory_ids, second_factory_id]},
        )
        assert updated.status_code == HTTPStatus.OK, updated.text

    switched = http_client.post(
        "/auth/select-factory",
        headers=headers,
        json={"factory_id": second_factory_id},
    )
    assert switched.status_code == HTTPStatus.OK, switched.text
    switched_headers = _auth_headers(switched.json()["access_token"])

    blocked = http_client.post(
        "/settings/users/invite",
        headers=switched_headers,
        json={
            "name": "QA Fourth User",
            "email": unique_email(),
            "role": "operator",
            "factory_name": created.json()["factory"]["name"],
        },
    )
    assert blocked.status_code == HTTPStatus.FORBIDDEN, blocked.text
    assert "User limit reached" in blocked.text


def test_inviting_existing_org_user_adds_them_to_current_factory(http_client):
    admin = register_user(http_client, role="admin")
    headers = _auth_headers(admin["access_token"])
    set_org_plan_for_user_email(admin["email"], "growth")

    invited_email = unique_email()
    first_invite = http_client.post(
        "/settings/users/invite",
        headers=headers,
        json={
            "name": "QA Existing Operator",
            "email": invited_email,
            "role": "operator",
            "factory_name": admin["factory_name"],
        },
    )
    assert first_invite.status_code == HTTPStatus.CREATED, first_invite.text
    temp_password = first_invite.json()["temp_password"]

    created = http_client.post(
        "/settings/factories",
        headers=headers,
        json={
            "name": unique_factory(),
            "location": "Dispatch Yard",
            "address": "Unit 2",
            "timezone": "Asia/Kolkata",
            "industry_type": "steel",
            "workflow_template_key": "steel-core-pack",
        },
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    second_factory_id = created.json()["factory"]["factory_id"]

    switched = http_client.post(
        "/auth/select-factory",
        headers=headers,
        json={"factory_id": second_factory_id},
    )
    assert switched.status_code == HTTPStatus.OK, switched.text
    switched_headers = _auth_headers(switched.json()["access_token"])

    second_invite = http_client.post(
        "/settings/users/invite",
        headers=switched_headers,
        json={
            "name": "QA Existing Operator",
            "email": invited_email,
            "role": "operator",
            "factory_name": admin["factory_name"],
        },
    )
    assert second_invite.status_code == HTTPStatus.CREATED, second_invite.text
    second_payload = second_invite.json()
    assert "Existing user added" in second_payload["message"]
    assert not second_payload.get("temp_password")

    users = http_client.get("/settings/users", headers=switched_headers)
    assert users.status_code == HTTPStatus.OK, users.text
    invited_row = next((row for row in users.json() if row["email"] == invited_email), None)
    assert invited_row is not None
    assert invited_row["factory_count"] == 2

    login = http_client.post(
        "/auth/login",
        json={"email": invited_email, "password": temp_password},
    )
    assert login.status_code == HTTPStatus.OK, login.text
    invited_headers = _auth_headers(login.json()["access_token"])

    context = http_client.get("/auth/context", headers=invited_headers)
    assert context.status_code == HTTPStatus.OK, context.text
    assert len(context.json()["factories"]) == 2


def test_inviting_existing_user_to_same_factory_returns_clear_message(http_client):
    admin = register_user(http_client, role="admin")
    headers = _auth_headers(admin["access_token"])

    invited_email = unique_email()
    first_invite = http_client.post(
        "/settings/users/invite",
        headers=headers,
        json={
            "name": "QA Repeat Invite",
            "email": invited_email,
            "role": "operator",
            "factory_name": admin["factory_name"],
        },
    )
    assert first_invite.status_code == HTTPStatus.CREATED, first_invite.text

    duplicate_invite = http_client.post(
        "/settings/users/invite",
        headers=headers,
        json={
            "name": "QA Repeat Invite",
            "email": invited_email,
            "role": "operator",
            "factory_name": admin["factory_name"],
        },
    )
    assert duplicate_invite.status_code == HTTPStatus.CONFLICT, duplicate_invite.text
    assert "already has access to this factory" in duplicate_invite.text


def test_manager_cannot_update_factory_access_memberships(http_client):
    admin = register_user(http_client, role="admin")
    manager = register_user(
        http_client,
        role="manager",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )

    manager_headers = _auth_headers(manager["access_token"])
    denied = http_client.get(f"/settings/users/{manager['user_id']}/factory-access", headers=manager_headers)
    assert denied.status_code == HTTPStatus.FORBIDDEN, denied.text


def test_manager_cannot_invite_admin_or_owner(http_client):
    admin = register_user(http_client, role="admin")
    manager = register_user(
        http_client,
        role="manager",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )
    manager_headers = _auth_headers(manager["access_token"])

    admin_invite = http_client.post(
        "/settings/users/invite",
        headers=manager_headers,
        json={
            "name": "QA Privileged Admin",
            "email": unique_email(),
            "role": "admin",
            "factory_name": admin["factory_name"],
        },
    )
    owner_invite = http_client.post(
        "/settings/users/invite",
        headers=manager_headers,
        json={
            "name": "QA Privileged Owner",
            "email": unique_email(),
            "role": "owner",
            "factory_name": admin["factory_name"],
        },
    )

    assert admin_invite.status_code == HTTPStatus.FORBIDDEN, admin_invite.text
    assert owner_invite.status_code == HTTPStatus.FORBIDDEN, owner_invite.text
    assert "cannot assign admin or owner roles" in admin_invite.text.lower()


def test_manager_cannot_promote_or_modify_privileged_roles(http_client):
    admin = register_user(http_client, role="admin")
    manager = register_user(
        http_client,
        role="manager",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )
    operator = register_user(
        http_client,
        role="operator",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )

    manager_headers = _auth_headers(manager["access_token"])

    promote = http_client.put(
        f"/settings/users/{operator['user_id']}/role",
        headers=manager_headers,
        json={"role": "admin"},
    )
    demote_admin = http_client.put(
        f"/settings/users/{admin['user_id']}/role",
        headers=manager_headers,
        json={"role": "manager", "confirm_action": "DOWNGRADE"},
    )

    assert promote.status_code == HTTPStatus.FORBIDDEN, promote.text
    assert demote_admin.status_code == HTTPStatus.FORBIDDEN, demote_admin.text
    assert "cannot assign admin or owner roles" in promote.text.lower()
    assert "cannot modify admin or owner accounts" in demote_admin.text.lower()


def test_role_update_noop_returns_clear_message(http_client):
    admin = register_user(http_client, role="admin")
    operator = register_user(
        http_client,
        role="operator",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )

    headers = _auth_headers(admin["access_token"])
    response = http_client.put(
        f"/settings/users/{operator['user_id']}/role",
        headers=headers,
        json={"role": "operator"},
    )

    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()
    assert "No role change applied." in payload["message"]
