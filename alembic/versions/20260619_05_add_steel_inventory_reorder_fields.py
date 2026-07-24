"""add_steel_inventory_reorder_fields

Revision ID: 20260619_05
Revises: 20260619_04
Create Date: 2026-06-19 18:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260619_05"
down_revision = "20260619_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("steel_inventory_items")}

    if "reorder_point_kg" not in columns:
        op.add_column("steel_inventory_items", sa.Column("reorder_point_kg", sa.Float(), nullable=True))
    if "safety_stock_kg" not in columns:
        op.add_column("steel_inventory_items", sa.Column("safety_stock_kg", sa.Float(), nullable=True))
    if "lead_time_days" not in columns:
        op.add_column("steel_inventory_items", sa.Column("lead_time_days", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("steel_inventory_items")}

    for col in ("lead_time_days", "safety_stock_kg", "reorder_point_kg"):
        if col in columns:
            op.drop_column("steel_inventory_items", col)
