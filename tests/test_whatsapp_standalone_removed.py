from __future__ import annotations

from http import HTTPStatus


def test_deleted_standalone_whatsapp_endpoints_are_not_reachable(http_client):
    send_response = http_client.post(
        "/alerts/send",
        json={"alert_type": "critical", "message": "Machine stopped."},
    )
    recipient_response = http_client.post(
        "/recipients",
        json={"name": "Ops", "phone_e164": "+919999999999"},
    )

    assert send_response.status_code == HTTPStatus.NOT_FOUND, send_response.text
    assert recipient_response.status_code == HTTPStatus.NOT_FOUND, recipient_response.text


def test_admin_alert_recipients_route_requires_authentication(http_client):
    response = http_client.get("/settings/alert-recipients")

    assert response.status_code == HTTPStatus.UNAUTHORIZED, response.text
