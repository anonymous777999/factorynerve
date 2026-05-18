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


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "subscriptions" not in table_names or "users" not in table_names or "organizations" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("subscriptions")}
    indexes = {index["name"] for index in inspector.get_indexes("subscriptions")}

    if "org_id" not in columns:
        op.add_column(
            "subscriptions",
            sa.Column("org_id", sa.String(length=36), nullable=True),
        )
        op.create_foreign_key(
            "fk_subscriptions_org_id_organizations",
            "subscriptions",
            "organizations",
            ["org_id"],
            ["org_id"],
        )

    if "ix_subscriptions_org_id" not in indexes:
        op.create_index("ix_subscriptions_org_id", "subscriptions", ["org_id"], unique=False)

    op.execute(
        """
        UPDATE subscriptions
        SET org_id = users.org_id
        FROM users
        WHERE users.id = subscriptions.user_id
        """
    )

    op.alter_column("subscriptions", "org_id", existing_type=sa.String(length=36), nullable=False)

    if "uq_subscriptions_active_org_id" not in indexes:
        op.create_index(
            "uq_subscriptions_active_org_id",
            "subscriptions",
            ["org_id"],
            unique=True,
            postgresql_where=sa.text("status = 'active'"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "subscriptions" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("subscriptions")}
    indexes = {index["name"] for index in inspector.get_indexes("subscriptions")}

    if "uq_subscriptions_active_org_id" in indexes:
        op.drop_index("uq_subscriptions_active_org_id", table_name="subscriptions")
    if "ix_subscriptions_org_id" in indexes:
        op.drop_index("ix_subscriptions_org_id", table_name="subscriptions")
    if "org_id" in columns:
        op.drop_column("subscriptions", "org_id")
