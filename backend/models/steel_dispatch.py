"""Steel dispatch header with gate pass and truck details."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelDispatch(Base):
    __tablename__ = "steel_dispatches"
    __table_args__ = (
        Index("ix_steel_dispatches_factory_id", "factory_id"),
        Index("ix_steel_dispatches_dispatch_number", "dispatch_number", unique=True),
        Index("ix_steel_dispatches_gate_pass_number", "gate_pass_number", unique=True),
        Index("ix_steel_dispatches_invoice_id", "invoice_id"),
        Index("ix_steel_dispatches_dispatch_date", "dispatch_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("steel_sales_invoices.id"), nullable=False)
    dispatch_number: Mapped[str] = mapped_column(String(40), nullable=False)
    gate_pass_number: Mapped[str] = mapped_column(String(40), nullable=False)
    dispatch_date: Mapped[date] = mapped_column(Date, nullable=False)
    truck_number: Mapped[str] = mapped_column(String(40), nullable=False)
    transporter_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    truck_capacity_kg: Mapped[float | None] = mapped_column(Numeric(14, 3), nullable=True)
    driver_name: Mapped[str] = mapped_column(String(120), nullable=False)
    driver_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    driver_license_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    entry_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exit_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="dispatched")
    total_weight_kg: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    receiver_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    pod_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    inventory_posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
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
