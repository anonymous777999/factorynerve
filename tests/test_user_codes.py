from http import HTTPStatus

from tests.utils import register_user


def test_user_code_is_five_digits_and_unique_within_org(http_client):
    first = register_user(http_client)
    second = register_user(
        http_client,
        factory_name=first["factory_name"],
        company_code=first["company_code"],
    )

    assert isinstance(first["user_code"], int)
    assert isinstance(second["user_code"], int)
    assert first["user_code"] >= 10000
    assert second["user_code"] >= 10000
    assert first["user_code"] != second["user_code"]


def test_invited_user_receives_org_scoped_user_code(http_client):
    admin = register_user(http_client, use_cookies=True)
    csrf = http_client.cookies.get("dpr_csrf")
    assert csrf

    invite = http_client.post(
        "/settings/users/invite",
        json={
            "name": "QA Invite",
            "email": "invite_" + admin["email"],
            "role": "operator",
            "factory_name": admin["factory_name"],
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert invite.status_code == HTTPStatus.CREATED, invite.text

    payload = invite.json()
    assert isinstance(payload.get("user_code"), int)
    assert payload["user_code"] >= 10000
    assert payload["user_code"] != admin["user_code"]
