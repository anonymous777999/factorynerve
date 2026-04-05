"""Steel dispatch material lines linked back to invoice lines."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelDispatchLine(Base):
    __tablename__ = "steel_dispatch_lines"
    __table_args__ = (
        Index("ix_steel_dispatch_lines_dispatch_id", "dispatch_id"),
        Index("ix_steel_dispatch_lines_invoice_line_id", "invoice_line_id"),
        Index("ix_steel_dispatch_lines_item_id", "item_id"),
        Index("ix_steel_dispatch_lines_batch_id", "batch_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dispatch_id: Mapped[int] = mapped_column(ForeignKey("steel_dispatches.id"), nullable=False)
    invoice_line_id: Mapped[int] = mapped_column(ForeignKey("steel_sales_invoice_lines.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("steel_production_batches.id"), nullable=True)
    weight_kg: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
