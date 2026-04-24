"""SMS provider abstraction for phone verification."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
import os

import structlog

from backend.phone_utils import mask_phone_number


logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class SMSResult:
    success: bool
    provider: str
    error: str | None = None


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
        return SMSResult(success=False, provider=self.provider_name, error=self.error)


class TwilioSMSProvider(SMSProvider):
    def send_otp(self, phone_e164: str, otp: str, channel: str) -> SMSResult:
        return SMSResult(
            success=False,
            provider="twilio",
            error="Twilio OTP delivery is not configured for phone verification yet.",
        )


def build_sms_provider() -> SMSProvider:
    provider_name = (os.getenv("SMS_PROVIDER") or "mock").strip().lower()
    if provider_name == "mock":
        return MockSMSProvider()
    if provider_name == "twilio":
        return TwilioSMSProvider()
    return UnavailableSMSProvider(
        provider_name=provider_name or "unknown",
        error=f"Unsupported SMS provider: {provider_name or 'unknown'}",
    )
