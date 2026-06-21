"""Line items on a steel vendor bill for cost allocation."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelVendorBillLine(Base):
    __tablename__ = "steel_vendor_bill_lines"
    __table_args__ = (
        Index("ix_steel_vendor_bill_lines_bill_id", "bill_id"),
        Index("ix_steel_vendor_bill_lines_item_id", "item_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("steel_vendor_bills.id"), nullable=False)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=1)
    unit: Mapped[str] = mapped_column(String(16), nullable=False, default="kg")
    rate: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    expense_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
