"""Production batch records for steel expected-vs-actual tracking."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelProductionBatch(Base):
    __tablename__ = "steel_production_batches"
    __table_args__ = (
        Index("ix_steel_production_batches_factory_id", "factory_id"),
        Index("ix_steel_production_batches_batch_code", "batch_code", unique=True),
        Index("ix_steel_production_batches_operator_user_id", "operator_user_id"),
        Index("ix_steel_production_batches_production_date", "production_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    batch_code: Mapped[str] = mapped_column(String(40), nullable=False)
    production_date: Mapped[date] = mapped_column(Date, nullable=False)
    input_item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False, index=True)
    output_item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False, index=True)
    operator_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    input_quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    expected_output_kg: Mapped[float] = mapped_column(Float, nullable=False)
    actual_output_kg: Mapped[float] = mapped_column(Float, nullable=False)
    loss_kg: Mapped[float] = mapped_column(Float, nullable=False)
    loss_percent: Mapped[float] = mapped_column(Float, nullable=False)
    variance_kg: Mapped[float] = mapped_column(Float, nullable=False)
    variance_percent: Mapped[float] = mapped_column(Float, nullable=False)
    variance_value_inr: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="recorded")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
