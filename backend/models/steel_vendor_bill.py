"""Steel vendor bill (purchase invoice) for accounts payable."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelVendorBill(Base):
    __tablename__ = "steel_vendor_bills"
    __table_args__ = (
        Index("ix_steel_vendor_bills_factory_id", "factory_id"),
        Index("ix_steel_vendor_bills_vendor_id", "vendor_id"),
        Index("ix_steel_vendor_bills_bill_date", "bill_date"),
        Index("ix_steel_vendor_bills_due_date", "due_date"),
        Index("ix_steel_vendor_bills_status", "status"),
        Index("uq_steel_vendor_bills_factory_bill_number", "factory_id", "bill_number", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("steel_vendors.id"), nullable=False)
    bill_number: Mapped[str] = mapped_column(String(40), nullable=False)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unpaid")
    expense_category: Mapped[str] = mapped_column(String(40), nullable=False, default="raw_material")
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    subtotal_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
