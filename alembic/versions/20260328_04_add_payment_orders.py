"""Add payment orders table for idempotent billing.

Revision ID: 20260328_04
Revises: 20260328_03
Create Date: 2026-03-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260328_04"
down_revision = "20260328_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="INR"),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="razorpay"),
        sa.Column("provider_order_id", sa.String(length=64), nullable=False),
        sa.Column("receipt", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="created"),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payment_orders_user_id", "payment_orders", ["user_id"])
    op.create_index("ix_payment_orders_idempotency", "payment_orders", ["idempotency_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_payment_orders_idempotency", table_name="payment_orders")
    op.drop_index("ix_payment_orders_user_id", table_name="payment_orders")
    op.drop_table("payment_orders")
