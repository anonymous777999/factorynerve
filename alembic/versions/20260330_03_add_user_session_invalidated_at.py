"""Add session invalidation timestamp to users.

Revision ID: 20260330_03
Revises: 20260330_02
Create Date: 2026-03-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260330_03"
down_revision = "20260330_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column(
                "session_invalidated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )
        )
    op.execute(
        """
        UPDATE users
        SET session_invalidated_at = COALESCE(last_login, created_at, CURRENT_TIMESTAMP)
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("session_invalidated_at")
