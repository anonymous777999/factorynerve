"""Repair: add missing auth_password_resets.user_id column.

Production was bootstrapped via the ``init_db()`` + ``stamp head`` fallback
in ``scripts/render_start.py`` on 2026-07-07 (after ``alembic upgrade head``
failed on migration ``20260707_02`` — see ``20260707_03`` for that repair).
That fallback stamps the Alembic history as fully applied without actually
running the DDL for any migration revision that came before the failure
point in the *current* run, including ``20260705_06`` (which adds
``auth_password_resets.user_id``). As a result, production is stamped at
head (``20260707_05``) but is missing this column entirely.

Impact confirmed live: ``POST /auth/password/forgot`` inserts a new
``AuthPasswordReset(user_id=..., ...)`` row, which raises
``psycopg2.errors.UndefinedColumn`` on production. That exception is
silently caught by a broad ``except Exception`` in the router, so the
endpoint still returns its generic 200 success message — but no reset
token is ever created and no reset email is ever sent. This is the actual
root cause of "password reset not working" in production, independent of
any application-code changes to auth_secure.py.

This migration re-applies (idempotently) the same column addition and
backfill that ``20260705_06`` was supposed to have performed, following
the same existence-check pattern as ``20260707_04``/``20260707_05`` so it
is safe to run on any environment (fresh, partially migrated, or already
correct).

Revision ID: 20260712_01
Revises: 20260707_05
Create Date: 2026-07-12
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260712_01"
down_revision: ClassVar[str] = "20260707_05"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def _existing_columns(table: str) -> set[str]:
    bind = op.get_bind()
    return {col["name"] for col in sa.inspect(bind).get_columns(table)}


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return name in set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    if not _table_exists("auth_password_resets"):
        print("  ⚠ auth_password_resets table does not exist — skipping.")
        return

    bind = op.get_bind()
    dialect = bind.dialect.name
    columns = _existing_columns("auth_password_resets")

    if "user_id" in columns:
        print("  ✓ auth_password_resets: user_id already exists — skipped.")
        return

    with op.batch_alter_table("auth_password_resets") as batch_op:
        batch_op.add_column(
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True)
        )
    print("  ✓ auth_password_resets: Added user_id column.")

    # Backfill from auth_users → users email join, same as 20260705_06.
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
    print("  ✓ auth_password_resets: Backfilled user_id from auth_users/users join.")


def downgrade() -> None:
    if not _table_exists("auth_password_resets"):
        return
    columns = _existing_columns("auth_password_resets")
    if "user_id" in columns:
        with op.batch_alter_table("auth_password_resets") as batch_op:
            batch_op.drop_column("user_id")
        print("  ✓ auth_password_resets: Dropped user_id column.")
