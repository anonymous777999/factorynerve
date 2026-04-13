import uuid
from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx

from backend.database import SessionLocal, init_db
from backend.models.entry import Entry
from backend.models.organization import Organization
from backend.models.report import AuditLog
from backend.models.user import User
from backend.models.user_factory_role import UserFactoryRole
from backend.plans import normalize_plan


def unique_email() -> str:
    return f"qa_{uuid.uuid4().hex[:10]}@example.com"


def unique_factory() -> str:
    return f"QA Factory {uuid.uuid4().hex[:6]}"


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
    data = resp.json()
    verification_link = data.get("verification_link")
    assert verification_link, f"Expected verification link in test mode: {data}"

    parsed = urlparse(verification_link)
    token_values = parse_qs(parsed.query).get("token") or parse_qs(parsed.query).get("verification_token")
    assert token_values, f"Verification link did not contain token: {verification_link}"
    verify = client.post("/auth/email/verify", json={"token": token_values[0]})
    assert verify.status_code == 200, verify.text

    headers = {"X-Use-Cookies": "1"} if use_cookies else None
    login = client.post(
        "/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
        headers=headers,
    )
    assert login.status_code == 200, login.text
    auth_data = login.json()
    actual_role = auth_data.get("user", {}).get("role")
    if requested_role != actual_role:
        init_db()
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == payload["email"]).first()
            assert user is not None
            user.role = requested_role
            memberships = db.query(UserFactoryRole).filter(UserFactoryRole.user_id == user.id).all()
            for membership in memberships:
                membership.role = requested_role
            db.commit()
        finally:
            db.close()
    return {
        "email": payload["email"],
        "password": payload["password"],
        "access_token": auth_data.get("access_token"),
        "user_id": auth_data.get("user", {}).get("id"),
        "user_code": auth_data.get("user", {}).get("user_code"),
        "company_code": auth_data.get("user", {}).get("factory_code"),
        "factory_name": auth_data.get("user", {}).get("factory_name") or payload["factory_name"],
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


def mark_entry_approved(entry_id: int, approver_user_id: int) -> None:
    init_db()
    db = SessionLocal()
    try:
        entry = db.query(Entry).filter(Entry.id == entry_id).first()
        assert entry is not None
        entry.status = "approved"
        db.add(
            AuditLog(
                user_id=approver_user_id,
                org_id=entry.org_id,
                factory_id=entry.factory_id,
                action="ENTRY_APPROVED",
                details=f"entry_id={entry.id}",
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )
        db.commit()
    finally:
        db.close()
