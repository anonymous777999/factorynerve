"""Add shift_start_utc, shift_end_utc, cross_midnight to attendance_records.

These columns were added to the AttendanceRecord model but the Alembic
migration was never created, causing a runtime error in the auto-close
attendance service:

  psycopg2.errors.UndefinedColumn: column attendance_records.shift_start_utc
  does not exist

Revision ID: 20260705_01
Revises: 20260704_03
Create Date: 2026-07-05
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260705_01"
down_revision: ClassVar[str] = "20260704_03"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "attendance_records"

# Columns to add — defines name, type, and creation kwargs
_COLUMNS: list[sa.Column] = [
    sa.Column("shift_start_utc", sa.DateTime(timezone=True), nullable=True),
    sa.Column("shift_end_utc", sa.DateTime(timezone=True), nullable=True),
    sa.Column("cross_midnight", sa.Boolean(), nullable=False, server_default=sa.false()),
]

_INDEXES: list[tuple[str, list[str]]] = [
    ("ix_attendance_records_shift_start_utc", ["shift_start_utc"]),
    ("ix_attendance_records_shift_bounds", ["shift_start_utc", "shift_end_utc"]),
]


def _column_exists(bind: sa.engine.Connection, table: str, column: str) -> bool:
    try:
        return column in {c["name"] for c in sa.inspect(bind).get_columns(table)}
    except Exception:
        return False


def _index_exists(bind: sa.engine.Connection, table: str, index_name: str) -> bool:
    try:
        return index_name in {i["name"] for i in sa.inspect(bind).get_indexes(table) if i.get("name")}
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    if _TABLE not in table_names:
        return

    for col in _COLUMNS:
        if not _column_exists(bind, _TABLE, col.name):
            op.add_column(_TABLE, col)

    for index_name, columns in _INDEXES:
        if not _index_exists(bind, _TABLE, index_name):
            op.create_index(index_name, _TABLE, columns)


def downgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    if _TABLE not in table_names:
        return

    for index_name, _ in reversed(_INDEXES):
        if _index_exists(bind, _TABLE, index_name):
            op.drop_index(index_name, table_name=_TABLE)

    for col in reversed(_COLUMNS):
        if _column_exists(bind, _TABLE, col.name):
            op.drop_column(_TABLE, col.name)
