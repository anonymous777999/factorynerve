"""Idempotency key tracking for safe retry of mutating API endpoints.

Ensures that duplicate POST requests (network retries, double-clicks,
browser replays) do not create duplicate records for financial operations
like dispatches, invoices, payments, and inventory transactions.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class IdempotencyKey(Base):
    """Tracks idempotency keys to prevent duplicate financial record creation.

    Each row represents one processed idempotency key.  The unique constraint
    on ``key_hash`` ensures that at most one record is created per idempotency
    key, even under concurrent load.

    Keys are SHA-256 hashed before storage so raw API keys are not persisted.
    """

    __tablename__ = "idempotency_keys"
    __table_args__ = (
        Index("ix_idempotency_keys_hash", "key_hash", unique=True),
        Index("ix_idempotency_keys_resource", "resource_type", "resource_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    response_status: Mapped[int] = mapped_column(nullable=False)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
