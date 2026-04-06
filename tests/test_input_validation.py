from http import HTTPStatus

from backend.utils import normalize_identifier_code, normalize_phone_number, normalize_reference_code
from tests.utils import register_user, unique_email, unique_factory


def test_normalize_phone_number_accepts_standard_values():
    assert normalize_phone_number("+91 98765 43210") == "+91 98765 43210"


def test_normalize_phone_number_rejects_email_like_values():
    try:
        normalize_phone_number("worker@example.com")
    except ValueError as error:
        assert "email address" in str(error)
    else:
        raise AssertionError("Expected email-like phone value to fail validation.")


def test_normalize_identifier_code_rejects_email_like_values():
    try:
        normalize_identifier_code("emp@example.com", field_name="Employee code")
    except ValueError as error:
        assert "email address" in str(error)
    else:
        raise AssertionError("Expected email-like employee code to fail validation.")


def test_normalize_reference_code_rejects_email_like_values():
    try:
        normalize_reference_code("utr@example.com", field_name="Reference number")
    except ValueError as error:
        assert "email address" in str(error)
    else:
        raise AssertionError("Expected email-like reference number to fail validation.")


def test_register_rejects_email_like_phone_number(http_client):
    response = http_client.post(
        "/auth/register",
        json={
            "name": "QA User",
            "email": unique_email(),
            "password": "StrongPassw0rd!",
            "role": "operator",
            "factory_name": unique_factory(),
            "phone_number": "person@example.com",
        },
    )
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, response.text
    assert "Phone number cannot be an email address." in response.text


def test_employee_profile_rejects_email_like_employee_code(http_client):
    admin = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    response = http_client.post(
        "/attendance/settings/employees",
        headers=headers,
        json={
            "user_id": admin["user_id"],
            "employee_code": "emp@example.com",
            "department": "Forge",
            "designation": "Operator",
            "employment_type": "permanent",
            "default_shift": "morning",
            "is_active": True,
        },
    )
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, response.text
    assert "Employee code cannot be an email address." in response.text
