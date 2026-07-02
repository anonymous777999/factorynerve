"""Regression tests for Phase P0 permission checks.

Tests that every P0-fixed endpoint correctly enforces PDP require_permission():
1. Returns 403 FORBIDDEN for a UserRole.ATTENDANCE user (who lacks any permission)
2. Returns a non-403 response for a UserRole.OWNER user (who has all permissions)

The role check is now enforced by the PDP (Policy Decision Point) system rather
than inline require_any_role() / require_role() calls.
"""

from __future__ import annotations

from http import HTTPStatus

import httpx
import pytest

from tests.utils import register_user


# ── Steel factory setup ──────────────────────────────────────────────────────

def _setup_steel_factory(user_email: str, factory_name: str) -> None:
    """Update the user's factory to have industry_type='steel' and ensure a
    UserFactoryRole entry exists so the PDP factory-scope check passes."""
    from backend.database import SessionLocal, init_db
    from backend.models.factory import Factory
    from backend.models.user import User
    from backend.models.user_factory_role import UserFactoryRole

    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == user_email).first()
        assert user is not None, f"User {user_email} not found"
        factory = (
            db.query(Factory)
            .filter(Factory.org_id == user.org_id, Factory.name == factory_name)
            .first()
        )
        if factory is None:
            # Fallback: try matching by name containing
            factory = (
                db.query(Factory)
                .filter(Factory.name.like(f"%{factory_name}%"))
                .first()
            )
        if factory:
            factory.industry_type = "steel"
        # Ensure a UserFactoryRole exists for factory-scope PDP check
        existing = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == user.id,
                UserFactoryRole.factory_id == factory.factory_id if factory else None,
            )
            .first()
        ) if factory else None
        if not existing and factory:
            db.add(
                UserFactoryRole(
                    user_id=user.id,
                    org_id=user.org_id,
                    factory_id=factory.factory_id,
                    role=user.role,
                )
            )
        db.commit()
    finally:
        db.close()


# ── Auth header helper ───────────────────────────────────────────────────────

def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ── AI endpoints (8) ─────────────────────────────────────────────────────────

