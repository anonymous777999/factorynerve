"""Ensure unique constraint on attendance_records(user_id, factory_id, attendance_date).

The constraint was defined in the original 20260330_01 migration, but may be
absent in databases that were created from a schema dump, restored from a
backup taken before the constraint was added, or had the constraint dropped
manually.  This migration is fully idempotent: it inspects the live DB and
only creates the constraint when it is missing.

Revision ID: 20260627_01
Revises: 20260626_02
Create Date: 2026-06-27
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260627_01"
down_revision: ClassVar[str] = "20260626_02"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "attendance_records"
_CONSTRAINT_NAME = "uq_attendance_records_user_factory_date"
_COLUMNS = ["user_id", "factory_id", "attendance_date"]


def _constraint_exists(bind: sa.engine.Connection) -> bool:
    """Return True if the unique constraint already exists in the live DB."""
    inspector = sa.inspect(bind)
    try:
        unique_constraints = inspector.get_unique_constraints(_TABLE)
    except Exception:
        return False
    for uc in unique_constraints:
        if uc.get("name") == _CONSTRAINT_NAME:
            return True
    # Also check via indexes (some dialects expose unique constraints as indexes)
    try:
        indexes = inspector.get_indexes(_TABLE)
    except Exception:
        return False
    for idx in indexes:
        if idx.get("name") == _CONSTRAINT_NAME and idx.get("unique"):
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()

    # Guard: table must exist
    if _TABLE not in sa.inspect(bind).get_table_names():
        return

    if _constraint_exists(bind):
        # Already present — nothing to do.
        return

    # Deduplicate any existing rows that would violate the constraint before
    # creating it.  Keep the row with the lowest id (earliest insert) and
    # delete the rest.  This is a safety measure for databases that accumulated
    # duplicates while the constraint was absent.
    dialect = bind.dialect.name
    if dialect == "postgresql":
        bind.execute(
            sa.text(
                """
                DELETE FROM attendance_records
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM attendance_records
                    GROUP BY user_id, factory_id, attendance_date
                )
                """
            )
        )
    else:
        # SQLite / other: use a CTE-compatible approach
        bind.execute(
            sa.text(
                """
                DELETE FROM attendance_records
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM attendance_records
                    GROUP BY user_id, factory_id, attendance_date
                )
                """
            )
        )
    bind.commit()

    # Now create the unique constraint.
    op.create_unique_constraint(
        _CONSTRAINT_NAME,
        _TABLE,
        _COLUMNS,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if _TABLE not in sa.inspect(bind).get_table_names():
        return
    if not _constraint_exists(bind):
        return
    op.drop_constraint(_CONSTRAINT_NAME, _TABLE, type_="unique")