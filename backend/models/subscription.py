"""Subscription and trial state."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("ix_subscriptions_user_id", "user_id", unique=True),
        Index("ix_subscriptions_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    plan: Mapped[str] = mapped_column(String(32), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="trialing", nullable=False)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trial_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pending_plan: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pending_plan_effective_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
