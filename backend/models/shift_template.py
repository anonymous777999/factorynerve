"""Shift template model for factory attendance windows."""

from __future__ import annotations

from datetime import datetime, time, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ShiftTemplate(Base):
    __tablename__ = "shift_templates"
    __table_args__ = (
        UniqueConstraint("factory_id", "shift_name", name="uq_shift_templates_factory_name"),
        Index("ix_shift_templates_org_factory", "org_id", "factory_id"),
        Index("ix_shift_templates_factory_default", "factory_id", "is_default"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False, index=True)
    shift_name: Mapped[str] = mapped_column(String(64), nullable=False)
    start_time: Mapped[time] = mapped_column(Time(), nullable=False)
    end_time: Mapped[time] = mapped_column(Time(), nullable=False)
    grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overtime_after_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=480)
    cross_midnight: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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
