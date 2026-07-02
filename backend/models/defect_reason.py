"""Lookup table for structured defect reasons.

Allows easy addition of new reasons without code changes.
Each reason has a human-readable label and optional description.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class DefectReason(Base):
    """Lookup table for structured defect reasons.

    Used by Entry.defect_reason_id to provide categorized quality defect data.
    Populated via seed data — new codes can be added without schema changes.
    """

    __tablename__ = "defect_reason"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<DefectReason id={self.id} code={self.code}>"
