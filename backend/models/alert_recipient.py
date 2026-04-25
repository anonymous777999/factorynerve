"""Recipient model for generic WhatsApp alert delivery."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class AlertRecipient(Base):
    __tablename__ = "alert_recipients"
    __table_args__ = (
        UniqueConstraint("phone_e164", name="uq_alert_recipients_phone_e164"),
        Index("ix_alert_recipients_phone_e164", "phone_e164"),
        Index("ix_alert_recipients_is_active", "is_active"),
        Index("ix_alert_recipients_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    preferences = relationship(
        "AlertPreference",
        back_populates="recipient",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    logs = relationship(
        "AlertLog",
        back_populates="recipient",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
