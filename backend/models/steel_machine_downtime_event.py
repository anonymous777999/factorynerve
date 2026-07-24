"""Per-machine downtime event tracking for OEE and MTBF/MTTR calculation."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelMachineDowntimeEvent(Base):
    """A discrete downtime event for a specific machine.

    Tracks when a machine went down, when it came back up, the duration,
    the reason category, and the operator/shift responsible. Used to
    compute machine uptime %, MTBF, MTTR, and to identify recurring
    downtime patterns.
    """

    __tablename__ = "steel_machine_downtime_events"
    __table_args__ = (
        Index("ix_steel_machine_downtime_events_factory_id", "factory_id"),
        Index("ix_steel_machine_downtime_events_machine_id", "machine_id"),
        Index("ix_steel_machine_downtime_events_started_at", "started_at"),
        Index("ix_steel_machine_downtime_events_ended_at", "ended_at"),
        Index("ix_steel_machine_downtime_events_factory_machine_date", "factory_id", "machine_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    machine_id: Mapped[int] = mapped_column(ForeignKey("steel_machines.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason_category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    reason_detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    shift: Mapped[str | None] = mapped_column(String(16), nullable=True)
    operator_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    entry_id: Mapped[int | None] = mapped_column(ForeignKey("entries.id"), nullable=True)
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
