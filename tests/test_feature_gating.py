from http import HTTPStatus

from tests.utils import create_entry_payload, mark_entry_approved, register_user


def test_free_plan_blocked_from_analytics(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    weekly = http_client.get("/analytics/weekly", headers=headers)
    assert weekly.status_code == HTTPStatus.PAYMENT_REQUIRED

    trends = http_client.get("/analytics/trends", headers=headers)
    assert trends.status_code == HTTPStatus.PAYMENT_REQUIRED


def test_free_plan_pdf_blocked_excel_allowed(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    entry_resp = http_client.post("/entries", json=create_entry_payload(), headers=headers)
    assert entry_resp.status_code == HTTPStatus.CREATED, entry_resp.text
    entry_id = entry_resp.json()["id"]
    mark_entry_approved(entry_id, user["user_id"])

    pdf = http_client.get(f"/reports/pdf/{entry_id}", headers=headers)
    assert pdf.status_code == HTTPStatus.PAYMENT_REQUIRED

    excel = http_client.get(f"/reports/excel/{entry_id}", headers=headers)
    assert excel.status_code == HTTPStatus.OK
