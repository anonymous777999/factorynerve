"""Make unique constraints factory-scoped (drop global, add composite)."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260614_02_factory_scoped_unique_constraints"
down_revision = "e9d27018633b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Steel sales invoices - factory_id + invoice_number
    op.drop_index("ix_steel_sales_invoices_invoice_number", table_name="steel_sales_invoices")
    op.create_index(
        "ix_steel_sales_invoices_invoice_number",
        "steel_sales_invoices",
        ["factory_id", "invoice_number"],
        unique=True,
    )

    # Steel dispatches - factory_id + dispatch_number
    op.drop_index("ix_steel_dispatches_dispatch_number", table_name="steel_dispatches")
    op.create_index(
        "ix_steel_dispatches_dispatch_number",
        "steel_dispatches",
        ["factory_id", "dispatch_number"],
        unique=True,
    )

    # Steel dispatches - factory_id + gate_pass_number
    op.drop_index("ix_steel_dispatches_gate_pass_number", table_name="steel_dispatches")
    op.create_index(
        "ix_steel_dispatches_gate_pass_number",
        "steel_dispatches",
        ["factory_id", "gate_pass_number"],
        unique=True,
    )

    # Steel production batches - factory_id + batch_code
    op.drop_index("ix_steel_production_batches_batch_code", table_name="steel_production_batches")
    op.create_index(
        "ix_steel_production_batches_batch_code",
        "steel_production_batches",
        ["factory_id", "batch_code"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_steel_production_batches_batch_code", table_name="steel_production_batches")
    op.create_index(
        "ix_steel_production_batches_batch_code",
        "steel_production_batches",
        ["batch_code"],
        unique=True,
    )
    op.drop_index("ix_steel_dispatches_gate_pass_number", table_name="steel_dispatches")
    op.create_index(
        "ix_steel_dispatches_gate_pass_number",
        "steel_dispatches",
        ["gate_pass_number"],
        unique=True,
    )
    op.drop_index("ix_steel_dispatches_dispatch_number", table_name="steel_dispatches")
    op.create_index(
        "ix_steel_dispatches_dispatch_number",
        "steel_dispatches",
        ["dispatch_number"],
        unique=True,
    )
    op.drop_index("ix_steel_sales_invoices_invoice_number", table_name="steel_sales_invoices")
    op.create_index(
        "ix_steel_sales_invoices_invoice_number",
        "steel_sales_invoices",
        ["invoice_number"],
        unique=True,
    )
