"""Ledger transactions for steel inventory trust and traceability."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelInventoryTransaction(Base):
    __tablename__ = "steel_inventory_transactions"
    __table_args__ = (
        Index("ix_steel_inventory_transactions_factory_id", "factory_id"),
        Index("ix_steel_inventory_transactions_item_id", "item_id"),
        Index("ix_steel_inventory_transactions_reference", "reference_type", "reference_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(40), nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
