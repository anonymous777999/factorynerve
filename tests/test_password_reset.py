from http import HTTPStatus
from urllib.parse import parse_qs, urlparse

from tests.utils import register_user


def _extract_token(reset_link: str) -> str:
    parsed = urlparse(reset_link)
    params = parse_qs(parsed.query)
    token = params.get("token") or params.get("reset_token")
    assert token, f"Reset link did not contain a token: {reset_link}"
    return token[0]


def test_password_reset_flow(http_client):
    user = register_user(http_client)

    forgot = http_client.post("/auth/password/forgot", json={"email": user["email"]})
    assert forgot.status_code == HTTPStatus.OK, forgot.text

    forgot_payload = forgot.json()
    assert forgot_payload["message"]
    assert forgot_payload.get("reset_link"), forgot_payload

    token = _extract_token(forgot_payload["reset_link"])

    validate = http_client.get("/auth/password/reset/validate", params={"token": token})
    assert validate.status_code == HTTPStatus.OK, validate.text
    assert validate.json()["valid"] is True

    new_password = "EvenStrongerPassw0rd!"
    reset = http_client.post(
        "/auth/password/reset",
        json={"token": token, "new_password": new_password},
    )
    assert reset.status_code == HTTPStatus.OK, reset.text

    old_login = http_client.post(
        "/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert old_login.status_code == HTTPStatus.UNAUTHORIZED

    new_login = http_client.post(
        "/auth/login",
        json={"email": user["email"], "password": new_password},
    )
    assert new_login.status_code == HTTPStatus.OK, new_login.text

    second_use = http_client.post(
        "/auth/password/reset",
        json={"token": token, "new_password": "AnotherStrongPassw0rd!"},
    )
    assert second_use.status_code == HTTPStatus.BAD_REQUEST
