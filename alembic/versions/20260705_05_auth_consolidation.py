"""Add auth fields to users table + user_id to auth_sessions.

Phase 1 of auth consolidation — migrate AuthUser fields into the User
model so we can eventually drop the auth_users table.

Adds to users:
  - password_hash_version (bcrypt|argon2)
  - password_changed_at
  - mfa_enabled, mfa_secret_encrypted
  - failed_login_attempts, locked_until
  - is_email_verified
  - updated_at

Adds to auth_sessions:
  - user_id (nullable FK → users.id, for transition)

Backfills both from existing AuthUser data.

Revision ID: 20260705_05
Revises: 20260705_04
Create Date: 2026-07-05
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260705_05"
down_revision: ClassVar[str] = "20260705_04"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def upgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    dialect = bind.dialect.name

    # ── users: add new columns ──────────────────────────────────────────
    if "users" in table_names:
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(
                sa.Column("password_hash_version", sa.String(16), nullable=False, server_default="bcrypt")
            )
            batch_op.add_column(
                sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
            )
            batch_op.add_column(
                sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.false())
            )
            batch_op.add_column(
                sa.Column("mfa_secret_encrypted", sa.Text(), nullable=True)
            )
            batch_op.add_column(
                sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0")
            )
            batch_op.add_column(
                sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True)
            )
            batch_op.add_column(
                sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.false())
            )
            batch_op.add_column(
                sa.Column(
                    "updated_at",
                    sa.DateTime(timezone=True),
                    nullable=False,
                    server_default=sa.text("CURRENT_TIMESTAMP"),
                )
            )

    # ── auth_sessions: add user_id column ───────────────────────────────
    if "auth_sessions" in table_names:
        with op.batch_alter_table("auth_sessions") as batch_op:
            batch_op.add_column(
                sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True)
            )
            batch_op.create_index("ix_auth_sessions_user_active_v2", ["user_id", "revoked_at"])

    # ── Backfill users from auth_users ──────────────────────────────────
    if "users" in table_names and "auth_users" in table_names:
        # Transfer AuthUser data to User
        if dialect == "sqlite":
            op.execute("""
                UPDATE users
                SET
                    password_hash_version = 'argon2',
                    password_changed_at = (
                        SELECT COALESCE(au.password_changed_at, users.created_at)
                        FROM auth_users au
                        WHERE au.email = users.email
                    ),
                    mfa_enabled = COALESCE(
                        (SELECT au.mfa_enabled FROM auth_users au WHERE au.email = users.email),
                        0
                    ),
                    mfa_secret_encrypted = (
                        SELECT au.mfa_secret_encrypted
                        FROM auth_users au
                        WHERE au.email = users.email
                    ),
                    failed_login_attempts = COALESCE(
                        (SELECT au.failed_login_attempts FROM auth_users au WHERE au.email = users.email),
                        0
                    ),
                    locked_until = (
                        SELECT au.locked_until
                        FROM auth_users au
                        WHERE au.email = users.email
                    ),
                    is_email_verified = COALESCE(
                        (SELECT au.is_email_verified FROM auth_users au WHERE au.email = users.email),
                        CASE WHEN users.email_verified_at IS NOT NULL THEN 1 ELSE 0 END
                    ),
                    updated_at = COALESCE(
                        (SELECT au.updated_at FROM auth_users au WHERE au.email = users.email),
                        CURRENT_TIMESTAMP
                    )
                WHERE EXISTS (
                    SELECT 1 FROM auth_users au WHERE au.email = users.email
                )
            """)
        else:
            op.execute("""
                UPDATE users u
                SET
                    password_hash_version = 'argon2',
                    password_changed_at = COALESCE(au.password_changed_at, u.created_at),
                    mfa_enabled = COALESCE(au.mfa_enabled, FALSE),
                    mfa_secret_encrypted = au.mfa_secret_encrypted,
                    failed_login_attempts = COALESCE(au.failed_login_attempts, 0),
                    locked_until = au.locked_until,
                    is_email_verified = COALESCE(au.is_email_verified, u.email_verified_at IS NOT NULL),
                    updated_at = COALESCE(au.updated_at, u.created_at)
                FROM auth_users au
                WHERE au.email = u.email
            """)

        # Backfill auth_sessions.user_id for existing sessions
        if dialect == "sqlite":
            op.execute("""
                UPDATE auth_sessions
                SET user_id = (
                    SELECT u.id
                    FROM users u
                    JOIN auth_users au ON au.email = u.email
                    WHERE au.id = auth_sessions.auth_user_id
                )
                WHERE user_id IS NULL
            """)
        else:
            op.execute("""
                UPDATE auth_sessions s
                SET user_id = u.id
                FROM users u
                JOIN auth_users au ON au.email = u.email
                WHERE au.id = s.auth_user_id
                  AND s.user_id IS NULL
            """)


def downgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())

    if "auth_sessions" in table_names:
        with op.batch_alter_table("auth_sessions") as batch_op:
            batch_op.drop_index("ix_auth_sessions_user_active_v2")
            batch_op.drop_column("user_id")

    if "users" in table_names:
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("password_hash_version")
            batch_op.drop_column("password_changed_at")
            batch_op.drop_column("mfa_enabled")
            batch_op.drop_column("mfa_secret_encrypted")
            batch_op.drop_column("failed_login_attempts")
            batch_op.drop_column("locked_until")
            batch_op.drop_column("is_email_verified")
            batch_op.drop_column("updated_at")
