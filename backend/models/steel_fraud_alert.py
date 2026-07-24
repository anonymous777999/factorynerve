"""Persistent fraud alert records with full lifecycle tracking.

Created when critical/high signals are detected by the fraud intelligence
service. Deduplicated by signal_fingerprint (signal_type + resource_id + date).
Lifecycle: active → acknowledged → investigating → resolved → dismissed.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelFraudAlert(Base):
    __tablename__ = "steel_fraud_alerts"
    __table_args__ = (
        UniqueConstraint("factory_id", "signal_fingerprint", name="uq_steel_fraud_alert_signal"),
        Index("ix_steel_fraud_alert_factory_status", "factory_id", "status"),
        Index("ix_steel_fraud_alert_severity", "severity"),
        Index("ix_steel_fraud_alert_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False, index=True)
    signal_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)

    # Signal provenance
    domain: Mapped[str] = mapped_column(String(24), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False)

    # Evidence
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Entity references
    resource_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    actor_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Lifecycle
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    acknowledged_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    dismissed_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Suppression (for recurring same-signal alerts)
    is_suppressed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    suppressed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
