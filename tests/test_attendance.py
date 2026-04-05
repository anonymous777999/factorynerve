from http import HTTPStatus

from tests.utils import register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_attendance_punch_flow_and_live_board(http_client):
    supervisor = register_user(http_client, role="supervisor")
    operator = register_user(
        http_client,
        role="operator",
        factory_name=supervisor["factory_name"],
        company_code=supervisor["company_code"],
    )

    supervisor_headers = _auth_headers(supervisor["access_token"])
    operator_headers = _auth_headers(operator["access_token"])

    before = http_client.get("/attendance/me/today", headers=operator_headers)
    assert before.status_code == HTTPStatus.OK, before.text
    before_payload = before.json()
    assert before_payload["status"] == "not_punched"
    assert before_payload["can_punch_in"] is True

    punched_in = http_client.post(
        "/attendance/punch",
        headers=operator_headers,
        json={"action": "in", "shift": "morning"},
    )
    assert punched_in.status_code == HTTPStatus.OK, punched_in.text
    punch_in_payload = punched_in.json()
    assert punch_in_payload["status"] == "working"
    assert punch_in_payload["can_punch_out"] is True
    assert punch_in_payload["punch_in_at"] is not None

    live = http_client.get("/attendance/live", headers=supervisor_headers)
    assert live.status_code == HTTPStatus.OK, live.text
    live_payload = live.json()
    assert live_payload["totals"]["total_people"] == 2
    assert live_payload["totals"]["working"] == 1
    assert live_payload["totals"]["not_punched"] == 1
    assert any(row["name"] == "QA User" and row["status"] == "working" for row in live_payload["rows"])

    punched_out = http_client.post(
        "/attendance/punch",
        headers=operator_headers,
        json={"action": "out"},
    )
    assert punched_out.status_code == HTTPStatus.OK, punched_out.text
    punch_out_payload = punched_out.json()
    assert punch_out_payload["status"] == "completed"
    assert punch_out_payload["punch_out_at"] is not None

    after = http_client.get("/attendance/me/today", headers=operator_headers)
    assert after.status_code == HTTPStatus.OK, after.text
    after_payload = after.json()
    assert after_payload["status"] == "completed"
    assert after_payload["can_punch_out"] is False


def test_attendance_live_board_requires_review_role(http_client):
    operator = register_user(http_client, role="operator")
    headers = _auth_headers(operator["access_token"])

    response = http_client.get("/attendance/live", headers=headers)
    assert response.status_code == HTTPStatus.FORBIDDEN, response.text


def test_attendance_role_is_self_service_only(http_client):
    manager = register_user(http_client, role="manager")
    attendance_user = register_user(
        http_client,
        role="attendance",
        factory_name=manager["factory_name"],
        company_code=manager["company_code"],
    )
    headers = _auth_headers(attendance_user["access_token"])

    today = http_client.get("/attendance/me/today", headers=headers)
    assert today.status_code == HTTPStatus.OK, today.text

    punched_in = http_client.post(
        "/attendance/punch",
        headers=headers,
        json={"action": "in", "shift": "morning"},
    )
    assert punched_in.status_code == HTTPStatus.OK, punched_in.text

    entries = http_client.get("/entries", headers=headers)
    assert entries.status_code == HTTPStatus.FORBIDDEN, entries.text


def test_attendance_settings_bootstrap_and_profile_save(http_client):
    manager = register_user(http_client, role="manager")
    manager_headers = _auth_headers(manager["access_token"])

    shifts = http_client.get("/attendance/settings/shifts", headers=manager_headers)
    assert shifts.status_code == HTTPStatus.OK, shifts.text
    shifts_payload = shifts.json()
    assert len(shifts_payload) >= 3
    assert any(item["shift_name"] == "morning" for item in shifts_payload)

    employees = http_client.get("/attendance/settings/employees", headers=manager_headers)
    assert employees.status_code == HTTPStatus.OK, employees.text
    employees_payload = employees.json()
    assert len(employees_payload) >= 1

    target = employees_payload[0]
    saved = http_client.post(
        "/attendance/settings/employees",
        headers=manager_headers,
        json={
            "user_id": target["user_id"],
            "employee_code": "EMP-1001",
            "department": "Rolling Mill",
            "designation": "Shift Lead",
            "employment_type": "permanent",
            "default_shift": "morning",
            "is_active": True,
        },
    )
    assert saved.status_code == HTTPStatus.OK, saved.text
    saved_payload = saved.json()
    assert saved_payload["employee_code"] == "EMP-1001"
    assert saved_payload["department"] == "Rolling Mill"


