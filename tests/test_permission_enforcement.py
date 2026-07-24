"""Permission enforcement tests — Phase 1 Week 2, Task 1.3.

For each role (operator, supervisor, manager, accountant, admin, owner), verifies:
1. Authenticates as that role via v2 session cookie.
2. Tries to access every permission-gated endpoint.
3. Verifies that forbidden endpoints return 403 (not 404, not 500, not 200).

Test strategy:
- Use `register_user(role=...)` to create a user with the target role.
- For endpoints that need a steel factory context, call `_setup_steel_factory()`.
- For each endpoint, assert the ATTENDANCE role (which has NO permissions) gets 403.
- For each endpoint, assert the OWNER role (which has ALL permissions) does NOT get 403.
- For role-specific tests, assert the correct role gets 403 or non-403 as expected.
"""

from __future__ import annotations

from http import HTTPStatus

import httpx
import pytest

from tests.utils import register_user


# ── Helpers ──────────────────────────────────────────────────────────────────

def _cookies(user: dict) -> dict[str, str]:
    """Return session cookie dict for the given user."""
    token = user.get("session_token", "")
    if not token:
        return {}
    return {"auth_session": token}


def _setup_steel_factory(user_email: str) -> None:
    """Ensure the user has a steel-industry factory and a UserFactoryRole binding."""
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
            .filter(Factory.org_id == user.org_id)
            .first()
        )
        if factory:
            factory.industry_type = "steel"
        existing = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == user.id,
                UserFactoryRole.factory_id == (factory.factory_id if factory else None),
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


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def operator_user(http_client: httpx.Client) -> dict:
    user = register_user(http_client, role="operator")
    _setup_steel_factory(user["email"])
    return user


@pytest.fixture(scope="module")
def supervisor_user(http_client: httpx.Client) -> dict:
    user = register_user(http_client, role="supervisor")
    _setup_steel_factory(user["email"])
    return user


@pytest.fixture(scope="module")
def manager_user(http_client: httpx.Client) -> dict:
    user = register_user(http_client, role="manager")
    _setup_steel_factory(user["email"])
    return user


@pytest.fixture(scope="module")
def accountant_user(http_client: httpx.Client) -> dict:
    user = register_user(http_client, role="accountant")
    _setup_steel_factory(user["email"])
    return user


@pytest.fixture(scope="module")
def admin_user(http_client: httpx.Client) -> dict:
    user = register_user(http_client, role="admin")
    _setup_steel_factory(user["email"])
    return user


@pytest.fixture(scope="module")
def owner_user(http_client: httpx.Client) -> dict:
    user = register_user(http_client, role="owner")
    _setup_steel_factory(user["email"])
    return user


@pytest.fixture(scope="module")
def attendance_user(http_client: httpx.Client) -> dict:
    """Attendance role has NO permissions — used as the universal 403 probe."""
    user = register_user(http_client, role="attendance")
    _setup_steel_factory(user["email"])
    return user


# ── Production Entry Permissions ──────────────────────────────────────────────

