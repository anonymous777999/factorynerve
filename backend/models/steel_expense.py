"""Steel direct operational expense tracking (non-vendor-bill-driven OPEX).

For expenses linked to a vendor bill, use SteelVendorBill instead.
This model covers quick operational expenses like petty cash, ad-hoc payments,
and one-off costs that don't go through the vendor bill lifecycle.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelExpense(Base):
    __tablename__ = "steel_expenses"
    __table_args__ = (
        Index("ix_steel_expenses_factory_id", "factory_id"),
        Index("ix_steel_expenses_expense_date", "expense_date"),
        Index("ix_steel_expenses_category", "category"),
        Index("ix_steel_expenses_payment_status", "payment_status"),
        Index("uq_steel_expenses_factory_expense_number", "factory_id", "expense_number", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    expense_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="other")
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    payment_status: Mapped[str] = mapped_column(String(16), nullable=False, default="unpaid")
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("steel_vendors.id"), nullable=True)
    bill_id: Mapped[int | None] = mapped_column(ForeignKey("steel_vendor_bills.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_reimbursable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
