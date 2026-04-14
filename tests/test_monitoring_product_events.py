import time
from http import HTTPStatus

from backend.database import SessionLocal
from sqlalchemy import text
from tests.utils import register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _wait_for_event_count(event_name: str, expected: int, timeout_seconds: float = 10.0) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        db = SessionLocal()
        try:
            count = int(
                db.execute(
                    text("SELECT COUNT(*) FROM product_events WHERE event_name = :event_name"),
                    {"event_name": event_name},
                ).scalar_one()
            )
            if count >= expected:
                return
        finally:
            db.close()
        time.sleep(0.25)
    raise AssertionError(f"Timed out waiting for {event_name} to reach count {expected}.")


def test_monitoring_events_persist_and_feed_dashboard(http_client):
    admin = register_user(http_client, role="admin")
    headers = _auth_headers(admin["access_token"])

    capture = http_client.post(
        "/analytics/events/batch",
        headers=headers,
        json={
            "events": [
                {
                    "event_name": "report_trust_gate_evaluated",
                    "properties": {
                        "route": "/reports",
                        "user_role": "admin",
                        "period_start": "2026-04-01",
                        "period_end": "2026-04-07",
                        "passed": False,
                        "block_reason": "3 OCR records pending review.",
                        "ocr_approved": 2,
                        "ocr_total": 5,
                        "shift_approved": 4,
                        "shift_total": 5,
                        "attendance_reviewed": True,
                        "trust_score": 64.5,
                        "session_id": "monitoring-smoke-trust",
                    },
                },
                {
                    "event_name": "mobile_route_funnel_step",
                    "properties": {
                        "route": "/reports",
                        "user_role": "admin",
                        "session_id": "monitoring-smoke-mobile",
                        "viewport_width": 390,
                        "step": "view",
                        "primary_action": "route_entry",
                    },
                },
                {
                    "event_name": "mobile_route_funnel_step",
                    "properties": {
                        "route": "/reports",
                        "user_role": "admin",
                        "session_id": "monitoring-smoke-mobile",
                        "viewport_width": 390,
                        "step": "primary_action_completed",
                        "primary_action": "export_report",
                    },
                },
                {
                    "event_name": "manager_session_guard_result",
                    "properties": {
                        "route": "/dashboard",
                        "result": "pass",
                        "session_age_minutes": 3,
                        "retry_count": 0,
                        "user_role": "manager",
                        "had_cached_session": True,
                        "session_id": "monitoring-smoke-manager",
                    },
                },
            ]
        },
    )
    assert capture.status_code == HTTPStatus.ACCEPTED, capture.text
    assert capture.json()["accepted"] == 4

    _wait_for_event_count("report_trust_gate_evaluated", 1)
    _wait_for_event_count("mobile_route_funnel_step", 2)
    _wait_for_event_count("manager_session_guard_result", 1)

    dashboard = http_client.get(
        "/analytics/monitoring/dashboards/trust-gate-blocks-by-reason-7d",
        headers=headers,
    )
    assert dashboard.status_code == HTTPStatus.OK, dashboard.text
    payload = dashboard.json()
    row = next(
        (
            item
            for item in payload["rows"]
            if item["route"] == "/reports" and item["block_reason"] == "3 OCR records pending review."
        ),
        None,
    )
    assert row is not None
    assert row["blocked_attempts"] >= 1
