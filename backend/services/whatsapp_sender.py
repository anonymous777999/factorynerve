"""Generic WhatsApp provider adapters and send orchestration."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import logging
import os
from typing import Any, Protocol

import httpx

from backend.phone_utils import normalize_phone_e164


logger = logging.getLogger(__name__)


class WhatsAppSenderError(RuntimeError):
    """Raised when sender configuration is invalid."""


@dataclass(frozen=True)
class WhatsAppProviderConfig:
    provider: str
    api_key: str
    api_url: str | None
    sender_id: str
    timeout_seconds: float
    retry_attempts: int
    retry_backoff_seconds: float


@dataclass(slots=True)
class WhatsAppSendResult:
    success: bool
    provider: str
    retryable: bool
    attempts_made: int = 1
    status_code: int | None = None
    provider_message_id: str | None = None
    response_data: dict[str, Any] | None = None
    error: str | None = None


class WhatsAppSender(Protocol):
    provider_name: str

    def validate_config(self) -> None:
        """Validate provider configuration."""

    async def send_whatsapp_message(self, to: str, message: str) -> WhatsAppSendResult:
        """Send a WhatsApp message to one recipient."""


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    return float(value)


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    return int(value)


def get_whatsapp_provider_config() -> WhatsAppProviderConfig:
    return WhatsAppProviderConfig(
        provider=(os.getenv("WHATSAPP_PROVIDER") or "meta").strip().lower(),
        api_key=(os.getenv("WHATSAPP_API_KEY") or "").strip(),
        api_url=(os.getenv("WHATSAPP_API_URL") or "").strip() or None,
        sender_id=(os.getenv("WHATSAPP_SENDER_ID") or "").strip(),
        timeout_seconds=_env_float("WHATSAPP_TIMEOUT_SECONDS", 10.0),
        retry_attempts=_env_int("WHATSAPP_RETRY_ATTEMPTS", 3),
        retry_backoff_seconds=_env_float("WHATSAPP_RETRY_BACKOFF_SECONDS", 1.5),
    )


class BaseHTTPWhatsAppAdapter:
    provider_name = "base"

    def __init__(self, config: WhatsAppProviderConfig) -> None:
        self.config = config

    def validate_config(self) -> None:
        missing: list[str] = []
        if not self.config.api_key:
            missing.append("WHATSAPP_API_KEY")
        if not self.config.sender_id:
            missing.append("WHATSAPP_SENDER_ID")
        if missing:
            raise WhatsAppSenderError("Missing required WhatsApp environment variables: " + ", ".join(missing))

    async def send_whatsapp_message(self, to: str, message: str) -> WhatsAppSendResult:
        self.validate_config()
        request_kwargs = self.build_request(to=to, message=message)
        try:
            async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                response = await client.request(**request_kwargs)
            data = self._safe_json(response)
            if response.is_success:
                return WhatsAppSendResult(
                    success=True,
                    provider=self.provider_name,
                    retryable=False,
                    status_code=response.status_code,
                    provider_message_id=self.extract_message_id(data),
                    response_data=data,
                )
            return WhatsAppSendResult(
                success=False,
                provider=self.provider_name,
                retryable=response.status_code in {408, 409, 429} or response.status_code >= 500,
                status_code=response.status_code,
                response_data=data,
                error=self.extract_error(response, data),
            )
        except httpx.TimeoutException as error:
            return WhatsAppSendResult(
                success=False,
                provider=self.provider_name,
                retryable=True,
                error=f"Request timed out: {error}",
            )
        except httpx.HTTPError as error:
            return WhatsAppSendResult(
                success=False,
                provider=self.provider_name,
                retryable=True,
                error=f"HTTP transport error: {error}",
            )

    def _safe_json(self, response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
            return payload if isinstance(payload, dict) else {"payload": payload}
        except Exception:
            return {"text": response.text}

    def extract_error(self, response: httpx.Response, payload: dict[str, Any]) -> str:
        detail = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(detail, dict):
            message = detail.get("message") or detail.get("error_user_msg") or str(detail)
        elif detail:
            message = str(detail)
        else:
            message = response.text.strip() or f"Provider returned HTTP {response.status_code}"
        return message[:500]

    def extract_message_id(self, payload: dict[str, Any]) -> str | None:
        return payload.get("message_id") or payload.get("id")

    def build_request(self, *, to: str, message: str) -> dict[str, Any]:
        raise NotImplementedError


class MetaWhatsAppAdapter(BaseHTTPWhatsAppAdapter):
    provider_name = "meta"

    def build_request(self, *, to: str, message: str) -> dict[str, Any]:
        base_url = (self.config.api_url or "https://graph.facebook.com/v19.0").rstrip("/")
        return {
            "method": "POST",
            "url": f"{base_url}/{self.config.sender_id}/messages",
            "headers": {
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
            "json": {
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"preview_url": False, "body": message},
            },
        }

    def extract_message_id(self, payload: dict[str, Any]) -> str | None:
        messages = payload.get("messages")
        if isinstance(messages, list) and messages:
            first = messages[0]
            if isinstance(first, dict):
                message_id = first.get("id")
                if message_id:
                    return str(message_id)
        return super().extract_message_id(payload)


class GupshupWhatsAppAdapter(BaseHTTPWhatsAppAdapter):
    provider_name = "gupshup"

    def _sender_parts(self) -> tuple[str, str | None]:
        raw = self.config.sender_id.strip()
        if "|" in raw:
            source, app_name = raw.split("|", 1)
            return source.strip(), app_name.strip() or None
        return raw, None

    def build_request(self, *, to: str, message: str) -> dict[str, Any]:
        url = (self.config.api_url or "https://api.gupshup.io/wa/api/v1/msg").rstrip("/")
        source, app_name = self._sender_parts()
        data = {
            "channel": "whatsapp",
            "source": source.replace("+", ""),
            "destination": to.lstrip("+"),
            "message": '{"type":"text","text":"' + message.replace('"', '\\"') + '"}',
        }
        if app_name:
            data["src.name"] = app_name
        return {
            "method": "POST",
            "url": url,
            "headers": {
                "apikey": self.config.api_key,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            "data": data,
        }

    def extract_message_id(self, payload: dict[str, Any]) -> str | None:
        message_id = payload.get("messageId") or payload.get("message_id")
        if message_id:
            return str(message_id)
        return super().extract_message_id(payload)


class TwilioWhatsAppAdapter(BaseHTTPWhatsAppAdapter):
    provider_name = "twilio"

    def validate_config(self) -> None:
        super().validate_config()
        if ":" not in self.config.api_key:
            raise WhatsAppSenderError(
                "Twilio requires WHATSAPP_API_KEY in the format 'account_sid:auth_token'."
            )

    def build_request(self, *, to: str, message: str) -> dict[str, Any]:
        account_sid, auth_token = self.config.api_key.split(":", 1)
        base_url = (self.config.api_url or f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}").rstrip("/")
        from_number = self.config.sender_id
        if not from_number.startswith("whatsapp:"):
            from_number = f"whatsapp:{from_number}"
        target = to if to.startswith("whatsapp:") else f"whatsapp:{to}"
        return {
            "method": "POST",
            "url": f"{base_url}/Messages.json",
            "auth": (account_sid, auth_token),
            "data": {
                "From": from_number,
                "To": target,
                "Body": message,
            },
        }

    def extract_message_id(self, payload: dict[str, Any]) -> str | None:
        sid = payload.get("sid")
        if sid:
            return str(sid)
        return super().extract_message_id(payload)


def build_whatsapp_sender(config: WhatsAppProviderConfig | None = None) -> WhatsAppSender:
    active_config = config or get_whatsapp_provider_config()
    provider = active_config.provider
    if provider == "meta":
        return MetaWhatsAppAdapter(active_config)
    if provider == "gupshup":
        return GupshupWhatsAppAdapter(active_config)
    if provider == "twilio":
        return TwilioWhatsAppAdapter(active_config)
    raise WhatsAppSenderError(f"Unsupported WHATSAPP_PROVIDER '{active_config.provider}'.")


async def send_whatsapp_message(
    to: str,
    message: str,
    *,
    sender: WhatsAppSender | None = None,
) -> WhatsAppSendResult:
    active_sender = sender or build_whatsapp_sender()
    return await active_sender.send_whatsapp_message(to=normalize_phone_e164(to), message=message)


async def send_with_retries(
    to: str,
    message: str,
    *,
    sender: WhatsAppSender | None = None,
    retry_attempts: int | None = None,
    retry_backoff_seconds: float | None = None,
) -> WhatsAppSendResult:
    active_sender = sender or build_whatsapp_sender()
    config = get_whatsapp_provider_config()
    attempts = retry_attempts or config.retry_attempts
    base_backoff = retry_backoff_seconds or config.retry_backoff_seconds
    result = await active_sender.send_whatsapp_message(to=to, message=message)
    result.attempts_made = 1
    if result.success:
        return result
    for attempt in range(2, attempts + 1):
        if not result.retryable:
            return result
        sleep_seconds = base_backoff * max(1, attempt - 1)
        logger.warning(
            "Retrying WhatsApp delivery provider=%s attempt=%s to=%s error=%s",
            active_sender.provider_name,
            attempt,
            to,
            result.error,
        )
        await asyncio.sleep(sleep_seconds)
        result = await active_sender.send_whatsapp_message(to=to, message=message)
        result.attempts_made = attempt
        if result.success:
            return result
    return result
