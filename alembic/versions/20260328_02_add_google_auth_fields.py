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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return
    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "google_id" not in columns:
        op.add_column("users", sa.Column("google_id", sa.String(length=255), nullable=True))
    if "profile_picture" not in columns:
        op.add_column("users", sa.Column("profile_picture", sa.String(length=500), nullable=True))
    if "auth_provider" not in columns:
        op.add_column("users", sa.Column("auth_provider", sa.String(length=32), server_default="local", nullable=False))
    if "ix_users_google_id" not in indexes:
        op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "profile_picture")
    op.drop_column("users", "google_id")
