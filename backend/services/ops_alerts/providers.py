"""Provider adapters for WhatsApp alert delivery."""

from __future__ import annotations

import logging
import os
from typing import Protocol

from backend.services.ops_alerts.types import AlertDispatchResult


logger = logging.getLogger(__name__)


class AlertProvider(Protocol):
    name: str

    def validate_config(self) -> None:
        """Fail loudly when the provider is configured incorrectly."""

    def deliver(self, message: str, *, to_number: str | None = None) -> AlertDispatchResult:
        """Deliver an already-formatted alert."""


class TwilioWhatsAppProvider:
    """Twilio-backed WhatsApp sender."""

    name = "twilio"

    def __init__(self) -> None:
        self.account_sid = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
        self.auth_token = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
        self.from_number = (os.getenv("TWILIO_WHATSAPP_FROM") or "").strip()
        self.default_to_number = (os.getenv("TWILIO_WHATSAPP_TO_DEFAULT") or "").strip()

    def validate_config(self) -> None:
        missing: list[str] = []
        if not self.account_sid:
            missing.append("TWILIO_ACCOUNT_SID")
        if not self.auth_token:
            missing.append("TWILIO_AUTH_TOKEN")
        if not self.from_number:
            missing.append("TWILIO_WHATSAPP_FROM")
        if not self.default_to_number:
            missing.append("TWILIO_WHATSAPP_TO_DEFAULT")
        if missing:
            raise ValueError("Missing required Twilio alert environment variables: " + ", ".join(sorted(missing)))

    def _build_client(self):
        self.validate_config()
        try:
            from twilio.rest import Client  # type: ignore
        except Exception as error:  # pragma: no cover - import depends on environment
            raise RuntimeError("Twilio SDK not installed.") from error
        return Client(self.account_sid, self.auth_token)

    def deliver(self, message: str, *, to_number: str | None = None) -> AlertDispatchResult:
        target = (to_number or self.default_to_number).strip()
        if not target or not self.from_number:
            return AlertDispatchResult(
                success=False,
                provider=self.name,
                retryable=False,
                error="Twilio WhatsApp from/to numbers are missing.",
            )
        try:
            client = self._build_client()
            response = client.messages.create(from_=self.from_number, to=target, body=message)
            external_id = getattr(response, "sid", None)
            status = getattr(response, "status", None)
            return AlertDispatchResult(
                success=True,
                provider=self.name,
                retryable=False,
                external_id=str(external_id) if external_id else None,
                error=None if status else None,
            )
        except ValueError as error:
            return AlertDispatchResult(
                success=False,
                provider=self.name,
                retryable=False,
                error=str(error),
            )
        except Exception as error:  # pylint: disable=broad-except
            status_code = int(getattr(error, "status", 0) or 0) or None
            retryable = bool(status_code in {408, 409, 429} or (status_code and status_code >= 500))
            if status_code is None:
                retryable = True
            logger.warning("Twilio WhatsApp delivery failed: %s", error)
            return AlertDispatchResult(
                success=False,
                provider=self.name,
                retryable=retryable,
                error=str(error),
                status_code=status_code,
            )


def build_provider(provider_name: str) -> AlertProvider:
    normalized = (provider_name or "").strip().lower()
    if normalized == "twilio":
        return TwilioWhatsAppProvider()
    raise ValueError(f"Unsupported alert provider: {provider_name}")
