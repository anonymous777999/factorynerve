"""Maintenance task scheduling and tracking for steel factory machines."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelMaintenanceTask(Base):
    """A scheduled or completed maintenance task on a steel machine.

    Tracks maintenance type (preventive/predictive/corrective), scheduled
    and completion dates, assigned operator, and runtime-based triggers
    for predicting when maintenance is due.
    """

    __tablename__ = "steel_maintenance_tasks"
    __table_args__ = (
        Index("ix_steel_maintenance_tasks_factory_id", "factory_id"),
        Index("ix_steel_maintenance_tasks_machine_id", "machine_id"),
        Index("ix_steel_maintenance_tasks_status", "status"),
        Index("ix_steel_maintenance_tasks_scheduled_date", "scheduled_date"),
        Index("ix_steel_maintenance_tasks_factory_status_date", "factory_id", "machine_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    machine_id: Mapped[int] = mapped_column(ForeignKey("steel_machines.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    maintenance_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="preventive"
    )
    # preventive | predictive | corrective | inspection | lubricating
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="scheduled"
    )
    # scheduled | in_progress | completed | cancelled | skipped
    priority: Mapped[str] = mapped_column(String(12), nullable=False, default="medium")
    # low | medium | high | critical
    scheduled_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    runtime_hours_trigger: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
