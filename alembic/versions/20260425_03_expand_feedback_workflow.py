"""Expand feedback workflow with rating support.

Revision ID: 20260425_03
Revises: 20260425_02
Create Date: 2026-04-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_03"
down_revision = "20260425_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("feedback")}

    if "rating" not in columns:
        op.add_column("feedback", sa.Column("rating", sa.String(length=16), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("feedback")}
    if "rating" in columns:
        op.drop_column("feedback", "rating")
