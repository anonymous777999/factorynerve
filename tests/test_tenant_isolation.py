from __future__ import annotations

from http import HTTPStatus
import time

from tests.utils import create_entry_payload, mark_entry_approved, register_user, set_org_plan_for_user_email, unique_email, unique_factory


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _wait_for_job(http_client, path: str, headers: dict[str, str], attempts: int = 80):
    payload = None
    for _ in range(attempts):
        response = http_client.get(path, headers=headers)
        assert response.status_code == HTTPStatus.OK, response.text
        payload = response.json()
        if payload.get("status") in {"succeeded", "failed", "canceled"}:
            return payload
        time.sleep(0.25)
    raise AssertionError(f"Job did not complete in time: {path} :: {payload}")


def _setup_multi_factory_manager(http_client, *, plan: str = "factory") -> dict[str, str]:
    admin = register_user(http_client, role="admin")
    admin_headers = _auth_headers(admin["access_token"])
    set_org_plan_for_user_email(admin["email"], plan)

    created = http_client.post(
        "/settings/factories",
        headers=admin_headers,
        json={
            "name": unique_factory(),
            "location": "Unit 2",
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
        headers=admin_headers,
        json={
            "name": "QA Isolation Manager",
            "email": manager_email,
            "role": "manager",
            "factory_name": admin["factory_name"],
        },
    )
    assert invited.status_code == HTTPStatus.CREATED, invited.text
    temp_password = invited.json()["temp_password"]

    users = http_client.get("/settings/users", headers=admin_headers)
    assert users.status_code == HTTPStatus.OK, users.text
    manager_row = next((row for row in users.json() if row["email"] == manager_email), None)
    assert manager_row is not None

    access = http_client.get(f"/settings/users/{manager_row['id']}/factory-access", headers=admin_headers)
    assert access.status_code == HTTPStatus.OK, access.text
    current_factory_ids = [item["factory_id"] for item in access.json()["factories"] if item["has_access"]]

    updated = http_client.put(
        f"/settings/users/{manager_row['id']}/factory-access",
        headers=admin_headers,
        json={"factory_ids": [*current_factory_ids, second_factory_id]},
    )
    assert updated.status_code == HTTPStatus.OK, updated.text

    login = http_client.post("/auth/login", json={"email": manager_email, "password": temp_password})
    assert login.status_code == HTTPStatus.OK, login.text
    access_token = login.json()["access_token"]

    context = http_client.get("/auth/context", headers=_auth_headers(access_token))
    assert context.status_code == HTTPStatus.OK, context.text
    context_payload = context.json()
    first_factory_id = context_payload["active_factory_id"]
    assert first_factory_id and first_factory_id != second_factory_id

    return {
        "manager_token": access_token,
        "manager_user_id": str(manager_row["id"]),
        "first_factory_id": first_factory_id,
        "second_factory_id": second_factory_id,
    }


def _switch_factory(http_client, token: str, factory_id: str) -> str:
    switched = http_client.post(
        "/auth/select-factory",
        headers=_auth_headers(token),
        json={"factory_id": factory_id},
    )
    assert switched.status_code == HTTPStatus.OK, switched.text
    return switched.json()["access_token"]


def test_factory_switch_scopes_sync_entries_analytics_reports_and_ai(http_client):
    setup = _setup_multi_factory_manager(http_client, plan="factory")
    manager_token = setup["manager_token"]
    first_factory_id = setup["first_factory_id"]
    second_factory_id = setup["second_factory_id"]

    first_headers = _auth_headers(manager_token)
    first_payload = create_entry_payload(index=1)
    first_payload["units_target"] = 100
    first_payload["units_produced"] = 21
    first_payload["downtime_minutes"] = 0
    created_first = http_client.post("/entries", json=first_payload, headers=first_headers)
    assert created_first.status_code == HTTPStatus.CREATED, created_first.text
    first_entry_id = created_first.json()["id"]

    manager_token = _switch_factory(http_client, manager_token, second_factory_id)
    second_headers = _auth_headers(manager_token)
    second_payload = create_entry_payload(index=1)
    second_payload["shift"] = "evening"
    second_payload["units_target"] = 100
    second_payload["units_produced"] = 89
    second_payload["downtime_minutes"] = 75
    created_second = http_client.post("/entries", json=second_payload, headers=second_headers)
    assert created_second.status_code == HTTPStatus.CREATED, created_second.text
    second_entry_id = created_second.json()["id"]
    mark_entry_approved(second_entry_id, int(setup["manager_user_id"]))

    manager_token = _switch_factory(http_client, manager_token, first_factory_id)
    first_headers = _auth_headers(manager_token)

    entries_first = http_client.get("/entries", headers=first_headers)
    assert entries_first.status_code == HTTPStatus.OK, entries_first.text
    first_items = entries_first.json()["items"]
    assert [item["id"] for item in first_items] == [first_entry_id]

    analytics_first = http_client.get("/analytics/weekly", headers=first_headers)
    assert analytics_first.status_code == HTTPStatus.OK, analytics_first.text
    assert sum(int(day["units"]) for day in analytics_first.json()) == 21

    reports_first = http_client.get(
        f"/reports/insights?start_date={first_payload['date']}&end_date={first_payload['date']}",
        headers=first_headers,
    )
    assert reports_first.status_code == HTTPStatus.OK, reports_first.text
    first_report_payload = reports_first.json()
    assert first_report_payload["totals"]["entry_count"] == 1
    assert first_report_payload["totals"]["total_units_produced"] == 21

    executive_first = http_client.get(
        f"/ai/executive-summary?start_date={first_payload['date']}&end_date={first_payload['date']}",
        headers=first_headers,
    )
    assert executive_first.status_code == HTTPStatus.OK, executive_first.text
    assert int(executive_first.json()["metrics"]["total_units"]) == 21

    manager_token = _switch_factory(http_client, manager_token, second_factory_id)
    second_headers = _auth_headers(manager_token)

    entries_second = http_client.get("/entries", headers=second_headers)
    assert entries_second.status_code == HTTPStatus.OK, entries_second.text
    second_items = entries_second.json()["items"]
    assert [item["id"] for item in second_items] == [second_entry_id]

    analytics_second = http_client.get("/analytics/weekly", headers=second_headers)
    assert analytics_second.status_code == HTTPStatus.OK, analytics_second.text
    assert sum(int(day["units"]) for day in analytics_second.json()) == 89

    reports_second = http_client.get(
        f"/reports/insights?start_date={second_payload['date']}&end_date={second_payload['date']}",
        headers=second_headers,
    )
    assert reports_second.status_code == HTTPStatus.OK, reports_second.text
    second_report_payload = reports_second.json()
    assert second_report_payload["totals"]["entry_count"] == 1
    assert second_report_payload["totals"]["total_units_produced"] == 89

    executive_second = http_client.get(
        f"/ai/executive-summary?start_date={second_payload['date']}&end_date={second_payload['date']}",
        headers=second_headers,
    )
    assert executive_second.status_code == HTTPStatus.OK, executive_second.text
    assert int(executive_second.json()["metrics"]["total_units"]) == 89


def test_factory_switch_scopes_async_report_and_ai_jobs(http_client):
    setup = _setup_multi_factory_manager(http_client, plan="factory")
    manager_token = setup["manager_token"]
    second_factory_id = setup["second_factory_id"]

    first_headers = _auth_headers(manager_token)
    first_payload_one = create_entry_payload(index=2)
    first_payload_one["units_target"] = 100
    first_payload_one["units_produced"] = 20
    created_first_one = http_client.post("/entries", json=first_payload_one, headers=first_headers)
    assert created_first_one.status_code == HTTPStatus.CREATED, created_first_one.text

    first_payload_two = create_entry_payload(index=2)
    first_payload_two["shift"] = "evening"
    first_payload_two["units_target"] = 100
    first_payload_two["units_produced"] = 30
    created_first_two = http_client.post("/entries", json=first_payload_two, headers=first_headers)
    assert created_first_two.status_code == HTTPStatus.CREATED, created_first_two.text

    manager_token = _switch_factory(http_client, manager_token, second_factory_id)
    second_headers = _auth_headers(manager_token)
    second_payload = create_entry_payload(index=2)
    second_payload["shift"] = "night"
    second_payload["units_target"] = 100
    second_payload["units_produced"] = 90
    created_second = http_client.post("/entries", json=second_payload, headers=second_headers)
    assert created_second.status_code == HTTPStatus.CREATED, created_second.text
    second_entry_id = created_second.json()["id"]
    mark_entry_approved(second_entry_id, int(setup["manager_user_id"]))

    pdf_job = http_client.post(f"/reports/pdf/{second_entry_id}/jobs", headers=second_headers)
    assert pdf_job.status_code == HTTPStatus.OK, pdf_job.text
    finished_pdf = _wait_for_job(http_client, f"/reports/export-jobs/{pdf_job.json()['job_id']}", second_headers)
    assert finished_pdf["status"] == "succeeded", finished_pdf

    range_job = http_client.post(
        f"/reports/excel-range/jobs?start_date={second_payload['date']}&end_date={second_payload['date']}",
        headers=second_headers,
    )
    assert range_job.status_code == HTTPStatus.OK, range_job.text
    finished_range = _wait_for_job(http_client, f"/reports/export-jobs/{range_job.json()['job_id']}", second_headers)
    assert finished_range["status"] == "succeeded", finished_range
    assert finished_range["result"]["row_count"] == 1

    executive_job = http_client.post(
        f"/ai/executive-summary/jobs?start_date={second_payload['date']}&end_date={second_payload['date']}",
        headers=second_headers,
    )
    assert executive_job.status_code == HTTPStatus.OK, executive_job.text
    finished_executive = _wait_for_job(http_client, f"/ai/jobs/{executive_job.json()['job_id']}", second_headers)
    assert finished_executive["status"] == "succeeded", finished_executive
    assert int(finished_executive["result"]["metrics"]["total_units"]) == 90


def test_manager_alerts_follow_active_factory_scope(http_client):
    setup = _setup_multi_factory_manager(http_client, plan="factory")
    manager_token = _switch_factory(http_client, setup["manager_token"], setup["second_factory_id"])
    second_headers = _auth_headers(manager_token)

    alert_payload = create_entry_payload(index=3)
    alert_payload["units_target"] = 100
    alert_payload["units_produced"] = 10
    alert_payload["downtime_minutes"] = 80
    created = http_client.post("/entries", json=alert_payload, headers=second_headers)
    assert created.status_code == HTTPStatus.CREATED, created.text

    alerts_second = http_client.get("/alerts", headers=second_headers)
    assert alerts_second.status_code == HTTPStatus.OK, alerts_second.text
    second_alert_ids = {item["id"] for item in alerts_second.json()}
    assert second_alert_ids

    manager_token = _switch_factory(http_client, manager_token, setup["first_factory_id"])
    first_headers = _auth_headers(manager_token)

    alerts_first = http_client.get("/alerts", headers=first_headers)
    assert alerts_first.status_code == HTTPStatus.OK, alerts_first.text
    first_alert_ids = {item["id"] for item in alerts_first.json()}
    assert first_alert_ids.isdisjoint(second_alert_ids)

    hidden_alert_id = next(iter(second_alert_ids))
    mark_hidden = http_client.put(f"/alerts/{hidden_alert_id}/read", headers=first_headers)
    assert mark_hidden.status_code == HTTPStatus.NOT_FOUND, mark_hidden.text
