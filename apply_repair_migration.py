"""Repair migration: add missing user_id column to auth_password_resets.

The production database is missing the user_id column on the
auth_password_resets table. Migration 20260705_06_auth_cleanup.py
was supposed to add it but was never applied.

This script:
  1. Adds user_id column (if missing)
  2. Creates an index on user_id (if missing)
  3. Backfills user_id from existing auth_user_id values
  4. Reports any remaining NULL user_id rows

Usage:
    python apply_repair_migration.py

Safe to run multiple times — skips if column already exists.
"""

from __future__ import annotations

import os
import re
import sys

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect, text
from backend.database import engine


def _repair_auth_password_resets() -> bool:
    """Add user_id column to auth_password_resets if missing.

    Returns True if repair was applied, False if already fixed.
    """
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "auth_password_resets" not in table_names:
        print("  ⏭  auth_password_resets table does not exist. Skipping.")
        return False

    columns = [col["name"] for col in inspector.get_columns("auth_password_resets")]
    if "user_id" in columns:
        print("  ✅ user_id column already exists on auth_password_resets. Nothing to do.")
        return False

    dialect = engine.dialect.name
    print(f"  ℹ  Adding user_id column to auth_password_resets (dialect={dialect})...")

    with engine.begin() as conn:
        # ── Step 1: Add the column ────────────────────────────────────────
        conn.execute(
            text(
                "ALTER TABLE auth_password_resets "
                "ADD COLUMN user_id INTEGER REFERENCES users(id)"
            )
        )

        # ── Step 2: Create index on user_id (matches model definition) ────
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_auth_password_resets_user_id "
                "ON auth_password_resets(user_id)"
            )
        )

        # ── Step 3: Backfill user_id ──────────────────────────────────────
        # auth_user_id may be:
        #   - a UUID string (old auth_users.id) → join via email
        #   - a numeric string (post-consolidation) → cast directly
        # We handle both cases below.

        # First pass: if auth_user_id is numeric, cast directly
        if dialect == "sqlite":
            conn.execute(
                text("""
                    UPDATE auth_password_resets
                    SET user_id = CAST(auth_user_id AS INTEGER)
                    WHERE user_id IS NULL
                      AND auth_user_id GLOB '[0-9]*'
                """)
            )
        else:
            conn.execute(
                text("""
                    UPDATE auth_password_resets
                    SET user_id = auth_user_id::integer
                    WHERE user_id IS NULL
                      AND auth_user_id ~ '^\\d+$'
                """)
            )

        # Second pass: for UUID-style auth_user_id, join via auth_users email
        if dialect == "sqlite":
            conn.execute(
                text("""
                    UPDATE auth_password_resets
                    SET user_id = (
                        SELECT u.id
                        FROM users u
                        JOIN auth_users au ON au.email = u.email
                        WHERE au.id = auth_password_resets.auth_user_id
                    )
                    WHERE user_id IS NULL
                """)
            )
        else:
            conn.execute(
                text("""
                    UPDATE auth_password_resets apr
                    SET user_id = u.id
                    FROM users u
                    JOIN auth_users au ON au.email = u.email
                    WHERE au.id = apr.auth_user_id
                      AND apr.user_id IS NULL
                """)
            )

        # Report remaining NULLs
        null_count = conn.execute(
            text(
                "SELECT COUNT(*) FROM auth_password_resets WHERE user_id IS NULL"
            )
        ).scalar()

    print(f"  ✅ user_id column added to auth_password_resets.")
    print(f"  ✅ Index ix_auth_password_resets_user_id created.")
    print(f"  ℹ  Rows still NULL after backfill: {null_count}")
    return True


def main() -> None:
    print("=" * 60)
    print("  Apply Repair Migration: auth_password_resets.user_id")
    print("=" * 60)
    print()

    db_url = os.getenv("DATABASE_URL", "")
    print(f"  Database URL: {db_url[:50]}...")

    try:
        applied = _repair_auth_password_resets()
    except Exception as exc:
        print(f"\n  ❌ ERROR: {exc}")
        sys.exit(1)

    print()
    if applied:
        print("  ✅ Repair applied successfully!")
        print("  ℹ  The password reset endpoint (/auth/password/forgot) should now work.")
        print()
        print("  ⚠  You should also run the remaining pending migrations:")
        print("     alembic upgrade head")
        print()
        print("     This will apply other auth consolidation changes that may")
        print("     be missing from the production database.")
    else:
        print("  ℹ  No repair needed.")
    print("=" * 60)


if __name__ == "__main__":
    main()
