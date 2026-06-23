"""Merge Alembic heads: ensure a single migration chain.

Revision ID: 20260623_merge
Revises: 20260623_01 (ensure_steel_lines_machines_tables), 20260623_100001 (add_auth_user_failed_login_attempts)
Create Date: 2026-06-23 10:30:00.000000
"""

from __future__ import annotations

from typing import ClassVar

from alembic import op

revision: str = "20260623_merge"
down_revision: ClassVar[tuple[str, str]] = (
    "20260623_01",
    "20260623_100001",
)
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def upgrade() -> None:
    """Merge two divergent migration chains into one."""
    pass


def downgrade() -> None:
    """No-op downgrade for a merge migration."""
    pass
