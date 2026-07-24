"""Add factory_id column to auth_sessions for session-scoped factory context.

The AuthSession model already defines the column and create_session() passes
factory_id, but no migration was ever generated to add it to the database.
This caused a crash on every authenticated request with:

    psycopg2.errors.UndefinedColumn: column "factory_id" of relation
    "auth_sessions" does not exist

Revision ID: 20260627_04
Revises: 20260627_03
Create Date: 2026-06-28
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260627_04"
down_revision: ClassVar[str] = "20260627_03"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "auth_sessions"
_COLUMN = "factory_id"
_INDEX = "ix_auth_sessions_factory_id"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _TABLE not in inspector.get_table_names():
        return

    existing_cols = {c["name"] for c in inspector.get_columns(_TABLE)}
    if _COLUMN not in existing_cols:
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.String(36), nullable=True))

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
