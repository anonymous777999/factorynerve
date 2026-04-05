from http import HTTPStatus

from backend.database import SessionLocal, init_db
from backend.models.organization import Organization
from backend.models.user import User
from tests.utils import create_entry_payload, register_user


init_db()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _set_org_plan(email: str, plan: str) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        org = db.query(Organization).filter(Organization.org_id == user.org_id).first()
        assert org is not None
        org.plan = plan
        db.commit()


def test_ai_suggestions_increment_smart_usage_for_growth_plan(http_client):
    user = register_user(http_client, role="admin")
    _set_org_plan(user["email"], "growth")
    headers = _auth_headers(user["access_token"])

    payload = create_entry_payload(index=2)
    payload["shift"] = "morning"
    created = http_client.post("/entries", json=payload, headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text

    usage_before = http_client.get("/ai/usage", headers=headers)
    assert usage_before.status_code == HTTPStatus.OK, usage_before.text
    before_payload = usage_before.json()

    suggestion = http_client.get("/ai/suggestions?shift=morning", headers=headers)
    assert suggestion.status_code == HTTPStatus.OK, suggestion.text
    suggestion_payload = suggestion.json()
    assert suggestion_payload["quota_feature"] == "smart"
    assert "rationale" in suggestion_payload

    usage_after = http_client.get("/ai/usage", headers=headers)
    assert usage_after.status_code == HTTPStatus.OK, usage_after.text
    after_payload = usage_after.json()
    assert after_payload["smart_used"] == before_payload["smart_used"] + 1


def test_ai_anomalies_require_growth_and_executive_summary_requires_factory(http_client):
    free_user = register_user(http_client, role="admin")
    free_headers = _auth_headers(free_user["access_token"])

    blocked_anomalies = http_client.get("/ai/anomalies", headers=free_headers)
    assert blocked_anomalies.status_code == HTTPStatus.PAYMENT_REQUIRED

    blocked_exec = http_client.get("/ai/executive-summary", headers=free_headers)
    assert blocked_exec.status_code == HTTPStatus.PAYMENT_REQUIRED

    growth_user = register_user(http_client, role="admin")
    _set_org_plan(growth_user["email"], "growth")
    growth_headers = _auth_headers(growth_user["access_token"])

    first_payload = create_entry_payload(index=3)
    first_payload["units_target"] = 100
    first_payload["units_produced"] = 42
    first_payload["downtime_minutes"] = 95
    second_payload = create_entry_payload(index=4)
    second_payload["shift"] = "evening"
    second_payload["units_target"] = 100
    second_payload["units_produced"] = 98
    second_payload["downtime_minutes"] = 8

    created_one = http_client.post("/entries", json=first_payload, headers=growth_headers)
    assert created_one.status_code == HTTPStatus.CREATED, created_one.text
    created_two = http_client.post("/entries", json=second_payload, headers=growth_headers)
    assert created_two.status_code == HTTPStatus.CREATED, created_two.text

    anomalies = http_client.get("/ai/anomalies?days=30", headers=growth_headers)
    assert anomalies.status_code == HTTPStatus.OK, anomalies.text
    anomaly_payload = anomalies.json()
    assert anomaly_payload["summary"]
    assert anomaly_payload["quota_feature"] == "summary"

    blocked_growth_exec = http_client.get("/ai/executive-summary", headers=growth_headers)
    assert blocked_growth_exec.status_code == HTTPStatus.PAYMENT_REQUIRED

    _set_org_plan(growth_user["email"], "factory")
    executive = http_client.get("/ai/executive-summary", headers=growth_headers)
    assert executive.status_code == HTTPStatus.OK, executive.text
    executive_payload = executive.json()
    assert executive_payload["summary"]
    assert int(executive_payload["metrics"]["total_units"]) >= first_payload["units_produced"] + second_payload["units_produced"]


def test_ai_nlq_requires_business_and_returns_data(http_client):
    factory_user = register_user(http_client, role="admin")
    _set_org_plan(factory_user["email"], "factory")
    factory_headers = _auth_headers(factory_user["access_token"])

    blocked = http_client.post("/ai/query", json={"question": "Show me last month's downtime by shift"}, headers=factory_headers)
    assert blocked.status_code == HTTPStatus.PAYMENT_REQUIRED

    business_user = register_user(http_client, role="admin")
    _set_org_plan(business_user["email"], "business")
    headers = _auth_headers(business_user["access_token"])

    payload = create_entry_payload(index=6)
    payload["downtime_minutes"] = 33
    created = http_client.post("/entries", json=payload, headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text

    response = http_client.post("/ai/query", json={"question": "Show me last 7 days downtime by shift"}, headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    data = response.json()
    assert data["answer"]
    assert data["structured_query"]["metric"] == "downtime"
    assert isinstance(data["data_points"], list)


def test_billing_status_exposes_ai_usage_summary(http_client):
    user = register_user(http_client, role="admin")
    _set_org_plan(user["email"], "growth")
    headers = _auth_headers(user["access_token"])

    suggestion = http_client.get("/ai/suggestions?shift=morning", headers=headers)
    assert suggestion.status_code == HTTPStatus.OK, suggestion.text

    billing_status = http_client.get("/billing/status", headers=headers)
    assert billing_status.status_code == HTTPStatus.OK, billing_status.text
    payload = billing_status.json()

    usage = payload.get("usage") or {}
    assert "summary_used" in usage
    assert "email_used" in usage
    assert usage["smart_used"] >= 1
    assert "smart_limit" in usage
