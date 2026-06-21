"""Tests for workforce intelligence endpoints — overview, workers, trends, costs."""

from __future__ import annotations

from datetime import date, datetime, timezone
from http import HTTPStatus

import httpx
import pytest

from backend.database import SessionLocal, init_db
from backend.models.attendance_record import AttendanceRecord
from backend.models.attendance_event import AttendanceEvent
from backend.models.factory import Factory
from backend.models.user import User
from backend.models.workforce_cost_rate import WorkforceCostRate

from tests.utils import register_user


# ── Helpers ───────────────────────────────────────────────────────────────────


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _promote_factory_to_steel(email: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        factory = (
            db.query(Factory)
            .filter(Factory.org_id == user.org_id, Factory.name == user.factory_name)
            .first()
        )
        assert factory is not None
        factory.industry_type = "steel"
        factory.workflow_template_key = "steel-core-pack"
        db.add(factory)
        db.commit()
    finally:
        db.close()


def _set_user_role(email: str, role: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        user.role = role
        db.add(user)
        db.commit()
    finally:
        db.close()


def _create_steel_user(
    http_client: httpx.Client,
    *,
    role: str = "owner",
    factory_context: dict | None = None,
) -> dict:
    if factory_context:
        user = register_user(
            http_client,
            role=role,
            factory_name=factory_context["factory_name"],
            company_code=factory_context["company_code"],
        )
    else:
        user = register_user(http_client, role=role)
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], role)
    return user


def _seed_attendance_data(org_id: str, factory_id: str, user_id: int) -> None:
    """Seed attendance records via direct DB for a specific factory and user."""
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(AttendanceRecord).filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.user_id == user_id,
        ).first()
        if existing:
            return

        today = date.today()
        from datetime import timedelta as _td
        for days_ago in range(1, 6):
            d = today - _td(days=days_ago)
            worked = 480 - days_ago * 15
            overtime = days_ago * 10 if days_ago <= 3 else 0
            late = days_ago * 5
            record = AttendanceRecord(
                org_id=org_id,
                factory_id=factory_id,
                user_id=user_id,
                attendance_date=d,
                shift="morning" if days_ago % 3 == 0 else ("evening" if days_ago % 3 == 1 else "night"),
                status="completed",
                source="test",
                punch_in_at=datetime(d.year, d.month, d.day, 8, 0, tzinfo=timezone.utc),
                punch_out_at=datetime(d.year, d.month, d.day, 16, 0, tzinfo=timezone.utc),
                worked_minutes=worked,
                overtime_minutes=overtime,
                late_minutes=late,
            )
            db.add(record)
            db.flush()
            db.add(
                AttendanceEvent(
                    org_id=org_id,
                    factory_id=factory_id,
                    user_id=user_id,
                    attendance_record_id=record.id,
                    attendance_date=d,
                    shift=record.shift,
                    event_type="in",
                    event_time=datetime(d.year, d.month, d.day, 8, 0, tzinfo=timezone.utc),
                    source="test",
                )
            )
        db.commit()
    except Exception as exc:
        print(f"Seed error: {exc}")
        db.rollback()
    finally:
        db.close()


def _seed_cost_rate(org_id: str, factory_id: str) -> None:
    """Seed a default factory-level cost rate. Idempotent."""
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(WorkforceCostRate).filter(
            WorkforceCostRate.factory_id == factory_id
        ).first()
        if existing:
            return
        rate = WorkforceCostRate(
            org_id=org_id,
            factory_id=factory_id,
            effective_from=date.today().replace(day=1),
            regular_hourly_rate_inr=200.0,
            overtime_multiplier=1.5,
            notes="Test default rate",
        )
        db.add(rate)
        db.commit()
    except Exception as exc:
        print(f"Seed cost error: {exc}")
        db.rollback()
    finally:
        db.close()


# ── Test Class ──────────────────────────────────────────────────────────────


