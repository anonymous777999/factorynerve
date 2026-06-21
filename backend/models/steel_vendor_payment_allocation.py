"""Allocation rows that link a vendor payment to one or more bills."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelVendorPaymentAllocation(Base):
    __tablename__ = "steel_vendor_payment_allocations"
    __table_args__ = (
        Index("ix_steel_vendor_payment_allocations_factory_id", "factory_id"),
        Index("ix_steel_vendor_payment_allocations_payment_id", "payment_id"),
        Index("ix_steel_vendor_payment_allocations_bill_id", "bill_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("steel_vendors.id"), nullable=False)
    payment_id: Mapped[int] = mapped_column(ForeignKey("steel_vendor_payments.id"), nullable=False)
    bill_id: Mapped[int] = mapped_column(ForeignKey("steel_vendor_bills.id"), nullable=False)
    allocated_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
