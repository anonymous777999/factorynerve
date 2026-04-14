from http import HTTPStatus

from tests.utils import register_user


def _auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def test_ui_autonomy_signal_cycle_and_overview(http_client):
    account = register_user(http_client, role="manager")
    headers = _auth_headers(account["access_token"])
    payloads = [
        {
            "route": "/dashboard",
            "signal_type": "layout",
            "signal_key": "horizontal_overflow",
            "severity": "high",
            "payload": {"overflow_px": 38},
        },
        {
            "route": "/dashboard",
            "signal_type": "hierarchy",
            "signal_key": "crowded_above_fold",
            "severity": "medium",
            "payload": {"count": 12},
        },
        {
            "route": "/dashboard",
            "signal_type": "route_visit",
            "signal_key": "route_dwell",
            "duration_ms": 28000,
        },
        {
            "route": "/attendance",
            "signal_type": "layout",
            "signal_key": "tap_target_small",
            "severity": "medium",
            "payload": {"count": 4},
        },
        {
            "route": "/attendance",
            "signal_type": "layout",
            "signal_key": "tap_target_small",
            "severity": "medium",
            "payload": {"count": 4},
        },
        {
            "route": "/attendance",
            "signal_type": "performance",
            "signal_key": "long_task",
            "severity": "high",
            "duration_ms": 180,
            "value": 180,
        },
    ]

    for payload in payloads:
        response = http_client.post("/autonomy/signals", json=payload, headers=headers)
        assert response.status_code == HTTPStatus.ACCEPTED, response.text

    cycle = http_client.post("/autonomy/recommendations/run", headers=headers)
    assert cycle.status_code == HTTPStatus.OK, cycle.text
    cycle_payload = cycle.json()
    assert cycle_payload["signals_considered"] >= len(payloads)
    assert cycle_payload["created"] >= 1
    assert any(
        "horizontal overflow" in item["title"].lower()
        for item in cycle_payload["recommendations"]
    )

    overview = http_client.get("/autonomy/overview", headers=headers)
    assert overview.status_code == HTTPStatus.OK, overview.text
    overview_payload = overview.json()
    assert overview_payload["status"] == "active"
    assert overview_payload["summary"]["total_signals"] >= len(payloads)
    assert any(item["route"] == "/dashboard" for item in overview_payload["summary"]["top_routes"])
    assert any(item["key"] == "priority_routes_auto" for item in overview_payload["preferences"])


def test_ui_autonomy_preferences_and_status_updates(http_client):
    account = register_user(http_client, role="manager")
    headers = _auth_headers(account["access_token"])

    response = http_client.put(
        "/autonomy/preferences/dashboard_density",
        json={"value": {"mode": "comfortable"}, "source": "manual"},
        headers=headers,
    )
    assert response.status_code == HTTPStatus.OK, response.text
    preference = response.json()
    assert preference["key"] == "dashboard_density"
    assert preference["source"] == "manual"

    signal = http_client.post(
        "/autonomy/signals",
        json={
            "route": "/reports",
            "signal_type": "clarity",
            "signal_key": "missing_primary_heading",
            "severity": "medium",
        },
        headers=headers,
    )
    assert signal.status_code == HTTPStatus.ACCEPTED, signal.text

    cycle = http_client.post("/autonomy/recommendations/run", headers=headers)
    assert cycle.status_code == HTTPStatus.OK, cycle.text
    recommendations = cycle.json()["recommendations"]
    assert recommendations, "Expected at least one recommendation after the signal run."

    recommendation_id = recommendations[0]["id"]
    status_update = http_client.put(
        f"/autonomy/recommendations/{recommendation_id}/status",
        json={"status": "applied"},
        headers=headers,
    )
    assert status_update.status_code == HTTPStatus.OK, status_update.text
    assert status_update.json()["status"] == "applied"

    preferences = http_client.get("/autonomy/preferences", headers=headers)
    assert preferences.status_code == HTTPStatus.OK, preferences.text
    assert any(item["key"] == "dashboard_density" for item in preferences.json())