def test_attendance_regularization_review_flow(http_client):
    supervisor = register_user(http_client, role="supervisor")
    operator = register_user(
        http_client,
        role="operator",
        factory_name=supervisor["factory_name"],
        company_code=supervisor["company_code"],
    )

    supervisor_headers = _auth_headers(supervisor["access_token"])
    operator_headers = _auth_headers(operator["access_token"])

    punched_in = http_client.post(
        "/attendance/punch",
        headers=operator_headers,
        json={"action": "in", "shift": "morning"},
    )
    assert punched_in.status_code == HTTPStatus.OK, punched_in.text
    today_payload = punched_in.json()

    regularization = http_client.post(
        "/attendance/me/regularizations",
        headers=operator_headers,
        json={
            "attendance_record_id": today_payload["attendance_id"],
            "request_type": "missed_punch",
            "requested_in_at": today_payload["punch_in_at"],
            "requested_out_at": today_payload["punch_in_at"],
            "reason": "Need supervisor closure for the test record.",
        },
    )
    assert regularization.status_code == HTTPStatus.CREATED, regularization.text
    regularization_payload = regularization.json()

    review = http_client.get("/attendance/review", headers=supervisor_headers)
    assert review.status_code == HTTPStatus.OK, review.text
    review_payload = review.json()
    assert review_payload["totals"]["pending_records"] >= 1
    item = next(
        row for row in review_payload["items"] if row["attendance_id"] == today_payload["attendance_id"]
    )
    assert item["regularization"]["id"] == regularization_payload["id"]

    approved = http_client.post(
        f"/attendance/review/{today_payload['attendance_id']}/approve",
        headers=supervisor_headers,
        json={
            "regularization_id": regularization_payload["id"],
            "punch_in_at": today_payload["punch_in_at"],
            "punch_out_at": today_payload["punch_in_at"],
            "final_status": "completed",
            "note": "Approved in QA",
        },
    )
    assert approved.status_code == HTTPStatus.OK, approved.text
    approved_payload = approved.json()
    assert approved_payload["review_status"] == "approved"
    assert approved_payload["status"] == "completed"


def test_attendance_review_queue_allows_manager_role(http_client):
    manager = register_user(http_client, role="manager")
    operator = register_user(
        http_client,
        role="operator",
        factory_name=manager["factory_name"],
        company_code=manager["company_code"],
    )

    manager_headers = _auth_headers(manager["access_token"])
    operator_headers = _auth_headers(operator["access_token"])

    punched_in = http_client.post(
        "/attendance/punch",
        headers=operator_headers,
        json={"action": "in", "shift": "morning"},
    )
    assert punched_in.status_code == HTTPStatus.OK, punched_in.text
    today_payload = punched_in.json()

    regularization = http_client.post(
        "/attendance/me/regularizations",
        headers=operator_headers,
        json={
            "attendance_record_id": today_payload["attendance_id"],
            "request_type": "missed_punch",
            "requested_in_at": today_payload["punch_in_at"],
            "requested_out_at": today_payload["punch_in_at"],
            "reason": "Manager review path coverage.",
        },
    )
    assert regularization.status_code == HTTPStatus.CREATED, regularization.text

    review = http_client.get("/attendance/review", headers=manager_headers)
    assert review.status_code == HTTPStatus.OK, review.text
    payload = review.json()
    assert any(row["attendance_id"] == today_payload["attendance_id"] for row in payload["items"])


def test_attendance_regularization_rejects_unknown_request_type(http_client):
    operator = register_user(http_client, role="operator")
    operator_headers = _auth_headers(operator["access_token"])

    punched_in = http_client.post(
        "/attendance/punch",
        headers=operator_headers,
        json={"action": "in", "shift": "morning"},
    )
    assert punched_in.status_code == HTTPStatus.OK, punched_in.text
    today_payload = punched_in.json()

    response = http_client.post(
        "/attendance/me/regularizations",
        headers=operator_headers,
        json={
            "attendance_record_id": today_payload["attendance_id"],
            "request_type": "abc",
            "requested_in_at": today_payload["punch_in_at"],
            "requested_out_at": today_payload["punch_in_at"],
            "reason": "Need correction for the invalid request type test.",
        },
    )
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, response.text
    assert "request_type" in response.text


def test_attendance_review_rejects_unknown_final_status(http_client):
    supervisor = register_user(http_client, role="supervisor")
    operator = register_user(
        http_client,
        role="operator",
        factory_name=supervisor["factory_name"],
        company_code=supervisor["company_code"],
    )

    supervisor_headers = _auth_headers(supervisor["access_token"])
    operator_headers = _auth_headers(operator["access_token"])

    punched_in = http_client.post(
        "/attendance/punch",
        headers=operator_headers,
        json={"action": "in", "shift": "morning"},
    )
    assert punched_in.status_code == HTTPStatus.OK, punched_in.text
    today_payload = punched_in.json()

    response = http_client.post(
        f"/attendance/review/{today_payload['attendance_id']}/approve",
        headers=supervisor_headers,
        json={
            "punch_in_at": today_payload["punch_in_at"],
            "final_status": "banana",
        },
    )
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, response.text
    assert "final_status" in response.text


def test_attendance_profile_rejects_non_manager_reporting_manager(http_client):
    manager = register_user(http_client, role="manager")
    operator = register_user(
        http_client,
        role="operator",
        factory_name=manager["factory_name"],
        company_code=manager["company_code"],
    )
    manager_headers = _auth_headers(manager["access_token"])

    response = http_client.post(
        "/attendance/settings/employees",
        headers=manager_headers,
        json={
            "user_id": operator["user_id"],
            "employee_code": "EMP-2001",
            "department": "Rolling Mill",
            "designation": "Operator",
            "employment_type": "permanent",
            "reporting_manager_id": operator["user_id"],
            "default_shift": "morning",
            "is_active": True,
        },
    )
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, response.text
    assert "Reporting manager" in response.text
