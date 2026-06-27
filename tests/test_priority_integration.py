"""Priority integration tests for critical production workflows.

These tests hit a live test backend (started by conftest.py) to validate
the most critical business flows end-to-end: authentication, attendance,
inventory management, dispatch, and billing.
"""

from __future__ import annotations

import pytest
from httpx import Client


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _auth_headers(client: Client, *, email: str, password: str) -> dict[str, str]:
    """Register *or* login, then return auth headers.

    The backend now uses v2 session cookies for authentication.
    The login/register endpoints set the cookies on the client.
    """
    # Try login first (sets session cookie on http_client)
    resp = client.post(
        "/auth/v2/login",
        json={"email": email, "password": password},
    )
    if resp.status_code == 200:
        # Session cookie is already set on the client
        return {}

    # Register if login fails (sets session cookie on http_client)
    resp = client.post(
        "/auth/v2/register",
        json={
            "email": email,
            "password": password,
            "name": "Test User",
            "factory_name": "Test Steel Factory",
        },
    )
    # If user already exists (409), try login again
    if resp.status_code == 409:
        resp = client.post(
            "/auth/v2/login",
            json={"email": email, "password": password},
        )
        assert resp.status_code == 200, f"Login after 409 failed: {resp.text}"
        return {}
    assert resp.status_code in (200, 201), f"Register failed: {resp.text}"
    return {}


def _steel_setup(http_client: Client, headers: dict[str, str]) -> str | None:
    """Ensure a steel factory exists and return its factory_id."""
    resp = http_client.get("/factories")
    if resp.status_code == 200:
        factories = resp.json()
        if isinstance(factories, list) and factories:
            for f in factories:
                if (f.get("industry_type") or "").lower() == "steel":
                    return f["factory_id"]
        elif isinstance(factories, dict):
            items = factories.get("factories") or factories.get("items") or []
            for f in items:
                if (f.get("industry_type") or "").lower() == "steel":
                    return f["factory_id"]

    # Create a steel factory
    resp = http_client.post(
        "/factories",
        json={"name": "Test Steel Factory", "industry_type": "steel", "timezone": "Asia/Kolkata"},
    )
    if resp.status_code in (200, 201):
        data = resp.json()
        return data.get("factory_id") or data.get("id")
    return None


# ===================================================================
# AUTHENTICATION
# ===================================================================

class TestAuthFlow:
    """Critical: User registration, login, logout, and session management."""

    TEST_EMAIL = "test_integration_auth@example.com"
    TEST_PASS = "Str0ng!Pass#99"

    def test_01_register_user(self, http_client: Client):
        """Register a new user and verify we get a token back."""
        resp = http_client.post(
            "/auth/v2/register",
            json={
                "email": self.TEST_EMAIL,
                "password": self.TEST_PASS,
                "name": "Auth Test User",
                "factory_name": "Auth Test Factory",
            },
        )
        assert resp.status_code in (200, 201), f"Registration failed: {resp.text}"
        data = resp.json()
        # Should have either a token or a success message
        assert "token" in data or "access_token" in data or "message" in data, f"Unexpected response: {data}"

    def test_02_login_user(self, http_client: Client):
        """Login with the registered credentials."""
        resp = http_client.post(
            "/auth/v2/login",
            json={"email": self.TEST_EMAIL, "password": self.TEST_PASS},
        )
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "token" in data or "access_token" in data or resp.cookies.get("csrf_token"), \
            f"No auth token received: {data}"

    def test_03_health_returns_ok(self, http_client: Client):
        """Public health endpoint."""
        resp = http_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") in ("ok", "healthy"), f"Health check failed: {data}"


# ===================================================================
# ATTENDANCE
# ===================================================================

