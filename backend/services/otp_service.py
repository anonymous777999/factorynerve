"""Transactional OTP verification service."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.admin_alert_recipient import AdminAlertRecipient
from backend.models.phone_verification import (
    PhoneVerification,
    PhoneVerificationChannel,
    PhoneVerificationPurpose,
    PhoneVerificationStatus,
)
from backend.models.user import User
from backend.otp_utils import generate_otp_code, hash_otp_code, verify_otp_code
from backend.phone_utils import mask_phone_number
from backend.services.rate_limit_service import RateLimitService
from backend.services.sms_service import SMSProvider, SMSResult, build_sms_provider


logger = structlog.get_logger(__name__)


def _coerce_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class OTPServiceError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class RateLimitedError(OTPServiceError):
    def __init__(self, code: str, message: str, *, retry_after: int, limit_type: str) -> None:
        super().__init__(code, message)
        self.retry_after = retry_after
        self.limit_type = limit_type


class NoActiveOTPError(OTPServiceError):
    pass


class ExpiredOTPError(OTPServiceError):
    pass


class MaxAttemptsExceededError(OTPServiceError):
    pass


class InvalidOTPError(OTPServiceError):
    def __init__(self, *, attempts_remaining: int) -> None:
        super().__init__("invalid_otp", "The verification code is invalid.")
        self.attempts_remaining = attempts_remaining


class SMSDeliveryFailedError(OTPServiceError):
    def __init__(self, result: SMSResult) -> None:
        super().__init__("sms_delivery_failed", result.error or "OTP delivery failed.")
        self.result = result


class UnverifiedPhoneError(OTPServiceError):
    pass


@dataclass(frozen=True)
class OTPStartResult:
    masked_phone: str
    expires_in: int
    verification_id: str


@dataclass(frozen=True)
class OTPConfirmResult:
    verified: bool
    phone_e164: str


class OTPService:
    OTP_TTL = timedelta(minutes=5)
    VERIFY_ATTEMPT_LIMIT = 5

    def __init__(
        self,
        *,
        sms_provider: SMSProvider | None = None,
        rate_limits: RateLimitService | None = None,
    ) -> None:
        self._sms_provider = sms_provider or build_sms_provider()
        self._rate_limits = rate_limits or RateLimitService()

    def start_user_verification(
        self,
        db: Session,
        *,
        user: User,
        phone_e164: str,
        ip_address: str,
        channel: PhoneVerificationChannel = PhoneVerificationChannel.SMS,
    ) -> OTPStartResult:
        return self._start_verification(
            db,
            phone_e164=phone_e164,
            ip_address=ip_address,
            channel=channel,
            purpose=PhoneVerificationPurpose.USER_VERIFICATION,
            user=user,
            recipient=None,
        )

    def confirm_user_verification(
        self,
        db: Session,
        *,
        user: User,
        phone_e164: str,
        otp_code: str,
        channel: PhoneVerificationChannel = PhoneVerificationChannel.SMS,
    ) -> OTPConfirmResult:
        return self._confirm_verification(
            db,
            phone_e164=phone_e164,
            otp_code=otp_code,
            channel=channel,
            purpose=PhoneVerificationPurpose.USER_VERIFICATION,
            user=user,
            recipient=None,
        )

    def start_recipient_verification(
        self,
        db: Session,
        *,
        recipient: AdminAlertRecipient,
        actor: User,
        phone_e164: str,
        ip_address: str,
        channel: PhoneVerificationChannel = PhoneVerificationChannel.SMS,
    ) -> OTPStartResult:
        return self._start_verification(
            db,
            phone_e164=phone_e164,
            ip_address=ip_address,
            channel=channel,
            purpose=PhoneVerificationPurpose.ALERT_RECIPIENT,
            user=actor,
            recipient=recipient,
        )

    def confirm_recipient_verification(
        self,
        db: Session,
        *,
        recipient: AdminAlertRecipient,
        actor: User,
        phone_e164: str,
        otp_code: str,
        channel: PhoneVerificationChannel = PhoneVerificationChannel.SMS,
    ) -> OTPConfirmResult:
        return self._confirm_verification(
            db,
            phone_e164=phone_e164,
            otp_code=otp_code,
            channel=channel,
            purpose=PhoneVerificationPurpose.ALERT_RECIPIENT,
            user=actor,
            recipient=recipient,
        )

    def _start_verification(
        self,
        db: Session,
        *,
        phone_e164: str,
        ip_address: str,
        channel: PhoneVerificationChannel,
        purpose: PhoneVerificationPurpose,
        user: User | None,
        recipient: AdminAlertRecipient | None,
    ) -> OTPStartResult:
        masked_phone = mask_phone_number(phone_e164)
        cooldown = self._rate_limits.check_cooldown(phone_e164)
        if not cooldown.allowed:
            self._log_event(
                "rate_limited",
                phone_masked=masked_phone,
                ip_address=ip_address,
                limit_type="cooldown",
                channel=channel.value,
                purpose=purpose.value,
                user_id=getattr(user, "id", None),
            )
            raise RateLimitedError(
                "cooldown_active",
                "Please wait before requesting another code.",
                retry_after=cooldown.seconds_remaining,
                limit_type="cooldown",
            )
        rate_limit = self._rate_limits.check_send_allowed(phone_e164, ip_address)
        if not rate_limit.allowed:
            self._log_event(
                "rate_limited",
                phone_masked=masked_phone,
                ip_address=ip_address,
                limit_type=rate_limit.limit_type or "send_count",
                channel=channel.value,
                purpose=purpose.value,
                user_id=getattr(user, "id", None),
            )
            raise RateLimitedError(
                "rate_limited",
                "Too many verification requests. Try again later.",
                retry_after=rate_limit.retry_after,
                limit_type=rate_limit.limit_type or "send_count",
            )

        otp_code = generate_otp_code()
        otp_hash = hash_otp_code(otp_code)
        now = datetime.now(timezone.utc)
        verification = PhoneVerification(
            phone_e164=phone_e164,
            otp_hash=otp_hash,
            expires_at=now + self.OTP_TTL,
            channel=channel,
            purpose=purpose,
            user_id=user.id if purpose == PhoneVerificationPurpose.USER_VERIFICATION and user else None,
            recipient_id=recipient.id if recipient is not None else None,
        )
        try:
            self._invalidate_active_otps(db, phone_e164=phone_e164, purpose=purpose)
            if purpose == PhoneVerificationPurpose.USER_VERIFICATION and user is not None:
                apply_user_phone_change(user, phone_e164)
                user.phone_last_otp_sent_at = now
                user.phone_otp_attempts = 0
                db.add(user)
            if purpose == PhoneVerificationPurpose.ALERT_RECIPIENT and recipient is not None:
                apply_alert_recipient_phone_change(recipient, phone_e164)
                recipient.last_otp_sent_at = now
                recipient.otp_attempts = 0
                recipient.verified_by_user_id = user.id if user is not None else None
                db.add(recipient)
            db.add(verification)
            db.commit()
        except Exception:
            db.rollback()
            raise

        self._rate_limits.record_send(phone_e164, ip_address)
        self._rate_limits.set_cooldown(phone_e164)
        self._log_event(
            "otp_requested",
            phone_masked=masked_phone,
            ip_address=ip_address,
            channel=channel.value,
            purpose=purpose.value,
            user_id=getattr(user, "id", None),
            recipient_id=getattr(recipient, "id", None),
        )
        result = self._sms_provider.send_otp(phone_e164, otp_code, channel.value)
        if not result.success:
            self._log_event(
                "otp_sent",
                phone_masked=masked_phone,
                ip_address=ip_address,
                channel=channel.value,
                purpose=purpose.value,
                user_id=getattr(user, "id", None),
                recipient_id=getattr(recipient, "id", None),
                provider=result.provider,
                success=False,
            )
            raise SMSDeliveryFailedError(result)
        self._log_event(
            "otp_sent",
            phone_masked=masked_phone,
            ip_address=ip_address,
            channel=channel.value,
            purpose=purpose.value,
            user_id=getattr(user, "id", None),
            recipient_id=getattr(recipient, "id", None),
            provider=result.provider,
            success=True,
        )
        return OTPStartResult(
            masked_phone=masked_phone,
            expires_in=int(self.OTP_TTL.total_seconds()),
            verification_id=verification.id,
        )

    def _confirm_verification(
        self,
        db: Session,
        *,
        phone_e164: str,
        otp_code: str,
        channel: PhoneVerificationChannel,
        purpose: PhoneVerificationPurpose,
        user: User | None,
        recipient: AdminAlertRecipient | None,
        ) -> OTPConfirmResult:
        masked_phone = mask_phone_number(phone_e164)
        now = datetime.now(timezone.utc)
        try:
            verification = self._load_active_verification_for_update(
                db,
                phone_e164=phone_e164,
                purpose=purpose,
                user=user,
                recipient=recipient,
            )
            if verification is None:
                raise NoActiveOTPError("no_active_otp", "No active verification code was found.")
            expires_at = _coerce_utc(verification.expires_at)
            if expires_at < now:
                self._log_event(
                    "otp_expired",
                    phone_masked=masked_phone,
                    verification_id=verification.id,
                    channel=channel.value,
                    purpose=purpose.value,
                    user_id=getattr(user, "id", None),
                    recipient_id=getattr(recipient, "id", None),
                )
                raise ExpiredOTPError("otp_expired", "The verification code has expired.")
            if verification.attempts >= self.VERIFY_ATTEMPT_LIMIT:
                self._mark_failed_state(user=user, recipient=recipient)
                db.commit()
                self._log_event(
                    "otp_locked",
                    phone_masked=masked_phone,
                    verification_id=verification.id,
                    channel=channel.value,
                    purpose=purpose.value,
                    user_id=getattr(user, "id", None),
                    recipient_id=getattr(recipient, "id", None),
                    reason="max_attempts",
                )
                raise MaxAttemptsExceededError("max_attempts_reached", "Maximum verification attempts reached.")

            verification.attempts += 1
            if recipient is not None:
                recipient.otp_attempts = verification.attempts
                db.add(recipient)
            if user is not None and purpose == PhoneVerificationPurpose.USER_VERIFICATION:
                user.phone_otp_attempts = verification.attempts
                db.add(user)

            if not verify_otp_code(otp_code, verification.otp_hash):
                attempts_remaining = max(0, self.VERIFY_ATTEMPT_LIMIT - verification.attempts)
                if verification.attempts >= self.VERIFY_ATTEMPT_LIMIT:
                    self._mark_failed_state(user=user, recipient=recipient)
                db.commit()
                self._log_event(
                    "otp_verified_failed",
                    phone_masked=masked_phone,
                    verification_id=verification.id,
                    channel=channel.value,
                    purpose=purpose.value,
                    user_id=getattr(user, "id", None),
                    recipient_id=getattr(recipient, "id", None),
                    attempts=verification.attempts,
                    reason="invalid_otp",
                )
                raise InvalidOTPError(attempts_remaining=attempts_remaining)

            verification.used = True
            created_at = _coerce_utc(verification.created_at)
            latency_ms = int((now - created_at).total_seconds() * 1000)
            if purpose == PhoneVerificationPurpose.USER_VERIFICATION and user is not None:
                user.phone_number = phone_e164
                user.phone_e164 = phone_e164
                user.phone_verification_status = PhoneVerificationStatus.VERIFIED
                user.phone_verified_at = now
                user.phone_last_otp_sent_at = created_at
                user.phone_otp_attempts = verification.attempts
                db.add(user)
            if purpose == PhoneVerificationPurpose.ALERT_RECIPIENT and recipient is not None:
                recipient.phone_number = phone_e164
                recipient.phone_e164 = phone_e164
                recipient.verification_status = PhoneVerificationStatus.VERIFIED.value
                recipient.verified_at = now
                recipient.verified_by_user_id = user.id if user is not None else recipient.verified_by_user_id
                recipient.otp_attempts = verification.attempts
                db.add(recipient)
            db.add(verification)
            self._log_event(
                "otp_verified_success",
                phone_masked=masked_phone,
                verification_id=verification.id,
                channel=channel.value,
                purpose=purpose.value,
                user_id=getattr(user, "id", None),
                recipient_id=getattr(recipient, "id", None),
                latency_ms=latency_ms,
            )
            db.commit()
        except OTPServiceError:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise
        return OTPConfirmResult(verified=True, phone_e164=phone_e164)

    def _invalidate_active_otps(
        self,
        db: Session,
        *,
        phone_e164: str,
        purpose: PhoneVerificationPurpose,
    ) -> None:
        now = datetime.now(timezone.utc)
        records = db.execute(
            select(PhoneVerification).where(
                PhoneVerification.phone_e164 == phone_e164,
                PhoneVerification.purpose == purpose,
                PhoneVerification.used.is_(False),
                PhoneVerification.expires_at >= now,
            )
        ).scalars().all()
        for record in records:
            record.used = True
            db.add(record)

    def _load_active_verification_for_update(
        self,
        db: Session,
        *,
        phone_e164: str,
        purpose: PhoneVerificationPurpose,
        user: User | None,
        recipient: AdminAlertRecipient | None,
    ) -> PhoneVerification | None:
        stmt = (
            select(PhoneVerification)
            .where(
                PhoneVerification.phone_e164 == phone_e164,
                PhoneVerification.purpose == purpose,
                PhoneVerification.used.is_(False),
            )
            .order_by(PhoneVerification.created_at.desc())
            .limit(1)
            .with_for_update()
        )
        if purpose == PhoneVerificationPurpose.USER_VERIFICATION and user is not None:
            stmt = stmt.where(PhoneVerification.user_id == user.id)
        if purpose == PhoneVerificationPurpose.ALERT_RECIPIENT and recipient is not None:
            stmt = stmt.where(PhoneVerification.recipient_id == recipient.id)
        return db.execute(stmt).scalars().first()

    def _mark_failed_state(self, *, user: User | None, recipient: AdminAlertRecipient | None) -> None:
        if user is not None:
            user.phone_verification_status = PhoneVerificationStatus.FAILED
        if recipient is not None:
            recipient.verification_status = PhoneVerificationStatus.FAILED.value

    def _log_event(
        self,
        event_name: Literal[
            "otp_requested",
            "otp_sent",
            "otp_verified_success",
            "otp_verified_failed",
            "otp_expired",
            "otp_locked",
            "rate_limited",
        ],
        *,
        phone_masked: str,
        ip_address: str | None = None,
        user_id: int | None = None,
        recipient_id: int | None = None,
        channel: str | None = None,
        purpose: str | None = None,
        verification_id: str | None = None,
        attempts: int | None = None,
        reason: str | None = None,
        provider: str | None = None,
        success: bool | None = None,
        latency_ms: int | None = None,
        limit_type: str | None = None,
    ) -> None:
        payload = {
            "phone_masked": phone_masked,
            "user_id": user_id,
            "recipient_id": recipient_id,
            "channel": channel,
            "purpose": purpose,
            "verification_id": verification_id,
            "attempts": attempts,
            "reason": reason,
            "provider": provider,
            "success": success,
            "latency_ms": latency_ms,
            "limit_type": limit_type,
        }
        if ip_address is not None:
            from backend.phone_utils import hash_ip_for_rate_limit

            payload["ip_hash"] = hash_ip_for_rate_limit(ip_address)
        logger.info(event_name, **payload)


def apply_user_phone_change(user: User, phone_e164: str | None) -> None:
    user.phone_number = phone_e164
    user.phone_e164 = phone_e164
    user.phone_verification_status = PhoneVerificationStatus.PENDING
    user.phone_verified_at = None
    user.phone_last_otp_sent_at = None
    user.phone_otp_attempts = 0


def apply_alert_recipient_phone_change(recipient: AdminAlertRecipient, phone_e164: str | None) -> None:
    recipient.phone_number = phone_e164 or ""
    recipient.phone_e164 = phone_e164
    recipient.verification_status = PhoneVerificationStatus.PENDING.value
    recipient.verified_at = None
    recipient.verified_by_user_id = None
    recipient.otp_attempts = 0
    recipient.last_otp_sent_at = None


def get_verified_phone_for_recipient(recipient: AdminAlertRecipient, user: User | None = None) -> str:
    if recipient.user_id and user is not None:
        if user.phone_e164 and user.phone_verification_status == PhoneVerificationStatus.VERIFIED:
            return user.phone_e164
        raise UnverifiedPhoneError("unverified_phone", "Linked user phone is not verified.")
    if recipient.phone_e164 and recipient.verification_status == PhoneVerificationStatus.VERIFIED.value:
        return recipient.phone_e164
    raise UnverifiedPhoneError("unverified_phone", "Recipient phone is not verified.")
