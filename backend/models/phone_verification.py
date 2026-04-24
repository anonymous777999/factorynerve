"""Phone verification ORM model and shared enums."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class PhoneVerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"


class PhoneVerificationChannel(str, Enum):
    SMS = "sms"
    WHATSAPP = "whatsapp"


class PhoneVerificationPurpose(str, Enum):
    USER_VERIFICATION = "user_verification"
    ALERT_RECIPIENT = "alert_recipient"


def _enum_values(enum_cls: type[Enum]) -> list[str]:
    return [str(member.value) for member in enum_cls]


class PhoneVerification(Base):
    __tablename__ = "phone_verifications"
    __table_args__ = (
        Index("ix_phone_verifications_phone_purpose_active", "phone_e164", "purpose", "used", "expires_at"),
        Index("ix_phone_verifications_user_id", "user_id"),
        Index("ix_phone_verifications_recipient_id", "recipient_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False)
    otp_hash: Mapped[str] = mapped_column(String(72), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    channel: Mapped[PhoneVerificationChannel] = mapped_column(
        SqlEnum(
            PhoneVerificationChannel,
            name="phone_verification_channel",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=False,
    )
    purpose: Mapped[PhoneVerificationPurpose] = mapped_column(
        SqlEnum(
            PhoneVerificationPurpose,
            name="phone_verification_purpose",
            values_callable=_enum_values,
            native_enum=False,
        ),
        nullable=False,
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    recipient_id: Mapped[int | None] = mapped_column(ForeignKey("admin_alert_recipients.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
