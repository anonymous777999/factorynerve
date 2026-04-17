from http import HTTPStatus

from tests.utils import invite_and_accept_user, register_user


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
    invited = invite_and_accept_user(
        http_client,
        inviter_token=admin["access_token"],
        name="QA Invite",
        email="invite_" + admin["email"],
        role="operator",
        factory_name=admin["factory_name"],
    )

    assert isinstance(invited.get("user_code"), int)
    assert invited["user_code"] >= 10000
    assert invited["user_code"] != admin["user_code"]
