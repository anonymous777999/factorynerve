import pytest
from http import HTTPStatus
from tests.utils import register_user

def test_ocr_history_cursor_pagination(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Create 15 records
    for i in range(15):
        resp = http_client.post(
            "/ocr/verifications",
            data={"language": "eng", "columns": "3", "reviewed_rows": "[[]]", "source_filename": f"doc_{i}"},
            headers=headers
        )
        assert resp.status_code == HTTPStatus.CREATED

    # Fetch page 1 (limit 10)
    resp1 = http_client.get("/ocr/history?limit=10", headers=headers)
    assert resp1.status_code == HTTPStatus.OK
    payload1 = resp1.json()
    if "data" in payload1:
        payload1 = payload1["data"]

    assert len(payload1["items"]) == 10
    assert payload1["has_more"] is True
    assert payload1["next_cursor"] is not None

    # Fetch page 2
    cursor = payload1["next_cursor"]
    resp2 = http_client.get(f"/ocr/history?limit=10&cursor={cursor}", headers=headers)
    assert resp2.status_code == HTTPStatus.OK
    payload2 = resp2.json()
    if "data" in payload2:
        payload2 = payload2["data"]

    assert len(payload2["items"]) == 5
    assert payload2["has_more"] is False
