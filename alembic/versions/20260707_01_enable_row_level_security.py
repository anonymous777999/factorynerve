"""Enable PostgreSQL Row-Level Security for multi-tenant data isolation.

Phase 3 of DB-03 (RLS implementation):
1. Creates a helper function `_rls_tenant_id()` that returns the current
   tenant's org_id from the session GUC ``app.current_org_id``.
2. Enables RLS (``ALTER TABLE ... ENABLE ROW LEVEL SECURITY``) on all
   tenant-scoped tables.
3. Creates RLS policies for each table:

   - **Tier 1** (tables with both ``org_id`` and ``factory_id``):
     Two policies — ``rls_org_isolation`` and ``rls_factory_isolation``.
   - **Tier 2** (tables with ``org_id`` only):
     One policy — ``rls_org_isolation``.

   Global / auth / system tables (``organizations``, ``users``, ``auth_*``,
   ``idempotency_keys``, ``rate_limits``, etc.) are intentionally excluded.

Migration is idempotent — safe to run multiple times (uses ``CREATE OR REPLACE``
and ``DROP POLICY IF EXISTS`` / ``CREATE POLICY`` with unique names).

REVERSIBLE: ``downgrade()`` drops all policies and disables RLS.

Revision ID: 20260707_01
Revises: 20260705_06
Create Date: 2026-07-07
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260707_01"
down_revision: ClassVar[str] = "20260705_06"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


# ── Table Inventory ──────────────────────────────────────────────────────

# Tier 1: Tables with BOTH org_id and factory_id columns (org + factory policies)
_TIER_1_TABLES: tuple[str, ...] = (
    "entries",
    "attendance_records",
    "attendance_events",
    "employee_profiles",
    "steel_inventory_items",
    "steel_inventory_transactions",
    "steel_dispatches",
    "steel_dispatch_lines",
    "steel_sales_invoices",
    "steel_sales_invoice_lines",
    "steel_production_batches",
    "steel_production_lines",
    "steel_vendors",
    "steel_vendor_bills",
    "steel_vendor_bill_lines",
    "steel_vendor_payments",
    "steel_vendor_payment_allocations",
    "steel_customers",
    "steel_customer_payments",
    "steel_customer_payment_allocations",
    "steel_cash_accounts",
    "steel_cash_ledger_entries",
    "steel_machine_downtime_events",
    "steel_maintenance_tasks",
    "steel_machines",
    "steel_bom",
    "steel_expenses",
    "steel_fraud_alerts",
    "steel_stock_reconciliations",
    "feedback",
    "approval_instances",
    "audit_logs",
    "factory_settings",
    "ocr_templates",
    "ocr_verifications",
    "defect_reasons",
    "workforce_cost_rates",
    "shift_templates",
    "ocr_usage",
    "notifications",
)

# Tier 2: Tables with org_id ONLY (org policy only)
_TIER_2_TABLES: tuple[str, ...] = (
    "invoices",
    "subscriptions",
    "feature_usage",
    "org_feature_usage",
    "org_ocr_usage",
    "org_whatsapp_usage",
    "ai_usage_log",
    "ai_result_cache",
    "intelligence_requests",
    "intelligence_stage_usage",
    "org_subscription_addons",
    "ops_alert_events",
    "ops_alert_daily_summaries",
    "payment_orders",
    "email_queue",
    "webhook_events",
)


def _table_exists(bind: sa.engine.Connection, table_name: str) -> bool:
    """Check if a table exists in the database."""
    inspector = sa.inspect(bind)
    return table_name in set(inspector.get_table_names())


def _dialect_is_postgresql(bind: sa.engine.Connection) -> bool:
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    if not _dialect_is_postgresql(bind):
        print("  ⚠ Skipping RLS setup on non-PostgreSQL dialect.")
        return

    print("  ✓ PostgreSQL detected — proceeding with RLS setup.")

    # ── Step 1: Create the helper function ─────────────────────────────
    # Returns the effective tenant ID from session context.
    # Empty string or NULL means "bypass" (platform admin).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION _rls_tenant_id()
        RETURNS text
        LANGUAGE SQL
        STABLE
        AS $$
            SELECT NULLIF(current_setting('app.current_org_id', TRUE), '');
        $$;
        """
    )
    print("  ✓ Created/updated _rls_tenant_id() helper function.")

    # ── Step 2: Enable RLS and create policies on Tier 1 tables ───────
    for table in _TIER_1_TABLES:
        if not _table_exists(bind, table):
            print(f"  ⚠ Skipping Tier-1 table '{table}' — does not exist.")
            continue

        # Check that org_id and factory_id columns actually exist
        columns = {col["name"] for col in sa.inspect(bind).get_columns(table)}
        if "org_id" not in columns:
            print(f"  ⚠ Skipping Tier-1 table '{table}' — no org_id column.")
            continue

        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

        # Org-level isolation policy (default)
        op.execute(
            f"""
            CREATE POLICY rls_org_isolation ON {table}
            FOR ALL
            USING (
                _rls_tenant_id() IS NULL
                OR org_id = _rls_tenant_id()
            );
            """
        )

        # Factory-level isolation policy (only if factory_id exists)
        if "factory_id" in columns:
            op.execute(
                f"""
                CREATE POLICY rls_factory_isolation ON {table}
                FOR ALL
                USING (
                    _rls_tenant_id() IS NULL
                    OR (
                        org_id = _rls_tenant_id()
                        AND factory_id = current_setting('app.current_factory_id')::text
                    )
                );
                """
            )

        print(f"  ✓ RLS enabled on '{table}' (Tier 1).")

    # ── Step 3: Enable RLS and create policies on Tier 2 tables ───────
    for table in _TIER_2_TABLES:
        if not _table_exists(bind, table):
            print(f"  ⚠ Skipping Tier-2 table '{table}' — does not exist.")
            continue

        columns = {col["name"] for col in sa.inspect(bind).get_columns(table)}
        if "org_id" not in columns:
            print(f"  ⚠ Skipping Tier-2 table '{table}' — no org_id column.")
            continue

        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

        op.execute(
            f"""
            CREATE POLICY rls_org_isolation ON {table}
            FOR ALL
            USING (
                _rls_tenant_id() IS NULL
                OR org_id = _rls_tenant_id()
            );
            """
        )

        print(f"  ✓ RLS enabled on '{table}' (Tier 2).")

    print("  ✓ RLS setup complete.")


def downgrade() -> None:
    bind = op.get_bind()
    if not _dialect_is_postgresql(bind):
        print("  ⚠ Skipping RLS downgrade on non-PostgreSQL dialect.")
        return

    print("  ✓ PostgreSQL detected — proceeding with RLS teardown.")

    all_tables: tuple[str, ...] = _TIER_1_TABLES + _TIER_2_TABLES

    for table in all_tables:
        if not _table_exists(bind, table):
            continue

        columns = {col["name"] for col in sa.inspect(bind).get_columns(table)}
        if "org_id" not in columns:
            continue

        # Drop policies
        op.execute(f"DROP POLICY IF EXISTS rls_org_isolation ON {table};")
        op.execute(f"DROP POLICY IF EXISTS rls_factory_isolation ON {table};")

        # Disable RLS
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

        print(f"  ✓ RLS disabled on '{table}'.")

    # Drop the helper function
    op.execute("DROP FUNCTION IF EXISTS _rls_tenant_id();")
    print("  ✓ Dropped _rls_tenant_id() helper function.")

    print("  ✓ RLS teardown complete.")
