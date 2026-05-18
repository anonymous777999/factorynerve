"""Add user role revision column for auth cache invalidation.

Revision ID: 20260518_02
Revises: 20260518_01
Create Date: 2026-05-18
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260518_02"
down_revision = "20260518_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role_revision", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(sa.text("UPDATE users SET role_revision = 0"))


def downgrade() -> None:
    op.drop_column("users", "role_revision")
