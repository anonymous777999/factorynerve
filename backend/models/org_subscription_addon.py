"""Organization-level paid add-ons attached to a subscription."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class OrgSubscriptionAddon(Base):
    __tablename__ = "org_subscription_addons"
    __table_args__ = (
        UniqueConstraint("org_id", "addon_id", name="uq_org_subscription_addons_org_addon"),
        Index("ix_org_subscription_addons_org_id", "org_id"),
        Index("ix_org_subscription_addons_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False)
    addon_id: Mapped[str] = mapped_column(String(32), nullable=False)
    feature_key: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    billing_cycle: Mapped[str] = mapped_column(String(16), nullable=False, default="monthly")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    purchased_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
    current_period_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
