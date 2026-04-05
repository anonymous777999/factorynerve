"""Attendance model for factory punch in/out tracking."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("user_id", "factory_id", "attendance_date", name="uq_attendance_records_user_factory_date"),
        Index("ix_attendance_records_org_date", "org_id", "attendance_date"),
        Index("ix_attendance_records_factory_date", "factory_id", "attendance_date"),
        Index("ix_attendance_records_user_date", "user_id", "attendance_date"),
        Index("ix_attendance_records_status", "status"),
        Index("ix_attendance_records_review_status", "review_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str] = mapped_column(String(16), nullable=False, default="morning")
    shift_template_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="working")
    review_status: Mapped[str] = mapped_column(String(24), nullable=False, default="auto")
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="self-service")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    punch_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    punch_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    worked_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    late_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    approved_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
