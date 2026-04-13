from __future__ import annotations

import base64
import time
from http import HTTPStatus

from backend.services import background_jobs
from tests.utils import create_entry_payload, mark_entry_approved, register_user, set_org_plan_for_user_email

PNG_1X1_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=="
)


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _wait_for_api_job(http_client, path: str, headers: dict[str, str], attempts: int = 80):
    payload = None
    for _ in range(attempts):
        response = http_client.get(path, headers=headers)
        assert response.status_code == HTTPStatus.OK, response.text
        payload = response.json()
        if payload.get("status") in {"succeeded", "failed", "canceled"}:
            return payload
        time.sleep(0.25)
    raise AssertionError(f"Job did not reach a terminal state: {path} :: {payload}")


def _wait_for_service_job(job_id: str, *, attempts: int = 80):
    payload = None
    for _ in range(attempts):
        payload = background_jobs.get_job(job_id, owner_id=1)
        if payload and payload.get("status") in {"succeeded", "failed", "canceled"}:
            return payload
        time.sleep(0.05)
    raise AssertionError(f"Background service job did not finish: {job_id} :: {payload}")


def test_background_job_cancel_and_retry_service_layer():
    retry_calls: list[str] = []

    def retry_handler(payload: dict, source_job):
        retry_calls.append(source_job["job_id"])
        new_job = background_jobs.create_job(
            kind="test_retry_kind",
            owner_id=1,
            org_id="org-test",
            message="Retry queued",
            context={"route": "/tests"},
            retry_context=payload,
        )
        background_jobs.start_job(
            new_job["job_id"],
            lambda progress: {"retried_from": source_job["job_id"], "ok": True},
        )
        return new_job

    background_jobs.register_retry_handler("test_retry_kind", retry_handler)

    cancellable = background_jobs.create_job(
        kind="test_retry_kind",
        owner_id=1,
        org_id="org-test",
        message="Queued test job",
        context={"route": "/tests"},
        retry_context={"owner_id": 1},
    )

    def slow_worker(progress):
        progress(10, "Starting")
        time.sleep(0.4)
        progress(60, "Still working")
        time.sleep(0.4)
        return {"ok": True}

    background_jobs.start_job(cancellable["job_id"], slow_worker)
    cancelled = background_jobs.cancel_job(cancellable["job_id"], owner_id=1)
    assert cancelled["status"] in {"canceling", "canceled"}
    final_cancelled = _wait_for_service_job(cancellable["job_id"])
    assert final_cancelled["status"] == "canceled"

    failed = background_jobs.create_job(
        kind="test_retry_kind",
        owner_id=1,
        org_id="org-test",
        message="Queued failing job",
        context={"route": "/tests"},
        retry_context={"owner_id": 1},
    )
    background_jobs.start_job(failed["job_id"], lambda _progress: (_ for _ in ()).throw(RuntimeError("boom")))
    final_failed = _wait_for_service_job(failed["job_id"])
    assert final_failed["status"] == "failed"
    retried = background_jobs.retry_job(failed["job_id"], owner_id=1)
    assert retried["job_id"] != failed["job_id"]
    retried_done = _wait_for_service_job(retried["job_id"])
    assert retried_done["status"] == "succeeded"
    assert retry_calls == [failed["job_id"]]


def test_shared_report_pdf_job_and_cancel(http_client):
    user = register_user(http_client, role="manager")
    headers = _auth_headers(user["access_token"])

    set_org_plan_for_user_email(user["email"], "growth")

    created = http_client.post("/entries", json=create_entry_payload(index=22), headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    entry_id = created.json()["id"]
    mark_entry_approved(entry_id, user["user_id"])

    pdf_job = http_client.post(f"/reports/pdf/{entry_id}/jobs", headers=headers)
    assert pdf_job.status_code == HTTPStatus.OK, pdf_job.text
    queued_pdf = pdf_job.json()
    assert queued_pdf["kind"] == "reports_entry_pdf"

    finished_pdf = _wait_for_api_job(http_client, f"/reports/export-jobs/{queued_pdf['job_id']}", headers)
    assert finished_pdf["status"] == "succeeded", finished_pdf

    download = http_client.get(f"/reports/export-jobs/{queued_pdf['job_id']}/download", headers=headers)
    assert download.status_code == HTTPStatus.OK, download.text
    assert download.headers["content-type"].startswith("application/pdf")

    range_job = http_client.post("/reports/excel-range/jobs", headers=headers)
    assert range_job.status_code == HTTPStatus.OK, range_job.text
    queued_range = range_job.json()
    cancelled = http_client.post(f"/jobs/{queued_range['job_id']}/cancel", headers=headers)
    assert cancelled.status_code == HTTPStatus.OK, cancelled.text
    assert cancelled.json()["status"] in {"canceling", "canceled"}


def test_shared_ocr_job_retry_and_download(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])
    set_org_plan_for_user_email(user["email"], "factory")

    success = http_client.post(
        "/ocr/logbook-excel-async",
        headers=headers,
        data={"mock": "true"},
        files={"file": ("scan.png", PNG_1X1_BYTES, "image/png")},
    )
    assert success.status_code == HTTPStatus.ACCEPTED, success.text
    success_job = success.json()
    assert success_job["kind"] == "ocr_ledger_excel"

    success_done = _wait_for_api_job(http_client, f"/ocr/jobs/{success_job['job_id']}", headers)
    assert success_done["status"] == "succeeded", success_done

    download = http_client.get(f"/ocr/jobs/{success_job['job_id']}/download", headers=headers)
    assert download.status_code == HTTPStatus.OK, download.text
    assert download.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    failed = http_client.post(
        "/ocr/logbook-excel-async",
        headers=headers,
        data={"mock": "true"},
        files={"file": ("broken.png", b"not-a-real-image", "image/png")},
    )
    assert failed.status_code == HTTPStatus.ACCEPTED, failed.text
    failed_job = failed.json()
    failed_done = _wait_for_api_job(http_client, f"/ocr/jobs/{failed_job['job_id']}", headers)
    assert failed_done["status"] == "failed", failed_done

    retried = http_client.post(f"/jobs/{failed_job['job_id']}/retry", headers=headers)
    assert retried.status_code == HTTPStatus.OK, retried.text
    retried_payload = retried.json()
    assert retried_payload["kind"] == "ocr_ledger_excel"
    assert retried_payload["job_id"] != failed_job["job_id"]


def test_ocr_async_job_rejects_images_over_8mb(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])
    set_org_plan_for_user_email(user["email"], "factory")

    too_large = http_client.post(
        "/ocr/logbook-excel-async",
        headers=headers,
        data={"mock": "true"},
        files={"file": ("too-large.png", b"x" * 8_000_001, "image/png")},
    )
    assert too_large.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE, too_large.text
    assert "Max 8MB" in too_large.text
