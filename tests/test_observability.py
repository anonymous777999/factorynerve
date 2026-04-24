from datetime import datetime, timezone
from http import HTTPStatus

from backend.database import SessionLocal, init_db
from backend.models.ops_alert_event import OpsAlertEvent
from backend.routers.observability import _serialize_alert_row
from backend.models.user import User

from tests.utils import register_user


def test_observability_ready_endpoint(http_client):
    response = http_client.get("/observability/ready")

    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["database"] == "ok"
    assert "uptime_seconds" in payload


def test_frontend_error_intake_accepts_reports(http_client):
    response = http_client.post(
        "/observability/frontend-error",
        json={
            "message": "Synthetic frontend crash",
            "source": "pytest",
            "url": "http://127.0.0.1:3000/dashboard",
            "route": "/dashboard",
            "stack": "Error: boom",
        },
    )

    assert response.status_code == HTTPStatus.ACCEPTED, response.text
    payload = response.json()
    assert payload["status"] == "accepted"


def test_frontend_error_intake_accepts_cookie_backed_reports_without_csrf(http_client):
    register_user(http_client, use_cookies=True)

    response = http_client.post(
        "/observability/frontend-error",
        json={
            "message": "Authenticated frontend crash",
            "source": "pytest-authenticated",
            "url": "http://127.0.0.1:3000/dashboard",
            "route": "/dashboard",
        },
    )

    assert response.status_code == HTTPStatus.ACCEPTED, response.text
    payload = response.json()
    assert payload["status"] == "accepted"


def test_alert_dashboard_returns_scoped_history_and_detail(http_client):
    admin = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    init_db()

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == admin["email"]).first()
        assert user is not None
        created_at = datetime(2026, 4, 24, 12, 0, tzinfo=timezone.utc)
        db.add_all(
            [
                OpsAlertEvent(
                    ref_id="obs-alert-1",
                    org_id=user.org_id,
                    org_name="QA Org",
                    event_type="ocr_failure_spike",
                    severity="HIGH",
                    status="suppressed",
                    dedup_key="obs:1",
                    group_key="obs-group:1",
                    escalation_level=3,
                    is_summary=False,
                    summary="OCR spike suppressed by org limiter.",
                    recipient_phone=None,
                    meta={"failures": 22},
                    provider="twilio",
                    delivery_status="suppressed",
                    suppressed_reason="org_rate_limited",
                    created_at=created_at,
                ),
                OpsAlertEvent(
                    ref_id="obs-alert-1",
                    org_id=user.org_id,
                    org_name="QA Org",
                    event_type="ocr_failure_spike",
                    severity="HIGH",
                    status="failed",
                    dedup_key="obs:1",
                    group_key="obs-group:1",
                    escalation_level=3,
                    is_summary=False,
                    summary="OCR spike suppressed by org limiter.",
                    recipient_phone="whatsapp:+919999999999",
                    meta={"failures": 22},
                    provider="twilio",
                    delivery_status="failed",
                    last_error="downstream reject",
                    created_at=created_at,
                ),
            ]
        )
        db.commit()

    listed = http_client.get(
        "/observability/alerts",
        params={"status": "suppressed", "event_type": "ocr_failure_spike"},
        headers=headers,
    )
    assert listed.status_code == HTTPStatus.OK, listed.text
    payload = listed.json()
    assert payload["total"] >= 1
    assert payload["alerts"][0]["status"] == "suppressed"
    assert payload["alerts"][0]["escalation_level"] == 3

    detail = http_client.get("/observability/alerts/obs-alert-1", headers=headers)
    assert detail.status_code == HTTPStatus.OK, detail.text
    detail_payload = detail.json()
    assert detail_payload["status"] == "suppressed"
    assert detail_payload["suppressed_reason"] == "org_rate_limited"
    assert len(detail_payload["deliveries"]) == 1


def test_alert_dashboard_tolerates_legacy_rows_with_missing_fields(http_client):
    row = OpsAlertEvent(
        ref_id="obs-legacy-1",
        org_id="org-legacy",
        org_name="Legacy Org",
        event_type="",
        severity="high",
        status="queued",
        dedup_key="legacy:1",
        summary="legacy row",
        recipient_phone=None,
        meta=None,
        provider="twilio",
        delivery_status="queued",
        created_at=datetime(2026, 4, 24, 13, 0, tzinfo=timezone.utc),
    )
    row.status = None  # type: ignore[assignment]
    row.delivery_status = None  # type: ignore[assignment]
    row.summary = None  # type: ignore[assignment]
    row.escalation_level = None  # type: ignore[assignment]

    payload = _serialize_alert_row(row)
    assert payload.ref_id == "obs-legacy-1"
    assert payload.event_type == "unknown_event"
    assert payload.status == "queued"
    assert payload.delivery_status == "queued"
    assert payload.summary == "Alert event recorded."
    assert payload.escalation_level == 0
