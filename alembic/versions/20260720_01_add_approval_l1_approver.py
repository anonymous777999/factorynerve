"""Add approval_instances.l1_approved_by_user_id for two-person separation.

Two-stage (IP-3) approvals move L1 -> L2, but the instance only recorded a
single ``approved_by_user_id`` (set at final L2 approval). Nothing recorded who
cleared L1, so the SAME checker could approve both stages and defeat the
two-person control. This column records the L1 approver; the service now
rejects an L2 action taken by that same user.

Revision ID: 20260720_01
Revises: 20260712_02
Create Date: 2026-07-20
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260720_01"
down_revision: ClassVar[str] = "20260712_02"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return name in set(sa.inspect(bind).get_table_names())


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return any(col["name"] == column for col in sa.inspect(bind).get_columns(table))


def upgrade() -> None:
    if not _table_exists("approval_instances"):
        print("  approval_instances table does not exist -- skipping.")
        return

    if _column_exists("approval_instances", "l1_approved_by_user_id"):
        print("  approval_instances.l1_approved_by_user_id already exists -- skipped.")
        return

    with op.batch_alter_table("approval_instances") as batch_op:
        batch_op.add_column(
            sa.Column("l1_approved_by_user_id", sa.Integer(), nullable=True)
        )
    print("  approval_instances: added l1_approved_by_user_id.")


def downgrade() -> None:
    if not _table_exists("approval_instances"):
        return
    if not _column_exists("approval_instances", "l1_approved_by_user_id"):
        return

    with op.batch_alter_table("approval_instances") as batch_op:
        batch_op.drop_column("l1_approved_by_user_id")
    print("  approval_instances: dropped l1_approved_by_user_id.")
