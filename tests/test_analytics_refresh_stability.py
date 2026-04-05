from http import HTTPStatus

from tests.utils import create_entry_payload, register_user, set_org_plan_for_user_email


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_analytics_refresh_pattern_stays_stable_without_throttle(http_client):
    """
    Regression coverage for ANA-02:
    Simulates repeated analytics refresh cycles from the client dashboard and
    verifies we do not hit request throttling or response instability.
    """
    manager = register_user(http_client, role="manager")
    set_org_plan_for_user_email(manager["email"], "factory")
    headers = _auth_headers(manager["access_token"])

    for index, shift in enumerate(("morning", "evening", "night"), start=1):
        payload = create_entry_payload(index=index)
        payload["shift"] = shift
        payload["units_target"] = 100
        payload["units_produced"] = 45 + index
        created = http_client.post("/entries", json=payload, headers=headers)
        assert created.status_code == HTTPStatus.CREATED, created.text

    refresh_paths = [
        "/analytics/weekly",
        "/analytics/monthly",
        "/analytics/trends",
        "/analytics/manager",
    ]

    # Mirrors multiple UI refresh rounds (manual refresh + auto refresh windows).
    for _ in range(12):
        for path in refresh_paths:
            response = http_client.get(path, headers=headers)
            assert response.status_code == HTTPStatus.OK, f"{path}: {response.status_code} {response.text}"

    weekly = http_client.get("/analytics/weekly", headers=headers)
    assert weekly.status_code == HTTPStatus.OK, weekly.text
    weekly_payload = weekly.json()
    assert isinstance(weekly_payload, list)
    assert len(weekly_payload) == 7
