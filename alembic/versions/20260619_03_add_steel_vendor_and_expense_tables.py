"""add_steel_vendor_and_expense_tables

Revision ID: 20260619_03
Revises: 20260619_01
Create Date: 2026-06-19 16:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260619_03"
down_revision = "20260619_01_add_factory_code_unique_constraint"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "steel_vendors" not in table_names:
        op.create_table(
            "steel_vendors",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("vendor_code", sa.String(24), nullable=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("phone", sa.String(32), nullable=True),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("address", sa.String(500), nullable=True),
            sa.Column("city", sa.String(120), nullable=True),
            sa.Column("state", sa.String(120), nullable=True),
            sa.Column("gst_number", sa.String(32), nullable=True),
            sa.Column("pan_number", sa.String(16), nullable=True),
            sa.Column("contact_person", sa.String(160), nullable=True),
            sa.Column("payment_terms_days", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("credit_limit", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("status", sa.String(24), nullable=False, server_default="active"),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("factory_id", "name", name="uq_steel_vendors_factory_name"),
        )
        op.create_index("ix_steel_vendors_factory_id", "steel_vendors", ["factory_id"])
        op.create_index("ix_steel_vendors_org_id", "steel_vendors", ["org_id"])

    if "steel_vendor_bills" not in table_names:
        op.create_table(
            "steel_vendor_bills",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("vendor_id", sa.Integer(), nullable=False),
            sa.Column("bill_number", sa.String(40), nullable=False),
            sa.Column("bill_date", sa.Date(), nullable=False),
            sa.Column("due_date", sa.Date(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="unpaid"),
            sa.Column("expense_category", sa.String(40), nullable=False, server_default="raw_material"),
            sa.Column("currency", sa.String(8), nullable=False, server_default="INR"),
            sa.Column("subtotal_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("total_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.ForeignKeyConstraint(["vendor_id"], ["steel_vendors.id"],),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_steel_vendor_bills_factory_id", "steel_vendor_bills", ["factory_id"])
        op.create_index("ix_steel_vendor_bills_vendor_id", "steel_vendor_bills", ["vendor_id"])
        op.create_index("ix_steel_vendor_bills_bill_date", "steel_vendor_bills", ["bill_date"])
        op.create_index("ix_steel_vendor_bills_due_date", "steel_vendor_bills", ["due_date"])
        op.create_index("ix_steel_vendor_bills_status", "steel_vendor_bills", ["status"])

    if "steel_vendor_bill_lines" not in table_names:
        op.create_table(
            "steel_vendor_bill_lines",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("bill_id", sa.Integer(), nullable=False),
            sa.Column("item_id", sa.Integer(), nullable=True),
            sa.Column("description", sa.String(200), nullable=True),
            sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="1"),
            sa.Column("unit", sa.String(16), nullable=False, server_default="kg"),
            sa.Column("rate", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("line_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("expense_category", sa.String(40), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["bill_id"], ["steel_vendor_bills.id"],),
            sa.ForeignKeyConstraint(["item_id"], ["steel_inventory_items.id"],),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_steel_vendor_bill_lines_bill_id", "steel_vendor_bill_lines", ["bill_id"])
        op.create_index("ix_steel_vendor_bill_lines_item_id", "steel_vendor_bill_lines", ["item_id"])

    if "steel_vendor_payments" not in table_names:
        op.create_table(
            "steel_vendor_payments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("vendor_id", sa.Integer(), nullable=False),
            sa.Column("bill_id", sa.Integer(), nullable=True),
            sa.Column("payment_date", sa.Date(), nullable=False),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("payment_mode", sa.String(32), nullable=False, server_default="bank_transfer"),
            sa.Column("reference_number", sa.String(80), nullable=True),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.ForeignKeyConstraint(["vendor_id"], ["steel_vendors.id"],),
            sa.ForeignKeyConstraint(["bill_id"], ["steel_vendor_bills.id"],),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_steel_vendor_payments_factory_id", "steel_vendor_payments", ["factory_id"])
        op.create_index("ix_steel_vendor_payments_vendor_id", "steel_vendor_payments", ["vendor_id"])
        op.create_index("ix_steel_vendor_payments_payment_date", "steel_vendor_payments", ["payment_date"])

    if "steel_vendor_payment_allocations" not in table_names:
        op.create_table(
            "steel_vendor_payment_allocations",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("vendor_id", sa.Integer(), nullable=False),
            sa.Column("payment_id", sa.Integer(), nullable=False),
            sa.Column("bill_id", sa.Integer(), nullable=False),
            sa.Column("allocated_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.ForeignKeyConstraint(["vendor_id"], ["steel_vendors.id"],),
            sa.ForeignKeyConstraint(["payment_id"], ["steel_vendor_payments.id"],),
            sa.ForeignKeyConstraint(["bill_id"], ["steel_vendor_bills.id"],),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_steel_vendor_payment_allocations_factory_id", "steel_vendor_payment_allocations", ["factory_id"])
        op.create_index("ix_steel_vendor_payment_allocations_payment_id", "steel_vendor_payment_allocations", ["payment_id"])
        op.create_index("ix_steel_vendor_payment_allocations_bill_id", "steel_vendor_payment_allocations", ["bill_id"])

    if "steel_expenses" not in table_names:
        op.create_table(
            "steel_expenses",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("expense_number", sa.String(40), nullable=True),
            sa.Column("expense_date", sa.Date(), nullable=False),
            sa.Column("category", sa.String(40), nullable=False, server_default="other"),
            sa.Column("description", sa.String(300), nullable=False),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("total_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("payment_status", sa.String(16), nullable=False, server_default="unpaid"),
            sa.Column("vendor_id", sa.Integer(), nullable=True),
            sa.Column("bill_id", sa.Integer(), nullable=True),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("is_reimbursable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("approved_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.ForeignKeyConstraint(["vendor_id"], ["steel_vendors.id"],),
            sa.ForeignKeyConstraint(["bill_id"], ["steel_vendor_bills.id"],),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_steel_expenses_factory_id", "steel_expenses", ["factory_id"])
        op.create_index("ix_steel_expenses_expense_date", "steel_expenses", ["expense_date"])
        op.create_index("ix_steel_expenses_category", "steel_expenses", ["category"])
        op.create_index("ix_steel_expenses_payment_status", "steel_expenses", ["payment_status"])


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    for table in (
        "steel_expenses",
        "steel_vendor_payment_allocations",
        "steel_vendor_payments",
        "steel_vendor_bill_lines",
        "steel_vendor_bills",
        "steel_vendors",
    ):
        if table in table_names:
            op.drop_table(table)
