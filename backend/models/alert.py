"""Alert ORM model and Pydantic schemas."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alerts_user_id", "user_id"),
        Index("ix_alerts_entry_id", "entry_id"),
        Index("ix_alerts_is_read", "is_read"),
        Index("ix_alerts_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    entry = relationship("Entry")
    user = relationship("User")


class AlertReadSchema(BaseModel):
    id: int
    entry_id: int
    user_id: int
    alert_type: str
    message: str
    severity: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
