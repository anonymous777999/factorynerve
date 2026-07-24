"""Repair missing auth consolidation columns on users + auth_sessions.

The production database was created via ``init_db()`` + ``stamp head``,
which bypassed migration ``20260705_05`` that normally adds:

**users table:**
- ``password_hash_version``, ``password_changed_at``, ``mfa_enabled``,
  ``mfa_secret_encrypted``, ``failed_login_attempts``, ``locked_until``,
  ``is_email_verified``, ``updated_at``

**auth_sessions table:**
- ``user_id`` column + ``ix_auth_sessions_user_active_v2`` index

Each column is checked individually so the migration is safe to run
on any environment (fresh, partial, or fully migrated).

Revision ID: 20260707_04
Revises: 20260707_03
Create Date: 2026-07-07
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260707_04"
down_revision: ClassVar[str] = "20260707_03"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def _existing_columns(table: str) -> set[str]:
    """Return the set of column names for *table*."""
    bind = op.get_bind()
    return {col["name"] for col in sa.inspect(bind).get_columns(table)}


def _table_exists(name: str) -> bool:
    """Check if a table exists in the database."""
    bind = op.get_bind()
    return name in set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    users_existing = _existing_columns("users")

    with op.batch_alter_table("users") as batch_op:
        # ── password_hash_version ───────────────────────────────────────
        if "password_hash_version" not in users_existing:
            batch_op.add_column(
                sa.Column("password_hash_version", sa.String(16),
                          nullable=False, server_default="bcrypt")
            )
            print("  ✓ users: Added password_hash_version (default: bcrypt).")
        else:
            print("  ✓ users: password_hash_version already exists — skipped.")

        # ── password_changed_at ─────────────────────────────────────────
        if "password_changed_at" not in users_existing:
            batch_op.add_column(
                sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
            )
            print("  ✓ users: Added password_changed_at.")
        else:
            print("  ✓ users: password_changed_at already exists — skipped.")

        # ── mfa_enabled ─────────────────────────────────────────────────
        if "mfa_enabled" not in users_existing:
            batch_op.add_column(
                sa.Column("mfa_enabled", sa.Boolean(),
                          nullable=False, server_default=sa.false())
            )
            print("  ✓ users: Added mfa_enabled (default: false).")
        else:
            print("  ✓ users: mfa_enabled already exists — skipped.")

        # ── mfa_secret_encrypted ────────────────────────────────────────
        if "mfa_secret_encrypted" not in users_existing:
            batch_op.add_column(
                sa.Column("mfa_secret_encrypted", sa.Text(), nullable=True)
            )
            print("  ✓ users: Added mfa_secret_encrypted.")
        else:
            print("  ✓ users: mfa_secret_encrypted already exists — skipped.")

        # ── failed_login_attempts ───────────────────────────────────────
        if "failed_login_attempts" not in users_existing:
            batch_op.add_column(
                sa.Column("failed_login_attempts", sa.Integer(),
                          nullable=False, server_default="0")
            )
            print("  ✓ users: Added failed_login_attempts (default: 0).")
        else:
            print("  ✓ users: failed_login_attempts already exists — skipped.")

        # ── locked_until ────────────────────────────────────────────────
        if "locked_until" not in users_existing:
            batch_op.add_column(
                sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True)
            )
            print("  ✓ users: Added locked_until.")
        else:
            print("  ✓ users: locked_until already exists — skipped.")

        # ── is_email_verified ───────────────────────────────────────────
        if "is_email_verified" not in users_existing:
            batch_op.add_column(
                sa.Column("is_email_verified", sa.Boolean(),
                          nullable=False, server_default=sa.false())
            )
            print("  ✓ users: Added is_email_verified (default: false).")
        else:
            print("  ✓ users: is_email_verified already exists — skipped.")

        # ── updated_at ──────────────────────────────────────────────────
        if "updated_at" not in users_existing:
            batch_op.add_column(
                sa.Column(
                    "updated_at",
                    sa.DateTime(timezone=True),
                    nullable=False,
                    server_default=sa.text("CURRENT_TIMESTAMP"),
                )
            )
            print("  ✓ users: Added updated_at (server_default=CURRENT_TIMESTAMP).")
        else:
            print("  ✓ users: updated_at already exists — skipped.")

    print("  ✓ users: Auth consolidation column repair complete.")

    # ── auth_sessions: add user_id column + index ─────────────────────
    if _table_exists("auth_sessions"):
        sess_existing = _existing_columns("auth_sessions")

        with op.batch_alter_table("auth_sessions") as batch_op:
            if "user_id" not in sess_existing:
                batch_op.add_column(
                    sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True)
                )
                batch_op.create_index(
                    "ix_auth_sessions_user_active_v2", ["user_id", "revoked_at"]
                )
                print("  ✓ auth_sessions: Added user_id + index.")
            else:
                print("  ✓ auth_sessions: user_id already exists — skipped.")
    else:
        print("  ⚠ auth_sessions table does not exist — skipping.")

    print("  ✓ Auth consolidation repair complete.")


def downgrade() -> None:
    """Reverse: drop columns/index that were added by this migration."""
    # ── users: drop repair columns ───────────────────────────────────────
    users_existing = _existing_columns("users")
    repair_columns = [
        "password_hash_version",
        "password_changed_at",
        "mfa_enabled",
        "mfa_secret_encrypted",
        "failed_login_attempts",
        "locked_until",
        "is_email_verified",
        "updated_at",
    ]

    user_drops = [col for col in repair_columns if col in users_existing]
    if user_drops:
        with op.batch_alter_table("users") as batch_op:
            for col in user_drops:
                batch_op.drop_column(col)
        print(f"  ✓ users: Dropped column(s): {', '.join(user_drops)}")

    # ── auth_sessions: drop user_id column + index ───────────────────────
    if _table_exists("auth_sessions"):
        sess_existing = _existing_columns("auth_sessions")
        if "user_id" in sess_existing:
            with op.batch_alter_table("auth_sessions") as batch_op:
                batch_op.drop_index("ix_auth_sessions_user_active_v2")
                batch_op.drop_column("user_id")
            print("  ✓ auth_sessions: Dropped user_id + index.")
