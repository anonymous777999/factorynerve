from http import HTTPStatus

from tests.utils import register_user, set_org_plan_for_user_email


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_feedback_submit_list_resolve_updates_and_export_flow(http_client):
    admin = register_user(http_client, role="admin")
    operator = register_user(
        http_client,
        role="operator",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )

    submit_response = http_client.post(
        "/feedback",
        json={
            "type": "bug",
            "message_original": "रिपोर्ट स्क्रीन तारीख बदलने पर रुक जाती है।",
            "source": "floating",
            "channel": "voice",
            "mood": "frustrated",
            "rating": "down",
            "context": {
                "route": "/reports",
                "page_title": "Reports",
                "last_action": "Changed date range",
            },
            "client_request_id": "feedback-flow-001",
        },
        headers=_auth_headers(operator["access_token"]),
    )
    assert submit_response.status_code == HTTPStatus.OK, submit_response.text
    submitted = submit_response.json()
    assert submitted["deduplicated"] is False
    assert submitted["type"] == "bug"
    feedback_id = submitted["id"]

    list_response = http_client.get(
        "/feedback?sort=recency",
        headers=_auth_headers(admin["access_token"]),
    )
    assert list_response.status_code == HTTPStatus.OK, list_response.text
    payload = list_response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == feedback_id
    assert payload["items"][0]["user_role"] == "operator"
    assert payload["items"][0]["context"]["route"] == "/reports"
    assert payload["items"][0]["rating"] == "down"
    assert payload["items"][0]["detected_language"] == "hi"

    resolve_response = http_client.patch(
        f"/feedback/{feedback_id}",
        json={"status": "resolved", "resolution_note": "Fixed in the date filter flow."},
        headers=_auth_headers(admin["access_token"]),
    )
    assert resolve_response.status_code == HTTPStatus.OK, resolve_response.text
    resolved = resolve_response.json()
    assert resolved["status"] == "resolved"
    assert resolved["resolution_note"] == "Fixed in the date filter flow."
    assert resolved["resolved_by_user_id"] == admin["user_id"]

    updates_response = http_client.get(
        "/feedback/mine/updates",
        headers=_auth_headers(operator["access_token"]),
    )
    assert updates_response.status_code == HTTPStatus.OK, updates_response.text
    updates = updates_response.json()
    assert updates["total"] == 1
    assert updates["items"][0]["id"] == feedback_id
    assert updates["items"][0]["resolution_note"] == "Fixed in the date filter flow."

    export_response = http_client.get(
        "/feedback/export.csv?sort=recency",
        headers=_auth_headers(admin["access_token"]),
    )
    assert export_response.status_code == HTTPStatus.OK, export_response.text
    assert export_response.headers["content-type"].startswith("text/csv")
    assert "message_original" in export_response.text
    assert "Fixed in the date filter flow." in export_response.text


def test_feedback_dedup_frequency_sort_and_admin_permissions(http_client):
    admin = register_user(http_client, role="admin")
    set_org_plan_for_user_email(admin["email"], "growth")
    manager = register_user(
        http_client,
        role="manager",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )
    operator_one = register_user(
        http_client,
        role="operator",
        factory_name=admin["factory_name"],
        company_code=admin["company_code"],
    )
    payload = {
        "type": "alert_problem",
        "message_original": "The late shift alert fired even though attendance was complete.",
        "source": "floating",
        "channel": "text",
        "context": {"route": "/dashboard", "last_action": "Viewed alerts"},
        "client_request_id": "feedback-dedupe-001",
    }
    first_response = http_client.post(
        "/feedback",
        json=payload,
        headers=_auth_headers(operator_one["access_token"]),
    )
    assert first_response.status_code == HTTPStatus.OK, first_response.text
    first = first_response.json()

    second_response = http_client.post(
        "/feedback",
        json=payload,
        headers=_auth_headers(operator_one["access_token"]),
    )
    assert second_response.status_code == HTTPStatus.OK, second_response.text
    second = second_response.json()
    assert second["deduplicated"] is True
    assert second["id"] == first["id"]

    third_response = http_client.post(
        "/feedback",
        json={
            **payload,
            "client_request_id": "feedback-dedupe-002",
        },
        headers=_auth_headers(admin["access_token"]),
    )
    assert third_response.status_code == HTTPStatus.OK, third_response.text

    frequency_response = http_client.get(
        "/feedback?sort=frequency",
        headers=_auth_headers(admin["access_token"]),
    )
    assert frequency_response.status_code == HTTPStatus.OK, frequency_response.text
    frequency_payload = frequency_response.json()
    assert frequency_payload["items"][0]["group_occurrences"] == 2

    forbidden_response = http_client.get("/feedback", headers=_auth_headers(manager["access_token"]))
    assert forbidden_response.status_code == HTTPStatus.FORBIDDEN, forbidden_response.text
