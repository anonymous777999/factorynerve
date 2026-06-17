from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException

from backend.database import SessionLocal
from backend.models.entry import Entry, ShiftType
from backend.models.factory import Factory
from backend.models.ocr_verification import OcrVerification
from backend.models.organization import Organization
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.query_helpers import get_org_record_or_404
from backend.security import create_access_token


def _seed_org_user_data():
    org_a = str(uuid.uuid4())
    org_b = str(uuid.uuid4())
    factory_a = str(uuid.uuid4())
    factory_b = str(uuid.uuid4())

    with SessionLocal() as db:
        db.add_all(
            [
                Organization(org_id=org_a, name="Org A", plan="operations", created_at=datetime.now(timezone.utc), is_active=True),
                Organization(org_id=org_b, name="Org B", plan="operations", created_at=datetime.now(timezone.utc), is_active=True),
                Factory(factory_id=factory_a, org_id=org_a, name="Factory A"),
                Factory(factory_id=factory_b, org_id=org_b, name="Factory B"),
            ]
        )
        db.flush()

        user_a = User(
            org_id=org_a,
            user_code=1001,
            name="User A",
            email=f"user-a-{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            role=UserRole.ADMIN,
            role_revision=0,
            factory_name="Factory A",
            auth_provider="local",
            is_active=True,
        )
        user_b = User(
            org_id=org_b,
            user_code=1002,
            name="User B",
            email=f"user-b-{uuid.uuid4().hex[:8]}@example.com",
            password_hash="hashed",
            role=UserRole.ADMIN,
            role_revision=0,
            factory_name="Factory B",
            auth_provider="local",
            is_active=True,
        )
        db.add_all([user_a, user_b])
        db.flush()

        db.add_all(
            [
                UserFactoryRole(user_id=user_a.id, factory_id=factory_a, org_id=org_a, role=UserRole.ADMIN),
                UserFactoryRole(user_id=user_b.id, factory_id=factory_b, org_id=org_b, role=UserRole.ADMIN),
            ]
        )

        entry_a = Entry(
            user_id=user_a.id,
            org_id=org_a,
            factory_id=factory_a,
            date=date.today(),
            shift=ShiftType.MORNING,
            units_target=100,
            units_produced=95,
            manpower_present=10,
            manpower_absent=1,
            downtime_minutes=2,
            status="submitted",
            is_active=True,
        )
        entry_b = Entry(
            user_id=user_b.id,
            org_id=org_b,
            factory_id=factory_b,
            date=date.today(),
            shift=ShiftType.MORNING,
            units_target=100,
            units_produced=95,
            manpower_present=10,
            manpower_absent=1,
            downtime_minutes=2,
            status="submitted",
            is_active=True,
        )
        verification_b = OcrVerification(
            org_id=org_b,
            factory_id=factory_b,
            user_id=user_b.id,
            source_filename="ocr-b.png",
            columns=2,
            language="eng",
            status="draft",
            headers=["A", "B"],
            original_rows=[["1", "2"]],
            reviewed_rows=[["1", "2"]],
        )
        db.add_all([entry_a, entry_b, verification_b])
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)
        db.refresh(entry_a)
        db.refresh(entry_b)
        db.refresh(verification_b)

        return {
            "user_a": user_a,
            "entry_a_id": entry_a.id,
            "entry_b_id": entry_b.id,
            "verification_b_id": verification_b.id,
            "factory_a": factory_a,
        }


def _auth_headers(user: User, factory_id: str) -> dict[str, str]:
    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        email=user.email,
        org_id=user.org_id,
        factory_id=factory_id,
    )
    return {"Authorization": f"Bearer {token}"}


def test_user_from_org_a_cannot_fetch_entry_belonging_to_org_b(http_client):
    seeded = _seed_org_user_data()
    response = http_client.get(
        f"/entries/{seeded['entry_b_id']}",
        headers=_auth_headers(seeded["user_a"], seeded["factory_a"]),
    )
    assert response.status_code == 404, response.text


def test_user_from_org_a_cannot_fetch_ocr_job_belonging_to_org_b(http_client):
    seeded = _seed_org_user_data()
    response = http_client.get(
        f"/ocr/verifications/{seeded['verification_b_id']}",
        headers=_auth_headers(seeded["user_a"], seeded["factory_a"]),
    )
    assert response.status_code == 404, response.text


def test_user_from_org_a_can_fetch_their_own_entry(http_client):
    seeded = _seed_org_user_data()
    response = http_client.get(
        f"/entries/{seeded['entry_a_id']}",
        headers=_auth_headers(seeded["user_a"], seeded["factory_a"]),
    )
    assert response.status_code == 200, response.text
    assert response.json()["id"] == seeded["entry_a_id"]


def test_get_org_record_or_404_returns_404_not_403_on_wrong_org_access():
    class ResultStub:
        def scalar_one_or_none(self):
            return None

    class AsyncSessionStub:
        async def execute(self, statement):
            del statement
            return ResultStub()

    try:
        asyncio.run(get_org_record_or_404(AsyncSessionStub(), Entry, 999, SimpleNamespace(org_id="org-a")))
    except HTTPException as exc:
        assert exc.status_code == 404
        assert exc.detail == "Not found"
    else:
        raise AssertionError("Expected wrong-org lookup to raise HTTPException.")
