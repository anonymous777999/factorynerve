"""DB-backed rate limit counters (sliding window via row-level locking)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class RateLimit(Base):
    """Atomic rate-limit bucket keyed by a logical ``key`` string.

    Each row represents one bucket.  Callers use ``SELECT ... FOR UPDATE`` to
    atomically read-and-increment within a transaction, so concurrent requests
    from the same key are properly serialised.
    """

    __tablename__ = "rate_limits"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
