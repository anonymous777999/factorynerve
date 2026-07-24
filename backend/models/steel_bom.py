"""P1-4: Bill of Materials for steel production.

Each BOM links one output item to a list of input items with consumption ratios.
Example: 1 ton of TMT Bar (output) requires 1.05 tons of Billet (input) + 0.02 tons of Alloy (input).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelBom(Base):
    """BOM header — links an output item to its bill of materials.

    A factory can have multiple BOMs for the same output item (different recipes),
    but only one can be active as the default at a time.
    """
    __tablename__ = "steel_boms"
    __table_args__ = (
        Index("ix_steel_boms_factory_id", "factory_id"),
        Index("ix_steel_boms_output_item_id", "output_item_id"),
        UniqueConstraint("factory_id", "name", name="uq_steel_boms_factory_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    output_item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False)
    output_quantity_kg: Mapped[float] = mapped_column(Float, nullable=False, default=1000.0)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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


class SteelBomLine(Base):
    """Individual line in a BOM — one input item with consumption ratio.

    ratio_kg defines how many kg of this input item are needed per output_quantity_kg
    of the output item. Example: ratio_kg=1050 for output_quantity_kg=1000 means
    1.05 kg input per 1 kg output.
    """
    __tablename__ = "steel_bom_lines"
    __table_args__ = (
        Index("ix_steel_bom_lines_bom_id", "bom_id"),
        Index("ix_steel_bom_lines_item_id", "item_id"),
        UniqueConstraint("bom_id", "item_id", name="uq_steel_bom_lines_bom_item"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("steel_boms.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("steel_inventory_items.id"), nullable=False)
    ratio_kg: Mapped[float] = mapped_column(Float, nullable=False)
    is_consumable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
