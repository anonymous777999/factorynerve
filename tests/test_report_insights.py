from __future__ import annotations

from datetime import date, timedelta
from http import HTTPStatus

from tests.utils import register_user


def _register(
    http_client,
    *,
    name: str,
    email: str,
    role: str,
    factory_name: str,
    company_code: str | None = None,
) -> dict:
    # Delegate to the shared helper, which performs register -> email verify ->
    # v2 login and returns the session token as ``access_token``. Adapt the
    # return shape to what this module's tests expect (``["user"]["factory_code"]``
    # and a top-level ``access_token``).
    user = register_user(
        http_client,
        role=role,
        email=email,
        factory_name=factory_name,
        company_code=company_code,
    )
    return {
        "access_token": user["access_token"],
        "user": {
            "factory_code": user.get("company_code"),
            "role": role,
        },
    }



def _entry_payload(*, day_offset: int, units_target: int, units_produced: int, downtime_minutes: int, quality_issues: bool) -> dict:
    entry_date = date.today() - timedelta(days=day_offset)
    return {
        "date": entry_date.isoformat(),
        "shift": "morning",
        "units_target": units_target,
        "units_produced": units_produced,
        "manpower_present": 16,
        "manpower_absent": 2,
        "downtime_minutes": downtime_minutes,
        "downtime_reason": "Maintenance" if downtime_minutes else "",
        "department": "Rolling",
        "materials_used": "Steel",
        "quality_issues": quality_issues,
        "quality_details": "Surface variance" if quality_issues else None,
        "notes": "QA report insight coverage",
    }


def test_reports_insights_show_weekly_employee_rankings(http_client):
    manager = _register(
        http_client,
        name="Manager One",
        email="manager.report@example.com",
        role="manager",
        factory_name="Insight Steel Works",
    )
    factory_code = manager["user"]["factory_code"]
    operator = _register(
        http_client,
        name="Operator Two",
        email="operator.report@example.com",
        role="operator",
        factory_name="Insight Steel Works",
        company_code=factory_code,
    )

    manager_headers = {"Authorization": f"Bearer {manager['access_token']}", "Cookie": f"auth_session={manager['access_token']}"}
    operator_headers = {"Authorization": f"Bearer {operator['access_token']}", "Cookie": f"auth_session={operator['access_token']}"}

    response = http_client.post("/entries", json=_entry_payload(day_offset=1, units_target=100, units_produced=118, downtime_minutes=0, quality_issues=False), headers=manager_headers)
    assert response.status_code == HTTPStatus.CREATED, response.text
    response = http_client.post("/entries", json=_entry_payload(day_offset=2, units_target=100, units_produced=76, downtime_minutes=28, quality_issues=True), headers=operator_headers)
    assert response.status_code == HTTPStatus.CREATED, response.text
    response = http_client.post("/entries", json=_entry_payload(day_offset=9, units_target=100, units_produced=88, downtime_minutes=14, quality_issues=False), headers=operator_headers)
    assert response.status_code == HTTPStatus.CREATED, response.text

    start_date = (date.today() - timedelta(days=13)).isoformat()
    end_date = date.today().isoformat()
    insights = http_client.get(
        f"/reports/insights?start_date={start_date}&end_date={end_date}",
        headers=manager_headers,
    )
    assert insights.status_code == HTTPStatus.OK, insights.text
    payload = insights.json()

    assert payload["totals"]["entry_count"] == 3
    assert payload["totals"]["active_people"] == 2
    assert len(payload["weekly_snapshots"]) >= 2
    assert payload["employee_leaderboard"][0]["name"] == "Manager One"
    assert payload["support_signals"][0]["name"] == "Operator Two"
    assert "downtime" in payload["support_signals"][0]["reason"].lower() or "quality" in payload["support_signals"][0]["reason"].lower()
    assert any(point["reporter_count"] > 0 for point in payload["daily_series"])
    assert payload["employee_trend"][0]["points"], "Expected weekly employee trend points."


def test_reports_insights_block_operator_role(http_client):
    operator = _register(
        http_client,
        name="Operator View",
        email="operator.block@example.com",
        role="operator",
        factory_name="Operator Block Factory",
    )
    headers = {"Authorization": f"Bearer {operator['access_token']}", "Cookie": f"auth_session={operator['access_token']}"}
    response = http_client.get("/reports/insights", headers=headers)
    assert response.status_code == HTTPStatus.FORBIDDEN, response.text
