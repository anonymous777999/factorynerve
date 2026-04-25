"""Per-recipient alert type preferences."""

from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class AlertPreference(Base):
    __tablename__ = "alert_preferences"
    __table_args__ = (
        UniqueConstraint("recipient_id", "alert_type", name="uq_alert_preferences_recipient_alert_type"),
        Index("ix_alert_preferences_recipient_id", "recipient_id"),
        Index("ix_alert_preferences_alert_type", "alert_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("alert_recipients.id", ondelete="CASCADE"),
        nullable=False,
    )
    alert_type: Mapped[str] = mapped_column(String(80), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    recipient = relationship("AlertRecipient", back_populates="preferences")
