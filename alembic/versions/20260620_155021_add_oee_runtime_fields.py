"""add OEE runtime tracking fields to steel_machines

Revision ID: 20260620_155021
Revises: 20260620_152901
Create Date: 2026-06-20T15:50:21.708818
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260620_155021"
down_revision: Union[str, None] = "20260620_152901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("steel_machines", sa.Column("planned_runtime_minutes", sa.Float(), nullable=True))
    op.add_column("steel_machines", sa.Column("operating_runtime_minutes", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("steel_machines", "operating_runtime_minutes")
    op.drop_column("steel_machines", "planned_runtime_minutes")
