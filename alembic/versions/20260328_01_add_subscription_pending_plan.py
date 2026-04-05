"""Add pending downgrade fields to subscriptions.

Revision ID: 20260328_01
Revises: 20260327_02
Create Date: 2026-03-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260328_01"
down_revision = "20260327_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("pending_plan", sa.String(length=32), nullable=True))
    op.add_column("subscriptions", sa.Column("pending_plan_effective_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("subscriptions", "pending_plan_effective_at")
    op.drop_column("subscriptions", "pending_plan")
