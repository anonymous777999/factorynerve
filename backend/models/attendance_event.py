"""Raw attendance punch events captured for audit and review."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class AttendanceEvent(Base):
    __tablename__ = "attendance_events"
    __table_args__ = (
        Index("ix_attendance_events_org_date", "org_id", "attendance_date"),
        Index("ix_attendance_events_factory_date", "factory_id", "attendance_date"),
        Index("ix_attendance_events_user_time", "user_id", "event_time"),
        Index("ix_attendance_events_record", "attendance_record_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    attendance_record_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str | None] = mapped_column(String(16), nullable=True)
    event_type: Mapped[str] = mapped_column(String(8), nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="self-service")
    device_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gps_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    selfie_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
