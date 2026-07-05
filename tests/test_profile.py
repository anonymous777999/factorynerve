from http import HTTPStatus
import io

from PIL import Image

from tests.utils import register_user


def _csrf_headers(http_client) -> dict[str, str]:
    csrf = http_client.cookies.get("auth_csrf")
    if csrf:
        return {"X-CSRF-Token": csrf}
    return {}


def test_profile_read_and_update(http_client):
    user = register_user(http_client, role="supervisor")

    me = http_client.get("/auth/v2/me")
    assert me.status_code == HTTPStatus.OK, me.text
    payload = me.json()
    assert payload["user_code"] >= 10000
    assert payload["created_at"]
    assert payload["email"] == user["email"]

    updated = http_client.put(
        "/auth/profile",
        headers=_csrf_headers(http_client),
        json={"name": "Updated QA User", "phone_number": "+919999999999"},
    )
    assert updated.status_code == HTTPStatus.OK, updated.text
    updated_payload = updated.json()
    assert updated_payload["name"] == "Updated QA User"
    assert updated_payload["phone_number"] == "+919999999999"


def test_profile_update_rejects_email_like_phone(http_client):
    user = register_user(http_client, role="supervisor")

    updated = http_client.put(
        "/auth/profile",
        headers=_csrf_headers(http_client),
        json={"phone_number": "person@example.com"},
    )
    assert updated.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, updated.text
    assert "Phone number cannot be an email address." in updated.text


def test_change_password_allows_new_login(http_client):
    user = register_user(http_client, role="operator")
    new_password = "EvenStrongerPassw0rd!"

    changed = http_client.post(
        "/auth/change-password",
        headers=_csrf_headers(http_client),
        json={"old_password": user["password"], "new_password": new_password},
    )
    assert changed.status_code == HTTPStatus.OK, changed.text

    # Register_user() creates an AuthUser record, and change-password now syncs
    # to AuthUser. So old password should fail and new password should succeed.
    old_login = http_client.post(
        "/auth/v2/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert old_login.status_code == HTTPStatus.UNAUTHORIZED, old_login.text

    new_login = http_client.post(
        "/auth/v2/login",
        json={"email": user["email"], "password": new_password},
    )
    assert new_login.status_code == HTTPStatus.OK, new_login.text


def test_profile_photo_upload_and_remove(http_client):
    user = register_user(http_client, role="operator")

    image_buffer = io.BytesIO()
    Image.new("RGB", (640, 480), color=(32, 86, 170)).save(image_buffer, format="PNG")
    image_buffer.seek(0)

    uploaded = http_client.post(
        "/auth/profile-photo",
        headers=_csrf_headers(http_client),
        files={"file": ("profile.png", image_buffer.getvalue(), "image/png")},
    )
    assert uploaded.status_code == HTTPStatus.OK, uploaded.text
    uploaded_payload = uploaded.json()
    photo_path = uploaded_payload["profile_picture"]
    assert isinstance(photo_path, str)
    assert photo_path.startswith("/auth/profile-photo/")

    photo_name = photo_path.rsplit("/", 1)[-1]
    fetched = http_client.get(f"/auth/profile-photo/{photo_name}")
    assert fetched.status_code == HTTPStatus.OK, fetched.text
    assert fetched.headers["content-type"].startswith("image/jpeg")

    removed = http_client.delete("/auth/profile-photo", headers=_csrf_headers(http_client))
    assert removed.status_code == HTTPStatus.OK, removed.text
    removed_payload = removed.json()
    assert removed_payload["profile_picture"] is None

    missing = http_client.get(f"/auth/profile-photo/{photo_name}")
    assert missing.status_code == HTTPStatus.NOT_FOUND, missing.text
