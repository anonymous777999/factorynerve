import uuid
from datetime import date, timedelta
from urllib.parse import parse_qs, urlparse

import httpx

from datetime import datetime, timezone

from datetime import datetime, timezone

from backend.auth_security.passwords import hash_password as auth_hash_password
from backend.database import SessionLocal, init_db
from backend.models.auth_user import AuthUser
from backend.models.organization import Organization
from backend.models.user import User
from backend.models.user_factory_role import UserFactoryRole
from backend.plans import normalize_plan


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
        "factory_name": factory_name or unique_factory(),
        "company_code": company_code,
    }
    # The auth_secure register endpoint no longer creates the User directly.
    # It records a PendingRegistration and returns verification_required=True
    # plus a verification_link (exposed because conftest sets
    # EMAIL_VERIFICATION_EXPOSE_LINK=1). The User row is only created once the
    # verification token is redeemed, so we must complete that step here before
    # the user can be looked up or logged in.
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code in (200, 201), resp.text
    data = _unwrap_response(resp.json())

    if data.get("verification_required"):
        verification_link = data.get("verification_link")
        assert verification_link, f"verification_link missing from register response: {data}"
        token = parse_qs(urlparse(verification_link).query).get("token", [None])[0]
        assert token, f"could not extract verification token from link: {verification_link}"
        verify_resp = client.post("/auth/email/verify", json={"token": token})
        assert verify_resp.status_code in (200, 201), verify_resp.text

    # Look up the user from DB
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

    # Ensure an AuthUser record exists for v2 auth endpoints (may have been created
    # by create_session during register).
    init_db()
    auth_db = SessionLocal()
    try:
        existing_auth = auth_db.query(AuthUser).filter(AuthUser.email == normalized_email).first()
        if not existing_auth:
            auth_db.add(
                AuthUser(
                    email=normalized_email,
                    password_hash=auth_hash_password(payload["password"]),
                    is_active=True,
                    is_email_verified=True,
                    password_changed_at=datetime.now(timezone.utc),
                )
            )
            auth_db.commit()
    finally:
        auth_db.close()

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

    # Login via v2 to get session cookies. httpx's cookie jar may not track
    # Set-Cookie headers automatically, so we extract them manually from the
    # response headers and set them on the client's cookie jar.
    login_resp = client.post(
        "/auth/v2/login",
        json={"email": normalized_email, "password": payload["password"]},
    )
    assert login_resp.status_code == 200, login_resp.text

    # Manually extract cookies from response Set-Cookie headers
    from http.cookies import SimpleCookie
    session_token = ""
    csrf_token = ""
    for header_val in login_resp.headers.get_list("set-cookie"):
        cookie = SimpleCookie(header_val)
        for key, morsel in cookie.items():
            client.cookies.set(key, morsel.value, domain=client.base_url.host, path=morsel.get("path", "/") or "/")
            if key == "auth_session":
                session_token = morsel.value
            if key == "auth_csrf" or key == "dpr_csrf":
                csrf_token = morsel.value

    return {
        "email": user.email,
        "password": payload["password"],
        "access_token": session_token,  # JWT removed; auth is via the v2 session
        # cookie already set on the client. We surface the session token here so
        # legacy `Authorization: Bearer {access_token}` test helpers still emit a
        # legal (non-empty) header — the backend ignores it and authenticates
        # from the cookie jar.
        "session_token": session_token,
        "csrf_token": csrf_token,
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
        from datetime import datetime, timezone
        from backend.models.subscription import Subscription

        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        org = db.query(Organization).filter(Organization.org_id == user.org_id).first()
        assert org is not None
        org.plan = normalize_plan(plan)
        org.plan_expires_at = None
        db.add(org)

        subscription = (
            db.query(Subscription)
            .filter(Subscription.org_id == org.org_id, Subscription.status.in_(("active", "trialing")))
            .first()
        )
        if subscription:
            subscription.plan = normalize_plan(plan)
        else:
            db.add(
                Subscription(
                    org_id=org.org_id,
                    plan=normalize_plan(plan),
                    status="active",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            )
        db.commit()
    finally:
        db.close()
