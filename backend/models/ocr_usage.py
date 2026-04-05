"""Usage tracking for OCR limits."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class OcrUsage(Base):
    __tablename__ = "ocr_usage"
    __table_args__ = (Index("ix_ocr_usage_user_period", "user_id", "period", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    period: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_request_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
