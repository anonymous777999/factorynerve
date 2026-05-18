from __future__ import annotations

import asyncio
import hashlib
import hmac
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

import httpx
import razorpay

from backend.services.billing.provider_adapter import OrderResult, PaymentResult, SubscriptionResult
from backend.services.billing.settings import BillingSettings, billing_settings


class RazorpayPaymentAdapter:
    def __init__(
        self,
        settings: BillingSettings | None = None,
        *,
        base_url: str = "https://api.razorpay.com/v1",
        transport: httpx.BaseTransport | httpx.AsyncBaseTransport | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._settings = settings or billing_settings
        self._key_id = self._settings.RAZORPAY_KEY_ID
        self._key_secret = self._settings.RAZORPAY_KEY_SECRET
        self._webhook_secret = self._settings.RAZORPAY_WEBHOOK_SECRET
        self._base_url = base_url.rstrip("/")
        self._transport = transport
        self._timeout = timeout
        self._sdk_client = razorpay.Client(auth=(self._key_id, self._key_secret))

    async def create_order(
        self,
        amount_paise: int,
        currency: str,
        receipt_id: str,
        notes: dict[str, str],
    ) -> OrderResult:
        payload = {
            "amount": int(amount_paise),
            "currency": currency,
            "receipt": receipt_id,
            "notes": dict(notes),
        }
        attempts = 0
        last_error: Exception | None = None
        while attempts < 2:
            attempts += 1
            try:
                result = await asyncio.to_thread(self._sdk_client.order.create, payload)
                break
            except httpx.HTTPStatusError as error:
                last_error = error
                if error.response is not None and error.response.status_code >= 500 and attempts < 2:
                    continue
                raise
        else:  # pragma: no cover - defensive loop exhaustion
            assert last_error is not None
            raise last_error
        return OrderResult(
            id=str(result["id"]),
            amount_paise=int(result["amount"]),
            currency=str(result["currency"]),
            receipt_id=str(result.get("receipt") or receipt_id),
            status=str(result.get("status") or "created"),
            notes={str(key): str(value) for key, value in (result.get("notes") or {}).items()},
            raw=dict(result),
        )

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        secret = self._webhook_secret.encode()
        expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        payload = f"{order_id}|{payment_id}".encode()
        expected = hmac.new(self._key_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def fetch_payment(self, payment_id: str) -> PaymentResult:
        async with httpx.AsyncClient(
            auth=(self._key_id, self._key_secret),
            base_url=f"{self._base_url}/",
            timeout=self._timeout,
            transport=self._transport,
        ) as client:
            response = await client.get(f"payments/{payment_id}")
            response.raise_for_status()
            payload = response.json()
        return PaymentResult(
            id=str(payload["id"]),
            order_id=self._as_optional_str(payload.get("order_id")),
            amount_paise=int(payload.get("amount") or 0),
            currency=str(payload.get("currency") or ""),
            status=str(payload.get("status") or ""),
            method=self._as_optional_str(payload.get("method")),
            captured=bool(payload.get("captured")),
            raw=dict(payload),
        )

    async def cancel_subscription(self, sub_id: str, at_period_end: bool) -> bool:
        payload = {"cancel_at_cycle_end": 1 if at_period_end else 0}
        result = await asyncio.to_thread(self._sdk_client.subscription.cancel, sub_id, payload)
        parsed = self._parse_subscription_result(result)
        return parsed.status in {"cancelled", "completed", "halted"}

    def _parse_subscription_result(self, payload: Mapping[str, Any]) -> SubscriptionResult:
        end_at = payload.get("end_at")
        current_end_at = None
        if isinstance(end_at, (int, float)):
            current_end_at = datetime.fromtimestamp(end_at, tz=timezone.utc)
        return SubscriptionResult(
            id=str(payload.get("id") or ""),
            status=str(payload.get("status") or ""),
            cancel_at_period_end=bool(payload.get("cancel_at_cycle_end")),
            current_end_at=current_end_at,
            raw=dict(payload),
        )

    @staticmethod
    def _as_optional_str(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None
