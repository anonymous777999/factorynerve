"""Run legacy schema patching for pre-migration databases.

This script replaces the old startup-time DDL patching. Run this manually
only when upgrading older SQLite/Postgres databases that predate Alembic.
The comprehensive schema repair migration (20260626_01) replaces all
runtime _ensure_* functions that were removed from database.py.

Usage:
    python -m scripts.legacy_schema_patch

Note: This script is kept for reference. Modern databases should use
Alembic migrations instead:
    alembic upgrade head
"""

from __future__ import annotations

from alembic import command
from alembic.config import Config


def run() -> None:
    """Run all outstanding Alembic migrations including the comprehensive
    schema repair (20260626_01) that replaces all _ensure_* functions."""
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    print("Legacy schema patch complete (via Alembic upgrade head).")


if __name__ == "__main__":
    run()
