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


def test_premium_dashboard_blocks_free_plan(http_client):
    user = register_user(http_client, role="admin")

    response = http_client.get("/premium/dashboard", headers=_auth_headers(user["access_token"]))
    assert response.status_code == HTTPStatus.PAYMENT_REQUIRED, response.text
    assert "Premium analytics requires Factory plan." in response.text


def test_premium_dashboard_and_pdf_work_for_factory_plan(http_client):
    user = register_user(http_client, role="admin")
    _set_org_plan(user["email"], "factory")

    first_payload = create_entry_payload(index=1)
    second_payload = create_entry_payload(index=2)
    second_payload["shift"] = "evening"

    created_one = http_client.post("/entries", json=first_payload, headers=_auth_headers(user["access_token"]))
    assert created_one.status_code == HTTPStatus.CREATED, created_one.text

    created_two = http_client.post("/entries", json=second_payload, headers=_auth_headers(user["access_token"]))
    assert created_two.status_code == HTTPStatus.CREATED, created_two.text

    dashboard = http_client.get("/premium/dashboard?days=14", headers=_auth_headers(user["access_token"]))
    assert dashboard.status_code == HTTPStatus.OK, dashboard.text
    payload = dashboard.json()
    assert payload["plan"] == "factory"
    assert payload["summary"]["total_units"] >= first_payload["units_produced"] + second_payload["units_produced"]
    assert len(payload["series"]) >= 2
    assert len(payload["heatmap"]) == 7 * 24

    audit = http_client.get("/premium/audit-trail", headers=_auth_headers(user["access_token"]))
    assert audit.status_code == HTTPStatus.OK, audit.text
    audit_payload = audit.json()
    assert audit_payload["total"] >= 1
    assert audit_payload["items"]

    pdf = http_client.get("/premium/executive-pdf", headers=_auth_headers(user["access_token"]))
    assert pdf.status_code == HTTPStatus.OK, pdf.text
    assert pdf.headers["content-type"].startswith("application/pdf")
