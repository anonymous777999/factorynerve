from http import HTTPStatus

from tests.utils import create_entry_payload, register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_entry_create_is_idempotent_for_same_client_request_id(http_client):
    user = register_user(http_client, role="admin")
    payload = create_entry_payload(index=11)
    payload["client_request_id"] = "entry-sync-idempotent-001"

    first = http_client.post("/entries", json=payload, headers=_auth_headers(user["access_token"]))
    assert first.status_code == HTTPStatus.CREATED, first.text
    first_payload = first.json()

    second = http_client.post("/entries", json=payload, headers=_auth_headers(user["access_token"]))
    assert second.status_code == HTTPStatus.OK, second.text
    second_payload = second.json()

    assert second_payload["id"] == first_payload["id"]
    assert second_payload["client_request_id"] == payload["client_request_id"]


def test_entry_duplicate_prevention_blocks_same_factory_shift(http_client):
    first_user = register_user(http_client, role="admin")
    second_user = register_user(
        http_client,
        role="manager",
        factory_name=first_user["factory_name"],
        company_code=first_user["company_code"],
    )

    payload = create_entry_payload(index=12)
    created = http_client.post(
        "/entries",
        json=payload,
        headers=_auth_headers(first_user["access_token"]),
    )
    assert created.status_code == HTTPStatus.CREATED, created.text
    created_payload = created.json()

    duplicate = http_client.post(
        "/entries",
        json={**payload, "units_produced": payload["units_produced"] + 3},
        headers=_auth_headers(second_user["access_token"]),
    )
    assert duplicate.status_code == HTTPStatus.CONFLICT, duplicate.text
    detail = duplicate.json()["detail"]
    assert detail["entry_id"] == created_payload["id"]
    assert "already exists" in detail["message"].lower()
