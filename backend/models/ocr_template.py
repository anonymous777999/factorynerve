"""OCR template model for logbook extraction."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, JSON, ForeignKey

from backend.database import Base


class OcrTemplate(Base):
    __tablename__ = "ocr_templates"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(String(36), ForeignKey("factories.factory_id"), index=True, nullable=True)
    factory_name = Column(String(200), index=True, nullable=False)
    name = Column(String(200), nullable=False)
    columns = Column(Integer, nullable=False, default=3)
    header_mode = Column(String(20), nullable=False, default="first")
    language = Column(String(20), nullable=False, default="eng")
    column_names = Column(JSON, nullable=True)
    column_keywords = Column(JSON, nullable=True)
    column_centers = Column(JSON, nullable=True)
    raw_column_label = Column(String(80), nullable=True, default="Raw")
    enable_raw_column = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