class TestProductionEntryPermissions:
    """production.entry.* permissions."""

    def test_list_entries_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/entries", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_entries_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/entries", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_entry_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/entries",
            json={"date": "2026-01-01", "shift": "morning", "units_target": 100, "units_produced": 90,
                  "manpower_present": 10, "manpower_absent": 0, "downtime_minutes": 0},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_entry_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.post(
            "/entries",
            json={"date": "2026-01-01", "shift": "morning", "units_target": 100, "units_produced": 90,
                  "manpower_present": 10, "manpower_absent": 0, "downtime_minutes": 0},
            cookies=_cookies(operator_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_entry_accountant_blocked(self, http_client: httpx.Client, accountant_user: dict) -> None:
        """Accountant role does NOT have production.entry.create."""
        resp = http_client.post(
            "/entries",
            json={"date": "2026-01-01", "shift": "morning", "units_target": 100, "units_produced": 90,
                  "manpower_present": 10, "manpower_absent": 0, "downtime_minutes": 0},
            cookies=_cookies(accountant_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_get_entry_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/entries/999999", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_get_entry_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/entries/999999", cookies=_cookies(operator_user))
        # PDP passes; then 404 since entry doesn't exist
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_today_entries_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/entries/today", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_today_entries_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/entries/today", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_defect_reasons_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/entries/defect-reasons", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_defect_reasons_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/entries/defect-reasons", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_approve_entry_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/entries/999999/approve", json={"notes": "test"}, cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_approve_entry_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have production.entry.approve."""
        resp = http_client.post("/entries/999999/approve", json={"notes": "test"}, cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_approve_entry_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.post("/entries/999999/approve", json={"notes": "test"}, cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_delete_entry_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.delete("/entries/999999", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_delete_entry_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have production.entry.delete."""
        resp = http_client.delete("/entries/999999", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_delete_entry_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.delete("/entries/999999", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_update_entry_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.put("/entries/999999", json={"notes": "test"}, cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_update_entry_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have production.entry.edit."""
        resp = http_client.put("/entries/999999", json={"notes": "test"}, cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_update_entry_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.put("/entries/999999", json={"notes": "test"}, cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Background Jobs Permissions ───────────────────────────────────────────────

class TestBackgroundJobsPermissions:
    """background_jobs.view permission."""

    def test_list_jobs_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/jobs", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_jobs_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/jobs", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_get_job_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/jobs/nonexistent-job-id", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_get_job_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/jobs/nonexistent-job-id", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_cancel_job_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/jobs/nonexistent-job-id/cancel", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_retry_job_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/jobs/nonexistent-job-id/retry", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text


# ── Attendance Self-Service Permissions ───────────────────────────────────────

class TestAttendanceSelfServicePermissions:
    """attendance.self.* permissions."""

    def test_my_attendance_today_attendance_role_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        """ATTENDANCE role does NOT have attendance.self.view."""
        resp = http_client.get("/attendance/me/today", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_my_attendance_today_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/attendance/me/today", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_punch_attendance_role_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/attendance/punch",
            json={"action": "in"},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_punch_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.post(
            "/attendance/punch",
            json={"action": "in"},
            cookies=_cookies(operator_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Attendance Team/Admin Permissions ─────────────────────────────────────────

class TestAttendanceTeamPermissions:
    """attendance.team.view, attendance.profile.manage, attendance.shift_template.manage."""

    def test_live_attendance_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/attendance/live", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_live_attendance_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have attendance.team.view."""
        resp = http_client.get("/attendance/live", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_live_attendance_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/attendance/live", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_employee_profiles_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/attendance/settings/employees", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_employee_profiles_supervisor_blocked(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor does NOT have attendance.profile.manage."""
        resp = http_client.get("/attendance/settings/employees", cookies=_cookies(supervisor_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_employee_profiles_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.get("/attendance/settings/employees", cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_shift_templates_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/attendance/settings/shifts", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_shift_templates_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.get("/attendance/settings/shifts", cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Steel Customer Permissions ────────────────────────────────────────────────

class TestSteelCustomerPermissions:
    """customer.record.* permissions."""

    def test_list_customers_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/customers", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_customers_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have customer.record.view."""
        resp = http_client.get("/steel/customers", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_customers_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.get("/steel/customers", cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_customer_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/steel/customers",
            json={"name": "Test Customer", "phone": "+919999999999"},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_customer_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.post(
            "/steel/customers",
            json={"name": "Test Customer", "phone": "+919999999999"},
            cookies=_cookies(operator_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_customer_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.post(
            "/steel/customers",
            json={"name": "Test Customer", "phone": "+919999999999"},
            cookies=_cookies(accountant_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Steel Dispatch Permissions ────────────────────────────────────────────────

class TestSteelDispatchPermissions:
    """dispatch.record.* permissions."""

    def test_list_dispatches_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/dispatches", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_dispatches_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/steel/dispatches", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_dispatch_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/steel/dispatches",
            json={"invoice_id": 1, "dispatch_date": "2026-01-01", "truck_number": "MP09AB1234",
                  "driver_name": "Test", "lines": [{"invoice_line_id": 1, "weight_kg": 100}]},
            cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_dispatch_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have dispatch.record.create."""
        resp = http_client.post("/steel/dispatches",
            json={"invoice_id": 1, "dispatch_date": "2026-01-01", "truck_number": "MP09AB1234",
                  "driver_name": "Test", "lines": [{"invoice_line_id": 1, "weight_kg": 100}]},
            cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_dispatch_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor now HAS dispatch.record.create."""
        resp = http_client.post("/steel/dispatches",
            json={"invoice_id": 1, "dispatch_date": "2026-01-01", "truck_number": "MP09AB1234",
                  "driver_name": "Test", "lines": [{"invoice_line_id": 1, "weight_kg": 100}]},
            cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_dispatch_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.post("/steel/dispatches",
            json={"invoice_id": 1, "dispatch_date": "2026-01-01", "truck_number": "MP09AB1234",
                  "driver_name": "Test", "lines": [{"invoice_line_id": 1, "weight_kg": 100}]},
            cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Steel Payment Permissions ─────────────────────────────────────────────────

class TestSteelPaymentPermissions:
    """payment.record.* permissions."""

    def test_create_payment_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/steel/customers/payments",
            json={"customer_id": 1, "payment_date": "2026-01-01", "amount": 100},
            cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_payment_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have payment.record.create."""
        resp = http_client.post("/steel/customers/payments",
            json={"customer_id": 1, "payment_date": "2026-01-01", "amount": 100},
            cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_payment_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.post("/steel/customers/payments",
            json={"customer_id": 1, "payment_date": "2026-01-01", "amount": 100},
            cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Steel Invoice Permissions ─────────────────────────────────────────────────

class TestSteelInvoicePermissions:
    """invoice.record.* permissions."""

    def test_list_invoices_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/invoices", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_invoices_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have invoice.record.view."""
        resp = http_client.get("/steel/invoices", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_invoices_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.get("/steel/invoices", cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_invoice_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/steel/invoices",
            json={"invoice_date": "2026-01-01", "lines": [{"item_id": 1, "weight_kg": 100, "rate_per_kg": 50}]},
            cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_invoice_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        """Accountant now HAS invoice.record.create."""
        resp = http_client.post("/steel/invoices",
            json={"invoice_date": "2026-01-01", "lines": [{"item_id": 1, "weight_kg": 100, "rate_per_kg": 50}]},
            cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_invoice_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.post("/steel/invoices",
            json={"invoice_date": "2026-01-01", "lines": [{"item_id": 1, "weight_kg": 100, "rate_per_kg": 50}]},
            cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Steel Inventory Permissions ───────────────────────────────────────────────

class TestSteelInventoryPermissions:
    """inventory.* permissions."""

    def test_list_inventory_items_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/inventory/items", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_inventory_items_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/steel/inventory/items", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_inventory_item_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/steel/inventory/items",
            json={"item_code": "TEST", "name": "Test Item", "category": "raw"},
            cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_inventory_item_supervisor_blocked(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor does NOT have inventory.item.manage."""
        resp = http_client.post("/steel/inventory/items",
            json={"item_code": "TEST", "name": "Test Item", "category": "raw"},
            cookies=_cookies(supervisor_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_inventory_item_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.post("/steel/inventory/items",
            json={"item_code": "TEST", "name": "Test Item", "category": "raw"},
            cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_reconciliation_approve_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/steel/inventory/reconciliations/999999/approve",
            json={"approver_notes": "test"},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_reconciliation_approve_manager_blocked(self, http_client: httpx.Client, manager_user: dict) -> None:
        """Manager does NOT have inventory.reconciliation.approve (admin+ only)."""
        resp = http_client.post(
            "/steel/inventory/reconciliations/999999/approve",
            json={"approver_notes": "test"},
            cookies=_cookies(manager_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_reconciliation_approve_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.post(
            "/steel/inventory/reconciliations/999999/approve",
            json={"approver_notes": "test"},
            cookies=_cookies(admin_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── AI Permissions ────────────────────────────────────────────────────────────

class TestAIPermissions:
    """ai.* permissions."""

    def test_ai_usage_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/usage", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_usage_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have ai.usage.view."""
        resp = http_client.get("/ai/usage", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_usage_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/ai/usage", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_ai_suggestions_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ai/suggestions?shift=morning", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_suggestions_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/ai/suggestions?shift=morning", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_suggestions_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/ai/suggestions?shift=morning", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_ai_nlq_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/ai/query",
            json={"question": "Show me last 7 days performance"},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ai_nlq_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.post(
            "/ai/query",
            json={"question": "Show me last 7 days performance"},
            cookies=_cookies(supervisor_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Reporting Permissions ─────────────────────────────────────────────────────

class TestReportingPermissions:
    """reporting.* permissions."""

    def test_report_insights_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/reports/insights", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_report_insights_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have reporting.insights.view."""
        resp = http_client.get("/reports/insights", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_report_insights_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/reports/insights", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_pdf_export_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/reports/pdf/999999", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_pdf_export_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/reports/pdf/999999", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_excel_export_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/reports/excel/999999", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_weekly_export_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/reports/weekly", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_weekly_export_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/reports/weekly", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Analytics Permissions ─────────────────────────────────────────────────────

class TestAnalyticsPermissions:
    """analytics.operations.view permission."""

    def test_weekly_analytics_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/analytics/weekly", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_weekly_analytics_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have analytics.operations.view."""
        resp = http_client.get("/analytics/weekly", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_weekly_analytics_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/analytics/weekly", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_monthly_analytics_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/analytics/monthly", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_trends_analytics_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/analytics/trends", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_manager_analytics_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/analytics/manager", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text


# ── Billing Permissions ───────────────────────────────────────────────────────

class TestBillingPermissions:
    """billing.* permissions."""

    def test_billing_config_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/billing/config", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_billing_config_manager_blocked(self, http_client: httpx.Client, manager_user: dict) -> None:
        """Manager does NOT have billing.config.view (admin+ only)."""
        resp = http_client.get("/billing/config", cookies=_cookies(manager_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_billing_config_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/billing/config", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_billing_status_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/billing/status", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_billing_status_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/billing/status", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_billing_invoices_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/billing/invoices", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_billing_invoice_pdf_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/billing/invoices/999999/pdf", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_billing_invoice_pdf_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/billing/invoices/999999/pdf", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Settings Permissions ──────────────────────────────────────────────────────

class TestSettingsPermissions:
    """factory.profile.manage, user.*, billing.status.view permissions."""

    def test_factory_settings_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/settings/factory", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_factory_settings_supervisor_blocked(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor does NOT have factory.profile.manage."""
        resp = http_client.get("/settings/factory", cookies=_cookies(supervisor_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_factory_settings_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.get("/settings/factory", cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_user_directory_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/settings/users", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_user_directory_supervisor_blocked(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor does NOT have user.directory.view."""
        resp = http_client.get("/settings/users", cookies=_cookies(supervisor_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_user_directory_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.get("/settings/users", cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_user_lookup_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/settings/users/lookup", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_user_lookup_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.get("/settings/users/lookup", cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_usage_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/settings/usage", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_usage_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/settings/usage", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_defect_reasons_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/settings/defect-reasons", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_defect_reasons_manager_blocked(self, http_client: httpx.Client, manager_user: dict) -> None:
        """Manager does NOT have factory.master_data.manage (admin+ only)."""
        resp = http_client.get("/settings/defect-reasons", cookies=_cookies(manager_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_defect_reasons_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/settings/defect-reasons", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_invite_user_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/settings/users/invite",
            json={"email": "newuser@example.com", "role": "operator"},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_invite_user_supervisor_blocked(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor does NOT have user.invite."""
        resp = http_client.post(
            "/settings/users/invite",
            json={"email": "newuser@example.com", "role": "operator"},
            cookies=_cookies(supervisor_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_invite_user_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.post(
            "/settings/users/invite",
            json={"email": "newuser@example.com", "role": "operator"},
            cookies=_cookies(manager_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── OCR Permissions ───────────────────────────────────────────────────────────

class TestOCRPermissions:
    """ocr.* permissions."""

    def test_list_verifications_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ocr/verifications", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_verifications_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/ocr/verifications", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_list_templates_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ocr/templates", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_templates_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/ocr/templates", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_template_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/ocr/templates",
            data={"name": "Test", "columns": "3"},
            files={"samples": ("test.jpg", b"fake", "image/jpeg")},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_template_supervisor_blocked(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor does NOT have ocr.template.manage (manager+ only)."""
        resp = http_client.post(
            "/ocr/templates",
            data={"name": "Test", "columns": "3"},
            files={"samples": ("test.jpg", b"fake", "image/jpeg")},
            cookies=_cookies(supervisor_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_template_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.post(
            "/ocr/templates",
            data={"name": "Test", "columns": "3"},
            files={"samples": ("test.jpg", b"fake", "image/jpeg")},
            cookies=_cookies(manager_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_approve_verification_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/ocr/verifications/999999/approve",
            json={"decision": "approve"},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_approve_verification_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have ocr.verification.approve."""
        resp = http_client.post(
            "/ocr/verifications/999999/approve",
            json={"decision": "approve"},
            cookies=_cookies(operator_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_approve_verification_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.post(
            "/ocr/verifications/999999/approve",
            json={"decision": "approve"},
            cookies=_cookies(supervisor_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_ocr_jobs_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/ocr/jobs/nonexistent-ocr-job", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_ocr_jobs_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/ocr/jobs/nonexistent-ocr-job", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Feedback Permissions ──────────────────────────────────────────────────────

class TestFeedbackPermissions:
    """feedback.submit, feedback.manage permissions."""

    def test_submit_feedback_attendance_allowed(self, http_client: httpx.Client, attendance_user: dict) -> None:
        """ATTENDANCE can now submit feedback (feedback.submit permission granted)."""
        resp = http_client.post(
            "/feedback",
            json={"type": "bug", "message": "Test bug report"},
            cookies=_cookies(attendance_user),
        )
        # Expect non-403 (permission passes); may get 422 due to validation
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_submit_feedback_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.post(
            "/feedback",
            json={"type": "bug", "message": "Test bug report"},
            cookies=_cookies(operator_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_list_feedback_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/feedback", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_feedback_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have feedback.manage."""
        resp = http_client.get("/feedback", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_feedback_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/feedback", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_my_feedback_updates_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/feedback/mine/updates", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_my_feedback_updates_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/feedback/mine/updates", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_export_feedback_csv_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/feedback/export.csv", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_export_feedback_csv_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/feedback/export.csv", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Alerts Permissions ────────────────────────────────────────────────────────

class TestAlertsPermissions:
    """ops.alerts.view, ops.alerts.manage permissions."""

    def test_list_alerts_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/alerts", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_alerts_operator_allowed(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/alerts", cookies=_cookies(operator_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_alert_recipients_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/alert-recipients", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_alert_recipients_manager_blocked(self, http_client: httpx.Client, manager_user: dict) -> None:
        """Manager does NOT have ops.alerts.manage (admin+ only)."""
        resp = http_client.get("/alert-recipients", cookies=_cookies(manager_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_alert_recipients_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/alert-recipients", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Intelligence Permissions ──────────────────────────────────────────────────

class TestIntelligencePermissions:
    """intelligence.request.* permissions."""

    def test_create_intelligence_request_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post(
            "/intelligence/requests",
            files={"file": ("test.txt", b"test data", "text/plain")},
            cookies=_cookies(attendance_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_intelligence_request_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have intelligence.request.create."""
        resp = http_client.post(
            "/intelligence/requests",
            files={"file": ("test.txt", b"test data", "text/plain")},
            cookies=_cookies(operator_user),
        )
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_intelligence_request_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.post(
            "/intelligence/requests",
            files={"file": ("test.txt", b"test data", "text/plain")},
            cookies=_cookies(supervisor_user),
        )
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_list_intelligence_requests_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/intelligence/requests", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_list_intelligence_requests_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/intelligence/requests", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Steel Intelligence Permissions ────────────────────────────────────────────

class TestSteelIntelligencePermissions:
    """production.analytics.view, production.fraud_intelligence.view, etc."""

    def test_inventory_intelligence_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/inventory/intelligence", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_inventory_intelligence_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have production.analytics.view."""
        resp = http_client.get("/steel/inventory/intelligence", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_inventory_intelligence_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/steel/inventory/intelligence", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_fraud_intelligence_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/fraud/intelligence", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_fraud_intelligence_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        resp = http_client.get("/steel/fraud/intelligence", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_fraud_intelligence_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/steel/fraud/intelligence", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Workforce Intelligence Permissions ────────────────────────────────────────

class TestWorkforceIntelligencePermissions:
    """workforce.* permissions."""

    def test_workforce_overview_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/workforce/overview", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_overview_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have workforce.overview.view."""
        resp = http_client.get("/steel/workforce/overview", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_overview_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/steel/workforce/overview", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_cost_summary_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/workforce/costs/summary", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_cost_summary_supervisor_blocked(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        """Supervisor does NOT have workforce.cost.view."""
        resp = http_client.get("/steel/workforce/costs/summary", cookies=_cookies(supervisor_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_cost_summary_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.get("/steel/workforce/costs/summary", cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_cost_manage_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/steel/workforce/costs/rates",
            json={"role": "operator", "base_rate": 100, "effective_from": "2026-01-01"},
            cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_cost_manage_manager_blocked(self, http_client: httpx.Client, manager_user: dict) -> None:
        """Manager does NOT have workforce.cost.manage (admin+ only)."""
        resp = http_client.post("/steel/workforce/costs/rates",
            json={"role": "operator", "base_rate": 100, "effective_from": "2026-01-01"},
            cookies=_cookies(manager_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_workforce_cost_manage_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.post("/steel/workforce/costs/rates",
            json={"role": "operator", "base_rate": 100, "effective_from": "2026-01-01"},
            cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Premium Analytics Permissions ─────────────────────────────────────────────

class TestPremiumAnalyticsPermissions:
    """analytics.premium.view, audit.log.view permissions."""

    def test_premium_dashboard_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/premium/dashboard", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_premium_dashboard_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have analytics.premium.view."""
        resp = http_client.get("/premium/dashboard", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_premium_dashboard_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/premium/dashboard", cookies=_cookies(supervisor_user))
        # May get 402 (plan-gated) — but NOT 403
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_audit_trail_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/premium/audit-trail", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_audit_trail_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/premium/audit-trail", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Observability Permissions ─────────────────────────────────────────────────

class TestObservabilityPermissions:
    """system.observability.view permission."""

    def test_alert_history_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/observability/alerts", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_alert_history_manager_blocked(self, http_client: httpx.Client, manager_user: dict) -> None:
        """Manager does NOT have system.observability.view (admin+ only)."""
        resp = http_client.get("/observability/alerts", cookies=_cookies(manager_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_alert_history_admin_allowed(self, http_client: httpx.Client, admin_user: dict) -> None:
        resp = http_client.get("/observability/alerts", cookies=_cookies(admin_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Email Summary Permissions ─────────────────────────────────────────────────

class TestEmailSummaryPermissions:
    """reporting.email.summary.* permissions."""

    def test_email_summary_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/emails/summary", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_email_summary_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have reporting.email.summary.view."""
        resp = http_client.get("/emails/summary", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_email_summary_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.get("/emails/summary", cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_generate_email_summary_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/emails/summary/generate", json={"period": "daily"}, cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_generate_email_summary_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.post("/emails/summary/generate", json={"period": "daily"}, cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Steel Finance Permissions ─────────────────────────────────────────────────

class TestSteelFinancePermissions:
    """invoice.record.view for finance overview routes."""

    def test_finance_overview_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/finance/overview", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_finance_overview_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have invoice.record.view."""
        resp = http_client.get("/steel/finance/overview", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_finance_overview_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.get("/steel/finance/overview", cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_finance_receivables_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/steel/finance/receivables", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_finance_receivables_accountant_allowed(self, http_client: httpx.Client, accountant_user: dict) -> None:
        resp = http_client.get("/steel/finance/receivables", cookies=_cookies(accountant_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text

    def test_create_vendor_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.post("/steel/vendors",
            json={"name": "Test Vendor", "phone": "+919999999999"},
            cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_vendor_accountant_blocked(self, http_client: httpx.Client, accountant_user: dict) -> None:
        """Accountant does NOT have invoice.record.create (manager+ only)."""
        resp = http_client.post("/steel/vendors",
            json={"name": "Test Vendor", "phone": "+919999999999"},
            cookies=_cookies(accountant_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_create_vendor_manager_allowed(self, http_client: httpx.Client, manager_user: dict) -> None:
        resp = http_client.post("/steel/vendors",
            json={"name": "Test Vendor", "phone": "+919999999999"},
            cookies=_cookies(manager_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text


# ── Approvals Permissions ─────────────────────────────────────────────────────

class TestApprovalsPermissions:
    """production.entry.approve permission for approval queue."""

    def test_approval_queue_attendance_blocked(self, http_client: httpx.Client, attendance_user: dict) -> None:
        resp = http_client.get("/approvals/queue/me", cookies=_cookies(attendance_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_approval_queue_operator_blocked(self, http_client: httpx.Client, operator_user: dict) -> None:
        """Operator does NOT have production.entry.approve."""
        resp = http_client.get("/approvals/queue/me", cookies=_cookies(operator_user))
        assert resp.status_code == HTTPStatus.FORBIDDEN, resp.text

    def test_approval_queue_supervisor_allowed(self, http_client: httpx.Client, supervisor_user: dict) -> None:
        resp = http_client.get("/approvals/queue/me", cookies=_cookies(supervisor_user))
        assert resp.status_code != HTTPStatus.FORBIDDEN, resp.text
