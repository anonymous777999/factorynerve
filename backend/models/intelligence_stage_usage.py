"""Per-stage AI usage and cost tracking for Factory Intelligence requests."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class IntelligenceStageUsage(Base):
    __tablename__ = "intelligence_stage_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intelligence_request_id: Mapped[int] = mapped_column(
        ForeignKey("intelligence_requests.id"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    factory_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    stage_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    task_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    model_tier: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    request = relationship("IntelligenceRequest", back_populates="stage_usage")
    user = relationship("User")
