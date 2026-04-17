"""Pending public signups that must verify email before account creation."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base
from backend.models.user import UserRole


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"
    __table_args__ = (
        Index("uq_pending_registrations_email", "email", unique=True),
        Index("ix_pending_registrations_token_hash", "token_hash"),
        Index("ix_pending_registrations_expires", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    org_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.org_id"), nullable=True, index=True)
    invited_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    requested_role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="pending_registration_role"),
        nullable=False,
        default=UserRole.ATTENDANCE,
    )
    factory_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    custom_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
