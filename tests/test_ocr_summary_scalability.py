import pytest
from datetime import datetime, timezone
from http import HTTPStatus
from tests.utils import register_user

def _verification_form_with_rows(rows):
    import json
    return {
        "language": "eng",
        "columns": "3",
        "avg_confidence": "95",
        "reviewed_rows": json.dumps(rows),
        "doc_type_hint": "table"
    }

def test_get_verification_summary_logic(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # 1. Approved document with 2 rows
    v1 = http_client.post(
        "/ocr/verifications",
        data=_verification_form_with_rows([["a", "b"], ["c", "d"]]),
        headers=headers
    )
    assert v1.status_code == HTTPStatus.CREATED
    v1_id = v1.json()["id"]
    http_client.post(f"/ocr/verifications/{v1_id}/submit", json={}, headers=headers)
    http_client.post(f"/ocr/verifications/{v1_id}/approve", json={}, headers=headers)

    # 2. Pending document with 1 row
    v2 = http_client.post(
        "/ocr/verifications",
        data=_verification_form_with_rows([["x", "y"]]),
        headers=headers
    )
    assert v2.status_code == HTTPStatus.CREATED
    v2_id = v2.json()["id"]
    http_client.post(f"/ocr/verifications/{v2_id}/submit", json={}, headers=headers)

    # 3. Fetch summary
    resp = http_client.get("/ocr/verifications/summary", headers=headers)
    assert resp.status_code == HTTPStatus.OK, resp.text
    payload = resp.json()
    summary = payload["data"]

    assert summary["total_documents"] == 2
    assert summary["trusted_documents"] == 1
    assert summary["trusted_rows"] == 2
    assert summary["pending_documents"] == 1
    assert summary["pending_rows"] == 1
    assert summary["avg_trusted_confidence"] == 95.0
