"""Add shift to attendance_records unique constraint for alt_shift tracking.

The original unique constraint on (user_id, factory_id, attendance_date) prevents
a worker from having multiple attendance records on the same day. This change
adds the shift column to the constraint, allowing a worker to punch in for
different shifts on the same day (e.g., morning AND evening double shift).

The migration is fully idempotent: it inspects the live DB state, drops the
old constraint only if it exists, and creates the new one only if it doesn't.

Revision ID: 20260703_01
Revises: 20260627_04
Create Date: 2026-07-03
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260703_01"
down_revision: ClassVar[str] = "20260627_04"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "attendance_records"
_OLD_CONSTRAINT = "uq_attendance_records_user_factory_date"
_NEW_CONSTRAINT = "uq_attendance_records_user_factory_date_shift"
_NEW_COLUMNS = ["user_id", "factory_id", "attendance_date", "shift"]


def _constraint_name_exists(bind: sa.engine.Connection, name: str) -> bool:
    """Return True if a unique constraint with *name* exists on the table."""
    inspector = sa.inspect(bind)
    try:
        constraints = inspector.get_unique_constraints(_TABLE)
    except Exception:
        return False
    for uc in constraints:
        if uc.get("name") == name:
            return True
    # Some dialects expose unique constraints as indexes
    try:
        indexes = inspector.get_indexes(_TABLE)
    except Exception:
        return False
    for idx in indexes:
        if idx.get("name") == name and idx.get("unique"):
            return True
    return False


def _table_exists(bind: sa.engine.Connection) -> bool:
    return _TABLE in sa.inspect(bind).get_table_names()


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind):
        return

    # Drop the old constraint if it still exists
    if _constraint_name_exists(bind, _OLD_CONSTRAINT):
        with op.batch_alter_table(_TABLE) as batch_op:
            batch_op.drop_constraint(_OLD_CONSTRAINT, type_="unique")

    # Create the new constraint only if it doesn't already exist
    if not _constraint_name_exists(bind, _NEW_CONSTRAINT):
        op.create_unique_constraint(_NEW_CONSTRAINT, _TABLE, _NEW_COLUMNS)


def downgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind):
        return

    # Drop the new constraint
    if _constraint_name_exists(bind, _NEW_CONSTRAINT):
        with op.batch_alter_table(_TABLE) as batch_op:
            batch_op.drop_constraint(_NEW_CONSTRAINT, type_="unique")

    # Restore the old constraint
    if not _constraint_name_exists(bind, _OLD_CONSTRAINT):
        op.create_unique_constraint(
            _OLD_CONSTRAINT,
            _TABLE,
            ["user_id", "factory_id", "attendance_date"],
        )
