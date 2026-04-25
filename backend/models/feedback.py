"""Feedback persistence model for in-app product feedback."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


def _enum_values(enum_cls: type[Enum]) -> list[str]:
    return [str(member.value) for member in enum_cls]


class FeedbackType(str, Enum):
    ISSUE = "issue"
    BUG = "bug"
    SUGGESTION = "suggestion"
    ALERT_PROBLEM = "alert_problem"


class FeedbackSource(str, Enum):
    FLOATING = "floating"
    MICRO = "micro"
    ERROR_PROMPT = "error_prompt"


class FeedbackChannel(str, Enum):
    TEXT = "text"
    VOICE = "voice"


class FeedbackMood(str, Enum):
    FRUSTRATED = "frustrated"
    NEUTRAL = "neutral"
    SATISFIED = "satisfied"


class FeedbackRating(str, Enum):
    UP = "up"
    DOWN = "down"


class FeedbackStatus(str, Enum):
    OPEN = "open"
    TRIAGED = "triaged"
    RESOLVED = "resolved"


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (
        UniqueConstraint("org_id", "user_id", "client_request_id", name="uq_feedback_org_user_client_request"),
        Index("ix_feedback_org_id", "org_id"),
        Index("ix_feedback_factory_id", "factory_id"),
        Index("ix_feedback_user_id", "user_id"),
        Index("ix_feedback_type", "type"),
        Index("ix_feedback_status", "status"),
        Index("ix_feedback_created_at", "created_at"),
        Index("ix_feedback_org_status_created_at", "org_id", "status", "created_at"),
        Index("ix_feedback_dedupe_hash", "dedupe_hash"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(String(36), nullable=False)
    factory_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[FeedbackType] = mapped_column(
        SqlEnum(
            FeedbackType,
            name="feedback_type",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=False,
    )
    source: Mapped[FeedbackSource] = mapped_column(
        SqlEnum(
            FeedbackSource,
            name="feedback_source",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=False,
        default=FeedbackSource.FLOATING,
    )
    channel: Mapped[FeedbackChannel] = mapped_column(
        SqlEnum(
            FeedbackChannel,
            name="feedback_channel",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=False,
        default=FeedbackChannel.TEXT,
    )
    mood: Mapped[FeedbackMood | None] = mapped_column(
        SqlEnum(
            FeedbackMood,
            name="feedback_mood",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=True,
    )
    rating: Mapped[FeedbackRating | None] = mapped_column(
        SqlEnum(
            FeedbackRating,
            name="feedback_rating",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=True,
    )
    message_original: Mapped[str] = mapped_column(Text, nullable=False)
    message_translated: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_language: Mapped[str | None] = mapped_column(String(24), nullable=True)
    translation_status: Mapped[str] = mapped_column(String(24), nullable=False, default="not_requested")
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dedupe_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[FeedbackStatus] = mapped_column(
        SqlEnum(
            FeedbackStatus,
            name="feedback_status",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=False,
        default=FeedbackStatus.OPEN,
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", foreign_keys=[user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])
