"""Add Google OAuth fields to users.

Revision ID: 20260328_02
Revises: 20260328_01
Create Date: 2026-03-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260328_02"
down_revision = "20260328_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("profile_picture", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("auth_provider", sa.String(length=32), server_default="local", nullable=False))
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "profile_picture")
    op.drop_column("users", "google_id")
