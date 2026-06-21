"""Time-varying labour cost rates for workforce cost analytics.

Supports a user-level, role-level, department-level, and factory-level
fallback hierarchy so that cost analytics can be computed even when
individual wages are not configured.  All rates are per hour in INR.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class WorkforceCostRate(Base):
    """Labour cost rate entry with time-varying and fallback hierarchy."""

    __tablename__ = "workforce_cost_rates"
    __table_args__ = (
        Index("ix_wc_rates_factory_effective", "factory_id", "effective_from"),
        Index("ix_wc_rates_user_effective", "user_id", "effective_from"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)

    # ── Targeting hierarchy (most specific wins) ──────────────────────────
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # ── Rate data ─────────────────────────────────────────────────────────
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    regular_hourly_rate_inr: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    overtime_multiplier: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False, default=1.5)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)
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
