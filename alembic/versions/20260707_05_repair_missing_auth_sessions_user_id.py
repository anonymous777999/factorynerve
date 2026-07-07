"""Repair: add missing auth_sessions.user_id column.

Migration ``20260707_04`` was deployed in a buggy version (duplicate
``upgrade()`` functions) that stamped the revision without reliably
adding ``auth_sessions.user_id``.  This migration is created in its
own revision so Alembic *will* apply it to production.

Each column / index is guarded by an existence check so the migration
is safe on any environment.

Revision ID: 20260707_05
Revises: 20260707_04
Create Date: 2026-07-07
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260707_05"
down_revision: ClassVar[str] = "20260707_04"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def _existing_columns(table: str) -> set[str]:
    bind = op.get_bind()
    return {col["name"] for col in sa.inspect(bind).get_columns(table)}


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return name in set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    if not _table_exists("auth_sessions"):
        print("  - auth_sessions table does not exist — skipping.")
        return

    existing = _existing_columns("auth_sessions")

    with op.batch_alter_table("auth_sessions") as batch_op:
        if "user_id" not in existing:
            batch_op.add_column(
                sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True)
            )
            batch_op.create_index(
                "ix_auth_sessions_user_active_v2", ["user_id", "revoked_at"]
            )
            print("  + auth_sessions: Added user_id column + ix_auth_sessions_user_active_v2 index.")
        else:
            print("  = auth_sessions: user_id already exists — skipped.")

    print("  Repair complete.")


def downgrade() -> None:
    if not _table_exists("auth_sessions"):
        return

    existing = _existing_columns("auth_sessions")
    if "user_id" in existing:
        with op.batch_alter_table("auth_sessions") as batch_op:
            batch_op.drop_index("ix_auth_sessions_user_active_v2")
            batch_op.drop_column("user_id")
        print("  - auth_sessions: Dropped user_id column + index.")
