"""Add platform admin flag to users.

Revision ID: 20260513_01
Revises: 20260425_04
Create Date: 2026-05-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260513_01"
down_revision = "20260425_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "is_platform_admin" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "is_platform_admin",
                sa.Boolean(),
                nullable=False,
                server_default="false",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "is_platform_admin" in columns:
        op.drop_column("users", "is_platform_admin")
