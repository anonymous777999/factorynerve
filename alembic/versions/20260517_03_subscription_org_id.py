"""Migrate subscriptions ownership from user_id to org_id.

Revision ID: 20260517_03
Revises: 20260517_02
Create Date: 2026-05-17
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260517_03"
down_revision = "20260517_02"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _duplicate_active_orgs(bind) -> list[str]:
    rows = bind.execute(
        sa.text(
            """
            SELECT org_id
            FROM subscriptions
            WHERE status = 'active'
            GROUP BY org_id
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()
    return [str(row[0]) for row in rows if row and row[0]]


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)
    if "subscriptions" not in table_names or "users" not in table_names or "organizations" not in table_names:
        return

    columns = _column_names(bind, "subscriptions")
    indexes = _index_names(bind, "subscriptions")
    dialect = bind.dialect.name

    if "org_id" not in columns:
        with op.batch_alter_table("subscriptions") as batch_op:
            batch_op.add_column(sa.Column("org_id", sa.String(length=36), nullable=True))
            batch_op.create_foreign_key(
                "fk_subscriptions_org_id_organizations",
                "organizations",
                ["org_id"],
                ["org_id"],
            )

    if "ix_subscriptions_org_id" not in indexes:
        op.create_index("ix_subscriptions_org_id", "subscriptions", ["org_id"], unique=False)

    bind.execute(
        sa.text(
            """
            UPDATE subscriptions
            SET org_id = (
                SELECT users.org_id
                FROM users
                WHERE users.id = subscriptions.user_id
            )
            WHERE org_id IS NULL
              AND user_id IS NOT NULL
            """
        )
    )

    null_org_rows = int(
        bind.execute(sa.text("SELECT COUNT(*) FROM subscriptions WHERE org_id IS NULL")).scalar() or 0
    )
    if null_org_rows:
        raise RuntimeError(
            "Migration 20260517_03 aborted: subscriptions still contain NULL org_id values after backfill."
        )

    duplicate_orgs = _duplicate_active_orgs(bind)
    if duplicate_orgs:
        raise RuntimeError(
            "Migration 20260517_03 aborted: duplicate active subscriptions exist for org_id values: "
            + ", ".join(sorted(duplicate_orgs))
        )

    with op.batch_alter_table("subscriptions") as batch_op:
        batch_op.alter_column("org_id", existing_type=sa.String(length=36), nullable=False)

    if "uq_subscriptions_active_org_id" not in indexes:
        kwargs: dict[str, object] = {}
        if dialect == "postgresql":
            kwargs["postgresql_where"] = sa.text("status = 'active'")
        if dialect == "sqlite":
            kwargs["sqlite_where"] = sa.text("status = 'active'")
        op.create_index(
            "uq_subscriptions_active_org_id",
            "subscriptions",
            ["org_id"],
            unique=True,
            **kwargs,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if "subscriptions" not in _table_names(bind):
        return

    columns = _column_names(bind, "subscriptions")
    indexes = _index_names(bind, "subscriptions")

    if "uq_subscriptions_active_org_id" in indexes:
        op.drop_index("uq_subscriptions_active_org_id", table_name="subscriptions")
    if "ix_subscriptions_org_id" in indexes:
        op.drop_index("ix_subscriptions_org_id", table_name="subscriptions")
    if "org_id" in columns:
        with op.batch_alter_table("subscriptions") as batch_op:
            batch_op.drop_constraint("fk_subscriptions_org_id_organizations", type_="foreignkey")
            batch_op.drop_column("org_id")
