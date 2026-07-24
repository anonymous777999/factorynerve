"""Delete ALL users from the database.

WARNING: This is destructive and irreversible without a backup.
It removes ALL users and their associated data from every related table.

Usage:
    # Preview what will be deleted (safe):
    python scripts/delete_all_users.py --dry-run

    # Actually delete everything:
    python scripts/delete_all_users.py --confirm

Requirements:
    - DATABASE_URL environment variable set (Render sets this automatically)
    - Python packages: sqlalchemy, python-dotenv, psycopg2-binary (for Postgres)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# ── Load .env (optional — Render sets env vars natively) ────────────────
_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path)

# ── Config ──────────────────────────────────────────────────────────────
DRY_RUN = "--dry-run" in sys.argv
CONFIRM = "--confirm" in sys.argv

# ── Tables in deletion order (children before parents) ──────────────────
# Order matters: tables that FK-reference others must come first.
DELETE_ORDER: list[str] = [
    # Auth child tables (reference auth_users and/or users)
    "auth_sessions",
    "auth_password_resets",
    "auth_audit_logs",
    # Non-nullable user FK tables
    "ocr_verifications",
    "ocr_usages",
    "token_blacklist",
    "refresh_tokens",
    "password_reset_tokens",
    "email_verification_tokens",
    "user_factory_roles",
    "user_plans",
    "intelligence_stage_usages",
    "intelligence_requests",
    "feedbacks",
    "feature_usages",
    "notifications",
    "employee_profiles",
    "attendance_regularizations",
    "attendance_events",
    "attendance_records",
    "entries",
    "alerts",
    "email_queue",
    # Parent tables (no remaining user FK deps)
    "auth_users",
    "users",
    # Signup queue (no FK to users but stale)
    "pending_registrations",
]

# Tables with nullable user FK columns — set to NULL before deleting users
NULLIFY_TABLES: list[tuple[str, list[str]]] = [
    ("audit_logs", ["user_id"]),
    ("subscriptions", ["user_id"]),
    ("payment_orders", ["user_id"]),
    ("phone_verifications", ["user_id"]),
    ("admin_alert_recipients", ["user_id", "verified_by_user_id"]),
    ("org_subscription_addons", ["user_id"]),
    ("workforce_cost_rates", ["user_id", "created_by_user_id"]),
    ("steel_boms", ["created_by_user_id"]),
    ("steel_cash_accounts", ["created_by_user_id"]),
    ("steel_cash_ledger_entries", ["created_by_user_id"]),
    ("steel_customers", ["verified_by_user_id", "created_by_user_id"]),
    ("steel_customer_payments", ["created_by_user_id"]),
    ("steel_customer_payment_allocations", ["created_by_user_id"]),
    ("steel_customer_follow_up_tasks", ["assigned_to_user_id", "created_by_user_id"]),
    ("steel_dispatches", ["gate_pass_verified_by_user_id", "delivered_by_user_id", "created_by_user_id"]),
    ("steel_expenses", ["created_by_user_id", "approved_by_user_id"]),
    ("steel_fraud_alerts", ["acknowledged_by_user_id", "resolved_by_user_id"]),
    ("steel_inventory_items", ["created_by_user_id"]),
    ("steel_inventory_transactions", ["created_by_user_id"]),
    ("steel_machines", ["created_by_user_id"]),
    ("steel_machine_downtime_events", ["operator_user_id", "created_by_user_id"]),
    ("steel_maintenance_tasks", ["assigned_to_user_id", "created_by_user_id"]),
    ("steel_production_batches", ["operator_user_id", "created_by_user_id"]),
    ("steel_production_lines", ["created_by_user_id"]),
    ("steel_sales_invoices", ["created_by_user_id"]),
    ("steel_stock_reconciliations", ["counted_by_user_id", "submitted_by_user_id", "approved_by_user_id", "rejected_by_user_id"]),
    ("steel_vendors", ["created_by_user_id"]),
    ("steel_vendor_bills", ["created_by_user_id"]),
    ("steel_vendor_payments", ["created_by_user_id"]),
    ("steel_vendor_payment_allocations", ["created_by_user_id"]),
]


def main() -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("❌ DATABASE_URL not set. Cannot connect to database.")
        sys.exit(1)

    # Safety interlock
    if not DRY_RUN and not CONFIRM:
        print(
            "⚠️  This script deletes ALL users and their data permanently.\n"
            "    Pass --dry-run to preview, or --confirm to execute.\n"
        )
        sys.exit(0)

    # Connect
    from sqlalchemy import create_engine, text
    engine = create_engine(db_url)
    conn = engine.connect()

    try:
        totals: dict[str, int] = {}

        # ── Step 1: Nullify nullable FK columns ─────────────────────────
        print("\n── Step 1: Nullifying nullable user FK columns ──")
        for table, columns in NULLIFY_TABLES:
            for col in columns:
                sql = text(f"UPDATE {table} SET {col} = NULL WHERE {col} IS NOT NULL")
                if DRY_RUN:
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {table} WHERE {col} IS NOT NULL")
                    ).scalar()
                    if count:
                        print(f"  Would NULL {table}.{col}: {count} rows")
                else:
                    result = conn.execute(sql)
                    if result.rowcount:
                        print(f"  NULL'd {table}.{col}: {result.rowcount} rows")
                conn.commit()

        # ── Step 2: Set OCR nullable FKs ────────────────────────────────
        for col in ("approved_by", "rejected_by"):
            sql = text(f"UPDATE ocr_verifications SET {col} = NULL WHERE {col} IS NOT NULL")
            if DRY_RUN:
                count = conn.execute(
                    text(f"SELECT COUNT(*) FROM ocr_verifications WHERE {col} IS NOT NULL")
                ).scalar()
                if count:
                    print(f"  Would NULL ocr_verifications.{col}: {count} rows")
            else:
                result = conn.execute(sql)
                if result.rowcount:
                    print(f"  NULL'd ocr_verifications.{col}: {result.rowcount} rows")
            conn.commit()

        # ── Step 3: Delete from tables in order ─────────────────────────
        print("\n── Step 2: Deleting rows from tables ──")
        for table in DELETE_ORDER:
            if DRY_RUN:
                count = conn.execute(
                    text(f"SELECT COUNT(*) FROM {table}")
                ).scalar()
                if count:
                    print(f"  Would DELETE from {table}: {count} rows")
            else:
                count = conn.execute(
                    text(f"DELETE FROM {table}")
                ).rowcount
                if count:
                    print(f"  Deleted from {table}: {count} rows")
                totals[table] = count
            conn.commit()

        # ── Summary ─────────────────────────────────────────────────────
        total_deleted = sum(totals.values()) if not DRY_RUN else 0
        print(f"\n{'─' * 50}")
        if DRY_RUN:
            print("✅ Dry-run complete. No data was modified.")
            print("   Run with --confirm to execute.")
        else:
            print(f"✅ Done! {total_deleted} total rows deleted across all tables.")
            user_count = totals.get("users", 0)
            auth_user_count = totals.get("auth_users", 0)
            print(f"   Users deleted: {user_count}")
            print(f"   AuthUsers deleted: {auth_user_count}")

    finally:
        conn.close()
        engine.dispose()


if __name__ == "__main__":
    main()
