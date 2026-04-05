"""Run legacy schema patching for pre-migration databases.

This script replaces the old startup-time DDL patching. Run it manually
only when upgrading older SQLite/Postgres databases that predate Alembic.
"""

from __future__ import annotations

from backend.database import (
    _ensure_audit_logs_columns,
    _ensure_entries_columns,
    _ensure_org_factory_backfill,
    _ensure_users_columns,
)


def run() -> None:
    _ensure_entries_columns()
    _ensure_users_columns()
    _ensure_audit_logs_columns()
    _ensure_org_factory_backfill()


if __name__ == "__main__":
    run()
    print("Legacy schema patch complete.")
