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


def _mark_duplicate_subscriptions_stale(bind) -> None:
    dialect = bind.dialect.name
    timestamp = "CURRENT_TIMESTAMP" if dialect == "sqlite" else "NOW()"
    bind.execute(
        sa.text(
            f"""
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY org_id
                        ORDER BY
                            CASE
                                WHEN status = 'active' THEN 0
                                WHEN status = 'trialing' THEN 1
                                WHEN status = 'past_due' THEN 2
                                WHEN status = 'suspended' THEN 3
                                WHEN status = 'inactive' THEN 4
                                WHEN status = 'cancelled' THEN 5
                                ELSE 6
                            END,
                            updated_at DESC NULLS LAST,
                            created_at DESC NULLS LAST,
                            id DESC
                    ) AS row_rank
                FROM subscriptions
                WHERE org_id IS NOT NULL
                  AND COALESCE(status, '') NOT IN ('stale', 'cancelled', 'expired')
            )
            UPDATE subscriptions
            SET status = 'stale',
                pending_plan = NULL,
                pending_plan_effective_at = NULL,
                updated_at = {timestamp}
            WHERE id IN (
                SELECT id
                FROM ranked
                WHERE row_rank > 1
            )
            """
        )
    )


def _clear_duplicate_invoice_provider_ids(bind) -> None:
    bind.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id, provider, provider_invoice_id
                        ORDER BY created_at DESC NULLS LAST, id DESC
                    ) AS row_rank
                FROM invoices
                WHERE user_id IS NOT NULL
                  AND provider IS NOT NULL
                  AND provider_invoice_id IS NOT NULL
            )
            UPDATE invoices
            SET provider_invoice_id = NULL
            WHERE id IN (
                SELECT id
                FROM ranked
                WHERE row_rank > 1
            )
            """
        )
    )


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "subscriptions" in table_names:
        indexes = _index_names(bind, "subscriptions")
        _mark_duplicate_subscriptions_stale(bind)

        if "uq_subscriptions_active_org_id" in indexes:
            with op.batch_alter_table("subscriptions") as batch_op:
                batch_op.drop_index("uq_subscriptions_active_org_id")

        if "uq_subscriptions_org_id" not in indexes:
            kwargs: dict[str, object] = {}
            where_clause = sa.text("status NOT IN ('stale', 'cancelled', 'expired')")
            if bind.dialect.name == "postgresql":
                kwargs["postgresql_where"] = where_clause
            if bind.dialect.name == "sqlite":
                kwargs["sqlite_where"] = where_clause
            op.create_index(
                "uq_subscriptions_org_id",
                "subscriptions",
                ["org_id"],
                unique=True,
                **kwargs,
            )

        if "ix_subscriptions_org_id" in indexes:
            with op.batch_alter_table("subscriptions") as batch_op:
                batch_op.drop_index("ix_subscriptions_org_id")

    if "invoices" in table_names:
        columns = _column_map(bind, "invoices")
        if "user_id" in columns and "provider" in columns and "provider_invoice_id" in columns:
            indexes = _index_names(bind, "invoices")
            _clear_duplicate_invoice_provider_ids(bind)
            if "ix_invoices_user_provider_invoice" not in indexes:
                kwargs: dict[str, object] = {}
                where_clause = sa.text("provider_invoice_id IS NOT NULL")
                if bind.dialect.name == "postgresql":
                    kwargs["postgresql_where"] = where_clause
                if bind.dialect.name == "sqlite":
                    kwargs["sqlite_where"] = where_clause
                op.create_index(
                    "ix_invoices_user_provider_invoice",
                    "invoices",
                    ["user_id", "provider", "provider_invoice_id"],
                    unique=True,
                    **kwargs,
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
