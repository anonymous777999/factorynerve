"""Allocation rows that link a customer payment to one or more invoices."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelCustomerPaymentAllocation(Base):
    __tablename__ = "steel_customer_payment_allocations"
    __table_args__ = (
        Index("ix_steel_customer_payment_allocations_factory_id", "factory_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("steel_customers.id"), nullable=False, index=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("steel_customer_payments.id"), nullable=False, index=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("steel_sales_invoices.id"), nullable=False, index=True)
    allocated_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
