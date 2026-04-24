"""Daily aggregate summaries for operational alerts."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class OpsAlertDailySummary(Base):
    __tablename__ = "ops_alert_daily_summaries"
    __table_args__ = (
        UniqueConstraint("org_id", "summary_date", name="uq_ops_alert_daily_summaries_org_date"),
        Index("ix_ops_alert_daily_summaries_org_date", "org_id", "summary_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(String(36), nullable=False)
    org_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_alerts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    high_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    top_event_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
