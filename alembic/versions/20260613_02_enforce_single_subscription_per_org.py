"""enforce_single_subscription_per_org

Revision ID: 20260613_02
Revises: 20260613_01
Create Date: 2026-06-13 12:30:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260613_02"
down_revision = "20260613_01"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _column_map(bind, table_name: str) -> dict[str, dict]:
    return {column["name"]: column for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "subscriptions" in table_names:
        indexes = _index_names(bind, "subscriptions")

        if "uq_subscriptions_active_org_id" in indexes:
            with op.batch_alter_table("subscriptions") as batch_op:
                batch_op.drop_index("uq_subscriptions_active_org_id")

        if "uq_subscriptions_org_id" not in indexes:
            with op.batch_alter_table("subscriptions") as batch_op:
                batch_op.create_index("uq_subscriptions_org_id", ["org_id"], unique=True)

        if "ix_subscriptions_org_id" in indexes:
            with op.batch_alter_table("subscriptions") as batch_op:
                batch_op.drop_index("ix_subscriptions_org_id")

    if "invoices" in table_names:
        columns = _column_map(bind, "invoices")
        if "user_id" in columns and "provider" in columns and "provider_invoice_id" in columns:
            indexes = _index_names(bind, "invoices")
            if "ix_invoices_user_provider_invoice" not in indexes:
                with op.batch_alter_table("invoices") as batch_op:
                    batch_op.create_index(
                        "ix_invoices_user_provider_invoice",
                        ["user_id", "provider", "provider_invoice_id"],
                        unique=True,
                    )


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "subscriptions" in table_names:
        op.drop_index("uq_subscriptions_org_id", table_name="subscriptions")
        op.create_index(
            "uq_subscriptions_active_org_id",
            "subscriptions",
            ["org_id"],
            unique=True,
            sqlite_where=sa.text("status = 'active'"),
            postgresql_where=sa.text("status = 'active'"),
        )

    if "invoices" in table_names:
        op.drop_index("ix_invoices_user_provider_invoice", table_name="invoices")
