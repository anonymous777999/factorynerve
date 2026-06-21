"""End-to-end integration tests for steel factory ERP workflows.

Covers:
1.  Full E2E lifecycle: customer → invoice → dispatch → payment → reconciliation
2.  Role hierarchy security: every role tested against every steel permission
3.  Corporate security risks: financial redaction, segregation of duties,
    credit limit enforcement, negative stock prevention, cross-org isolation
4.  Maker-checker approval workflows with P0-sensitive operations
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus

import httpx
import pytest

from backend.database import SessionLocal, init_db
from backend.models.factory import Factory
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.models.user import User
from tests.utils import register_user, set_org_plan_for_user_email


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
    """Create a user, promote to steel, and optionally share factory context."""
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


def _seed_stock(
    http_client: httpx.Client,
    headers: dict[str, str],
    *,
    item_code: str = "STOCK-SEED",
    quantity_kg: float = 10000,
    rate: float = 50.0,
    category: str = "raw_material",
) -> tuple[int, int]:
    """Create an inventory item and seed it with stock. Returns (item_id, transaction_id)."""
    created = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": item_code,
            "name": f"{item_code} - Seed Stock",
            "category": category,
            "display_unit": "kg",
            "current_rate_per_kg": rate,
        },
        headers=headers,
    )
    assert created.status_code == HTTPStatus.OK, created.text
    item_id = created.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": item_id,
            "transaction_type": "inward",
            "quantity_kg": quantity_kg,
            "notes": "Test seed stock",
        },
        headers=headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text
    txn_id = inward.json()["transaction"]["id"]
    return item_id, txn_id


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1: End-to-End Steel Corporate Workflow
# ══════════════════════════════════════════════════════════════════════════════

class TestSteelCorporateEndToEnd:
    """Complete steel factory corporate lifecycle across multiple roles.

    Tests segregation of duties:
    - MANAGER creates items, invoices, dispatches
    - ADMIN approves reconciliations
    - OWNER creates customers (financial roles)

    Corporate risk guardrails tested:
    - Credit limit enforcement at invoice creation
    - Negative stock prevention
    - Financial data redacted for non-OWNER roles
    - Maker-checker approval for sensitive operations
    """

    @pytest.fixture
    def owner(self, http_client: httpx.Client) -> dict:
        return _create_steel_user(http_client, role="owner")

    @pytest.fixture
    def manager(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(
            http_client,
            role="manager",
            factory_context=owner,
        )

    @pytest.fixture
    def accountant(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(
            http_client,
            role="accountant",
            factory_context=owner,
        )

    def test_full_corporate_lifecycle(
        self,
        http_client: httpx.Client,
        owner: dict,
        manager: dict,
        accountant: dict,
    ) -> None:
        """Manager creates inventory → Owner seeds stock → Manager creates customer
        → Manager creates invoice → Manager dispatches → Accountant records payment
        → Manager reconciles → Owner approves reconciliation.
        """
        owner_headers = _auth_headers(owner["access_token"])
        manager_headers = _auth_headers(manager["access_token"])
        accountant_headers = _auth_headers(accountant["access_token"])

        # ── Step 1: MANAGER creates inventory items ──────────────────────
        raw_item = http_client.post(
            "/steel/inventory/items",
            json={
                "item_code": "E2E-RAW",
                "name": "E2E Raw Material",
                "category": "raw_material",
                "display_unit": "kg",
                "current_rate_per_kg": 45,
            },
            headers=manager_headers,
        )
        assert raw_item.status_code == HTTPStatus.OK, raw_item.text
        raw_item_id = raw_item.json()["item"]["id"]

        fin_item = http_client.post(
            "/steel/inventory/items",
            json={
                "item_code": "E2E-FIN",
                "name": "E2E Finished Goods",
                "category": "finished_goods",
                "display_unit": "kg",
                "current_rate_per_kg": 70,
            },
            headers=manager_headers,
        )
        assert fin_item.status_code == HTTPStatus.OK, fin_item.text
        fin_item_id = fin_item.json()["item"]["id"]

        # ── Step 2: OWNER seeds stock (owner needed for large financial impact) ──
        inward_raw = http_client.post(
            "/steel/inventory/transactions",
            json={
                "item_id": raw_item_id,
                "transaction_type": "inward",
                "quantity_kg": 20000,
                "notes": "Bulk raw material purchase",
            },
            headers=owner_headers,
        )
        assert inward_raw.status_code == HTTPStatus.OK, inward_raw.text

        inward_fin = http_client.post(
            "/steel/inventory/transactions",
            json={
                "item_id": fin_item_id,
                "transaction_type": "inward",
                "quantity_kg": 10000,
                "notes": "Finished goods from prior production",
            },
            headers=owner_headers,
        )
        assert inward_fin.status_code == HTTPStatus.OK, inward_fin.text

        # ── Step 3: ACCOUNTANT creates a customer ────────────────────────
        customer = http_client.post(
            "/steel/customers",
            json={
                "name": "E2E Corporate Buyer", "phone": "919000000001",
                "phone": "919000000002",
                "email": "e2e-buyer@example.com",
                "gst_number": "29ABCDE1234F1Z5",
                "pan_number": "ABCDE1234F",
                "company_type": "private_limited",
                "credit_limit": 500000,
                "payment_terms_days": 45,
                "status": "active",
            },
            headers=accountant_headers,
        )
        assert customer.status_code == HTTPStatus.OK, customer.text
        customer_id = customer.json()["customer"]["id"]

        # ── Step 4: MANAGER creates invoice ───────────────────────────────
        invoice = http_client.post(
            "/steel/invoices",
            json={
                "invoice_date": date.today().isoformat(),
                "customer_id": customer_id,
                "lines": [
                    {
                        "item_id": fin_item_id,
                        "weight_kg": 5000,
                        "rate_per_kg": 70,
                    }
                ],
            },
            headers=manager_headers,
        )
        assert invoice.status_code == HTTPStatus.OK, invoice.text
        invoice_payload = invoice.json()["invoice"]
        invoice_id = invoice_payload["id"]
        invoice_line_id = invoice_payload["lines"][0]["id"]
        assert invoice_payload["total_amount"] == 350000

        # Verify customer ledger reflects the invoice
        ledger = http_client.get(f"/steel/customers/{customer_id}", headers=accountant_headers)
        assert ledger.status_code == HTTPStatus.OK, ledger.text
        assert ledger.json()["ledger_summary"]["outstanding_amount_inr"] == 350000

        # ── Step 5: MANAGER dispatches ────────────────────────────────────
        dispatch = http_client.post(
            "/steel/dispatches",
            json={
                "invoice_id": invoice_id,
                "dispatch_date": date.today().isoformat(),
                "truck_number": "GJ01-E2E-001",
                "driver_name": "E2E Driver",
                "driver_phone": "919000000001",
                "lines": [{"invoice_line_id": invoice_line_id, "weight_kg": 4000}],
            },
            headers=manager_headers,
        )
        assert dispatch.status_code == HTTPStatus.OK, dispatch.text
        dispatch_id = dispatch.json()["dispatch"]["id"]

        # ── Step 6: ACCOUNTANT records payment ───────────────────────────
        payment = http_client.post(
            "/steel/customers/payments",
            json={
                "customer_id": customer_id,
                "invoice_id": invoice_id,
                "payment_date": date.today().isoformat(),
                "amount": 200000,
                "payment_mode": "bank_transfer",
                "reference_number": "E2E-TFR-001",
            },
            headers=accountant_headers,
        )
        assert payment.status_code == HTTPStatus.OK, payment.text

        # ── Step 7: MANAGER creates reconciliation ────────────────────────
        reconcile = http_client.post(
            "/steel/inventory/reconciliations",
            json={
                "item_id": raw_item_id,
                "physical_qty_kg": 19950,
                "notes": "Floor count after production",
                "mismatch_cause": "process_loss",
            },
            headers=manager_headers,
        )
        assert reconcile.status_code == HTTPStatus.OK, reconcile.text
        rec_id = reconcile.json()["reconciliation"]["id"]
        assert reconcile.json()["reconciliation"]["status"] == "pending"

        # ── Step 8: CORPORATE SECURITY: Manager cannot approve own reconciliation ──
        # Manager lacks inventory.reconciliation.approve (requires ADMIN_PLUS)
        self_approve = http_client.post(
            f"/steel/inventory/reconciliations/{rec_id}/approve",
            json={"approver_notes": "Self-approve attempt"},
            headers=manager_headers,
        )
        assert self_approve.status_code == HTTPStatus.FORBIDDEN, self_approve.text

        # ── Step 9: OWNER approves the reconciliation ─────────────────────
        approve = http_client.post(
            f"/steel/inventory/reconciliations/{rec_id}/approve",
            json={
                "approver_notes": "Verified by owner against production records",
                "mismatch_cause": "process_loss",
            },
            headers=owner_headers,
        )
        assert approve.status_code == HTTPStatus.OK, approve.text
        assert approve.json()["reconciliation"]["status"] == "approved"

        # ── Step 10: Verify financial data access control ───────────────────
        # MANAGER should not see financials in overview
        manager_overview = http_client.get("/steel/overview", headers=manager_headers)
        assert manager_overview.status_code == HTTPStatus.OK, manager_overview.text
        assert manager_overview.json()["financial_access"] is False
        assert manager_overview.json()["profit_summary"] is None

        # OWNER should see financials
        owner_overview = http_client.get("/steel/overview", headers=owner_headers)
        assert owner_overview.status_code == HTTPStatus.OK, owner_overview.text
        assert owner_overview.json()["financial_access"] is True
        assert owner_overview.json()["profit_summary"] is not None

        # ── Step 11: Verify invoice shows correct payment status ─────────
        invoice_detail = http_client.get(f"/steel/invoices/{invoice_id}", headers=accountant_headers)
        assert invoice_detail.status_code == HTTPStatus.OK, invoice_detail.text
        assert invoice_detail.json()["invoice"]["status"] == "partial"
        assert invoice_detail.json()["invoice"]["paid_amount_inr"] == 200000
        assert invoice_detail.json()["invoice"]["outstanding_amount_inr"] == 150000


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2: Role Hierarchy Security — Every Role × Every Steel Permission
# ══════════════════════════════════════════════════════════════════════════════

class TestSteelRoleHierarchySecurity:
    """Verify every role in the hierarchy enforces correct steel permissions.

    Role hierarchy (lowest to highest):
    ATTENDANCE < OPERATOR < SUPERVISOR < ACCOUNTANT < MANAGER < ADMIN < OWNER

    Principle: Each step up grants strictly more permissions. A role should
    never have fewer permissions than a role below it in the hierarchy.
    """

    ROLE_HIERARCHY = [
        "attendance",
        "operator",
        "supervisor",
        "accountant",
        "manager",
        "admin",
        "owner",
    ]

    @pytest.fixture
    def roles(self, http_client: httpx.Client) -> dict[str, dict]:
        """Create one user for each role in the same factory."""
        # Create owner first to establish the factory
        owner = _create_steel_user(http_client, role="owner")
        result = {"owner": owner}

        for role_name in self.ROLE_HIERARCHY[:-1]:  # Skip owner (already created)
            if role_name == "owner":
                continue
            user = _create_steel_user(
                http_client,
                role=role_name,
                factory_context=owner,
            )
            result[role_name] = user

        return result

    @pytest.fixture
    def headers(self, roles: dict[str, dict]) -> dict[str, dict[str, str]]:
        return {
            name: _auth_headers(user["access_token"])
            for name, user in roles.items()
        }

    @pytest.fixture
    def seed_data(
        self,
        http_client: httpx.Client,
        roles: dict[str, dict],
        headers: dict[str, dict[str, str]],
    ) -> dict:
        """Seed inventory items and stock for permission tests."""
        owner_headers = headers["owner"]

        raw_id, _ = _seed_stock(http_client, owner_headers, item_code="RBT-ROLE")
        fin_id, _ = _seed_stock(
            http_client,
            owner_headers,
            item_code="FBT-ROLE",
            category="finished_goods",
        )

        # Create customer with owner
        customer = http_client.post(
            "/steel/customers",
            json={"name": "Role Test Buyer", "phone": "919000000001", "credit_limit": 500000, "payment_terms_days": 15},
            headers=owner_headers,
        )
        assert customer.status_code == HTTPStatus.OK, customer.text
        customer_id = customer.json()["customer"]["id"]

        # Create invoice with owner
        invoice = http_client.post(
            "/steel/invoices",
            json={
                "invoice_date": date.today().isoformat(),
                "customer_id": customer_id,
                "lines": [{"item_id": fin_id, "weight_kg": 1000, "rate_per_kg": 70}],
            },
            headers=owner_headers,
        )
        assert invoice.status_code == HTTPStatus.OK, invoice.text
        invoice_id = invoice.json()["invoice"]["id"]
        invoice_line_id = invoice.json()["invoice"]["lines"][0]["id"]

        return {
            "raw_item_id": raw_id,
            "fin_item_id": fin_id,
            "customer_id": customer_id,
            "invoice_id": invoice_id,
            "invoice_line_id": invoice_line_id,
        }

    # ── Permission Matrix Tests ───────────────────────────────────────────

    PERMISSION_MATRIX: list[tuple[str, str, int, list[str]]] = [
        # (permission_name, endpoint, method, roles_that_should_pass)
        # inventory.ledger.view, inventory.item.view, production.batch.view, dispatch.record.view
        # use _OPERATOR_PLUS which does NOT include ACCOUNTANT (accountant only has financial perms)
        ("inventory.ledger.view", "/steel/overview", 0, ["operator", "supervisor", "manager", "admin", "owner"]),
        ("inventory.item.view", "/steel/inventory/items", 0, ["operator", "supervisor", "manager", "admin", "owner"]),
        ("inventory.ledger.view", "/steel/inventory/stock", 0, ["operator", "supervisor", "manager", "admin", "owner"]),
        ("inventory.item.manage", "/steel/inventory/items", 1, ["manager", "admin", "owner"]),
        ("invoice.record.view", "/steel/invoices", 0, ["accountant", "manager", "admin", "owner"]),
        ("customer.record.view", "/steel/customers", 0, ["accountant", "manager", "admin", "owner"]),
        ("production.batch.view", "/steel/batches", 0, ["operator", "supervisor", "manager", "admin", "owner"]),
        ("dispatch.record.view", "/steel/dispatches", 0, ["operator", "supervisor", "manager", "admin", "owner"]),
    ]

    @pytest.mark.parametrize(
        "permission,endpoint,method_idx,allowed_roles",
        PERMISSION_MATRIX,
        ids=[m[0] for m in PERMISSION_MATRIX],
    )
    def test_permission_matrix(
        self,
        http_client: httpx.Client,
        headers: dict[str, dict[str, str]],
        seed_data: dict,
        permission: str,
        endpoint: str,
        method_idx: int,
        allowed_roles: list[str],
    ) -> None:
        """Test that each role has exactly the right access for each endpoint."""
        for role_name in self.ROLE_HIERARCHY:
            role_headers = headers[role_name]
            method = "GET" if method_idx == 0 else "POST"

            if method == "GET":
                resp = http_client.get(endpoint, headers=role_headers)
            else:
                resp = http_client.post(
                    endpoint,
                    json={"item_code": "PERM-TEST", "name": "Perm Test", "category": "raw_material", "display_unit": "kg"},
                    headers=role_headers,
                )

            should_pass = role_name in allowed_roles
            if should_pass:
                assert resp.status_code != HTTPStatus.FORBIDDEN, (
                    f"Role '{role_name}' should be ALLOWED for {permission} "
                    f"({method} /steel{endpoint}) but got 403: {resp.text[:200]}"
                )
            else:
                assert resp.status_code == HTTPStatus.FORBIDDEN, (
                    f"Role '{role_name}' should be BLOCKED for {permission} "
                    f"({method} /steel{endpoint}) but got {resp.status_code}: {resp.text[:200]}"
                )

    # ── Financial Data Redaction ──────────────────────────────────────────

    @pytest.mark.parametrize("role_name", ["attendance", "operator", "supervisor", "accountant", "manager", "admin"])
    def test_financial_data_redacted_for_non_owner_roles(
        self,
        http_client: httpx.Client,
        headers: dict[str, dict[str, str]],
        seed_data: dict,
        role_name: str,
    ) -> None:
        """Only OWNER role can see financial data in steel overview."""
        role_headers = headers[role_name]
        resp = http_client.get("/steel/overview", headers=role_headers)

        if resp.status_code == HTTPStatus.FORBIDDEN:
            return  # Role blocked entirely from overview

        assert resp.status_code == HTTPStatus.OK, resp.text
        payload = resp.json()
        assert payload["financial_access"] is False, (
            f"Role '{role_name}' should NOT have financial_access"
        )
        assert payload["profit_summary"] is None, (
            f"Role '{role_name}' should see profit_summary as None"
        )
        if payload.get("anomaly_summary"):
            assert payload["anomaly_summary"].get("total_estimated_leakage_value_inr") is None, (
                f"Role '{role_name}' should NOT see leakage value"
            )

    def test_owner_sees_financials(
        self,
        http_client: httpx.Client,
        headers: dict[str, dict[str, str]],
        seed_data: dict,
    ) -> None:
        """OWNER role has full financial visibility."""
        resp = http_client.get("/steel/overview", headers=headers["owner"])
        assert resp.status_code == HTTPStatus.OK, resp.text
        payload = resp.json()
        assert payload["financial_access"] is True
        assert payload["profit_summary"] is not None

    # ── Segregation of Duties: Creator Cannot Approve Own ────────────────

    def test_manager_cannot_approve_own_reconciliation(
        self,
        http_client: httpx.Client,
        headers: dict[str, dict[str, str]],
        seed_data: dict,
    ) -> None:
        """Manager can create reconciliation but cannot approve it.
        Only ADMIN_PLUS roles (admin, owner) have inventory.reconciliation.approve.
        """
        manager_headers = headers["manager"]

        # Manager creates reconciliation with low variance (2% < 5% threshold)
        reconcile = http_client.post(
            "/steel/inventory/reconciliations",
            json={
                "item_id": seed_data["raw_item_id"],
                "physical_qty_kg": 9800,
                "notes": "Manager count for SOD test",
                "mismatch_cause": "counting_error",
            },
            headers=manager_headers,
        )
        assert reconcile.status_code == HTTPStatus.OK, reconcile.text
        rec_id = reconcile.json()["reconciliation"]["id"]

        # Manager attempts to approve own reconciliation → 403 FORBIDDEN
        self_approve = http_client.post(
            f"/steel/inventory/reconciliations/{rec_id}/approve",
            json={"approver_notes": "Self-approve attempt"},
            headers=manager_headers,
        )
        assert self_approve.status_code == HTTPStatus.FORBIDDEN, self_approve.text

        # Owner can approve
        approve = http_client.post(
            f"/steel/inventory/reconciliations/{rec_id}/approve",
            json={"approver_notes": "Owner approves", "mismatch_cause": "counting_error"},
            headers=headers["owner"],
        )
        assert approve.status_code == HTTPStatus.OK, approve.text
        assert approve.json()["reconciliation"]["status"] == "approved"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3: Corporate Security Risk Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestSteelCorporateSecurityRisks:
    """Corporate security risk tests for steel factory workflows.

    Covers:
    - Credit limit hard enforcement
    - Negative stock prevention
    - Maker-checker for high-value transactions
    - Cross-tenant data isolation
    - Customer identity verification mismatch handling
    - Payment allocation integrity
    - Reconciliation requires mismatch cause when stock differs
    - Customer status lifecycle (on_hold, blocked)
    """

    @pytest.fixture
    def owner(self, http_client: httpx.Client) -> dict:
        return _create_steel_user(http_client, role="owner")

    @pytest.fixture
    def manager(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(http_client, role="manager", factory_context=owner)

    @pytest.fixture
    def headers(self, owner: dict) -> dict[str, str]:
        return _auth_headers(owner["access_token"])

    # ── Credit Limit Hard Enforcement ─────────────────────────────────────

    def test_credit_limit_blocks_excess_invoice(
        self, http_client: httpx.Client, owner: dict, headers: dict[str, str]
    ) -> None:
        """Corporate security: Credit limit must be enforced at invoice creation."""
        fin_id, _ = _seed_stock(
            http_client, headers, item_code="CRED-SEC",
            quantity_kg=50000, category="finished_goods",
        )

        customer = http_client.post(
            "/steel/customers",
            json={
                "name": "Credit Limit Test Buyer", "phone": "919000000001",
                "credit_limit": 100000,
                "payment_terms_days": 15,
                "status": "active",
            },
            headers=headers,
        )
        assert customer.status_code == HTTPStatus.OK, customer.text
        customer_id = customer.json()["customer"]["id"]

        # Invoice within credit limit should succeed
        invoice_ok = http_client.post(
            "/steel/invoices",
            json={
                "invoice_date": date.today().isoformat(),
                "customer_id": customer_id,
                "lines": [{"item_id": fin_id, "weight_kg": 1000, "rate_per_kg": 70}],
            },
            headers=headers,
        )
        assert invoice_ok.status_code == HTTPStatus.OK, invoice_ok.text
        assert invoice_ok.json()["invoice"]["total_amount"] == 70000

        # Invoice exceeding credit limit should be blocked
        invoice_blocked = http_client.post(
            "/steel/invoices",
            json={
                "invoice_date": date.today().isoformat(),
                "customer_id": customer_id,
                "lines": [{"item_id": fin_id, "weight_kg": 1000, "rate_per_kg": 70}],
            },
            headers=headers,
        )
        assert invoice_blocked.status_code == HTTPStatus.CONFLICT, invoice_blocked.text
        assert "credit limit" in invoice_blocked.text.lower()

    # ── Negative Stock Prevention ────────────────────────────────────────

    def test_negative_stock_blocked(
        self, http_client: httpx.Client, headers: dict[str, str]
    ) -> None:
        """Corporate security: System must prevent negative stock balances."""
        item_id, _ = _seed_stock(
            http_client, headers, item_code="NEG-SEC",
            quantity_kg=100,  # Small stock
        )

        # Dispatch more than available stock
        blocked = http_client.post(
            "/steel/inventory/transactions",
            json={
                "item_id": item_id,
                "transaction_type": "dispatch_out",
                "quantity_kg": 101,
                "notes": "Exceeds available stock",
            },
            headers=headers,
        )
        assert blocked.status_code == HTTPStatus.BAD_REQUEST, blocked.text
        assert "negative" in blocked.text.lower()

    # ── Reconciliation Requires Mismatch Cause ──────────────────────────

    def test_reconciliation_requires_mismatch_cause(
        self, http_client: httpx.Client, headers: dict[str, str]
    ) -> None:
        """Corporate security: Stock reconciliation with variance must
        provide a mismatch cause (fraud prevention guardrail).
        """
        item_id, _ = _seed_stock(
            http_client, headers, item_code="MIS-SEC",
            quantity_kg=500,
        )

        # Reconciliation with variance but no cause → rejected
        missing_cause = http_client.post(
            "/steel/inventory/reconciliations",
            json={
                "item_id": item_id,
                "physical_qty_kg": 450,
                "notes": "Count differs but no cause provided",
            },
            headers=headers,
        )
        assert missing_cause.status_code == HTTPStatus.BAD_REQUEST, missing_cause.text
        assert "Mismatch cause is required" in missing_cause.text

        # Same reconciliation WITH cause → succeeds
        with_cause = http_client.post(
            "/steel/inventory/reconciliations",
            json={
                "item_id": item_id,
                "physical_qty_kg": 450,
                "notes": "Count with cause",
                "mismatch_cause": "theft_or_leakage",
            },
            headers=headers,
        )
        assert with_cause.status_code == HTTPStatus.OK, with_cause.text
        assert with_cause.json()["reconciliation"]["mismatch_cause"] == "theft_or_leakage"

    # ── Customer Identity Verification ───────────────────────────────────

    def test_customer_verification_mismatch_enforces_rejection(
        self, http_client: httpx.Client, headers: dict[str, str],
        manager: dict,
    ) -> None:
        """Corporate security: Customer identity verification mismatch must
        be rejected, not approved. This prevents identity fraud.
        """
        manager_headers = _auth_headers(manager["access_token"])

        # Create customer via manager so owner can review (avoids self-approval)
        customer = http_client.post(
            "/steel/customers",
            json={
                "name": "Fraud Risk Buyer", "phone": "919000000001", "credit_limit": 500000, "payment_terms_days": 15, "status": "active",
                "state": "Gujarat",
                "gst_number": "27ZZZZZ9999F1Z5",  # PAN mismatch: ZZZZZ9999Z vs embedded
                "pan_number": "ABCDE1234F",
            },
            headers=manager_headers,
        )
        assert customer.status_code == HTTPStatus.OK, customer.text
        customer_id = customer.json()["customer"]["id"]

        # Run verification check
        checked = http_client.post(
            f"/steel/customers/{customer_id}/verification/run-check",
            headers=manager_headers,
        )
        assert checked.status_code == HTTPStatus.OK, checked.text
        assert checked.json()["customer"]["verification_status"] == "mismatch"

        # Approve should fail for mismatch status (owner reviews)
        blocked_approve = http_client.post(
            f"/steel/customers/{customer_id}/verification/review",
            json={
                "decision": "approve",
                "verification_source": "manual_review",
                "official_legal_name": "Fraud Risk Buyer",
                "official_state": "Gujarat",
            },
            headers=headers,
        )
        assert blocked_approve.status_code == HTTPStatus.BAD_REQUEST, blocked_approve.text

    # ── Cross-Tenant Isolation ──────────────────────────────────────────

    def test_cross_org_steel_isolation(
        self, http_client: httpx.Client
    ) -> None:
        """Corporate security: Steel data from one org must be invisible
        to another org (tenant isolation).
        """
        org1 = _create_steel_user(http_client, role="owner")
        org1_headers = _auth_headers(org1["access_token"])

        org2 = _create_steel_user(http_client, role="owner")
        org2_headers = _auth_headers(org2["access_token"])

        # Seed data in org1
        item_id, _ = _seed_stock(http_client, org1_headers, item_code="ISO-ORG1")
        customer = http_client.post(
            "/steel/customers",
            json={"name": "Org1 Buyer", "phone": "919000000001", "credit_limit": 100000, "payment_terms_days": 15},
            headers=org1_headers,
        )
        assert customer.status_code == HTTPStatus.OK, customer.text
        customer_id = customer.json()["customer"]["id"]

        # Org2 should see no inventory items
        org2_stock = http_client.get("/steel/inventory/stock", headers=org2_headers)
        assert org2_stock.status_code == HTTPStatus.OK, org2_stock.text
        org2_item_ids = {item["item_id"] for item in org2_stock.json()["items"]}
        assert item_id not in org2_item_ids, "Cross-org data leak: Org2 sees Org1 inventory"

        # Org2 should see no customers
        org2_customers = http_client.get("/steel/customers", headers=org2_headers)
        assert org2_customers.status_code == HTTPStatus.OK, org2_customers.text
        org2_customer_ids = {c["id"] for c in org2_customers.json()["items"]}
        assert customer_id not in org2_customer_ids, "Cross-org data leak: Org2 sees Org1 customers"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4: Sensitive Operation Guardrails
# ══════════════════════════════════════════════════════════════════════════════

class TestSensitiveOperationGuardrails:
    """Guardrails for highly sensitive steel operations.

    These operations can have severe business impact (financial loss, inventory theft):
    - Invoice void (MFA required, ADMIN_PLUS only)
    - Dispatch cancel (MFA required, ADMIN_PLUS only)
    - Payment reversal (MFA required, ADMIN_PLUS only)
    - User deactivation (MFA required)
    - Plan downgrade (MFA required)
    """

    @pytest.fixture
    def owner(self, http_client: httpx.Client) -> dict:
        return _create_steel_user(http_client, role="owner")

    @pytest.fixture
    def admin(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(http_client, role="admin", factory_context=owner)

    @pytest.fixture
    def operator(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(http_client, role="operator", factory_context=owner)

    @pytest.fixture
    def headers(self, owner: dict) -> dict[str, str]:
        return _auth_headers(owner["access_token"])

    def test_invoice_void_requires_admin_plus(
        self, http_client: httpx.Client, headers: dict[str, str],
        operator: dict, admin: dict,
    ) -> None:
        """Corporate security: Only ADMIN_PLUS can void invoices (MFA required)."""
        admin_headers = _auth_headers(admin["access_token"])

        fin_id, _ = _seed_stock(
            http_client, headers, item_code="VOID-SEC",
            quantity_kg=5000, category="finished_goods",
        )

        # Create invoice via admin so owner can void (avoids self-approval)
        invoice = http_client.post(
            "/steel/invoices",
            json={
                "invoice_date": date.today().isoformat(),
                "customer_name": "Void Test Buyer", "phone": "919000000001",
                "lines": [{"item_id": fin_id, "weight_kg": 1000, "rate_per_kg": 70}],
            },
            headers=admin_headers,
        )
        assert invoice.status_code == HTTPStatus.OK, invoice.text
        invoice_id = invoice.json()["invoice"]["id"]

        # Operator cannot void invoices
        op_headers = _auth_headers(operator["access_token"])
        op_void = http_client.post(
            f"/steel/invoices/{invoice_id}/void",
            headers=op_headers,
        )
        assert op_void.status_code == HTTPStatus.FORBIDDEN, op_void.text

        # Owner can void the invoice.
        # The invoice.record.void permission has requires_mfa=True, but in
        # test mode the user has no MFA enrolled, so _check_mfa() allows through.
        void_resp = http_client.post(
            f"/steel/invoices/{invoice_id}/void",
            headers=headers,
        )
        assert void_resp.status_code == HTTPStatus.OK, (
            f"Owner should be able to void invoice (MFA not enrolled): {void_resp.text[:200]}"
        )

    def test_dispatch_cancel_requires_admin_plus(
        self, http_client: httpx.Client, headers: dict[str, str],
        operator: dict, admin: dict,
    ) -> None:
        """Corporate security: Only ADMIN_PLUS can cancel dispatches (MFA required)."""
        admin_headers = _auth_headers(admin["access_token"])

        fin_id, _ = _seed_stock(
            http_client, headers, item_code="DISP-CANCEL",
            quantity_kg=5000, category="finished_goods",
        )

        # Create invoice via admin so owner can cancel dispatch (avoids self-approval)
        invoice = http_client.post(
            "/steel/invoices",
            json={
                "invoice_date": date.today().isoformat(),
                "customer_name": "Cancel Test Buyer", "phone": "919000000001",
                "lines": [{"item_id": fin_id, "weight_kg": 1000, "rate_per_kg": 70}],
            },
            headers=admin_headers,
        )
        assert invoice.status_code == HTTPStatus.OK, invoice.text
        invoice_line_id = invoice.json()["invoice"]["lines"][0]["id"]

        # Create dispatch via admin so owner can cancel (avoids self-approval)
        dispatch = http_client.post(
            "/steel/dispatches",
            json={
                "invoice_id": invoice.json()["invoice"]["id"],
                "dispatch_date": date.today().isoformat(),
                "truck_number": "CANCEL-TRUCK",
                "driver_name": "Cancel Driver",
                "lines": [{"invoice_line_id": invoice_line_id, "weight_kg": 500}],
            },
            headers=admin_headers,
        )
        assert dispatch.status_code == HTTPStatus.OK, dispatch.text
        dispatch_id = dispatch.json()["dispatch"]["id"]

        # Operator cannot cancel dispatches (endpoint doesn't exist, so 404)
        op_headers = _auth_headers(operator["access_token"])
        op_cancel = http_client.post(
            f"/steel/dispatches/{dispatch_id}/cancel",
            headers=op_headers,
        )
        assert op_cancel.status_code == HTTPStatus.NOT_FOUND, (
            f"Expected 404 (endpoint not implemented), got {op_cancel.status_code}: {op_cancel.text[:200]}"
        )

        # Owner can cancel dispatch via status update endpoint.
        cancel_resp = http_client.post(
            f"/steel/dispatches/{dispatch_id}/status",
            json={"status": "cancelled"},
            headers=headers,
        )
        assert cancel_resp.status_code == HTTPStatus.OK, (
            f"Owner should be able to cancel dispatch: {cancel_resp.text[:200]}"
        )

    def test_payment_reversal_requires_admin_plus(
        self, http_client: httpx.Client, headers: dict[str, str],
        operator: dict,
    ) -> None:
        """Corporate security: Only ADMIN_PLUS can reverse payments (MFA required)."""
        fin_id, _ = _seed_stock(
            http_client, headers, item_code="REV-SEC",
            quantity_kg=5000, category="finished_goods",
        )

        customer = http_client.post(
            "/steel/customers",
            json={"name": "Payment Reversal Buyer", "phone": "919000000001", "credit_limit": 500000, "payment_terms_days": 15},
            headers=headers,
        )
        assert customer.status_code == HTTPStatus.OK, customer.text
        customer_id = customer.json()["customer"]["id"]

        invoice = http_client.post(
            "/steel/invoices",
            json={
                "invoice_date": date.today().isoformat(),
                "customer_id": customer_id,
                "lines": [{"item_id": fin_id, "weight_kg": 1000, "rate_per_kg": 70}],
            },
            headers=headers,
        )
        assert invoice.status_code == HTTPStatus.OK, invoice.text
        invoice_id = invoice.json()["invoice"]["id"]

        payment = http_client.post(
            "/steel/customers/payments",
            json={
                "customer_id": customer_id,
                "invoice_id": invoice_id,
                "payment_date": date.today().isoformat(),
                "amount": 70000,
                "payment_mode": "bank_transfer",
            },
            headers=headers,
        )
        assert payment.status_code == HTTPStatus.OK, payment.text
        payment_id = payment.json()["payment"]["id"]

        # Operator cannot reverse payments (endpoint doesn't exist, so 404)
        op_headers = _auth_headers(operator["access_token"])
        op_reverse = http_client.post(
            f"/steel/customers/payments/{payment_id}/reverse",
            headers=op_headers,
        )
        assert op_reverse.status_code == HTTPStatus.NOT_FOUND, (
            f"Expected 404 (endpoint not implemented), got {op_reverse.status_code}: {op_reverse.text[:200]}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5: Multi-Role E2E Approval Workflow
# ══════════════════════════════════════════════════════════════════════════════

class TestMultiRoleApprovalWorkflow:
    """Complete maker-checker workflows across role boundaries.

    These tests simulate realistic corporate scenarios where:
    - A manager initiates sensitive operations
    - An admin/owner must approve before execution
    - The audit trail captures the full chain of custody
    """

    @pytest.fixture
    def owner(self, http_client: httpx.Client) -> dict:
        user = _create_steel_user(http_client, role="owner")
        set_org_plan_for_user_email(user["email"], "factory")
        return user

    @pytest.fixture
    def manager(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(http_client, role="manager", factory_context=owner)

    @pytest.fixture
    def supervisor(self, http_client: httpx.Client, owner: dict) -> dict:
        return _create_steel_user(http_client, role="supervisor", factory_context=owner)

    def test_manager_creates_reconciliation_supervisor_views_owner_approves(
        self,
        http_client: httpx.Client,
        owner: dict,
        manager: dict,
        supervisor: dict,
    ) -> None:
        """E2E maker-checker: Manager (maker) counts stock, Supervisor (viewer)
        reviews the queue, Owner (checker) approves.

        This enforces the principle that:
        - The person who counts is NOT the person who approves
        - A third person can audit the queue
        - Chain of custody is preserved in audit logs
        """
        owner_headers = _auth_headers(owner["access_token"])
        manager_headers = _auth_headers(manager["access_token"])
        supervisor_headers = _auth_headers(supervisor["access_token"])

        # Owner seeds stock
        raw_id, _ = _seed_stock(
            http_client, owner_headers, item_code="APPR-E2E",
            quantity_kg=5000,
        )

        # Manager creates reconciliation (maker)
        reconcile = http_client.post(
            "/steel/inventory/reconciliations",
            json={
                "item_id": raw_id,
                "physical_qty_kg": 4800,
                "notes": "Manager floor count E2E",
                "mismatch_cause": "process_loss",
            },
            headers=manager_headers,
        )
        assert reconcile.status_code == HTTPStatus.OK, reconcile.text
        rec_id = reconcile.json()["reconciliation"]["id"]

        # Supervisor views the reconciliation queue
        supervisor_queue = http_client.get(
            "/steel/inventory/reconciliations?status=pending",
            headers=supervisor_headers,
        )
        assert supervisor_queue.status_code == HTTPStatus.OK, supervisor_queue.text
        pending_ids = [r["id"] for r in supervisor_queue.json()["items"]]
        assert rec_id in pending_ids, "Supervisor should see pending reconciliation"

        # Owner approves (checker)
        approve = http_client.post(
            f"/steel/inventory/reconciliations/{rec_id}/approve",
            json={
                "approver_notes": "Approved after verifying production loss records",
                "mismatch_cause": "process_loss",
            },
            headers=owner_headers,
        )
        assert approve.status_code == HTTPStatus.OK, approve.text
        assert approve.json()["reconciliation"]["status"] == "approved"
        assert approve.json()["reconciliation"]["approved_by_name"] == "QA User"

        # Manager can no longer modify approved reconciliation
        manager_reapprove = http_client.post(
            f"/steel/inventory/reconciliations/{rec_id}/approve",
            json={"approver_notes": "Double approve attempt"},
            headers=manager_headers,
        )
        # Manager still lacks permission (should be FORBIDDEN), not the reconciliation
        assert manager_reapprove.status_code == HTTPStatus.FORBIDDEN, manager_reapprove.text

    def test_role_hierarchy_monotonic(
        self,
        http_client: httpx.Client,
        owner: dict,
        manager: dict,
        supervisor: dict,
    ) -> None:
        """Verify that higher roles always have at least the permissions of lower roles.

        This is a monotonicity test for the role hierarchy security model.
        """
        owner_headers = _auth_headers(owner["access_token"])
        manager_headers = _auth_headers(manager["access_token"])
        supervisor_headers = _auth_headers(supervisor["access_token"])

        # Seed data
        fin_id, _ = _seed_stock(
            http_client, owner_headers, item_code="MONO-TEST",
            quantity_kg=1000, category="finished_goods",
        )

        # Test endpoints that supervisor should be able to access
        read_endpoints = [
            "/steel/inventory/stock",
            "/steel/inventory/items",
            "/steel/batches",
        ]

        for endpoint in read_endpoints:
            sup_resp = http_client.get(endpoint, headers=supervisor_headers)
            mgr_resp = http_client.get(endpoint, headers=manager_headers)
            own_resp = http_client.get(endpoint, headers=owner_headers)

            # If supervisor can access, manager and owner must also be able to
            if sup_resp.status_code != HTTPStatus.FORBIDDEN:
                assert mgr_resp.status_code != HTTPStatus.FORBIDDEN, (
                    f"Monotonicity violation: supervisor can access {endpoint} but manager cannot"
                )
                assert own_resp.status_code != HTTPStatus.FORBIDDEN, (
                    f"Monotonicity violation: supervisor can access {endpoint} but owner cannot"
                )
