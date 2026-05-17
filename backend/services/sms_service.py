"""OTP delivery provider abstraction for phone verification."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
import os

import structlog

from backend.phone_utils import mask_phone_number
from backend.services import whatsapp_sender


logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class SMSResult:
    success: bool
    provider: str
    error: str | None = None
    status_code: int = 503
    retryable: bool | None = None


class SMSProvider(ABC):
    @abstractmethod
    def send_otp(self, phone_e164: str, otp: str, channel: str) -> SMSResult:
        raise NotImplementedError


class MockSMSProvider(SMSProvider):
    """Test-friendly provider that records OTPs without sending them externally."""

    def __init__(self) -> None:
        self.sent: dict[str, str] = {}

    def send_otp(self, phone_e164: str, otp: str, channel: str) -> SMSResult:
        self.sent[phone_e164] = otp
        logger.warning(
            "mock_otp_delivery",
            phone_masked=mask_phone_number(phone_e164),
            channel=channel,
        )
        return SMSResult(success=True, provider="mock")


class UnavailableSMSProvider(SMSProvider):
    def __init__(self, *, provider_name: str, error: str) -> None:
        self.provider_name = provider_name
        self.error = error

    def send_otp(self, phone_e164: str, otp: str, channel: str) -> SMSResult:
        logger.warning(
            "otp_provider_unavailable",
            provider=self.provider_name,
            phone_masked=mask_phone_number(phone_e164),
            channel=channel,
            error=self.error,
        )
        return SMSResult(success=False, provider=self.provider_name, error=self.error, status_code=503, retryable=False)


class WhatsAppSMSProvider(SMSProvider):
    TEMPLATE_NAME = "otp_verification_code"
    OTP_EXPIRY_MINUTES = 5
    PROVIDER_NAME = "meta_whatsapp"
    DELIVERY_UNAVAILABLE_MESSAGE = "Verification code delivery is temporarily unavailable. Please try again."
    INVALID_PHONE_MESSAGE = "This phone number cannot receive WhatsApp verification codes."

    def __init__(
        self,
        *,
        template_name: str = TEMPLATE_NAME,
        expiry_minutes: int = OTP_EXPIRY_MINUTES,
        org_id: str = "otp-verification",
    ) -> None:
        self.template_name = template_name
        self.expiry_minutes = max(1, int(expiry_minutes))
        self.org_id = org_id

    def send_otp(self, phone_e164: str, otp: str, channel: str) -> SMSResult:
        masked_phone = mask_phone_number(phone_e164)
        try:
            result = whatsapp_sender.send_message_blocking(
                to=phone_e164,
                template_name=self.template_name,
                template_params={
                    "auth_template": True,
                    "code": otp,
                    "expires_minutes": self.expiry_minutes,
                    "disable_dedup": True,
                },
                org_id=self.org_id,
            )
        except Exception as error:  # pylint: disable=broad-except
            logger.warning(
                "otp_transport_runtime_failed",
                provider=self.PROVIDER_NAME,
                phone_masked=masked_phone,
                channel=channel,
                error=str(error),
            )
            return SMSResult(
                success=False,
                provider=self.PROVIDER_NAME,
                error=self.DELIVERY_UNAVAILABLE_MESSAGE,
                status_code=503,
                retryable=True,
            )

        if result.status == "sent":
            logger.info(
                "otp_transport_dispatched",
                provider=self.PROVIDER_NAME,
                phone_masked=masked_phone,
                channel=channel,
                delivery_status=result.status,
                provider_message_id=result.provider_message_id,
            )
            return SMSResult(success=True, provider=self.PROVIDER_NAME, status_code=200, retryable=False)

        provider_response = result.provider_response if isinstance(result.provider_response, dict) else {}
        provider_reason = str(provider_response.get("reason") or "").strip().lower()
        http_status = int(provider_response.get("http_status") or 0)
        status_code = 503
        retryable = True
        client_error = self.DELIVERY_UNAVAILABLE_MESSAGE

        if provider_reason == "invalid_phone":
            status_code = 400
            retryable = False
            client_error = self.INVALID_PHONE_MESSAGE
        elif http_status == 429 or "rate limit" in (result.error_message or "").lower():
            status_code = 429
            retryable = True
            client_error = self.DELIVERY_UNAVAILABLE_MESSAGE
        elif provider_reason in {"template_invalid", "config_missing"} or http_status in {400, 401, 403, 404, 422}:
            retryable = False
            client_error = "Verification code delivery is not configured correctly. Please contact support."

        logger.warning(
            "otp_transport_rejected",
            provider=self.PROVIDER_NAME,
            phone_masked=masked_phone,
            channel=channel,
            delivery_status=result.status,
            provider_reason=provider_reason or "unknown",
            http_status=http_status or None,
            retryable=retryable,
        )
        return SMSResult(
            success=False,
            provider=self.PROVIDER_NAME,
            error=client_error,
            status_code=status_code,
            retryable=retryable,
        )


def build_sms_provider() -> SMSProvider:
    provider_name = (os.getenv("SMS_PROVIDER") or "").strip().lower()
    if not provider_name:
        whatsapp_mode = (os.getenv("WHATSAPP_PROVIDER_MODE") or "").strip().lower()
        provider_name = "whatsapp" if whatsapp_mode in {"meta", "mock"} else "mock"
    if provider_name == "mock":
        return MockSMSProvider()
    if provider_name in {"whatsapp", "meta"}:
        return WhatsAppSMSProvider()
    return UnavailableSMSProvider(
        provider_name=provider_name or "unknown",
        error=f"Unsupported OTP delivery provider: {provider_name or 'unknown'}",
    )