class TestAiEndpoints:
    """PDP permission checks for 8 AI endpoints — key: ai.*."""

    @pytest.fixture
    def attendance_user(self, http_client: httpx.Client) -> dict:
        return register_user(http_client, role="attendance")

    @pytest.fixture
    def owner_user(self, http_client: httpx.Client) -> dict:
        return register_user(http_client, role="owner")

    # ── GET /ai/usage (ai.usage.view) ──────────────────────────────────────────
    def test_ai_usage_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/usage", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_usage_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/ai/usage", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /ai/suggestions?shift=morning (ai.suggestions.view) ────────────────
    def test_ai_suggestions_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/suggestions?shift=morning", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_suggestions_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/ai/suggestions?shift=morning", headers=_auth_headers(owner_user["access_token"]))
        # May get 402 (plan-gated) — but NOT 403
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /ai/anomalies (ai.anomalies.view) ──────────────────────────────────
    def test_ai_anomalies_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/anomalies", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_anomalies_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/ai/anomalies", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /ai/anomalies/preview (ai.anomalies.view) ──────────────────────────
    def test_ai_anomalies_preview_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/anomalies/preview", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_anomalies_preview_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/ai/anomalies/preview", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── POST /ai/query (ai.nlq.query) ──────────────────────────────────────────
    def test_ai_nlq_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/ai/query",
            json={"question": "Show me last 7 days performance"},
            headers=_auth_headers(attendance_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_nlq_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.post(
            "/ai/query",
            json={"question": "Show me last 7 days performance"},
            headers=_auth_headers(owner_user["access_token"]),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /ai/executive-summary (ai.executive.view) ──────────────────────────
    def test_ai_executive_summary_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/executive-summary", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_executive_summary_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/ai/executive-summary", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── POST /ai/executive-summary/jobs (ai.executive.view) ────────────────────
    def test_ai_executive_jobs_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/ai/executive-summary/jobs", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_executive_jobs_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.post("/ai/executive-summary/jobs", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /ai/jobs/{job_id} (ai.executive.view) ──────────────────────────────
    def test_ai_jobs_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/jobs/nonexistent-ai-job", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_jobs_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/ai/jobs/nonexistent-ai-job", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code == HTTPStatus.NOT_FOUND, resp.text


# ── Intelligence endpoints (4) ────────────────────────────────────────────────

class TestIntelligenceEndpoints:
    """PDP permission checks for 4 intelligence endpoints — keys: intelligence.request.*, ai.usage.view."""

    @pytest.fixture
    def attendance_user(self, http_client: httpx.Client) -> dict:
        return register_user(http_client, role="attendance")

    @pytest.fixture
    def owner_user(self, http_client: httpx.Client) -> dict:
        return register_user(http_client, role="owner")

    # ── POST /intelligence/requests (intelligence.request.create) ──────────────
    def test_intel_create_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/intelligence/requests",
            files={"file": ("test.txt", b"test data", "text/plain")},
            headers=_auth_headers(attendance_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_intel_create_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.post(
            "/intelligence/requests",
            files={"file": ("test.txt", b"test data", "text/plain")},
            headers=_auth_headers(owner_user["access_token"]),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /intelligence/requests (intelligence.request.view) ─────────────────
    def test_intel_list_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/intelligence/requests", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_intel_list_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/intelligence/requests", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /intelligence/requests/{request_id} (intelligence.request.view) ────
    def test_intel_detail_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get(
            "/intelligence/requests/nonexistent-intel-id",
            headers=_auth_headers(attendance_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_intel_detail_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get(
            "/intelligence/requests/nonexistent-intel-id",
            headers=_auth_headers(owner_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.NOT_FOUND, resp.text

    # ── GET /intelligence/usage (ai.usage.view) ────────────────────────────────
    def test_intel_usage_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/intelligence/usage", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_intel_usage_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/intelligence/usage", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Reports export-job endpoints (2) ──────────────────────────────────────────

class TestReportsExportEndpoints:
    """PDP permission checks for 2 reports export-job endpoints — key: reporting.export.view."""

    @pytest.fixture
    def attendance_user(self, http_client: httpx.Client) -> dict:
        return register_user(http_client, role="attendance")

    @pytest.fixture
    def owner_user(self, http_client: httpx.Client) -> dict:
        return register_user(http_client, role="owner")

    # ── GET /reports/export-jobs/{job_id} (reporting.export.view) ──────────────
    def test_export_jobs_status_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get(
            "/reports/export-jobs/nonexistent-export-job",
            headers=_auth_headers(attendance_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_export_jobs_status_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get(
            "/reports/export-jobs/nonexistent-export-job",
            headers=_auth_headers(owner_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.NOT_FOUND, resp.text

    # ── GET /reports/export-jobs/{job_id}/download (reporting.export.view) ─────
    def test_export_jobs_download_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get(
            "/reports/export-jobs/nonexistent-export-job/download",
            headers=_auth_headers(attendance_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_export_jobs_download_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get(
            "/reports/export-jobs/nonexistent-export-job/download",
            headers=_auth_headers(owner_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.NOT_FOUND, resp.text


# ── Steel ERP P0 endpoints (6) ───────────────────────────────────────────────

class TestSteelP0Endpoints:
    """PDP permission checks for 6 steel P0 endpoints.

    These endpoints require a steel factory context. The attendance_user fixture
    sets up the user with a steel factory so the PDP factory-scope check runs.
    Without a steel factory, the endpoint would return 400 before the PDP check.
    """

    @pytest.fixture
    def attendance_user(self, http_client: httpx.Client) -> dict:
        user = register_user(http_client, role="attendance")
        _setup_steel_factory(user["email"], user.get("factory_name", ""))
        return user

    @pytest.fixture
    def owner_user(self, http_client: httpx.Client) -> dict:
        user = register_user(http_client, role="owner")
        _setup_steel_factory(user["email"], user.get("factory_name", ""))
        return user

    # ── GET /steel/overview (inventory.ledger.view) ────────────────────────────
    def test_overview_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/overview", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_overview_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/steel/overview", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /steel/batches (production.batch.view) ─────────────────────────────
    def test_batches_list_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/batches", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_batches_list_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/steel/batches", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /steel/batches/{batch_id} (production.batch.view) ──────────────────
    def test_batches_detail_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/batches/999999", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_batches_detail_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/steel/batches/999999", headers=_auth_headers(owner_user["access_token"]))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    # ── GET /steel/invoices/{invoice_id} (invoice.record.view) ─────────────────
    def test_invoices_detail_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/invoices/999999", headers=_auth_headers(attendance_user["access_token"]))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_invoices_detail_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.get("/steel/invoices/999999", headers=_auth_headers(owner_user["access_token"]))
        # With a steel factory but no matching invoice → 404 (not 403)
        assert resp.status_code not in (HTTPStatus.FORBIDDEN,), resp.text

    # ── POST /steel/inventory/reconciliations/{id}/approve (inventory.reconciliation.approve) ──
    def test_reconciliation_approve_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/steel/inventory/reconciliations/999999/approve",
            json={},
            headers=_auth_headers(attendance_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_reconciliation_approve_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.post(
            "/steel/inventory/reconciliations/999999/approve",
            json={},
            headers=_auth_headers(owner_user["access_token"]),
        )
        # PDP check passes; then reject with 404 (not found) since no reconciliation exists
        assert resp.status_code not in (HTTPStatus.FORBIDDEN,), resp.text

    # ── POST /steel/inventory/reconciliations/{id}/reject (inventory.reconciliation.approve) ──
    def test_reconciliation_reject_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/steel/inventory/reconciliations/999999/reject",
            json={"rejection_reason": "Test rejection"},
            headers=_auth_headers(attendance_user["access_token"]),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_reconciliation_reject_owner_allowed(self, http_client: httpx.Client, owner_user: dict) -> None:
        resp = http_client.post(
            "/steel/inventory/reconciliations/999999/reject",
            json={"rejection_reason": "Test rejection"},
            headers=_auth_headers(owner_user["access_token"]),
        )
        # PDP check passes; then reject with 404 (not found)
        assert resp.status_code not in (HTTPStatus.FORBIDDEN,), resp.text
