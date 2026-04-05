"""Entry ORM model for DPR records."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class ShiftType(str, Enum):
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"


class Entry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        Index("ix_entries_user_id", "user_id"),
        Index("ix_entries_date", "date"),
        Index("ix_entries_org_id", "org_id"),
        Index("ix_entries_factory_id", "factory_id"),
        Index("ix_entries_client_request_id", "client_request_id"),
        Index("ix_entries_org_date", "org_id", "date"),
        Index("ix_entries_factory_date", "factory_id", "date"),
        Index("ix_entries_org_created_at", "org_id", "created_at"),
        Index("ix_entries_factory_shift_date", "factory_id", "shift", "date"),
        Index("ix_entries_org_shift_date", "org_id", "shift", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    org_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.org_id"), nullable=True)
    factory_id: Mapped[str | None] = mapped_column(ForeignKey("factories.factory_id"), nullable=True)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    shift: Mapped[ShiftType] = mapped_column(SqlEnum(ShiftType, name="shift_type"), nullable=False)
    units_target: Mapped[int] = mapped_column(Integer, nullable=False)
    units_produced: Mapped[int] = mapped_column(Integer, nullable=False)
    manpower_present: Mapped[int] = mapped_column(Integer, nullable=False)
    manpower_absent: Mapped[int] = mapped_column(Integer, nullable=False)
    downtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    downtime_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    materials_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_issues: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quality_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="entries")

    @property
    def submitted_by(self) -> str | None:
        return self.user.name if self.user else None
