from http import HTTPStatus

from tests.utils import register_user


def test_observability_ready_endpoint(http_client):
    response = http_client.get("/observability/ready")

    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["database"] == "ok"
    assert "uptime_seconds" in payload


def test_frontend_error_intake_accepts_reports(http_client):
    response = http_client.post(
        "/observability/frontend-error",
        json={
            "message": "Synthetic frontend crash",
            "source": "pytest",
            "url": "http://127.0.0.1:3000/dashboard",
            "route": "/dashboard",
            "stack": "Error: boom",
        },
    )

    assert response.status_code == HTTPStatus.ACCEPTED, response.text
    payload = response.json()
    assert payload["status"] == "accepted"


def test_frontend_error_intake_accepts_cookie_backed_reports_without_csrf(http_client):
    register_user(http_client, use_cookies=True)

    response = http_client.post(
        "/observability/frontend-error",
        json={
            "message": "Authenticated frontend crash",
            "source": "pytest-authenticated",
            "url": "http://127.0.0.1:3000/dashboard",
            "route": "/dashboard",
        },
    )

    assert response.status_code == HTTPStatus.ACCEPTED, response.text
    payload = response.json()
    assert payload["status"] == "accepted"
