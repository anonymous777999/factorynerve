"""Add CHECK constraint preventing negative quantity in steel_inventory_transactions.

No database-level constraint was enforcing quantity_kg >= 0 in the inventory
ledger, meaning concurrent dispatch creation could oversell inventory or
create negative-quantity transactions (STEEL-01 / P0-05).

This migration:
1. Backfills any negative quantity to 0 (data integrity fix)
2. Adds the CHECK constraint as NOT VALID first (avoids table lock)
3. Validates the constraint on existing rows

Revision ID: 20260705_02
Revises: 20260705_01
Create Date: 2026-07-05
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260705_02"
down_revision: ClassVar[str] = "20260705_01"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None

_TABLE = "steel_inventory_transactions"
_CONSTRAINT_NAME = "ck_steel_inv_tx_quantity_non_negative"
_COLUMN = "quantity_kg"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Only proceed if the table exists
    table_names = set(inspector.get_table_names())
    if _TABLE not in table_names:
        return

    # Check if constraint already exists
    existing_constraints = {c["name"] for c in inspector.get_check_constraints(_TABLE)}
    if _CONSTRAINT_NAME in existing_constraints:
        return

    # Step 1: Backfill any negative quantities to 0
    bind.execute(
        sa.text(
            f"UPDATE {_TABLE} SET {_COLUMN} = 0 "
            f"WHERE {_COLUMN} IS NOT NULL AND {_COLUMN} < 0"
        )
    )

    # Step 2: Add constraint as NOT VALID (no table lock on existing rows)
    bind.execute(
        sa.text(
            f"ALTER TABLE {_TABLE} "
            f"ADD CONSTRAINT {_CONSTRAINT_NAME} "
            f"CHECK ({_COLUMN} >= 0) "
            f"NOT VALID"
        )
    )

    # Step 3: Validate existing rows (background, no lock escalation)
    bind.execute(
        sa.text(f"ALTER TABLE {_TABLE} VALIDATE CONSTRAINT {_CONSTRAINT_NAME}")
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if _TABLE not in table_names:
        return

    existing_constraints = {c["name"] for c in inspector.get_check_constraints(_TABLE)}
    if _CONSTRAINT_NAME in existing_constraints:
        bind.execute(
            sa.text(f"ALTER TABLE {_TABLE} DROP CONSTRAINT {_CONSTRAINT_NAME}")
        )
