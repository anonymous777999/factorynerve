"""Weight-based steel sales invoice lines."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelSalesInvoiceLine(Base):
    __tablename__ = "steel_sales_invoice_lines"
    __table_args__ = (
        Index("ix_steel_sales_invoice_lines_invoice_id", "invoice_id"),
        Index("ix_steel_sales_invoice_lines_item_id", "item_id"),
        Index("ix_steel_sales_invoice_lines_batch_id", "batch_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("steel_sales_invoices.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("steel_production_batches.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    weight_kg: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=0)
    rate_per_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
