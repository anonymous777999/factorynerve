"""Factory settings model."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class FactorySettings(Base):
    __tablename__ = "factory_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    factory_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    factory_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    target_morning: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_evening: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_night: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ai_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class FactorySettingsRead(BaseModel):
    factory_name: str
    address: str | None = None
    factory_type: str | None = None
    target_morning: int
    target_evening: int
    target_night: int
    ai_provider: str | None = None

    model_config = ConfigDict(from_attributes=True)
