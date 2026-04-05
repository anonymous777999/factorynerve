"""Physical stock verification records for steel stock confidence."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelStockReconciliation(Base):
    __tablename__ = "steel_stock_reconciliations"
    __table_args__ = (
        Index("ix_steel_stock_reconciliations_factory_id", "factory_id"),
        Index("ix_steel_stock_reconciliations_item_id", "item_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False)
    physical_qty_kg: Mapped[float] = mapped_column(Float, nullable=False)
    system_qty_kg: Mapped[float] = mapped_column(Float, nullable=False)
    variance_kg: Mapped[float] = mapped_column(Float, nullable=False)
    variance_percent: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_status: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    counted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    submitted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    rejected_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approver_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mismatch_cause: Mapped[str | None] = mapped_column(String(40), nullable=True)
    counted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
