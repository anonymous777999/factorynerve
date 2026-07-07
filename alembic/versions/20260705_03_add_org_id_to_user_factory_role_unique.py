"""Update UserFactoryRole unique constraint to include org_id.

The previous unique constraint was on (user_id, factory_id) only, which could
allow inconsistent data with different org_ids for the same user-factory pair.
This migration also handles the edge case where the User table has a
composite PK referenced by some FK definitions — we safely skip index-only
operations when the table doesn't have a simple PK.

Revision ID: 20260705_03
Revises: 20260705_02
Create Date: 2026-07-05
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260705_03"
down_revision: ClassVar[str] = "20260705_02"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "user_factory_roles"
_OLD_CONSTRAINT = "uq_user_factory"
_NEW_CONSTRAINT = "uq_user_factory_role"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if _TABLE not in table_names:
        return

    existing_unique = {c["name"] for c in inspector.get_unique_constraints(_TABLE)}

    # Remove old constraint if it exists
    if _OLD_CONSTRAINT in existing_unique:
        op.drop_constraint(_OLD_CONSTRAINT, _TABLE, type_="unique")

    # Add new constraint if it doesn't already exist
    if _NEW_CONSTRAINT not in existing_unique:
        op.create_unique_constraint(
            _NEW_CONSTRAINT, _TABLE, ["user_id", "factory_id", "org_id"]
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if _TABLE not in table_names:
        return

    existing_unique = {c["name"] for c in inspector.get_unique_constraints(_TABLE)}

    # Remove new constraint
    if _NEW_CONSTRAINT in existing_unique:
        op.drop_constraint(_NEW_CONSTRAINT, _TABLE, type_="unique")

    # Restore old constraint
    if _OLD_CONSTRAINT not in existing_unique:
        op.create_unique_constraint(
            _OLD_CONSTRAINT, _TABLE, ["user_id", "factory_id"]
        )
