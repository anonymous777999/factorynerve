"""add_steel_customer_party_type_bank

Revision ID: 20260613_03
Revises: 20260613_02
Create Date: 2026-06-13 16:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260613_03"
down_revision = "20260613_02"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_map(bind, table_name: str) -> dict[str, dict]:
    return {column["name"]: column for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "steel_customers" in table_names:
        columns = _column_map(bind, "steel_customers")

        if "party_type" not in columns:
            op.add_column(
                "steel_customers",
                sa.Column("party_type", sa.String(length=16), nullable=False, server_default="customer"),
            )
        if "bank_name" not in columns:
            op.add_column(
                "steel_customers",
                sa.Column("bank_name", sa.String(length=160), nullable=True),
            )
        if "account_number" not in columns:
            op.add_column(
                "steel_customers",
                sa.Column("account_number", sa.String(length=40), nullable=True),
            )
        if "ifsc_code" not in columns:
            op.add_column(
                "steel_customers",
                sa.Column("ifsc_code", sa.String(length=20), nullable=True),
            )
        if "upi_id" not in columns:
            op.add_column(
                "steel_customers",
                sa.Column("upi_id", sa.String(length=80), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "steel_customers" in table_names:
        columns = _column_map(bind, "steel_customers")

        for col in ("party_type", "bank_name", "account_number", "ifsc_code", "upi_id"):
            if col in columns:
                op.drop_column("steel_customers", col)
