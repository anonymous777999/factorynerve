"""Persistence model for backend operational alert delivery history."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class OpsAlertEvent(Base):
    __tablename__ = "ops_alert_events"
    __table_args__ = (
        UniqueConstraint("ref_id", "recipient_phone", name="uq_ops_alert_events_ref_recipient"),
        Index("ix_ops_alert_events_ref_id", "ref_id"),
        Index("ix_ops_alert_events_event_type", "event_type"),
        Index("ix_ops_alert_events_delivery_status", "delivery_status"),
        Index("ix_ops_alert_events_created_at", "created_at"),
        Index("ix_ops_alert_events_org_created_at", "org_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref_id: Mapped[str] = mapped_column(String(80), nullable=False)
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    org_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    dedup_key: Mapped[str] = mapped_column(String(255), nullable=False)
    group_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    escalation_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_summary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_phone: Mapped[str | None] = mapped_column(String(48), nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    delivery_status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    suppressed_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