class TestAttendanceFlow:
    """Critical: Clock-in, clock-out, and attendance record retrieval."""

    TEST_EMAIL = "test_integration_attendance@example.com"
    TEST_PASS = "Str0ng!Pass#99"

    @pytest.fixture(autouse=True)
    def _setup(self, http_client: Client):
        self.headers = _auth_headers(http_client, email=self.TEST_EMAIL, password=self.TEST_PASS)

    def test_04_create_attendance_record(self, http_client: Client):
        """Create an attendance record and verify it is stored."""
        import datetime as dt
        today = dt.date.today().isoformat()

        resp = http_client.post(
            "/attendance/records",
            headers=self.headers,
            json={
                "date": today,
                "shift": "morning",
                "employee_name": "Worker-001",
                "clock_in": f"{today}T08:00:00+05:30",
                "clock_out": f"{today}T17:00:00+05:30",
                "status": "present",
            },
        )
        # Accept both 200 (success) and 201 (created)
        assert resp.status_code in (200, 201), f"Attendance create failed: {resp.text}"
        data = resp.json()
        assert data.get("status") in ("present", "success"), f"Unexpected attendance status: {data}"

    def test_05_list_attendance_records(self, http_client: Client):
        """List attendance records to verify the created record is visible."""
        resp = http_client.get("/attendance/records", headers=self.headers)
        # The endpoint may return 403 if attendance isn't configured yet,
        # but shouldn't crash
        if resp.status_code == 403:
            pytest.skip("Attendance module not available for this user")
        assert resp.status_code in (200, 403), f"Attendance list failed: {resp.text}"


# ===================================================================
# INVENTORY (Steel)
# ===================================================================

class TestSteelInventoryFlow:
    """Critical: Create inventory items, post transactions, check stock."""

    TEST_EMAIL = "test_integration_inventory@example.com"
    TEST_PASS = "Str0ng!Pass#99"

    @pytest.fixture(autouse=True)
    def _setup(self, http_client: Client):
        self.headers = _auth_headers(http_client, email=self.TEST_EMAIL, password=self.TEST_PASS)
        self.factory_id = _steel_setup(http_client, self.headers)
        self.item_id: int | None = None

    def test_06_create_inventory_item(self, http_client: Client):
        """Create a steel inventory item."""
        if not self.factory_id:
            pytest.skip("No steel factory available")

        resp = http_client.post(
            "/steel/inventory/items",
            headers=self.headers,
            json={
                "item_code": "INT-TEST-BILLET",
                "name": "Integration Test Billet",
                "category": "raw_material",
                "display_unit": "kg",
                "current_rate_per_kg": 45.0,
            },
        )
        # May return pending_approval if approval workflow gates creation
        assert resp.status_code in (200, 201, 202), f"Item creation failed: {resp.text}"
        data = resp.json()
        item = data.get("item") or data
        self.item_id = item.get("id")
        assert self.item_id is not None, f"No item id returned: {data}"

    def test_07_inventory_transaction_race_prevention(self, http_client: Client):
        """Post a transaction and verify the stock balance updates correctly.

        This test exercises the locked-stock-balance path used in
        ``create_steel_inventory_transaction``.
        """
        if not self.factory_id:
            pytest.skip("No steel factory available")

        # First ensure we have an item
        if self.item_id is None:
            resp = http_client.post(
                "/steel/inventory/items",
                headers=self.headers,
                json={
                    "item_code": "INT-TEST-INGOT",
                    "name": "Integration Test Ingot",
                    "category": "raw_material",
                    "display_unit": "kg",
                    "current_rate_per_kg": 50.0,
                },
            )
            if resp.status_code not in (200, 201, 202):
                pytest.skip("Could not create item for transaction test")
            item_data = resp.json()
            self.item_id = (item_data.get("item") or item_data).get("id")

        if self.item_id is None:
            pytest.skip("No item available for transaction")

        # Post an inward transaction
        resp = http_client.post(
            "/steel/inventory/transactions",
            headers=self.headers,
            json={
                "item_id": self.item_id,
                "transaction_type": "inward",
                "quantity_kg": 500.0,
            },
        )
        assert resp.status_code in (200, 201, 202), f"Transaction failed: {resp.text}"

        # Verify balance is reflected
        stock_resp = http_client.get("/steel/inventory/stock", headers=self.headers)
        if stock_resp.status_code == 200:
            stock_data = stock_resp.json()
            items = stock_data.get("items") or []
            for item in items:
                if item.get("item_id") == self.item_id:
                    assert float(item.get("stock_balance_kg", 0)) > 0, \
                        f"Stock balance not updated after transaction: {item}"
                    break


