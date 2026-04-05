"""Attendance regularization requests for missed punch and manual review."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class AttendanceRegularization(Base):
    __tablename__ = "attendance_regularizations"
    __table_args__ = (
        Index("ix_attendance_regularizations_org_status", "org_id", "status"),
        Index("ix_attendance_regularizations_factory_status", "factory_id", "status"),
        Index("ix_attendance_regularizations_record", "attendance_record_id"),
        Index("ix_attendance_regularizations_user_date", "user_id", "attendance_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    attendance_record_id: Mapped[int] = mapped_column(ForeignKey("attendance_records.id"), nullable=False)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    request_type: Mapped[str] = mapped_column(String(32), nullable=False, default="missed_punch")
    requested_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    reviewer_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
