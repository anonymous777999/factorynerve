"""Steel customer recovery and follow-up tasks."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelCustomerFollowUpTask(Base):
    __tablename__ = "steel_customer_follow_up_tasks"
    __table_args__ = (
        Index("ix_steel_customer_follow_up_tasks_factory_id", "factory_id"),
        Index("ix_steel_customer_follow_up_tasks_customer_id", "customer_id"),
        Index("ix_steel_customer_follow_up_tasks_due_date", "due_date"),
        Index("ix_steel_customer_follow_up_tasks_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("steel_customers.id"), nullable=False)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("steel_sales_invoices.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    assigned_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