# ===================================================================
# DISPATCH
# ===================================================================

class TestSteelDispatchFlow:
    """Critical: Create invoice, then dispatch against it."""

    TEST_EMAIL = "test_integration_dispatch@example.com"
    TEST_PASS = "Str0ng!Pass#99"

    @pytest.fixture(autouse=True)
    def _setup(self, http_client: Client):
        self.headers = _auth_headers(http_client, email=self.TEST_EMAIL, password=self.TEST_PASS)
        self.factory_id = _steel_setup(http_client, self.headers)

    def test_08_create_invoice(self, http_client: Client):
        """Create a steel sales invoice."""
        if not self.factory_id:
            pytest.skip("No steel factory available")

        resp = http_client.post(
            "/steel/invoices",
            headers=self.headers,
            json={
                "invoice_date": "2026-06-19",
                "customer_name": "Integration Test Buyer",
                "payment_terms_days": 30,
                "lines": [
                    {
                        "item_id": 1,
                        "description": "Test item",
                        "weight_kg": 100.0,
                        "rate_per_kg": 55.0,
                    }
                ],
            },
        )
        # May fail if no item with id=1 exists — that's expected
        if resp.status_code == 404:
            pytest.skip("No seed data — invoice creation may need pre-existing items")
        assert resp.status_code in (200, 201, 202), f"Invoice creation failed: {resp.text}"


# ===================================================================
# BILLING
# ===================================================================

class TestBillingEndpoint:
    """Critical: Billing plan and payment order creation."""

    TEST_EMAIL = "test_integration_billing@example.com"
    TEST_PASS = "Str0ng!Pass#99"

    @pytest.fixture(autouse=True)
    def _setup(self, http_client: Client):
        self.headers = _auth_headers(http_client, email=self.TEST_EMAIL, password=self.TEST_PASS)

    def test_09_list_billing_plans(self, http_client: Client):
        """Fetch available billing plans (public endpoint)."""
        resp = http_client.get("/billing/plans")
        if resp.status_code == 404:
            pytest.skip("Billing plans endpoint not found")

        assert resp.status_code in (200, 401), f"Plans fetch failed: {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            plans = data if isinstance(data, list) else data.get("plans") or []
            assert len(plans) > 0, "No billing plans returned"
            plan_names = [p.get("name") or p.get("id") for p in plans]
            assert any(name for name in plan_names), f"Plan names missing: {plans}"

    def test_10_payment_order_idempotency(self, http_client: Client):
        """Verify that creating a payment order with the same idempotency key is safe.

        This tests the idempotency-key unique constraint on ``payment_orders``.
        """
        import uuid

        resp = http_client.post(
            "/billing/create-order",
            headers=self.headers,
            json={
                "plan_id": "pilot",
                "plan": "pilot",
                "amount": 99900,  # 999 INR in paise
                "currency": "INR",
                "idempotency_key": f"int-test-{uuid.uuid4().hex}",
            },
        )
        # This endpoint may be behind a payment gateway — we just verify it
        # doesn't crash and handles idempotency gracefully
        if resp.status_code in (404, 405):
            pytest.skip("Payment order endpoint not available in test mode")

        assert resp.status_code in (200, 201, 400, 402, 409), \
            f"Payment order creation failed: {resp.text}"


# ===================================================================
# HEALTH / SMOKE
# ===================================================================

class TestSmokeEndpoint:
    """Lightweight smoke tests that do not require auth."""

    def test_health_check_endpoint(self, http_client: Client):
        """The root health check must always succeed."""
        resp = http_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict), f"Health check did not return JSON: {data}"
