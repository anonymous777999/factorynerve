"""Add failed_login_attempts and locked_until columns to auth_users table.

The AuthUser model was updated to support account lockout after repeated
failed login attempts (auth_security/lockout.py), but the migration was
never created, causing a column-not-found error on login.

This migration depends on 20260623_01 (ensure_steel_lines_machines_tables)
for a clean single-chain lineage — no branch merge needed.

Revision ID: 20260623_100001
Revises: 20260623_01 (ensure_steel_lines_machines_tables)
Create Date: 2026-06-23 10:00:01.000000
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260623_100001"
down_revision: ClassVar[str | None] = "20260623_01"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def upgrade() -> None:
    op.add_column(
        "auth_users",
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "auth_users",
        sa.Column(
            "locked_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("auth_users", "locked_until")
    op.drop_column("auth_users", "failed_login_attempts")
