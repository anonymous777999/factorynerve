"""Repair users.is_platform_admin for drifted databases.

Revision ID: 20260516_02
Revises: 20260516_01
Create Date: 2026-05-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260516_02"
down_revision = "20260516_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    dialect = bind.dialect.name

    if "is_platform_admin" not in columns:
        if dialect == "postgresql":
            bind.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE"
            )
        else:
            bind.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT 0"
            )

    if dialect == "postgresql":
        bind.exec_driver_sql("UPDATE users SET is_platform_admin = FALSE WHERE is_platform_admin IS NULL")
        bind.exec_driver_sql("ALTER TABLE users ALTER COLUMN is_platform_admin SET DEFAULT FALSE")
        bind.exec_driver_sql("ALTER TABLE users ALTER COLUMN is_platform_admin SET NOT NULL")
    else:
        bind.exec_driver_sql("UPDATE users SET is_platform_admin = 0 WHERE is_platform_admin IS NULL")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "is_platform_admin" in columns:
        op.drop_column("users", "is_platform_admin")
