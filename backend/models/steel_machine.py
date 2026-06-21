"""Machine model for steel factories — tracks machine-level utilization and performance."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelMachine(Base):
    """A machine/equipment asset within a steel factory (e.g., "Furnace #3", "Rolling Stand 2")."""

    __tablename__ = "steel_machines"
    __table_args__ = (
        Index("ix_steel_machines_factory_id", "factory_id"),
        Index(
            "uq_steel_machines_factory_code",
            "factory_id",
            "machine_code",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    line_id: Mapped[int | None] = mapped_column(ForeignKey("steel_production_lines.id"), nullable=True)
    machine_code: Mapped[str] = mapped_column(String(24), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    machine_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    rated_capacity_per_hour: Mapped[float | None] = mapped_column(Float, nullable=True)
    # OEE tracking fields — planned vs actual runtime
    planned_runtime_minutes: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    operating_runtime_minutes: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
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
