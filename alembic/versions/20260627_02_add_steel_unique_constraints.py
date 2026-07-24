"""Add unique constraints to steel models (Phase 2).

Adds the following unique constraints that were defined in model __table_args__
but may be absent in databases created before the model changes were deployed:

  - steel_cash_accounts:          (factory_id, account_name)
  - steel_vendor_bills:           (factory_id, bill_number)
  - steel_customer_payment_allocations: (payment_id, invoice_id)
  - steel_vendor_payment_allocations:   (payment_id, bill_id)

Each constraint is created idempotently — the migration inspects the live
database and only issues DDL when the constraint is missing.

Revision ID: 20260627_02
Revises: 20260627_01
Create Date: 2026-06-27
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260627_02"
down_revision: ClassVar[str] = "20260627_01"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

# ── Constraint definitions ──────────────────────────────────────────────────

_CONSTRAINTS: list[dict] = [
    {
        "name": "uq_steel_cash_accounts_factory_name",
        "table": "steel_cash_accounts",
        "columns": ["factory_id", "account_name"],
    },
    {
        "name": "uq_steel_vendor_bills_factory_bill_number",
        "table": "steel_vendor_bills",
        "columns": ["factory_id", "bill_number"],
    },
    {
        "name": "uq_steel_customer_payment_allocations_payment_invoice",
        "table": "steel_customer_payment_allocations",
        "columns": ["payment_id", "invoice_id"],
    },
    {
        "name": "uq_steel_vendor_payment_allocations_payment_bill",
        "table": "steel_vendor_payment_allocations",
        "columns": ["payment_id", "bill_id"],
    },
    {
        "name": "uq_steel_expenses_factory_expense_number",
        "table": "steel_expenses",
        "columns": ["factory_id", "expense_number"],
    },
    {
        "name": "uq_steel_customer_payments_factory_reference",
        "table": "steel_customer_payments",
        "columns": ["factory_id", "reference_number"],
    },
    {
        "name": "uq_steel_vendor_payments_factory_reference",
        "table": "steel_vendor_payments",
        "columns": ["factory_id", "reference_number"],
    },
]


# ── Helpers ─────────────────────────────────────────────────────────────────


def _constraint_exists(bind: sa.engine.Connection, table: str, name: str) -> bool:
    """Return True if *name* already exists as a unique constraint on *table*."""
    inspector = sa.inspect(bind)
    try:
        unique_constraints = inspector.get_unique_constraints(table)
    except Exception:
        return False
    for uc in unique_constraints:
        if uc.get("name") == name:
            return True
    # Some dialects expose unique constraints as indexes.
    try:
        indexes = inspector.get_indexes(table)
    except Exception:
        return False
    for idx in indexes:
        if idx.get("name") == name and idx.get("unique"):
            return True
    return False


def _deduplicate(bind: sa.engine.Connection, table: str, columns: list[str]) -> None:
    """Delete duplicate rows so the unique constraint can be created."""
    cols_sql = ", ".join(columns)
    bind.execute(
        sa.text(
            f"""
            DELETE FROM {table}
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM {table}
                GROUP BY {cols_sql}
            )
            """
        )
    )
    bind.commit()


# ── Migration ───────────────────────────────────────────────────────────────


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = sa.inspect(bind).get_table_names()

    for c in _CONSTRAINTS:
        if c["table"] not in existing_tables:
            continue
        if _constraint_exists(bind, c["table"], c["name"]):
            continue

        # Remove rows that would violate the constraint before creating it.
        _deduplicate(bind, c["table"], c["columns"])

        op.create_unique_constraint(c["name"], c["table"], c["columns"])


def downgrade() -> None:
    bind = op.get_bind()
    existing_tables = sa.inspect(bind).get_table_names()

    for c in _CONSTRAINTS:
        if c["table"] not in existing_tables:
            continue
        if not _constraint_exists(bind, c["table"], c["name"]):
            continue
        op.drop_constraint(c["name"], c["table"], type_="unique")
