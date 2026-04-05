from http import HTTPStatus

from tests.utils import register_user


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_factory_profile_catalog_and_update(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])

    catalog = http_client.get("/settings/factory-profiles", headers=headers)
    assert catalog.status_code == HTTPStatus.OK, catalog.text
    catalog_payload = catalog.json()
    assert {item["key"] for item in catalog_payload} >= {"general", "steel", "chemical"}

    current = http_client.get("/settings/factory", headers=headers)
    assert current.status_code == HTTPStatus.OK, current.text
    current_payload = current.json()
    assert current_payload["industry_type"] == "general"

    updated = http_client.put(
        "/settings/factory",
        headers=headers,
        json={
            "factory_name": user["factory_name"],
            "address": "Plot 42, Industrial Area",
            "industry_type": "steel",
            "target_morning": 120,
            "target_evening": 110,
            "target_night": 90,
        },
    )
    assert updated.status_code == HTTPStatus.OK, updated.text
    update_payload = updated.json()
    assert update_payload["industry_type"] == "steel"
    assert update_payload["industry_label"] == "Steel Industry"

    refreshed = http_client.get("/settings/factory", headers=headers)
    assert refreshed.status_code == HTTPStatus.OK, refreshed.text
    refreshed_payload = refreshed.json()
    assert refreshed_payload["industry_type"] == "steel"
    assert refreshed_payload["industry_label"] == "Steel Industry"
    assert refreshed_payload["factory_type"] == "Steel Industry"


def test_factory_profile_rejects_unknown_value(http_client):
    user = register_user(http_client, role="admin")
    headers = _auth_headers(user["access_token"])

    response = http_client.put(
        "/settings/factory",
        headers=headers,
        json={
            "factory_name": user["factory_name"],
            "industry_type": "unknown-space-lab",
            "target_morning": 10,
            "target_evening": 10,
            "target_night": 10,
        },
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST, response.text
    assert "Factory industry must be one of" in response.text
