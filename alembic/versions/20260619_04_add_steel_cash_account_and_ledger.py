"""add_steel_cash_account_and_ledger_tables

Revision ID: 20260619_04
Revises: 20260619_03
Create Date: 2026-06-19 17:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260619_04"
down_revision = "20260619_03"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    if "steel_cash_accounts" not in table_names:
        op.create_table(
            "steel_cash_accounts",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("account_name", sa.String(160), nullable=False),
            sa.Column("account_type", sa.String(24), nullable=False, server_default="bank"),
            sa.Column("account_number", sa.String(40), nullable=True),
            sa.Column("bank_name", sa.String(160), nullable=True),
            sa.Column("ifsc_code", sa.String(20), nullable=True),
            sa.Column("opening_balance", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("current_balance", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(8), nullable=False, server_default="INR"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_steel_cash_accounts_factory_id", "steel_cash_accounts", ["factory_id"])
        op.create_index("ix_steel_cash_accounts_org_id", "steel_cash_accounts", ["org_id"])
        op.create_index("ix_steel_cash_accounts_account_type", "steel_cash_accounts", ["account_type"])
        op.create_index("ix_steel_cash_accounts_is_active", "steel_cash_accounts", ["is_active"])

    if "steel_cash_ledger_entries" not in table_names:
        op.create_table(
            "steel_cash_ledger_entries",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("org_id", sa.String(), nullable=False),
            sa.Column("factory_id", sa.String(), nullable=False),
            sa.Column("account_id", sa.Integer(), nullable=False),
            sa.Column("entry_date", sa.Date(), nullable=False),
            sa.Column("entry_type", sa.String(8), nullable=False),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("balance_after", sa.Numeric(14, 2), nullable=False, server_default="0"),
            sa.Column("reference_type", sa.String(40), nullable=True),
            sa.Column("reference_id", sa.String(80), nullable=True),
            sa.Column("description", sa.String(300), nullable=False),
            sa.Column("category", sa.String(40), nullable=True),
            sa.Column("payment_mode", sa.String(24), nullable=False, server_default="bank_transfer"),
            sa.Column("notes", sa.String(500), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.org_id"],),
            sa.ForeignKeyConstraint(["factory_id"], ["factories.factory_id"],),
            sa.ForeignKeyConstraint(["account_id"], ["steel_cash_accounts.id"],),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_steel_cash_ledger_entries_factory_id", "steel_cash_ledger_entries", ["factory_id"])
        op.create_index("ix_steel_cash_ledger_entries_org_id", "steel_cash_ledger_entries", ["org_id"])
        op.create_index("ix_steel_cash_ledger_entries_account_id", "steel_cash_ledger_entries", ["account_id"])
        op.create_index("ix_steel_cash_ledger_entries_entry_date", "steel_cash_ledger_entries", ["entry_date"])
        op.create_index("ix_steel_cash_ledger_entries_entry_type", "steel_cash_ledger_entries", ["entry_type"])
        op.create_index("ix_steel_cash_ledger_entries_reference_type", "steel_cash_ledger_entries", ["reference_type"])
        op.create_index("ix_steel_cash_ledger_entries_category", "steel_cash_ledger_entries", ["category"])


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)

    for table in ("steel_cash_ledger_entries", "steel_cash_accounts"):
        if table in table_names:
            op.drop_table(table)
