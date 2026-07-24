"""Validate that the current database schema matches the SQLAlchemy model definitions.

Run against any environment (local, staging, production) to detect schema drift:
  python scripts/validate_schema_drift.py

Exits with code 0 if no drift is detected, non-zero with a detailed report
if any tables, columns, or constraints are out of sync.

Designed to be run in CI after migrations, or as a pre-deploy check.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine, create_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger("schema_drift")


class SchemaDriftError(Exception):
    """Raised when schema drift is detected."""


def _bootstrap_models() -> None:
    """Import all model modules so SQLAlchemy metadata is fully loaded."""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    sys.path.insert(0, str(backend_dir.parent))

    # Required imports to register all tables in Base.metadata
    # Keep this in sync with backend/database.py → init_db()
    import backend.models.alert  # noqa: F401
    import backend.models.entry  # noqa: F401
    import backend.models.attendance_record  # noqa: F401
    import backend.models.attendance_event  # noqa: F401
    import backend.models.attendance_regularization  # noqa: F401
    import backend.models.employee_profile  # noqa: F401
    import backend.models.organization  # noqa: F401
    import backend.models.factory  # noqa: F401
    import backend.models.user_factory_role  # noqa: F401
    import backend.models.factory_settings  # noqa: F401
    import backend.models.report  # noqa: F401
    import backend.models.user  # noqa: F401
    import backend.models.ocr_template  # noqa: F401
    import backend.models.ocr_verification  # noqa: F401
    import backend.models.ocr_usage  # noqa: F401
    import backend.models.user_plan  # noqa: F401
    import backend.models.feature_usage  # noqa: F401
    import backend.models.org_feature_usage  # noqa: F401
    import backend.models.email_queue  # noqa: F401
    import backend.models.subscription  # noqa: F401
    import backend.models.org_subscription_addon  # noqa: F401
    import backend.models.invoice  # noqa: F401
    import backend.models.webhook_event  # noqa: F401
    import backend.models.refresh_token  # noqa: F401
    import backend.models.org_ocr_usage  # noqa: F401
    import backend.models.org_whatsapp_usage  # noqa: F401
    import backend.models.payment_order  # noqa: F401
    import backend.models.intelligence_request  # noqa: F401
    import backend.models.intelligence_stage_usage  # noqa: F401
    import backend.models.ai_result_cache  # noqa: F401
    import backend.models.ai_usage_log  # noqa: F401
    import backend.models.steel_inventory_item  # noqa: F401
    import backend.models.steel_inventory_transaction  # noqa: F401
    import backend.models.steel_stock_reconciliation  # noqa: F401
    import backend.models.steel_machine_downtime_event  # noqa: F401
    import backend.models.steel_maintenance_task  # noqa: F401
    import backend.models.steel_vendor  # noqa: F401
    import backend.models.steel_vendor_bill  # noqa: F401
    import backend.models.steel_vendor_bill_line  # noqa: F401
    import backend.models.steel_vendor_payment  # noqa: F401
    import backend.models.steel_vendor_payment_allocation  # noqa: F401
    import backend.models.steel_expense  # noqa: F401
    import backend.models.steel_cash_account  # noqa: F401
    import backend.models.steel_cash_ledger_entry  # noqa: F401
    import backend.models.steel_production_batch  # noqa: F401
    import backend.models.steel_production_line  # noqa: F401
    import backend.models.steel_machine  # noqa: F401
    import backend.models.steel_sales_invoice  # noqa: F401
    import backend.models.steel_sales_invoice_line  # noqa: F401
    import backend.models.steel_customer  # noqa: F401
    import backend.models.steel_customer_follow_up_task  # noqa: F401
    import backend.models.steel_customer_payment  # noqa: F401
    import backend.models.steel_customer_payment_allocation  # noqa: F401
    import backend.models.steel_dispatch  # noqa: F401
    import backend.models.steel_dispatch_line  # noqa: F401
    import backend.models.password_reset_token  # noqa: F401
    import backend.models.auth_user  # noqa: F401
    import backend.models.auth_session  # noqa: F401
    import backend.models.auth_password_reset  # noqa: F401
    import backend.models.auth_audit_log  # noqa: F401
    import backend.models.shift_template  # noqa: F401
    import backend.models.email_verification_token  # noqa: F401
    import backend.models.ops_alert_event  # noqa: F401
    import backend.models.pending_registration  # noqa: F401
    import backend.models.admin_alert_recipient  # noqa: F401
    import backend.models.ops_alert_daily_summary  # noqa: F401
    import backend.models.phone_verification  # noqa: F401
    import backend.models.feedback  # noqa: F401
    import backend.models.approval_instance  # noqa: F401
    import backend.models.workforce_cost_rate  # noqa: F401
    import backend.models.defect_reason  # noqa: F401
    import backend.models.idempotency_key  # noqa: F401
    import backend.models.rate_limit  # noqa: F401


def _get_db_url() -> str:
    """Get the database URL from environment or default to SQLite for local dev."""
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("DB_URL")
        or "sqlite:///./dev.db"
    )
    # Handle Render-style postgres:// URLs (SQLAlchemy requires postgresql://)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def _create_engine_from_url(url: str) -> Engine:
    """Create a SQLAlchemy engine for inspection, with safe defaults."""
    connect_args: dict[str, Any] = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        future=True,
    )


# ── Comparison Engine ────────────────────────────────────────────────────────


def _get_model_tables() -> dict[str, Any]:
    """Return registered SQLAlchemy table objects from metadata."""
    from backend.database import Base
    return {name: table for name, table in Base.metadata.tables.items()}


def _get_db_tables(inspector: Any) -> set[str]:
    """Return set of table names currently in the database."""
    return set(inspector.get_table_names())


def _normalize_type(raw: str) -> str:
    """Normalize a SQL type string for comparison (strip length/params)."""
    raw = raw.lower().strip()
    # Strip parameterised types like VARCHAR(255) → VARCHAR
    import re
    raw = re.sub(r"\(.*?\)", "", raw).strip()
    # Normalise common aliases
    mapping = {
        "integer": "integer",
        "int": "integer",
        "bigint": "bigint",
        "smallint": "smallint",
        "character varying": "varchar",
        "character": "char",
        "boolean": "boolean",
        "bool": "boolean",
        "double precision": "float",
        "real": "float",
        "numeric": "numeric",
        "timestamp without time zone": "timestamp",
        "timestamp with time zone": "timestamptz",
        "date": "date",
        "time without time zone": "time",
        "time with time zone": "timetz",
        "datetime": "datetime",
        "interval": "interval",
        "json": "json",
        "jsonb": "jsonb",
        "uuid": "uuid",
        "text": "text",
        "clob": "text",
        "blob": "blob",
        "bytea": "blob",
        "largebinary": "blob",
        "array": "array",
    }
    return mapping.get(raw, raw)


def _compare_columns(
    table_name: str,
    model_columns: dict[str, Any],
    db_columns: list[dict[str, Any]],
    *,
    skip_type_check: bool = False,
) -> list[str]:
    """Compare columns between model and database, returning drift messages."""
    drifts: list[str] = []
    db_col_map = {col["name"]: col for col in db_columns}

    # Check for missing columns
    for col_name in sorted(model_columns):
        if col_name not in db_col_map:
            drifts.append(
                f"  [{table_name}] Missing column in DB: '{col_name}' "
                f"(type: {_normalize_type(str(model_columns[col_name].type))})"
            )

    # Check for extra columns
    for col_name in sorted(db_col_map):
        if col_name not in model_columns:
            drifts.append(
                f"  [{table_name}] Extra column in DB not in model: '{col_name}' "
                f"(type: {_normalize_type(str(db_col_map[col_name]['type']))})"
            )

    # Check type mismatches (skip for sqlite which doesn't enforce types)
    if not skip_type_check:
        for col_name in sorted(set(model_columns) & set(db_col_map)):
            model_col = model_columns[col_name]
            model_type = _normalize_type(str(model_col.type))
            db_type_raw = str(db_col_map[col_name]["type"])
            db_type = _normalize_type(db_type_raw)

            # Skip columns using custom types (EncryptedString etc.)
            if model_type in ("encryptedstring", "encrypted_string"):
                continue

            if model_type != db_type and not (
                model_type in ("integer", "bigint") and db_type in ("integer", "bigint")
            ):
                drifts.append(
                    f"  [{table_name}] Type mismatch '{col_name}': "
                    f"model={model_type}, db={db_type}"
                )

    return drifts


def _compare_indexes(
    table_name: str,
    model_table: Any,
    inspector: Any,
    drifts: list[str],
) -> list[str]:
    """Compare indexes between model and database (both directions)."""
    try:
        db_indexes = inspector.get_indexes(table_name)
        db_index_names = {idx["name"] for idx in db_indexes if idx.get("name")}
    except Exception:
        # Some engines don't support index inspection for all table types
        return drifts

    # Collect model indexes
    model_index_names = set()
    for idx in model_table.indexes:
        if idx.name:
            model_index_names.add(idx.name)

    # Check for missing indexes (model has, DB missing)
    for idx_name in sorted(model_index_names - db_index_names):
        drifts.append(
            f"  [{table_name}] Missing index in DB: '{idx_name}'"
        )

    # Check for extra indexes (DB has, model missing — from raw migrations)
    for idx_name in sorted(db_index_names - model_index_names):
        # Skip auto-generated indexes for FK columns
        if idx_name and idx_name.startswith("ix_"):
            continue
        drifts.append(
            f"  [{table_name}] Extra index in DB not in model: '{idx_name}'"
        )

    return drifts


def _compare_constraints(
    table_name: str,
    model_table: Any,
    inspector: Any,
    drifts: list[str],
) -> list[str]:
    """Compare unique constraints, foreign keys, and check constraints."""
    # Unique constraints
    try:
        db_unique_constraints = inspector.get_unique_constraints(table_name)
        db_unique_names = {uc["name"] for uc in db_unique_constraints if uc.get("name")}
    except Exception:
        db_unique_names = set()

    model_unique_names = set()
    for constraint in model_table.constraints:
        if constraint.name:
            model_unique_names.add(constraint.name)

    for name in sorted(model_unique_names - db_unique_names):
        drifts.append(
            f"  [{table_name}] Missing unique constraint in DB: '{name}'"
        )

    # Foreign keys (bidirectional)
    try:
        db_fks = inspector.get_foreign_keys(table_name)
        db_fk_names = {fk["name"] for fk in db_fks if fk.get("name")}
    except Exception:
        db_fk_names = set()

    model_fk_names = set()
    for fk in model_table.foreign_keys:
        if fk.constraint and fk.constraint.name:
            model_fk_names.add(fk.constraint.name)

    # Missing FKs (model has, DB missing)
    for name in sorted(model_fk_names - db_fk_names):
        drifts.append(
            f"  [{table_name}] Missing FK constraint in DB: '{name}'"
        )
    # Extra FKs (DB has, model missing)
    for name in sorted(db_fk_names - model_fk_names):
        drifts.append(
            f"  [{table_name}] Extra FK constraint in DB not in model: '{name}'"
        )

    # Check constraints (e.g. quantity_kg >= 0 on steel_inventory_transactions)
    try:
        db_check_constraints = inspector.get_check_constraints(table_name)
        for cc in db_check_constraints:
            sqltext = cc.get("sqltext", "")
            name = cc.get("name", "")
            if name:
                # Check if model has a matching constraint
                model_has_ck = any(
                    hasattr(c, "sqltext") for c in model_table.constraints
                )
                if not model_has_ck:
                    drifts.append(
                        f"  [{table_name}] Check constraint in DB not in model: '{name}' ({sqltext})"
                    )
    except Exception:
        pass

    return drifts


# ── Main Validation ──────────────────────────────────────────────────────────


def validate_schema(url: str | None = None) -> list[str]:
    """Validate schema against database at the given URL.

    Returns a list of drift messages (empty if no drift).
    """
    db_url = url or _get_db_url()
    engine = _create_engine_from_url(db_url)
    inspector = inspect(engine)

    _bootstrap_models()
    model_tables = _get_model_tables()
    db_tables = _get_db_tables(inspector)

    all_drifts: list[str] = []

    # Check for missing tables in DB
    for table_name in sorted(model_tables):
        if table_name not in db_tables:
            all_drifts.append(
                f"  Missing table in DB: '{table_name}'"
            )

    # Check for extra tables in DB not in models (from raw migrations)
    # Skip Alembic's version table
    db_tables_to_check = db_tables - {"alembic_version", "spatial_ref_sys"}
    for table_name in sorted(db_tables_to_check):
        if table_name not in model_tables:
            all_drifts.append(
                f"  Extra table in DB not in model: '{table_name}'"
            )

    # Determine if we should skip type checks (SQLite doesn't enforce types)
    import re as _re
    skip_type = bool(_re.match(r"^sqlite", db_url, _re.IGNORECASE))

    # Compare columns, indexes, constraints for each table
    for table_name in sorted(set(model_tables) & db_tables_to_check):
        model_table = model_tables[table_name]
        model_columns = model_table.columns
        db_columns = inspector.get_columns(table_name)

        all_drifts.extend(_compare_columns(table_name, model_columns, db_columns, skip_type_check=skip_type))
        all_drifts.extend(_compare_indexes(table_name, model_table, inspector, []))
        all_drifts.extend(_compare_constraints(table_name, model_table, inspector, []))

    return all_drifts


def main() -> int:
    """Run schema validation and exit with appropriate code."""
    url = os.getenv("DRIFT_CHECK_DATABASE_URL")
    logger.info("Validating schema against: %s", url or _get_db_url())

    try:
        drifts = validate_schema(url)
    except Exception as exc:
        logger.error("Schema validation failed: %s", exc)
        return 2

    if not drifts:
        logger.info("✅ No schema drift detected.")
        return 0

    logger.warning("\n⚠️  Schema drift detected:\n")
    for msg in drifts:
        logger.warning(msg)
    logger.warning(
        "\nTotal drifts: %d\n\n"
        "Run `alembic upgrade head` or create a new migration to resolve.",
        len(drifts),
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
