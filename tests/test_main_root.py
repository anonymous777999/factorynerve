from http import HTTPStatus


def test_root_endpoint_returns_backend_status(http_client):
    response = http_client.get("/")

    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "backend"
    assert payload["health_url"] == "/health"
    assert payload["ready_url"] == "/observability/ready"
