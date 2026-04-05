"""Password reset tokens (one-time use)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class AuthPasswordReset(Base):
    __tablename__ = "auth_password_resets"
    __table_args__ = (Index("ix_auth_password_resets_expires", "expires_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    auth_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("auth_users.id"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
