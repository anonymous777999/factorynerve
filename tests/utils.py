import uuid
from datetime import date, timedelta
from urllib.parse import parse_qs, urlparse

import httpx

from backend.database import SessionLocal, init_db
from backend.models.organization import Organization
from backend.models.user import User
from backend.models.user_factory_role import UserFactoryRole
from backend.plans import normalize_plan
from backend.security import create_access_token


def _unwrap_response(data: dict) -> dict:
    """Unwrap response envelope if present.

    The backend may wrap JSON responses in {success: True, data: ...}
    when the response envelope middleware is active.
    """
    if isinstance(data, dict) and data.get("success") is True and "data" in data:
        return data["data"]
    return data


def unique_email() -> str:
    return f"qa_{uuid.uuid4().hex[:10]}@example.com"


def unique_factory() -> str:
    return f"QA Factory {uuid.uuid4().hex[:6]}"


def _lookup_user(email: str) -> User:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None, f"User {email} not found after verification"
        # Force-load all attributes before closing the session
        _ = user.id
        _ = user.org_id
        _ = user.role
        _ = user.user_code
        _ = user.factory_code
        _ = user.factory_name
        _ = user.email
        return user
    finally:
        db.close()


def register_user(
    client: httpx.Client,
    *,
    role: str = "admin",
    use_cookies: bool = False,
    factory_name: str | None = None,
    company_code: str | None = None,
    email: str | None = None,
) -> dict:
    requested_role = role
    normalized_email = email or unique_email()
    payload = {
        "name": "QA User",
        "email": normalized_email,
        "password": "StrongPassw0rd!",
        "role": "attendance",
        "factory_name": factory_name or unique_factory(),
        "company_code": company_code,
        "phone_number": "+910000000000",
    }
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code in (200, 201), resp.text
    data = _unwrap_response(resp.json())
    verification_link = data.get("verification_link")
    assert verification_link, f"Expected verification link in test mode: {data}"

    parsed = urlparse(verification_link)
    token_values = parse_qs(parsed.query).get("token") or parse_qs(parsed.query).get("verification_token")
    assert token_values, f"Verification link did not contain token: {verification_link}"
    verify = client.post("/auth/email/verify", json={"token": token_values[0]})
    assert verify.status_code == 200, verify.text

    # Look up the user from DB and create an access token directly.
    # /auth/login is deprecated (returns 410), so we bypass it in tests.
    user = _lookup_user(normalized_email)

    # Override role if requested role differs from the assigned role
    if requested_role != user.role.value:
        init_db()
        db = SessionLocal()
        try:
            user_db = db.query(User).filter(User.email == normalized_email).first()
            assert user_db is not None
            user_db.role = requested_role
            memberships = db.query(UserFactoryRole).filter(UserFactoryRole.user_id == user_db.id).all()
            for membership in memberships:
                membership.role = requested_role
            db.commit()
            user.role = requested_role
        finally:
            db.close()

    # Get the first factory membership for auth context
    init_db()
    db = SessionLocal()
    try:
        membership = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == user.id)
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )
        factory_id = membership.factory_id if membership else None
        org_id = membership.org_id if membership else user.org_id
    finally:
        db.close()

    access_token = create_access_token(
        user_id=user.id,
        role=str(user.role.value) if hasattr(user.role, "value") else str(user.role),
        email=user.email,
        org_id=org_id,
        factory_id=factory_id,
        mfa_verified=False,
    )

    return {
        "email": user.email,
        "password": payload["password"],
        "access_token": access_token,
        "user_id": user.id,
        "user_code": user.user_code,
        "company_code": user.factory_code,
        "factory_name": user.factory_name or payload["factory_name"],
    }


def create_entry_payload(index: int = 0) -> dict:
    entry_date = date.today() - timedelta(days=index % 30)
    return {
        "date": entry_date.isoformat(),
        "shift": "morning",
        "units_target": 100 + index,
        "units_produced": 95 + index,
        "manpower_present": 20,
        "manpower_absent": 2,
        "downtime_minutes": 5,
        "downtime_reason": "Maintenance",
        "department": "Admin",
        "materials_used": "Steel",
        "quality_issues": False,
        "quality_details": None,
        "notes": "QA entry",
    }


def set_org_plan_for_user_email(email: str, plan: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        org = db.query(Organization).filter(Organization.org_id == user.org_id).first()
        assert org is not None
        org.plan = normalize_plan(plan)
        org.plan_expires_at = None
        db.add(org)
        db.commit()
    finally:
        db.close()
