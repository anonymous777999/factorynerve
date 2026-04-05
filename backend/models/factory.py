"""Factory model for org-scoped locations."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Factory(Base):
    __tablename__ = "factories"
    __table_args__ = (
        Index("ix_factories_org_id", "org_id"),
        Index("ix_factories_code", "factory_code"),
        Index("ix_factories_industry_type", "industry_type"),
    )

    factory_id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    timezone: Mapped[str] = mapped_column(String(60), default="Asia/Kolkata", nullable=False)
    industry_type: Mapped[str] = mapped_column(String(40), default="general", nullable=False)
    workflow_template_key: Mapped[str] = mapped_column(String(64), default="general-ops-pack", nullable=False)
    factory_code: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    organization = relationship("Organization", back_populates="factories")
    user_roles = relationship("UserFactoryRole", back_populates="factory")
