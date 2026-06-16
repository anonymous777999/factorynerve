"""Repair billing schema drift for quota and payment order tables.

Revision ID: 20260518_01
Revises: 20260517_03
Create Date: 2026-05-18
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260518_01"
down_revision = "20260517_03"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _month_bounds(period_value: str) -> tuple[datetime, datetime]:
    year = int(period_value[:4])
    month = int(period_value[5:7])
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return start, end


def _repair_org_ocr_usage(bind) -> None:
    if "org_ocr_usage" not in _table_names(bind):
        return

    columns = _column_names(bind, "org_ocr_usage")
    indexes = _index_names(bind, "org_ocr_usage")

    if "ocr_limit" not in columns:
        op.add_column("org_ocr_usage", sa.Column("ocr_limit", sa.Integer(), nullable=True))
    if "period_start" not in columns:
        op.add_column("org_ocr_usage", sa.Column("period_start", sa.DateTime(timezone=True), nullable=True))
    if "period_end" not in columns:
        op.add_column("org_ocr_usage", sa.Column("period_end", sa.DateTime(timezone=True), nullable=True))

    rows = bind.execute(sa.text("SELECT id, period FROM org_ocr_usage")).fetchall()
    for row in rows:
        period_raw = str(row.period or "")
        try:
            period_start, period_end = _month_bounds(period_raw)
        except Exception:
            now = datetime.now(timezone.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_end = period_start + timedelta(days=31)
        bind.execute(
            sa.text(
                """
                UPDATE org_ocr_usage
                SET ocr_limit = COALESCE(ocr_limit, 0),
                    period_start = COALESCE(period_start, :period_start),
                    period_end = COALESCE(period_end, :period_end)
                WHERE id = :row_id
                """
            ),
            {
                "row_id": int(row.id),
                "period_start": period_start,
                "period_end": period_end,
            },
        )

    with op.batch_alter_table("org_ocr_usage") as batch_op:
        batch_op.alter_column("ocr_limit", existing_type=sa.Integer(), nullable=False)

    if "ix_org_ocr_usage_org_id" not in indexes:
        op.create_index("ix_org_ocr_usage_org_id", "org_ocr_usage", ["org_id"], unique=False)


def _repair_payment_orders(bind) -> None:
    if "payment_orders" not in _table_names(bind):
        return

    columns = _column_names(bind, "payment_orders")
    indexes = _index_names(bind, "payment_orders")

    if "org_id" not in columns:
        op.add_column("payment_orders", sa.Column("org_id", sa.String(length=36), nullable=True))
    if "plan_id" not in columns:
        op.add_column("payment_orders", sa.Column("plan_id", sa.String(length=32), nullable=True))
    if "amount_paise" not in columns:
        op.add_column("payment_orders", sa.Column("amount_paise", sa.Integer(), nullable=True))
    if "razorpay_order_id" not in columns:
        op.add_column("payment_orders", sa.Column("razorpay_order_id", sa.String(length=64), nullable=True))
    if "receipt_id" not in columns:
        op.add_column("payment_orders", sa.Column("receipt_id", sa.String(length=120), nullable=True))

    bind.execute(
        sa.text(
            """
            UPDATE payment_orders
            SET plan_id = COALESCE(plan_id, plan),
                amount_paise = COALESCE(amount_paise, amount),
                razorpay_order_id = COALESCE(razorpay_order_id, provider_order_id),
                receipt_id = COALESCE(receipt_id, receipt),
                org_id = COALESCE(
                    org_id,
                    (
                        SELECT users.org_id
                        FROM users
                        WHERE users.id = payment_orders.user_id
                    )
                )
            """
        )
    )

    with op.batch_alter_table("payment_orders") as batch_op:
        batch_op.alter_column("plan_id", existing_type=sa.String(length=32), nullable=False)
        batch_op.alter_column("amount_paise", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("razorpay_order_id", existing_type=sa.String(length=64), nullable=False)
        batch_op.alter_column("receipt_id", existing_type=sa.String(length=120), nullable=False)

    if "ix_payment_orders_org_id" not in indexes:
        op.create_index("ix_payment_orders_org_id", "payment_orders", ["org_id"], unique=False)
    if "ix_payment_orders_razorpay_order_id" not in indexes:
        op.create_index(
            "ix_payment_orders_razorpay_order_id",
            "payment_orders",
            ["razorpay_order_id"],
            unique=True,
        )


def upgrade() -> None:
    bind = op.get_bind()
    _repair_org_ocr_usage(bind)
    _repair_payment_orders(bind)


def downgrade() -> None:
    bind = op.get_bind()
    if "payment_orders" in _table_names(bind):
        indexes = _index_names(bind, "payment_orders")
        if "ix_payment_orders_razorpay_order_id" in indexes:
            op.drop_index("ix_payment_orders_razorpay_order_id", table_name="payment_orders")
        if "ix_payment_orders_org_id" in indexes:
            op.drop_index("ix_payment_orders_org_id", table_name="payment_orders")
    if "org_ocr_usage" in _table_names(bind):
        indexes = _index_names(bind, "org_ocr_usage")
        if "ix_org_ocr_usage_org_id" in indexes:
            op.drop_index("ix_org_ocr_usage_org_id", table_name="org_ocr_usage")
