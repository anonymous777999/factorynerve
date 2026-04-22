from http import HTTPStatus
import time

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


def _wait_for_job(http_client, path: str, headers: dict[str, str], attempts: int = 60):
    payload = None
    for _ in range(attempts):
        response = http_client.get(path, headers=headers)
        assert response.status_code == HTTPStatus.OK, response.text
        payload = response.json()
        if payload.get("status") in {"succeeded", "failed"}:
            return payload
        time.sleep(0.5)
    raise AssertionError(f"Job did not complete in time: {path} :: {payload}")


def test_excel_range_export_job_completes_and_downloads(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])

    for index in range(3):
        created = http_client.post("/entries", json=create_entry_payload(index=index), headers=headers)
        assert created.status_code in {HTTPStatus.CREATED, HTTPStatus.OK}, created.text

    response = http_client.post("/reports/excel-range/jobs", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    job = response.json()
    assert job["status"] in {"queued", "running"}

    final_job = _wait_for_job(http_client, f"/reports/export-jobs/{job['job_id']}", headers)
    assert final_job["status"] == "succeeded", final_job
    assert final_job["result"]["row_count"] >= 1

    download = http_client.get(f"/reports/export-jobs/{job['job_id']}/download", headers=headers)
    assert download.status_code == HTTPStatus.OK, download.text
    assert "spreadsheetml" in (download.headers.get("content-type") or "")
    assert download.content


def test_executive_summary_job_returns_payload(http_client):
    user = register_user(http_client, role="admin")
    _set_org_plan(user["email"], "factory")
    headers = _auth_headers(user["access_token"])

    for index in range(2):
        payload = create_entry_payload(index=index + 7)
        payload["units_target"] = 100
        payload["units_produced"] = 85 + index
        created = http_client.post("/entries", json=payload, headers=headers)
        assert created.status_code in {HTTPStatus.CREATED, HTTPStatus.OK}, created.text

    response = http_client.post("/ai/executive-summary/jobs", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    job = response.json()

    final_job = _wait_for_job(http_client, f"/ai/jobs/{job['job_id']}", headers)
    assert final_job["status"] == "succeeded", final_job
    result = final_job.get("result") or {}
    assert result.get("summary")
    assert result.get("metrics")
