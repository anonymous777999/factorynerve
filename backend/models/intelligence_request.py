"""Persistent request tracking for Factory Intelligence orchestration jobs."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class IntelligenceRequest(Base):
    __tablename__ = "intelligence_requests"
    __table_args__ = (
        UniqueConstraint("request_id", name="uq_intelligence_requests_request_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    request_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    job_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    factory_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    document_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    cache_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", index=True)
    task_classification: Mapped[str | None] = mapped_column(String(32), nullable=True)
    selected_model_tier: Mapped[str | None] = mapped_column(String(32), nullable=True)
    final_model_tier: Mapped[str | None] = mapped_column(String(32), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cached_result: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pipeline_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    normalized_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User")
    stage_usage = relationship("IntelligenceStageUsage", back_populates="request", cascade="all, delete-orphan")
