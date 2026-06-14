"""add_payment_order_billing_cycle

Revision ID: 20260613_01
Revises: e9d27018633b
Create Date: 2026-06-13 12:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260613_01"
down_revision = "20260529_01"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_map(bind, table_name: str) -> dict[str, dict]:
    return {column["name"]: column for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "payment_orders" in table_names:
        columns = _column_map(bind, "payment_orders")
        if "billing_cycle" not in columns:
            op.add_column(
                "payment_orders",
                sa.Column("billing_cycle", sa.String(length=16), nullable=False, server_default="monthly"),
            )


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "payment_orders" in table_names:
        columns = _column_map(bind, "payment_orders")
        if "billing_cycle" in columns:
            op.drop_column("payment_orders", "billing_cycle")
