"""Add GST columns to steel_sales_invoices and audit_logs indexes."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "20260614_01_add_gst_and_audit_indexes"
down_revision = "20260613_03_add_steel_customer_party_type_bank"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # GST columns for steel_sales_invoices
    op.add_column("steel_sales_invoices", sa.Column("gst_rate", sa.Numeric(5, 2), nullable=True))
    op.add_column("steel_sales_invoices", sa.Column("supply_type", sa.String(8), nullable=True))
    op.add_column("steel_sales_invoices", sa.Column("taxable_amount", sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("steel_sales_invoices", sa.Column("cgst_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("steel_sales_invoices", sa.Column("sgst_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("steel_sales_invoices", sa.Column("igst_amount", sa.Numeric(14, 2), nullable=True))

    # Audit log indexes
    op.create_index("ix_audit_logs_factory_id", "audit_logs", ["factory_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
    op.create_index("ix_audit_logs_factory_action", "audit_logs", ["factory_id", "action"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_factory_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_timestamp", table_name="audit_logs")
    op.drop_index("ix_audit_logs_factory_id", table_name="audit_logs")
    op.drop_column("steel_sales_invoices", "igst_amount")
    op.drop_column("steel_sales_invoices", "sgst_amount")
    op.drop_column("steel_sales_invoices", "cgst_amount")
    op.drop_column("steel_sales_invoices", "taxable_amount")
    op.drop_column("steel_sales_invoices", "supply_type")
    op.drop_column("steel_sales_invoices", "gst_rate")
