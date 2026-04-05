from http import HTTPStatus

from tests.utils import register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_demo_loader_requires_admin_role(http_client):
    manager = register_user(http_client, role="manager")
    response = http_client.post("/settings/demo/load", headers=_auth_headers(manager["access_token"]))
    assert response.status_code == HTTPStatus.FORBIDDEN, response.text


def test_demo_loader_seeds_factory_entries_idempotently(http_client):
    admin = register_user(http_client, role="admin")
    headers = _auth_headers(admin["access_token"])

    first = http_client.post("/settings/demo/load", headers=headers)
    assert first.status_code == HTTPStatus.OK, first.text
    first_payload = first.json()
    assert first_payload["message"] == "Demo data loaded successfully."
    assert first_payload["created_count"] == 21
    assert first_payload["updated_count"] == 0
    assert len(first_payload["entry_ids"]) == 21
    assert first_payload["window"]["days"] == 7

    second = http_client.post("/settings/demo/load", headers=headers)
    assert second.status_code == HTTPStatus.OK, second.text
    second_payload = second.json()
    assert second_payload["created_count"] == 0
    assert second_payload["updated_count"] == 21
    assert len(second_payload["entry_ids"]) == 21

    entries = http_client.get("/entries", headers=headers)
    assert entries.status_code == HTTPStatus.OK, entries.text
    assert entries.json().get("total", 0) >= 21
