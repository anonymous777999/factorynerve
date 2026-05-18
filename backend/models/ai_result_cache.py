"""DB-backed AI result cache for tenant-scoped deduplication."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class AIResultCache(Base):
    __tablename__ = "ai_result_cache"
    __table_args__ = (
        Index("ix_ai_result_cache_org_cache_key", "org_id", "cache_key", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    cache_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    prompt_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False, default="v1")
    result_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
