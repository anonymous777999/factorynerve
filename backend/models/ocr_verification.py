"""Persistent OCR verification review records."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text

from backend.database import Base


class OcrVerification(Base):
    __tablename__ = "ocr_verifications"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String(36), index=True, nullable=True)
    factory_id = Column(String(36), ForeignKey("factories.factory_id"), index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    template_id = Column(Integer, ForeignKey("ocr_templates.id"), nullable=True)
    source_filename = Column(String(255), nullable=True)
    source_image_path = Column(Text, nullable=True)
    columns = Column(Integer, nullable=False, default=3)
    language = Column(String(20), nullable=False, default="eng")
    avg_confidence = Column(Float, nullable=True)
    warnings = Column(JSON, nullable=True)
    scan_quality = Column(JSON, nullable=True)
    document_hash = Column(String(128), nullable=True, index=True)
    doc_type_hint = Column(String(80), nullable=True)
    routing_meta = Column(JSON, nullable=True)
    raw_text = Column(Text, nullable=True)
    headers = Column(JSON, nullable=True)
    original_rows = Column(JSON, nullable=True)
    reviewed_rows = Column(JSON, nullable=True)
    raw_column_added = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="draft")
    export_state = Column(String(32), nullable=False, default="pending")
    last_action = Column(String(40), nullable=False, default="uploaded")
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    exported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
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


class OcrAuditEvent(Base):
    __tablename__ = "ocr_audit_events"
    __table_args__ = (
        Index("ix_ocr_audit_events_document_time", "document_id", "created_at"),
        Index("ix_ocr_audit_events_event_type", "event_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("ocr_verifications.id"), index=True, nullable=False)
    event_type = Column(String(40), nullable=False)
    actor = Column(String(120), nullable=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
