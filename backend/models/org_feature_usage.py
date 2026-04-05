"""Organization-level usage tracking for AI feature limits."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class OrgFeatureUsage(Base):
    __tablename__ = "org_feature_usage"
    __table_args__ = (
        Index(
            "ix_org_feature_usage_org_period_feature",
            "org_id",
            "period",
            "feature",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(String(36), nullable=False)
    period: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    feature: Mapped[str] = mapped_column(String(32), nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_request_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
