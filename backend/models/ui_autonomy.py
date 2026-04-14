"""Persistence models for autonomous UI telemetry, preferences, and recommendations."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class UiBehaviorSignal(Base):
    __tablename__ = "ui_behavior_signals"
    __table_args__ = (
        Index("ix_ui_behavior_signals_user_created", "user_id", "created_at"),
        Index("ix_ui_behavior_signals_org_route", "org_id", "route"),
        Index("ix_ui_behavior_signals_factory_route", "factory_id", "route"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    factory_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    route: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    signal_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    signal_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    severity: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    value: Mapped[float | None] = mapped_column(nullable=True)
    payload_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User")


class UiPreference(Base):
    __tablename__ = "ui_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "preference_key", name="uq_ui_preferences_user_key"),
        Index("ix_ui_preferences_org_key", "org_id", "preference_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    factory_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    preference_key: Mapped[str] = mapped_column(String(80), nullable=False)
    preference_value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(24), nullable=False, default="manual", index=True)
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


class UiRecommendation(Base):
    __tablename__ = "ui_recommendations"
    __table_args__ = (
        UniqueConstraint("recommendation_key", name="uq_ui_recommendations_key"),
        Index("ix_ui_recommendations_user_status", "user_id", "status"),
        Index("ix_ui_recommendations_org_priority", "org_id", "priority"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommendation_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    factory_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    route: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium", index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="local-heuristics", index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="open", index=True)
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
