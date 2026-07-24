"""Cleanup after auth consolidation — drop replaced tables, finalize user_id FK.

Phase 4 of auth consolidation — safely drops the auth_audit_logs table (fully
replaced by audit_logs), makes auth_session.user_id NOT NULL (all sessions
backfilled in phase 1), and prepares auth_password_reset for the eventual
auth_users table drop.

Revision ID: 20260705_06
Revises: 20260705_05
Create Date: 2026-07-05
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260705_06"
down_revision: ClassVar[str] = "20260705_05"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def upgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    dialect = bind.dialect.name

    # ── Drop auth_audit_logs (replaced by audit_logs) ─────────────────────
    if "auth_audit_logs" in table_names:
        op.drop_table("auth_audit_logs")
        print("  ✓ Dropped auth_audit_logs table (replaced by audit_logs)")

    # ── auth_sessions: make user_id NOT NULL ──────────────────────────────
    if "auth_sessions" in table_names:
        # Backfill any remaining NULL user_id values (edge case: sessions
        # created between phase 1 and phase 4 deployment).
        if dialect == "sqlite":
            op.execute("""
                UPDATE auth_sessions
                SET user_id = (
                    SELECT u.id
                    FROM users u
                    WHERE u.email = (
                        SELECT au.email
                        FROM auth_users au
                        WHERE au.id = auth_sessions.auth_user_id
                    )
                )
                WHERE user_id IS NULL
                  AND auth_user_id IS NOT NULL
            """)
        else:
            op.execute("""
                UPDATE auth_sessions s
                SET user_id = u.id
                FROM users u
                WHERE u.email = (
                    SELECT au.email
                    FROM auth_users au
                    WHERE au.id = s.auth_user_id
                )
                  AND s.user_id IS NULL
                  AND s.auth_user_id IS NOT NULL
            """)

        with op.batch_alter_table("auth_sessions") as batch_op:
            batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=False)

    # ── auth_password_reset: prepare for user_id migration ────────────────
    # The auth_password_reset table still references auth_users.id via FK.
    # Once we're confident all sessions are backfilled, we can add a
    # user_id column here and drop the auth_user_id FK. For now, just add
    # a nullable user_id column and backfill it.
    if "auth_password_resets" in table_names:
        # Check if user_id column already exists
        columns = [col["name"] for col in sa.inspect(bind).get_columns("auth_password_resets")]
        if "user_id" not in columns:
            with op.batch_alter_table("auth_password_resets") as batch_op:
                batch_op.add_column(
                    sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True)
                )

            # Backfill from auth_users → users email join
            if dialect == "sqlite":
                op.execute("""
                    UPDATE auth_password_resets
                    SET user_id = (
                        SELECT u.id
                        FROM users u
                        JOIN auth_users au ON au.email = u.email
                        WHERE au.id = auth_password_resets.auth_user_id
                    )
                    WHERE user_id IS NULL
                """)
            else:
                op.execute("""
                    UPDATE auth_password_resets apr
                    SET user_id = u.id
                    FROM users u
                    JOIN auth_users au ON au.email = u.email
                    WHERE au.id = apr.auth_user_id
                      AND apr.user_id IS NULL
                """)


def downgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    dialect = bind.dialect.name

    # Restore auth_password_resets: drop user_id column
    if "auth_password_resets" in table_names:
        columns = [col["name"] for col in sa.inspect(bind).get_columns("auth_password_resets")]
        if "user_id" in columns:
            with op.batch_alter_table("auth_password_resets") as batch_op:
                batch_op.drop_column("user_id")

    # Restore auth_sessions: make user_id nullable again
    if "auth_sessions" in table_names:
        with op.batch_alter_table("auth_sessions") as batch_op:
            batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)

    # Recreate auth_audit_logs
    if "auth_audit_logs" not in table_names:
        op.create_table(
            "auth_audit_logs",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("auth_user_id", sa.String(36), sa.ForeignKey("auth_users.id"), nullable=True),
            sa.Column("action", sa.String(80), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("ip_hash", sa.String(128), nullable=True),
            sa.Column("user_agent_hash", sa.String(128), nullable=True),
            sa.Column("meta", sa.JSON(), nullable=True),
        )
