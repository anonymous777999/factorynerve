"""Add grace period end timestamp to subscriptions.

Revision ID: 20260518_06
Revises: 20260518_05
Create Date: 2026-05-18
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260518_06"
down_revision = "20260518_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "subscriptions" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("subscriptions")}
    if "grace_period_end_at" not in columns:
        op.add_column(
            "subscriptions",
            sa.Column("grace_period_end_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "subscriptions" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("subscriptions")}
    if "grace_period_end_at" in columns:
        op.drop_column("subscriptions", "grace_period_end_at")
