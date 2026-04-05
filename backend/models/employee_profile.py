"""Attendance employee profile model for factory roster mapping."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", "factory_id", name="uq_employee_profiles_user_factory"),
        Index("ix_employee_profiles_org_factory", "org_id", "factory_id"),
        Index("ix_employee_profiles_factory_department", "factory_id", "department"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    employee_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    employment_type: Mapped[str] = mapped_column(String(32), nullable=False, default="permanent")
    reporting_manager_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_shift: Mapped[str] = mapped_column(String(16), nullable=False, default="morning")
    joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
