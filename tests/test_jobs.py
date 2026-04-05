from http import HTTPStatus
import time

from tests.utils import create_entry_payload, register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


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


def test_entry_summary_job_is_listed_globally(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])

    created = http_client.post("/entries", json=create_entry_payload(index=11), headers=headers)
    assert created.status_code in {HTTPStatus.CREATED, HTTPStatus.OK}, created.text
    entry_id = created.json()["id"]

    queued = http_client.post(f"/entries/{entry_id}/summary-jobs", headers=headers)
    assert queued.status_code == HTTPStatus.OK, queued.text
    job = queued.json()
    assert job["kind"] == "entry_summary"

    listed = http_client.get("/jobs", headers=headers)
    assert listed.status_code == HTTPStatus.OK, listed.text
    jobs = listed.json()
    assert any(item["job_id"] == job["job_id"] for item in jobs)

    final_job = _wait_for_job(http_client, f"/jobs/{job['job_id']}", headers)
    assert final_job["status"] == "succeeded", final_job
    assert int(final_job["result"]["entry_id"]) == entry_id
