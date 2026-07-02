from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from backend.database import SessionLocal, init_db
from backend.dependencies.quota import require_ocr_quota
from backend.middleware.rate_limit import _fallback_hits
from backend.models.organization import Organization
from backend.models.subscription import Subscription
from backend.models.user import User, UserRole
from backend.routers.billing import _reset_org_ocr_quota_period
from backend.auth_security.tokens import generate_token, hash_token
from backend.models.auth_session import AuthSession
from backend.models.auth_user import AuthUser
from backend.security import hash_password


COOKIE_NAME = "auth_session"


def _headers(session_token: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={session_token}"}


def _create_authenticated_user(*, role: UserRole = UserRole.OWNER) -> dict[str, object]:
    init_db()
    db = SessionLocal()
    try:
        org_id = str(uuid4())
        email = f"phase4_{uuid4().hex[:10]}@example.com"
        now = datetime.now(timezone.utc)
        org = Organization(org_id=org_id, name=f"Phase4 Org {uuid4().hex[:6]}", plan="operator", is_active=True)
        user = User(
            org_id=org_id,
            user_code=10000 + int(uuid4().hex[:4], 16),
            name="Phase 4 User",
            email=email,
            password_hash=hash_password("StrongPassw0rd!"),
            role=role,
            factory_name="Phase4 Factory",
            is_active=True,
        )
        db.add(org)
        db.add(user)
        db.flush()

        # Create a matching AuthUser for v2 session auth
        auth_user = AuthUser(
            email=email,
            password_hash=hash_password("StrongPassw0rd!"),
            is_email_verified=True,
            is_active=True,
        )
        db.add(auth_user)
        db.flush()

        # Create a v2 session directly and return the raw token
        raw_token = generate_token(32)
        token_hash = hash_token(raw_token)
        session = AuthSession(
            auth_user_id=auth_user.id,
            token_hash=token_hash,
            csrf_hash=hash_token(generate_token(16)),
            created_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.add(session)
        db.commit()

        return {"email": user.email, "access_token": raw_token, "user_id": user.id, "org_id": user.org_id}
    finally:
        db.close()


def _ensure_phase4_ocr_usage_schema() -> None:
    init_db()
    db = SessionLocal()
    try:
        dialect = db.bind.dialect.name if db.bind else "sqlite"
        if dialect == "sqlite":
            columns = {
                row[1]
                for row in db.execute(text("PRAGMA table_info(org_ocr_usage)")).fetchall()
            }
        else:
            columns = {
                str(row[0])
                for row in db.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'org_ocr_usage'
                        """
                    )
                ).fetchall()
            }
        statements: list[str] = []
        if "ocr_limit" not in columns:
            statements.append("ALTER TABLE org_ocr_usage ADD COLUMN ocr_limit INTEGER NOT NULL DEFAULT 0")
        if "period_start" not in columns:
            statements.append("ALTER TABLE org_ocr_usage ADD COLUMN period_start TIMESTAMP")
        if "period_end" not in columns:
            statements.append("ALTER TABLE org_ocr_usage ADD COLUMN period_end TIMESTAMP")
        for statement in statements:
            db.execute(text(statement))
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_org_ocr_usage_org_id ON org_ocr_usage (org_id)"))
        db.commit()
    finally:
        db.close()


def _set_subscription_state(email: str, *, status: str, grace_hours: int = 24) -> tuple[User, Subscription]:
    _ensure_phase4_ocr_usage_schema()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        sub = db.query(Subscription).filter(Subscription.org_id == user.org_id).first()
        if not sub:
            sub = Subscription(org_id=user.org_id, user_id=user.id, plan="operator", status="active")
        sub.status = status
        sub.user_id = user.id
        sub.plan = "operator"
        sub.grace_period_end_at = datetime.now(timezone.utc) + timedelta(hours=grace_hours)
        db.add(sub)
        db.commit()
        db.refresh(user)
        db.refresh(sub)
        return user, sub
    finally:
        db.close()


def _seed_org_quota(org_id: str, *, limit: int, count: int, expires_in_hours: int = 24) -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        db.execute(
            text(
                """
                INSERT INTO org_ocr_usage (org_id, period, ocr_limit, request_count, credit_count, period_start, period_end, created_at, updated_at)
                VALUES (:org_id, :period, :ocr_limit, :request_count, 0, :period_start, :period_end, :created_at, :updated_at)
                ON CONFLICT(org_id, period) DO UPDATE
                SET ocr_limit = excluded.ocr_limit,
                    request_count = excluded.request_count,
                    period_start = excluded.period_start,
                    period_end = excluded.period_end,
                    updated_at = excluded.updated_at
                """
            ),
            {
                "org_id": org_id,
                "period": now.strftime("%Y-%m"),
                "ocr_limit": limit,
                "request_count": count,
                "period_start": now,
                "period_end": now + timedelta(hours=expires_in_hours),
                "created_at": now,
                "updated_at": now,
            },
        )
        db.commit()
    finally:
        db.close()


def _load_request_count(org_id: str) -> int:
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT request_count FROM org_ocr_usage WHERE org_id = :org_id"),
            {"org_id": org_id},
        ).fetchone()
        assert row is not None
        return int(row[0])
    finally:
        db.close()


def test_atomic_decrement_blocks_at_exact_limit(http_client):
    user = _create_authenticated_user()
    orm_user, _ = _set_subscription_state(str(user["email"]), status="active")
    _seed_org_quota(orm_user.org_id, limit=2, count=1)

    db1 = SessionLocal()
    db2 = SessionLocal()
    try:
        row = asyncio.run(require_ocr_quota(user=orm_user, db=db1))
        assert row["request_count"] == 2
        assert _load_request_count(orm_user.org_id) == 2
        with pytest.raises(HTTPException) as error:
            asyncio.run(require_ocr_quota(user=orm_user, db=db2))
        assert error.value.status_code == 429
        assert error.value.detail["code"] == "QUOTA_EXHAUSTED"
        assert _load_request_count(orm_user.org_id) == 2
    finally:
        db1.close()
        db2.close()


def test_two_concurrent_requests_at_limit_only_one_succeeds(http_client):
    user = _create_authenticated_user()
    orm_user, _ = _set_subscription_state(str(user["email"]), status="active")
    _seed_org_quota(orm_user.org_id, limit=2, count=1)

    async def attempt() -> tuple[str, int | None]:
        def runner() -> tuple[str, int | None]:
            db = SessionLocal()
            try:
                result = asyncio.run(require_ocr_quota(user=orm_user, db=db))
                return ("ok", int(result["request_count"]))
            except HTTPException as error:
                return ("error", error.status_code)
            finally:
                db.close()

        return await asyncio.to_thread(runner)

    async def run_attempts() -> tuple[tuple[str, int | None], tuple[str, int | None]]:
        return await asyncio.gather(attempt(), attempt())

    first, second = asyncio.run(run_attempts())
    statuses = sorted([first[0], second[0]])
    assert statuses == ["error", "ok"]
    assert _load_request_count(orm_user.org_id) == 2


def test_past_due_blocks_upload_allows_read(http_client):
    user = _create_authenticated_user()
    orm_user, _ = _set_subscription_state(str(user["email"]), status="past_due")
    _seed_org_quota(orm_user.org_id, limit=5, count=0)
    headers = _headers(str(user["access_token"]))

    upload = http_client.post(
        "/ocr/table-excel",
        headers=headers,
        files={"file": ("tiny.png", b"not-a-real-image", "image/png")},
    )
    assert upload.status_code == 402
    assert upload.json()["detail"]["code"] == "PAST_DUE"

    read = http_client.get("/ocr/jobs/missing-job", headers=headers)
    assert read.status_code == 404


def test_suspended_blocks_all_routes(http_client):
    user = _create_authenticated_user()
    orm_user, _ = _set_subscription_state(str(user["email"]), status="suspended")
    _seed_org_quota(orm_user.org_id, limit=5, count=0)
    headers = _headers(str(user["access_token"]))

    upload = http_client.post(
        "/ocr/table-excel",
        headers=headers,
        files={"file": ("tiny.png", b"not-a-real-image", "image/png")},
    )
    read = http_client.get("/ocr/jobs/missing-job", headers=headers)

    assert upload.status_code == 403
    assert read.status_code == 403


def test_rate_limit_5_per_minute_on_order_creation(http_client):
    _fallback_hits.clear()
    user = _create_authenticated_user()
    headers = _headers(str(user["access_token"]))
    payload = {"plan": "operator", "billing_cycle": "monthly", "currency": "INR"}

    responses = [
        http_client.post("/billing/orders", headers=headers, json=payload)
        for _ in range(6)
    ]

    assert all(response.status_code != 429 for response in responses[:5])
    assert responses[5].status_code == 429


def test_quota_reset_sets_count_to_zero(http_client):
    user = _create_authenticated_user()
    orm_user, _ = _set_subscription_state(str(user["email"]), status="active")
    _seed_org_quota(orm_user.org_id, limit=12, count=9)

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        _reset_org_ocr_quota_period(
            db,
            org_id=orm_user.org_id,
            ocr_limit=12,
            period_start=now,
            period_end=now + timedelta(days=30),
        )
        db.commit()
    finally:
        db.close()

    assert _load_request_count(orm_user.org_id) == 0
