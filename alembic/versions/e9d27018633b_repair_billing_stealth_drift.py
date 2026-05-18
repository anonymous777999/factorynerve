"""repair_billing_stealth_drift

Revision ID: e9d27018633b
Revises: 20260518_06
Create Date: 2026-05-18 19:30:29.282835
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e9d27018633b"
down_revision = "20260518_06"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_map(bind, table_name: str) -> dict[str, dict]:
    return {column["name"]: column for column in sa.inspect(bind).get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def _foreign_key_names(bind, table_name: str) -> set[str]:
    names: set[str] = set()
    for foreign_key in sa.inspect(bind).get_foreign_keys(table_name):
        name = foreign_key.get("name")
        if name:
            names.add(str(name))
    return names


def _column_type_text(column: dict) -> str:
    return str(column.get("type") or "").lower()


def _is_string_like(column: dict) -> bool:
    type_text = _column_type_text(column)
    return "char" in type_text or "text" in type_text


def _ensure_column(bind, table_name: str, column: sa.Column) -> None:
    if table_name not in _table_names(bind):
        return
    columns = _column_map(bind, table_name)
    if column.name not in columns:
        op.add_column(table_name, column)


def _ensure_index(bind, table_name: str, index_name: str, columns: list[str], *, unique: bool = False) -> None:
    if table_name not in _table_names(bind):
        return
    if index_name not in _index_names(bind, table_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _ensure_foreign_key(
    bind,
    table_name: str,
    fk_name: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
) -> None:
    if table_name not in _table_names(bind) or referent_table not in _table_names(bind):
        return
    if fk_name in _foreign_key_names(bind, table_name):
        return
    with op.batch_alter_table(table_name) as batch_op:
        batch_op.create_foreign_key(fk_name, referent_table, local_cols, remote_cols)


def _coerce_org_id_to_string(bind, table_name: str) -> None:
    if table_name not in _table_names(bind):
        return
    columns = _column_map(bind, table_name)
    column = columns.get("org_id")
    if column is None or _is_string_like(column):
        return

    dialect = bind.dialect.name
    if dialect == "postgresql":
        bind.execute(
            sa.text(
                f"""
                ALTER TABLE {table_name}
                ALTER COLUMN org_id TYPE VARCHAR(36)
                USING CASE
                    WHEN org_id IS NULL THEN NULL
                    ELSE org_id::text
                END
                """
            )
        )
    else:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column(
                "org_id",
                existing_type=column["type"],
                type_=sa.String(length=36),
                existing_nullable=column.get("nullable", True),
            )


def _safe_backfill_invoice_org_id(bind) -> None:
    if "invoices" not in _table_names(bind) or "users" not in _table_names(bind):
        return
    invoice_columns = _column_map(bind, "invoices")
    user_columns = _column_map(bind, "users")
    if "org_id" not in invoice_columns or "user_id" not in invoice_columns or "org_id" not in user_columns:
        return

    bind.execute(
        sa.text(
            """
            UPDATE invoices
            SET org_id = (
                SELECT CAST(users.org_id AS VARCHAR(36))
                FROM users
                WHERE users.id = invoices.user_id
            )
            WHERE invoices.org_id IS NULL
              AND invoices.user_id IS NOT NULL
            """
        )
    )


def _safe_backfill_invoice_sub_id(bind) -> None:
    if "invoices" not in _table_names(bind) or "subscriptions" not in _table_names(bind):
        return
    invoice_columns = _column_map(bind, "invoices")
    subscription_columns = _column_map(bind, "subscriptions")
    if "sub_id" not in invoice_columns or "org_id" not in invoice_columns or "org_id" not in subscription_columns:
        return

    bind.execute(
        sa.text(
            """
            UPDATE invoices
            SET sub_id = (
                SELECT subscriptions.id
                FROM subscriptions
                WHERE CAST(subscriptions.org_id AS VARCHAR(36)) = CAST(invoices.org_id AS VARCHAR(36))
                  AND subscriptions.status IN ('active', 'trialing')
                ORDER BY subscriptions.created_at DESC
                LIMIT 1
            )
            WHERE invoices.sub_id IS NULL
              AND invoices.org_id IS NOT NULL
            """
        )
    )


def _can_create_invoice_org_fk(bind) -> bool:
    rows = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM invoices
            WHERE org_id IS NOT NULL
              AND org_id NOT IN (SELECT org_id FROM organizations)
            """
        )
    ).scalar()
    return int(rows or 0) == 0


