"""Steel customer payment tracking for outstanding ledger visibility."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelCustomerPayment(Base):
    __tablename__ = "steel_customer_payments"
    __table_args__ = (
        Index("ix_steel_customer_payments_factory_id", "factory_id"),
        Index("ix_steel_customer_payments_customer_id", "customer_id"),
        Index("ix_steel_customer_payments_invoice_id", "invoice_id"),
        Index("ix_steel_customer_payments_payment_date", "payment_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("steel_customers.id"), nullable=False)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("steel_sales_invoices.id"), nullable=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    payment_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="bank_transfer")
    reference_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
