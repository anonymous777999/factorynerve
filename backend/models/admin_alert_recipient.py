"""Admin-managed WhatsApp recipients for operational alerts."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base
from backend.models.phone_verification import PhoneVerificationStatus


class AdminAlertRecipient(Base):
    __tablename__ = "admin_alert_recipients"
    __table_args__ = (
        UniqueConstraint("org_id", "phone_number", name="uq_admin_alert_recipients_org_phone"),
        Index("ix_admin_alert_recipients_org_id", "org_id"),
        Index("ix_admin_alert_recipients_user_id", "user_id"),
        Index("ix_admin_alert_recipients_is_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False)
    phone_e164: Mapped[str | None] = mapped_column(String(20), nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default=PhoneVerificationStatus.PENDING.value,
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    otp_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_otp_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    event_types: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    severity_levels: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    receive_daily_summary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