def _can_create_invoice_sub_fk(bind) -> bool:
    rows = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM invoices
            WHERE sub_id IS NOT NULL
              AND sub_id NOT IN (SELECT id FROM subscriptions)
            """
        )
    ).scalar()
    return int(rows or 0) == 0


def _can_create_payment_order_org_fk(bind) -> bool:
    rows = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM payment_orders
            WHERE org_id IS NOT NULL
              AND org_id NOT IN (SELECT org_id FROM organizations)
            """
        )
    ).scalar()
    return int(rows or 0) == 0


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "invoices" in table_names:
        _ensure_column(bind, "invoices", sa.Column("payment_event_id", sa.String(length=64), nullable=True))
        _ensure_column(bind, "invoices", sa.Column("invoice_number", sa.String(length=64), nullable=True))
        _ensure_column(bind, "invoices", sa.Column("razorpay_payment_id", sa.String(length=64), nullable=True))
        _ensure_column(bind, "invoices", sa.Column("period_start", sa.DateTime(timezone=True), nullable=True))
        _ensure_column(bind, "invoices", sa.Column("period_end", sa.DateTime(timezone=True), nullable=True))
        _ensure_column(bind, "invoices", sa.Column("amount_paise", sa.Integer(), nullable=True))
        _ensure_column(bind, "invoices", sa.Column("org_id", sa.String(length=36), nullable=True))
        _ensure_column(bind, "invoices", sa.Column("sub_id", sa.Integer(), nullable=True))
        _coerce_org_id_to_string(bind, "invoices")
        with op.batch_alter_table("invoices") as batch_op:
            batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)
        _safe_backfill_invoice_org_id(bind)
        _safe_backfill_invoice_sub_id(bind)
        _ensure_index(bind, "invoices", "ix_invoices_org_id", ["org_id"], unique=False)
        _ensure_index(bind, "invoices", "ix_invoices_invoice_number", ["invoice_number"], unique=True)
        _ensure_index(bind, "invoices", "ix_invoices_payment_event_id", ["payment_event_id"], unique=True)
        if "organizations" in table_names and _can_create_invoice_org_fk(bind):
            _ensure_foreign_key(
                bind,
                "invoices",
                "fk_invoices_org_id_organizations",
                "organizations",
                ["org_id"],
                ["org_id"],
            )
        if "subscriptions" in table_names and _can_create_invoice_sub_fk(bind):
            _ensure_foreign_key(
                bind,
                "invoices",
                "fk_invoices_sub_id_subscriptions",
                "subscriptions",
                ["sub_id"],
                ["id"],
            )

    if "webhook_events" in table_names:
        _ensure_column(bind, "webhook_events", sa.Column("org_id", sa.String(length=36), nullable=True))
        _ensure_column(bind, "webhook_events", sa.Column("razorpay_event_id", sa.String(length=64), nullable=True))
        _ensure_column(bind, "webhook_events", sa.Column("status", sa.String(length=32), server_default="processed", nullable=False))
        _ensure_column(bind, "webhook_events", sa.Column("outcome", sa.String(length=64), nullable=True))
        _ensure_column(bind, "webhook_events", sa.Column("duration_ms", sa.Integer(), nullable=True))
        _coerce_org_id_to_string(bind, "webhook_events")
        _ensure_index(bind, "webhook_events", "ix_webhook_events_razorpay_event_id", ["razorpay_event_id"], unique=True)

    if "payment_orders" in table_names:
        with op.batch_alter_table("payment_orders") as batch_op:
            batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)
        if "organizations" in table_names and _can_create_payment_order_org_fk(bind):
            _ensure_foreign_key(
                bind,
                "payment_orders",
                "fk_payment_orders_org_id_organizations",
                "organizations",
                ["org_id"],
                ["org_id"],
            )

    if "subscriptions" in table_names:
        with op.batch_alter_table("subscriptions") as batch_op:
            batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    pass
