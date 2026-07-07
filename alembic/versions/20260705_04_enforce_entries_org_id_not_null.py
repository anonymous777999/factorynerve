"""Enforce NOT NULL on entries.org_id.

The entries.org_id foreign key was created as nullable=True, which means
orphan entries without an org reference can exist in the database.  This
migration:

1. Backfills any existing NULL org_id values using the factory's org_id.
2. Adds a NOT NULL constraint on the column.

Revision ID: 20260705_04
Revises: 20260705_03
Create Date: 2026-07-05
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260705_04"
down_revision: ClassVar[str] = "20260705_03"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "entries"
_COLUMN = "org_id"
_FK_COLUMN = "factory_id"
_FK_TABLE = "factories"
_FK_TARGET = "org_id"


def upgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    if _TABLE not in table_names:
        return

    # Backfill any NULL org_id values using the factory's org_id.
    # If a factory reference is missing, default to an empty string
    # (the model allows it, and the row would need manual inspection).
    dialect = bind.dialect.name
    if dialect == "sqlite":
        op.execute(
            f"""
            UPDATE {_TABLE}
            SET {_COLUMN} = (
                SELECT COALESCE(f.{_FK_TARGET}, '')
                FROM {_FK_TABLE} f
                WHERE f.factory_id = {_TABLE}.{_FK_COLUMN}
            )
            WHERE {_COLUMN} IS NULL
            """
        )
    else:
        op.execute(
            f"""
            UPDATE {_TABLE}
            SET {_COLUMN} = COALESCE(
                (SELECT f.{_FK_TARGET} FROM {_FK_TABLE} f WHERE f.factory_id = {_TABLE}.{_FK_COLUMN}),
                ''
            )
            WHERE {_COLUMN} IS NULL
            """
        )

    # Now enforce NOT NULL
    with op.batch_alter_table(_TABLE) as batch_op:
        batch_op.alter_column(
            _COLUMN,
            existing_type=sa.String(36),
            nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())
    if _TABLE not in table_names:
        return

    with op.batch_alter_table(_TABLE) as batch_op:
        batch_op.alter_column(
            _COLUMN,
            existing_type=sa.String(36),
            nullable=True,
        )
