from http import HTTPStatus
import time

from tests.utils import register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _sample_pdf_bytes() -> bytes:
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Length 128 >>\nstream\n"
        b"BT /F1 12 Tf 72 720 Td "
        b"(Dispatch Register 2026-04-02 Operator: Rajesh Shift: Night Qty 35 Total 35) Tj "
        b"ET\n"
        b"endstream\nendobj\n"
        b"trailer\n<<>>\n%%EOF"
    )


def _wait_for_request(http_client, request_id: str, headers: dict[str, str], attempts: int = 60) -> dict:
    payload = None
    for _ in range(attempts):
        response = http_client.get(f"/intelligence/requests/{request_id}", headers=headers)
        assert response.status_code == HTTPStatus.OK, response.text
        payload = response.json()
        if payload.get("status") in {"succeeded", "failed"}:
            return payload
        time.sleep(0.5)
    raise AssertionError(f"Factory Intelligence request did not complete in time: {payload}")


def test_factory_intelligence_request_runs_async_and_uses_cache(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])
    files = {"file": ("dispatch.pdf", _sample_pdf_bytes(), "application/pdf")}

    created = http_client.post("/intelligence/requests", files=files, headers=headers)
    assert created.status_code == HTTPStatus.ACCEPTED, created.text
    queued = created.json()
    assert queued["status"] == "queued"
    assert queued["request_id"]
    assert queued["job_id"]

    listed = http_client.get("/intelligence/requests", headers=headers)
    assert listed.status_code == HTTPStatus.OK, listed.text
    assert any(item["request_id"] == queued["request_id"] for item in listed.json())

    first_detail = _wait_for_request(http_client, queued["request_id"], headers)
    assert first_detail["status"] == "succeeded", first_detail
    assert first_detail["cached_result"] is False
    assert first_detail["normalized_result"]["document"]["kind"] == "pdf"
    assert first_detail["normalized_result"]["loss_estimation"]["estimated_loss_inr"] is not None
    assert len(first_detail["stage_usage"]) >= 4

    created_again = http_client.post("/intelligence/requests", files=files, headers=headers)
    assert created_again.status_code == HTTPStatus.ACCEPTED, created_again.text
    queued_again = created_again.json()
    assert queued_again["cached_result_available"] is True

    cached_detail = _wait_for_request(http_client, queued_again["request_id"], headers)
    assert cached_detail["status"] == "succeeded", cached_detail
    assert cached_detail["cached_result"] is True
    assert cached_detail["normalized_result"]["document"]["hash"] == first_detail["document_hash"]

    usage = http_client.get("/intelligence/usage", headers=headers)
    assert usage.status_code == HTTPStatus.OK, usage.text
    usage_payload = usage.json()
    assert usage_payload["total_requests"] >= 2
    assert usage_payload["completed_requests"] >= 2
    assert usage_payload["cached_requests"] >= 1
