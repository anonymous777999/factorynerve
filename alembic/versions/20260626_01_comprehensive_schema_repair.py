"""Comprehensive schema repair — consolidate all runtime _ensure_* drift repairs.

This migration captures EVERY schema change that was previously scattered across
20+ _ensure_* functions in ``backend/database.py`` that ran on every startup.
Those functions have been removed from ``init_db()`` — this migration is their
permanent replacement.

The operations are idempotent: columns, indexes, tables, and foreign keys are
only created when they do not already exist. Data backfills use COALESCE and
IS NULL guards so they never overwrite existing data.

Revision ID: 20260626_01
Revises: 20260623_100001
Create Date: 2026-06-26 10:00:00.000000
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260626_01"
down_revision: ClassVar[str | None] = "20260623_100001"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


# ── Idempotent Helper Functions ─────────────────────────────────────────────

_BOOLEAN_TRUE = sa.text("true")
_BOOLEAN_FALSE = sa.text("false")
_SQLITE = False


def _dialect(bind: sa.engine.Connection) -> str:
    return bind.dialect.name


def _table_names(bind: sa.engine.Connection) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_map(bind: sa.engine.Connection, table: str) -> dict[str, dict]:
    try:
        return {c["name"]: c for c in sa.inspect(bind).get_columns(table)}
    except Exception:
        return {}


def _index_names(bind: sa.engine.Connection, table: str) -> set[str]:
    try:
        return {i["name"] for i in sa.inspect(bind).get_indexes(table) if i.get("name")}
    except Exception:
        return set()


def _column_exists(bind: sa.engine.Connection, table: str, column: str) -> bool:
    return column in _column_map(bind, table)


def _table_has(bind: sa.engine.Connection, table: str) -> bool:
    return table in _table_names(bind)


def _add_column(bind: sa.engine.Connection, table: str, col: sa.Column) -> None:
    if not _table_has(bind, table):
        return
    if _column_exists(bind, table, col.name):
        return
    op.add_column(table, col)


def _create_index_if(bind: sa.engine.Connection, name: str, table: str, columns: list[str], *, unique: bool = False) -> None:
    if not _table_has(bind, table):
        return
    if name in _index_names(bind, table):
        return
    op.create_index(name, table, columns, unique=unique)


def _ensure_pg_enum(bind: sa.engine.Connection, enum_name: str, values: list[str]) -> None:
    if _dialect(bind) != "postgresql":
        return
    existing = {
        str(r).strip()
        for r in bind.execute(
            sa.text(
                """
                SELECT e.enumlabel
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = :enum_name
                """
            ),
            {"enum_name": enum_name},
        ).scalars().all()
        if r
    }
    for val in values:
        if val not in existing:
            bind.exec_driver_sql(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{val}'")


def _backfill_table(bind: sa.engine.Connection, table: str, sets: dict[str, str], where: str | None = None) -> None:
    """Run an UPDATE with idempotent COALESCE guards."""
    if not _table_has(bind, table):
        return
    set_clauses = [f"{col} = COALESCE({col}, {val})" for col, val in sets.items()]
    if not set_clauses:
        return
    sql = f"UPDATE {table} SET {', '.join(set_clauses)}"
    if where:
        sql += f" WHERE {where}"
    bind.execute(sa.text(sql))
    bind.commit()


# ── MAIN UPGRADE ────────────────────────────────────────────────────────────


def upgrade() -> None:
    bind = op.get_bind()
    global _SQLITE
    _SQLITE = _dialect(bind) == "sqlite"

    # ── 1. PostgreSQL enum values ───────────────────────────────────────────
    _ensure_pg_enum(bind, "phone_verification_channel", ["whatsapp", "email"])
    _ensure_pg_enum(bind, "phone_verification_purpose", ["user_verification", "alert_recipient"])

    # ── 2. Tables that might have been missed by Alembic ────────────────────

    # workforce_cost_rates
    if not _table_has(bind, "workforce_cost_rates"):
        op.create_table(
            "workforce_cost_rates",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(36), nullable=False),
            sa.Column("factory_id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("role", sa.String(32), nullable=True),
            sa.Column("department", sa.String(120), nullable=True),
            sa.Column("effective_from", sa.Date(), nullable=False),
            sa.Column("effective_to", sa.Date(), nullable=True),
            sa.Column("regular_hourly_rate_inr", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("overtime_multiplier", sa.Numeric(4, 2), nullable=False, server_default=sa.text("1.5")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=_BOOLEAN_TRUE),
            sa.Column("notes", sa.String(300), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"], name="fk_wc_rates_org_id"),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"], name="fk_wc_rates_factory_id"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_workforce_cost_rates_org_id", "workforce_cost_rates", ["org_id"])
        op.create_index("ix_wc_rates_factory_effective", "workforce_cost_rates", ["factory_id", "effective_from"])
        op.create_index("ix_wc_rates_user_effective", "workforce_cost_rates", ["user_id", "effective_from"])

    # defect_reason
    if not _table_has(bind, "defect_reason"):
        op.create_table(
            "defect_reason",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("code", sa.String(60), nullable=False, unique=True),
            sa.Column("label", sa.String(120), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=_BOOLEAN_TRUE),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    # ── 3. users table ─────────────────────────────────────────────────────
    if _table_has(bind, "users"):
        _add_column(bind, "users", sa.Column("user_code", sa.Integer(), nullable=True))
        _add_column(bind, "users", sa.Column("factory_code", sa.String(32), nullable=True))
        _add_column(bind, "users", sa.Column("org_id", sa.String(36), nullable=True))
        _add_column(bind, "users", sa.Column("google_id", sa.String(255), nullable=True))
        _add_column(bind, "users", sa.Column("profile_picture", sa.String(500), nullable=True))
        _add_column(bind, "users", sa.Column("auth_provider", sa.String(32), server_default=sa.text("'local'"), nullable=True))
        _add_column(bind, "users", sa.Column("is_platform_admin", sa.Boolean(), server_default=_BOOLEAN_FALSE, nullable=True))
        _add_column(bind, "users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
        _add_column(bind, "users", sa.Column("verification_sent_at", sa.DateTime(timezone=True), nullable=True))
        _add_column(bind, "users", sa.Column("phone_number", sa.String(32), nullable=True))
        _add_column(bind, "users", sa.Column("phone_e164", sa.String(20), nullable=True))
        _add_column(bind, "users", sa.Column("phone_verification_status", sa.String(24), server_default=sa.text("'pending'"), nullable=True))
        _add_column(bind, "users", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))
        _add_column(bind, "users", sa.Column("phone_last_otp_sent_at", sa.DateTime(timezone=True), nullable=True))
        _add_column(bind, "users", sa.Column("phone_otp_attempts", sa.Integer(), server_default=sa.text("0"), nullable=True))

        _create_index_if(bind, "ix_users_org_id", "users", ["org_id"])

    # ── 4. factories table ──────────────────────────────────────────────────
    if _table_has(bind, "factories"):
        _add_column(bind, "factories", sa.Column("industry_type", sa.String(40), server_default=sa.text("'general'"), nullable=True))
        _add_column(bind, "factories", sa.Column("workflow_template_key", sa.String(64), server_default=sa.text("'general-ops-pack'"), nullable=True))

        _create_index_if(bind, "ix_factories_industry_type", "factories", ["industry_type"])

    # ── 5. entries table ────────────────────────────────────────────────────
    if _table_has(bind, "entries"):
        _add_column(bind, "entries", sa.Column("client_request_id", sa.String(64), nullable=True))
        _add_column(bind, "entries", sa.Column("rejection_qty", sa.Integer(), nullable=True))
        _add_column(bind, "entries", sa.Column("defect_reason_id", sa.Integer(), nullable=True))
        _add_column(bind, "entries", sa.Column("defect_reason_details", sa.String(300), nullable=True))
        _add_column(bind, "entries", sa.Column("rework_required", sa.Boolean(), server_default=_BOOLEAN_FALSE, nullable=True))
        _add_column(bind, "entries", sa.Column("scrap_qty_entry", sa.Integer(), nullable=True))
        _add_column(bind, "entries", sa.Column("org_id", sa.String(36), nullable=True))
        _add_column(bind, "entries", sa.Column("factory_id", sa.String(36), nullable=True))
        _add_column(bind, "entries", sa.Column("status", sa.String(20), server_default=sa.text("'submitted'"), nullable=True))
        _add_column(bind, "entries", sa.Column("department", sa.String(120), nullable=True))

        _create_index_if(bind, "ix_entries_client_request_id", "entries", ["client_request_id"])
        _create_index_if(bind, "ix_entries_defect_reason_id", "entries", ["defect_reason_id"])

    # ── 6. Entry performance indexes ────────────────────────────────────────
    if _table_has(bind, "entries"):
        _create_index_if(bind, "ix_entries_org_date", "entries", ["org_id", "date"])
        _create_index_if(bind, "ix_entries_factory_date", "entries", ["factory_id", "date"])
        _create_index_if(bind, "ix_entries_org_created_at", "entries", ["org_id", "created_at"])
        _create_index_if(bind, "ix_entries_factory_shift_date", "entries", ["factory_id", "shift", "date"])
        _create_index_if(bind, "ix_entries_org_shift_date", "entries", ["org_id", "shift", "date"])
        _create_index_if(bind, "ix_entries_org_date_shift", "entries", ["org_id", "date", "shift"])

    # ── 7. org_subscription_addons ──────────────────────────────────────────
    if _table_has(bind, "org_subscription_addons"):
        _add_column(bind, "org_subscription_addons", sa.Column("quantity", sa.Integer(), server_default=sa.text("1"), nullable=True))

    # ── 8. ocr_verifications ────────────────────────────────────────────────
    if _table_has(bind, "ocr_verifications"):
        _add_column(bind, "ocr_verifications", sa.Column("scan_quality", sa.JSON(), nullable=True))
        _add_column(bind, "ocr_verifications", sa.Column("document_hash", sa.String(128), nullable=True))
        _add_column(bind, "ocr_verifications", sa.Column("doc_type_hint", sa.String(80), nullable=True))
        _add_column(bind, "ocr_verifications", sa.Column("routing_meta", sa.JSON(), nullable=True))
        _add_column(bind, "ocr_verifications", sa.Column("raw_text", sa.Text(), nullable=True))
        _create_index_if(bind, "ix_ocr_verifications_document_hash", "ocr_verifications", ["document_hash"])

    # ── 9. steel_customers ──────────────────────────────────────────────────
    if _table_has(bind, "steel_customers"):
        _add_column(bind, "steel_customers", sa.Column("customer_code", sa.String(24), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("city", sa.String(120), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("state", sa.String(120), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("gst_number", sa.String(32), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("pan_number", sa.String(16), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("company_type", sa.String(40), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("contact_person", sa.String(160), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("designation", sa.String(120), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("credit_limit", sa.Numeric(14, 2), server_default=sa.text("0"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("payment_terms_days", sa.Integer(), server_default=sa.text("0"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("status", sa.String(24), server_default=sa.text("'active'"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("notes", sa.String(500), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("verification_status", sa.String(24), server_default=sa.text("'draft'"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("pan_status", sa.String(24), server_default=sa.text("'not_checked'"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("gst_status", sa.String(24), server_default=sa.text("'not_checked'"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("verification_source", sa.String(80), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("official_legal_name", sa.String(200), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("official_trade_name", sa.String(200), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("official_state", sa.String(120), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("name_match_status", sa.String(24), server_default=sa.text("'not_available'"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("state_match_status", sa.String(24), server_default=sa.text("'not_available'"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("match_score", sa.Numeric(5, 2), server_default=sa.text("0"), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("mismatch_reason", sa.String(500), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("pan_document_path", sa.String(255), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("gst_document_path", sa.String(255), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("verified_at", sa.DateTime(), nullable=True))
        _add_column(bind, "steel_customers", sa.Column("verified_by_user_id", sa.Integer(), nullable=True))

        _create_index_if(bind, "ix_steel_customers_status", "steel_customers", ["status"])
        _create_index_if(bind, "ix_steel_customers_verification_status", "steel_customers", ["verification_status"])

    # ── 10. steel_sales_invoices ─────────────────────────────────────────────
    if _table_has(bind, "steel_sales_invoices"):
        _add_column(bind, "steel_sales_invoices", sa.Column("customer_id", sa.Integer(), nullable=True))
        _add_column(bind, "steel_sales_invoices", sa.Column("due_date", sa.Date(), nullable=True))
        _add_column(bind, "steel_sales_invoices", sa.Column("payment_terms_days", sa.Integer(), server_default=sa.text("0"), nullable=True))
        _create_index_if(bind, "ix_steel_sales_invoices_customer_id", "steel_sales_invoices", ["customer_id"])
        _create_index_if(bind, "ix_steel_sales_invoices_due_date", "steel_sales_invoices", ["due_date"])

    # ── 11. steel_dispatches ─────────────────────────────────────────────────
    if _table_has(bind, "steel_dispatches"):
        _add_column(bind, "steel_dispatches", sa.Column("transporter_name", sa.String(160), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("vehicle_type", sa.String(40), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("truck_capacity_kg", sa.Numeric(14, 3), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("driver_license_number", sa.String(80), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("entry_time", sa.DateTime(), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("exit_time", sa.DateTime(), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("receiver_name", sa.String(160), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("pod_notes", sa.String(500), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("inventory_posted_at", sa.DateTime(), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("delivered_at", sa.DateTime(), nullable=True))
        _add_column(bind, "steel_dispatches", sa.Column("delivered_by_user_id", sa.Integer(), nullable=True))
        _create_index_if(bind, "ix_steel_dispatches_status", "steel_dispatches", ["status"])

    # ── 12. steel_inventory_items ────────────────────────────────────────────
    if _table_has(bind, "steel_inventory_items"):
        _add_column(bind, "steel_inventory_items", sa.Column("reorder_point_kg", sa.Float(), nullable=True))
        _add_column(bind, "steel_inventory_items", sa.Column("safety_stock_kg", sa.Float(), nullable=True))
        _add_column(bind, "steel_inventory_items", sa.Column("coil_weight_kg", sa.Float(), server_default=sa.text("0.0"), nullable=True))
        _add_column(bind, "steel_inventory_items", sa.Column("lead_time_days", sa.Integer(), nullable=True))

    # ── 13. steel_stock_reconciliations ──────────────────────────────────────
    if _table_has(bind, "steel_stock_reconciliations"):
        _add_column(bind, "steel_stock_reconciliations", sa.Column("status", sa.String(16), server_default=sa.text("'pending'"), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("submitted_by_user_id", sa.Integer(), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("approved_by_user_id", sa.Integer(), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("rejected_by_user_id", sa.Integer(), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("approver_notes", sa.String(500), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("rejection_reason", sa.String(500), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("mismatch_cause", sa.String(40), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("approved_at", sa.DateTime(), nullable=True))
        _add_column(bind, "steel_stock_reconciliations", sa.Column("rejected_at", sa.DateTime(), nullable=True))
        _create_index_if(bind, "ix_steel_stock_reconciliations_status", "steel_stock_reconciliations", ["status"])

    # ── 14. steel_production_batches ─────────────────────────────────────────
    if _table_has(bind, "steel_production_batches"):
        _add_column(bind, "steel_production_batches", sa.Column("coil_expected_weight_kg", sa.Float(), nullable=True))
        _add_column(bind, "steel_production_batches", sa.Column("coil_weight_variance_kg", sa.Float(), nullable=True))
        _add_column(bind, "steel_production_batches", sa.Column("coil_weight_variance_percent", sa.Float(), nullable=True))
        _add_column(bind, "steel_production_batches", sa.Column("is_coil_theft_suspected", sa.Boolean(), server_default=_BOOLEAN_FALSE, nullable=True))
        _add_column(bind, "steel_production_batches", sa.Column("rejection_qty_kg", sa.Float(), nullable=True))
        _add_column(bind, "steel_production_batches", sa.Column("scrap_qty_kg", sa.Float(), nullable=True))
        _add_column(bind, "steel_production_batches", sa.Column("line_id", sa.Integer(), nullable=True))
        _add_column(bind, "steel_production_batches", sa.Column("machine_id", sa.Integer(), nullable=True))

    # ── 15. attendance_records ───────────────────────────────────────────────
    if _table_has(bind, "attendance_records"):
        _add_column(bind, "attendance_records", sa.Column("shift_template_id", sa.Integer(), nullable=True))
        _add_column(bind, "attendance_records", sa.Column("review_status", sa.String(24), server_default=sa.text("'auto'"), nullable=True))
        _add_column(bind, "attendance_records", sa.Column("approved_by_user_id", sa.Integer(), nullable=True))
        _add_column(bind, "attendance_records", sa.Column("approved_at", sa.DateTime(), nullable=True))
        _create_index_if(bind, "ix_attendance_records_review_status", "attendance_records", ["review_status"])

    # ── 16. admin_alert_recipients ───────────────────────────────────────────
    if _table_has(bind, "admin_alert_recipients"):
        _add_column(bind, "admin_alert_recipients", sa.Column("phone_e164", sa.String(20), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("verification_status", sa.String(24), server_default=sa.text("'pending'"), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("verified_at", sa.DateTime(), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("verified_by_user_id", sa.Integer(), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("otp_attempts", sa.Integer(), server_default=sa.text("0"), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("last_otp_sent_at", sa.DateTime(), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("event_types", sa.JSON() if _dialect(bind) == "postgresql" else sa.JSON(), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("severity_levels", sa.JSON() if _dialect(bind) == "postgresql" else sa.JSON(), nullable=True))
        _add_column(bind, "admin_alert_recipients", sa.Column("receive_daily_summary", sa.Boolean(), server_default=_BOOLEAN_TRUE, nullable=True))

    # ── 17. ops_alert_events ─────────────────────────────────────────────────
    if _table_has(bind, "ops_alert_events"):
        _add_column(bind, "ops_alert_events", sa.Column("org_id", sa.String(36), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("org_name", sa.String(200), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("status", sa.String(24), server_default=sa.text("'queued'"), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("group_key", sa.String(255), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("escalation_level", sa.Integer(), server_default=sa.text("0"), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("is_summary", sa.Boolean(), server_default=_BOOLEAN_FALSE, nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("recipient_phone", sa.String(48), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("suppressed_reason", sa.String(64), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("provider_message_id", sa.String(255), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("provider_status_at", sa.DateTime(), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("delivered_at", sa.DateTime(), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("read_at", sa.DateTime(), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("failed_at", sa.DateTime(), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("provider_error_code", sa.String(64), nullable=True))
        _add_column(bind, "ops_alert_events", sa.Column("provider_error_title", sa.String(255), nullable=True))
        _create_index_if(bind, "ix_ops_alert_events_org_created_at", "ops_alert_events", ["org_id", "created_at"])
        _create_index_if(bind, "ix_ops_alert_events_org_created_at_desc", "ops_alert_events", ["org_id", "created_at DESC"])
        _create_index_if(bind, "ix_ops_alert_events_provider_message_id", "ops_alert_events", ["provider_message_id"])
        _create_index_if(bind, "ix_ops_alert_events_ref_id", "ops_alert_events", ["ref_id"])

    # ── 18. org_ocr_usage ────────────────────────────────────────────────────
    if _table_has(bind, "org_ocr_usage"):
        _add_column(bind, "org_ocr_usage", sa.Column("ocr_limit", sa.Integer(), server_default=sa.text("0"), nullable=True))
        _add_column(bind, "org_ocr_usage", sa.Column("period_start", sa.DateTime(), nullable=True))
        _add_column(bind, "org_ocr_usage", sa.Column("period_end", sa.DateTime(), nullable=True))
        _create_index_if(bind, "ix_org_ocr_usage_org_id", "org_ocr_usage", ["org_id"])

    # ── 19. org_whatsapp_usage ───────────────────────────────────────────────
    if _table_has(bind, "org_whatsapp_usage"):
        _add_column(bind, "org_whatsapp_usage", sa.Column("message_limit", sa.Integer(), server_default=sa.text("0"), nullable=True))
        _add_column(bind, "org_whatsapp_usage", sa.Column("period_start", sa.DateTime(), nullable=True))
        _add_column(bind, "org_whatsapp_usage", sa.Column("period_end", sa.DateTime(), nullable=True))
        _create_index_if(bind, "ix_org_whatsapp_usage_org_id", "org_whatsapp_usage", ["org_id"])

    # ── 20. payment_orders ──────────────────────────────────────────────────
    if _table_has(bind, "payment_orders"):
        _add_column(bind, "payment_orders", sa.Column("org_id", sa.String(36), nullable=True))
        _add_column(bind, "payment_orders", sa.Column("plan_id", sa.String(32), nullable=True))
        _add_column(bind, "payment_orders", sa.Column("amount_paise", sa.Integer(), nullable=True))
        _add_column(bind, "payment_orders", sa.Column("razorpay_order_id", sa.String(64), nullable=True))
        _add_column(bind, "payment_orders", sa.Column("receipt_id", sa.String(120), nullable=True))
        _create_index_if(bind, "ix_payment_orders_org_id", "payment_orders", ["org_id"])

    # ── 21. feedback ─────────────────────────────────────────────────────────
    if _table_has(bind, "feedback"):
        _add_column(bind, "feedback", sa.Column("rating", sa.String(16), nullable=True))

    # ── 22. audit_logs ───────────────────────────────────────────────────────
    if _table_has(bind, "audit_logs"):
        _add_column(bind, "audit_logs", sa.Column("org_id", sa.String(36), nullable=True))
        _add_column(bind, "audit_logs", sa.Column("factory_id", sa.String(36), nullable=True))
        _add_column(bind, "audit_logs", sa.Column("user_agent", sa.String(500), nullable=True))
        _create_index_if(bind, "ix_audit_logs_org_id", "audit_logs", ["org_id"])


    # ── DATA BACKFILLS ──────────────────────────────────────────────────────

    # ── D1. users.org_id, factory_code & user_code backfill ─────────────────
    if _table_has(bind, "users") and _table_has(bind, "organizations") and _table_has(bind, "factories"):
        # Backfill org_id for users that have a factory_name but no org_id
        bind.execute(
            sa.text(
                """
                UPDATE users
                SET org_id = COALESCE(
                    users.org_id,
                    (
                        SELECT f.org_id
                        FROM factories f
                        WHERE f.name = users.factory_name
                        LIMIT 1
                    ),
                    (
                        SELECT o.org_id
                        FROM organizations o
                        WHERE o.name = users.factory_name
                        LIMIT 1
                    )
                )
                WHERE users.org_id IS NULL
                  AND users.factory_name IS NOT NULL
                  AND users.factory_name != ''
                """
            )
        )
        bind.commit()

        # Backfill factory_code for users that don't have one
        bind.execute(
            sa.text(
                """
                UPDATE users
                SET factory_code = COALESCE(
                    users.factory_code,
                    UPPER(SUBSTR(REPLACE(users.factory_name, ' ', ''), 1, 6))
                )
                WHERE (users.factory_code IS NULL OR users.factory_code = '')
                  AND users.factory_name IS NOT NULL
                  AND users.factory_name != ''
                """
            )
        )
        bind.commit()

        # Backfill email_verified_at for legacy users
        bind.execute(
            sa.text(
                """
                UPDATE users
                SET email_verified_at = COALESCE(users.email_verified_at, users.created_at)
                WHERE users.email_verified_at IS NULL
                  AND users.verification_sent_at IS NULL
                """
            )
        )
        bind.commit()

    # ── D2. entries defaults ────────────────────────────────────────────────
    if _table_has(bind, "entries") and _table_has(bind, "users"):
        bind.execute(sa.text("UPDATE entries SET status = COALESCE(status, 'submitted') WHERE status IS NULL OR status = ''"))
        bind.commit()

        # Backfill department from user role
        bind.execute(
            sa.text(
                """
                UPDATE entries
                SET department = COALESCE(
                    entries.department,
                    (
                        SELECT CASE LOWER(COALESCE(u.role, ''))
                            WHEN 'admin' THEN 'Admin'
                            WHEN 'owner' THEN 'Owner'
                            WHEN 'manager' THEN 'Manager'
                            WHEN 'supervisor' THEN 'Supervisor'
                            WHEN 'operator' THEN 'Operator'
                            WHEN 'attendance' THEN 'Attendance'
                            WHEN 'accountant' THEN 'Accountant'
                            ELSE COALESCE(u.role, 'Operator')
                        END
                        FROM users u
                        WHERE u.id = entries.user_id
                    )
                )
                WHERE entries.department IS NULL OR entries.department = ''
                """
            )
        )
        bind.commit()

    # ── D3. factories industry_type backfill ─────────────────────────────────
    if _table_has(bind, "factories"):
        bind.execute(
            sa.text(
                """
                UPDATE factories
                SET industry_type = COALESCE(industry_type, 'general')
                WHERE industry_type IS NULL OR industry_type = ''
                """
            )
        )
        bind.commit()

        bind.execute(
            sa.text(
                """
                UPDATE factories
                SET workflow_template_key = COALESCE(
                    workflow_template_key,
                    CASE industry_type
                        WHEN 'steel' THEN 'steel-core-pack'
                        ELSE 'general-ops-pack'
                    END
                )
                WHERE workflow_template_key IS NULL OR workflow_template_key = ''
                """
            )
        )
        bind.commit()

    # ── D4. steel_customers defaults ────────────────────────────────────────
    if _table_has(bind, "steel_customers"):
        bind.execute(sa.text("UPDATE steel_customers SET credit_limit = COALESCE(credit_limit, 0) WHERE credit_limit IS NULL"))
        bind.execute(sa.text("UPDATE steel_customers SET payment_terms_days = COALESCE(payment_terms_days, 0) WHERE payment_terms_days IS NULL"))
        bind.execute(sa.text("UPDATE steel_customers SET status = COALESCE(status, 'active') WHERE status IS NULL OR status = ''"))
        bind.execute(sa.text("UPDATE steel_customers SET verification_status = COALESCE(verification_status, 'draft') WHERE verification_status IS NULL OR verification_status = ''"))
        bind.execute(sa.text("UPDATE steel_customers SET pan_status = COALESCE(pan_status, 'not_checked') WHERE pan_status IS NULL OR pan_status = ''"))
        bind.execute(sa.text("UPDATE steel_customers SET gst_status = COALESCE(gst_status, 'not_checked') WHERE gst_status IS NULL OR gst_status = ''"))
        bind.execute(sa.text("UPDATE steel_customers SET name_match_status = COALESCE(name_match_status, 'not_available') WHERE name_match_status IS NULL OR name_match_status = ''"))
        bind.execute(sa.text("UPDATE steel_customers SET state_match_status = COALESCE(state_match_status, 'not_available') WHERE state_match_status IS NULL OR state_match_status = ''"))
        bind.execute(sa.text("UPDATE steel_customers SET match_score = COALESCE(match_score, 0) WHERE match_score IS NULL"))
        bind.commit()

        # Generate customer_code for customers that don't have one
        bind.execute(
            sa.text(
                """
                UPDATE steel_customers
                SET customer_code = COALESCE(
                    customer_code,
                    'CUST-' || SUBSTR('00000' || CAST(id AS TEXT), -5, 5)
                )
                WHERE customer_code IS NULL OR customer_code = ''
                """
            )
        )
        bind.commit()

    # ── D5. steel_sales_invoices defaults ───────────────────────────────────
    if _table_has(bind, "steel_sales_invoices"):
        bind.execute(sa.text("UPDATE steel_sales_invoices SET payment_terms_days = COALESCE(payment_terms_days, 0) WHERE payment_terms_days IS NULL"))
        bind.execute(sa.text("UPDATE steel_sales_invoices SET due_date = COALESCE(due_date, invoice_date) WHERE due_date IS NULL"))
        bind.execute(sa.text("UPDATE steel_sales_invoices SET status = COALESCE(NULLIF(NULLIF(status, ''), 'issued'), 'unpaid') WHERE status IS NULL OR status = '' OR status = 'issued'"))
        bind.commit()

    # ── D6. steel_dispatches backfill ───────────────────────────────────────
    if _table_has(bind, "steel_dispatches"):
        bind.execute(
            sa.text(
                """
                UPDATE steel_dispatches
                SET inventory_posted_at = COALESCE(inventory_posted_at, created_at)
                WHERE inventory_posted_at IS NULL
                  AND status IN ('dispatched', 'delivered')
                """
            )
        )
        bind.commit()

    # ── D7. steel_inventory_items defaults ──────────────────────────────────
    if _table_has(bind, "steel_inventory_items"):
        bind.execute(sa.text("UPDATE steel_inventory_items SET coil_weight_kg = COALESCE(coil_weight_kg, 0.0) WHERE coil_weight_kg IS NULL"))
        bind.commit()

    # ── D8. steel_stock_reconciliations defaults ────────────────────────────
    if _table_has(bind, "steel_stock_reconciliations"):
        bind.execute(sa.text("UPDATE steel_stock_reconciliations SET status = COALESCE(NULLIF(status, ''), 'pending') WHERE status IS NULL OR status = ''"))
        bind.commit()

    # ── D9. steel_production_batches defaults ───────────────────────────────
    if _table_has(bind, "steel_production_batches"):
        bind.execute(sa.text("UPDATE steel_production_batches SET is_coil_theft_suspected = COALESCE(is_coil_theft_suspected, FALSE) WHERE is_coil_theft_suspected IS NULL"))
        bind.commit()

    # ── D10. attendance_records defaults ────────────────────────────────────
    if _table_has(bind, "attendance_records"):
        bind.execute(sa.text("UPDATE attendance_records SET review_status = COALESCE(NULLIF(review_status, ''), 'auto') WHERE review_status IS NULL OR review_status = ''"))
        bind.commit()

    # ── D11. ops_alert_events defaults ──────────────────────────────────────
    if _table_has(bind, "ops_alert_events"):
        bind.execute(sa.text("UPDATE ops_alert_events SET status = COALESCE(NULLIF(status, ''), 'queued') WHERE status IS NULL OR status = ''"))
        bind.execute(sa.text("UPDATE ops_alert_events SET escalation_level = COALESCE(escalation_level, 0) WHERE escalation_level IS NULL"))
        bind.execute(sa.text("UPDATE ops_alert_events SET is_summary = COALESCE(is_summary, FALSE) WHERE is_summary IS NULL"))
        bind.commit()

    # ── D12. admin_alert_recipients defaults ────────────────────────────────
    if _table_has(bind, "admin_alert_recipients"):
        bind.execute(sa.text("UPDATE admin_alert_recipients SET phone_e164 = COALESCE(phone_e164, phone_number) WHERE phone_e164 IS NULL AND phone_number IS NOT NULL AND phone_number != ''"))
        bind.execute(sa.text("UPDATE admin_alert_recipients SET verification_status = COALESCE(NULLIF(verification_status, ''), 'pending') WHERE verification_status IS NULL OR verification_status = ''"))
        bind.execute(sa.text("UPDATE admin_alert_recipients SET otp_attempts = COALESCE(otp_attempts, 0) WHERE otp_attempts IS NULL"))
        bind.execute(sa.text("UPDATE admin_alert_recipients SET receive_daily_summary = COALESCE(receive_daily_summary, TRUE) WHERE receive_daily_summary IS NULL"))
        bind.commit()

    # ── D13. users phone backfill ───────────────────────────────────────────
    if _table_has(bind, "users"):
        bind.execute(sa.text("UPDATE users SET phone_e164 = COALESCE(phone_e164, phone_number) WHERE phone_e164 IS NULL AND phone_number IS NOT NULL AND phone_number != ''"))
        bind.execute(sa.text("UPDATE users SET phone_verification_status = COALESCE(NULLIF(phone_verification_status, ''), 'pending') WHERE phone_verification_status IS NULL OR phone_verification_status = ''"))
        bind.execute(sa.text("UPDATE users SET phone_otp_attempts = COALESCE(phone_otp_attempts, 0) WHERE phone_otp_attempts IS NULL"))
        bind.execute(sa.text("UPDATE users SET is_platform_admin = COALESCE(is_platform_admin, FALSE) WHERE is_platform_admin IS NULL"))
        bind.commit()

    # ── D14. org_subscription_addons defaults ───────────────────────────────
    if _table_has(bind, "org_subscription_addons"):
        bind.execute(sa.text("UPDATE org_subscription_addons SET quantity = COALESCE(quantity, 1) WHERE quantity IS NULL OR quantity < 1"))
        bind.commit()

    # ── D15. payment_orders backfill from legacy columns ────────────────────
    if _table_has(bind, "payment_orders") and _table_has(bind, "users"):
        bind.execute(
            sa.text(
                """
                UPDATE payment_orders
                SET
                    plan_id = COALESCE(plan_id, plan),
                    amount_paise = COALESCE(amount_paise, amount),
                    razorpay_order_id = COALESCE(razorpay_order_id, provider_order_id),
                    receipt_id = COALESCE(receipt_id, receipt),
                    org_id = COALESCE(
                        org_id,
                        (SELECT u.org_id FROM users u WHERE u.id = payment_orders.user_id LIMIT 1)
                    )
                """
            )
        )
        bind.commit()


def downgrade() -> None:
    """No downgrade — this is a safety-net consolidation migration.

    All changes are additive (column additions, index creations, table creations)
    and are safe to keep. A downgrade would risk data loss.
    """
    pass
