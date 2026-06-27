"""Add client_request_id to steel_dispatches for idempotency.

Without this column, duplicate dispatch requests (e.g. from client retries on
timeout) create duplicate SteelDispatch rows with the same invoice lines,
causing double stock deductions.  The column is nullable so existing rows are
unaffected.

Revision ID: 20260627_02
Revises: 20260627_01
Create Date: 2026-06-27
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260627_02"
down_revision: ClassVar[str] = "20260627_01"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "steel_dispatches"
_COLUMN = "client_request_id"
_INDEX = "ix_steel_dispatches_client_request_id"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _TABLE not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns(_TABLE)}
    if _COLUMN not in existing_cols:
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.String(64), nullable=True))

    existing_indexes = {i["name"] for i in inspector.get_indexes(_TABLE) if i.get("name")}
    if _INDEX not in existing_indexes:
        op.create_index(_INDEX, _TABLE, [_COLUMN])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _TABLE not in inspector.get_table_names():
        return

    existing_indexes = {i["name"] for i in inspector.get_indexes(_TABLE) if i.get("name")}
    if _INDEX in existing_indexes:
        op.drop_index(_INDEX, table_name=_TABLE)

    existing_cols = {c["name"] for c in inspector.get_columns(_TABLE)}
    if _COLUMN in existing_cols:
        op.drop_column(_TABLE, _COLUMN)