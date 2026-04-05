"""Weight-based steel sales invoice header."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelSalesInvoice(Base):
    __tablename__ = "steel_sales_invoices"
    __table_args__ = (
        Index("ix_steel_sales_invoices_factory_id", "factory_id"),
        Index("ix_steel_sales_invoices_invoice_number", "invoice_number", unique=True),
        Index("ix_steel_sales_invoices_invoice_date", "invoice_date"),
        Index("ix_steel_sales_invoices_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("steel_customers.id"), nullable=True, index=True)
    invoice_number: Mapped[str] = mapped_column(String(40), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unpaid")
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_weight_kg: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=0)
    subtotal_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
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