class TestWorkforceIntelligence:
    """Test suite for workforce intelligence endpoints."""

    @pytest.fixture
    def owner(self, http_client: httpx.Client) -> dict:
        return _create_steel_user(http_client, role="owner")

    @pytest.fixture
    def operator(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(http_client, role="operator", factory_context=owner)

    def _seed(self, owner: dict) -> None:
        init_db()
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == owner["email"]).first()
            factory = db.query(Factory).filter(Factory.org_id == user.org_id).first() if user else None
            if user and factory:
                _seed_attendance_data(factory.org_id, factory.factory_id, user.id)
                _seed_cost_rate(factory.org_id, factory.factory_id)
        finally:
            db.close()

    # ── Overview ─────────────────────────────────────────────────────────

    def test_overview_returns_kpis(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/overview?days=30",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert "as_of" in data
        assert "today" in data
        assert "period" in data
        assert "shift_comparison" in data

    def test_overview_blocks_operator(self, http_client: httpx.Client, owner: dict, operator: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(operator["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/overview?days=30",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN

    # ── Workers ─────────────────────────────────────────────────────────

    def test_workers_returns_ranked_list(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/workers?days=30&sort_by=worked_minutes&limit=50",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert "workers" in data
        assert len(data["workers"]) >= 1
        worker = data["workers"][0]
        assert "name" in worker
        assert "total_worked_minutes" in worker
        assert "estimated_productivity_score" in worker

    def test_workers_shows_cost_for_owner(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/workers?days=30",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert data["financial_access"] is True
        if data["workers"]:
            assert "total_cost_inr" in data["workers"][0]

    # ── Worker Trend ────────────────────────────────────────────────────

    def test_worker_trend_returns_daily(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        init_db()
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == owner["email"]).first()
            assert user is not None
            user_id = user.id
        finally:
            db.close()

        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            f"/intelligence/workforce/workers/{user_id}/trend?days=30",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert "daily" in data
        assert "summary" in data
        assert data["name"] == "QA User"

    def test_worker_trend_empty_for_unknown_user(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/workers/999999/trend?days=30",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK
        data = resp.json()
        assert data["daily"] == []

    # ── Cost Summary ────────────────────────────────────────────────────

    def test_cost_summary_returns_financial_data(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/costs/summary?days=30",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert data["financial_access"] is True
        assert "total_cost_inr" in data
        assert "regular_cost_inr" in data

    def test_cost_summary_requires_cost_permission(self, http_client: httpx.Client, owner: dict, operator: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(operator["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/costs/summary?days=30",
            headers=headers,
        )
        # Operator doesn't have workforce.cost.view
        assert resp.status_code in (HTTPStatus.FORBIDDEN, HTTPStatus.BAD_REQUEST), f"Body: {resp.text[:500]}"

    # ── Shift Comparison ────────────────────────────────────────────────

    def test_shift_comparison_works(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/shifts/comparison?days=30",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert "shifts" in data

    # ── Cost Rates CRUD ─────────────────────────────────────────────────

    def test_list_cost_rates(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.get(
            "/intelligence/workforce/costs/rates",
            headers=headers,
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert "items" in data

    def test_create_cost_rate(self, http_client: httpx.Client, owner: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(owner["access_token"])
        resp = http_client.post(
            "/intelligence/workforce/costs/rates",
            headers=headers,
            json={
                "effective_from": str(date.today()),
                "regular_hourly_rate_inr": 300.0,
                "overtime_multiplier": 2.0,
                "department": "Production",
                "notes": "Test rate",
            },
        )
        assert resp.status_code == HTTPStatus.OK, f"Body: {resp.text[:500]}"
        data = resp.json()
        assert "rate" in data
        assert data["rate"]["regular_hourly_rate_inr"] == 300.0

    def test_create_cost_rate_requires_admin(self, http_client: httpx.Client, owner: dict, operator: dict) -> None:
        self._seed(owner)
        headers = _auth_headers(operator["access_token"])
        resp = http_client.post(
            "/intelligence/workforce/costs/rates",
            headers=headers,
            json={
                "effective_from": str(date.today()),
                "regular_hourly_rate_inr": 250.0,
            },
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN
