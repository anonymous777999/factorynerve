"""Add unique constraint on auth_password_resets.token_hash.

Revision ID: 20260626_02
Revises: None (initial migration — no prior versions)
Create Date: 2026-06-26

"""

from __future__ import annotations

from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260626_02"
down_revision: str | None = "20260626_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Remove the standalone index on token_hash; the unique constraint
    #    will serve as the index as well (PostgreSQL/SQLite automatically
    #    creates a unique index for a unique constraint).
    op.drop_index("ix_auth_password_resets_token_hash", table_name="auth_password_resets")

    # 2. Clean up any duplicate token_hashes before adding the unique constraint.
    #    Keep only the most recent row for each duplicate token_hash.
    op.execute("""
        DELETE FROM auth_password_resets
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY token_hash
                    ORDER BY created_at DESC
                ) AS rn
                FROM auth_password_resets
            ) dups
            WHERE dups.rn > 1
        )
    """)

    # 3. Add the unique constraint on token_hash
    op.create_unique_constraint(
        "uq_auth_password_resets_token_hash",
        "auth_password_resets",
        ["token_hash"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_auth_password_resets_token_hash",
        "auth_password_resets",
        type_="unique",
    )
    op.create_index(
        "ix_auth_password_resets_token_hash",
        "auth_password_resets",
        ["token_hash"],
    )
