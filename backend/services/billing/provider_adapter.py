from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol


@dataclass(slots=True, frozen=True)
class OrderResult:
    id: str
    amount_paise: int
    currency: str
    receipt_id: str
    status: str
    notes: dict[str, str] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True, frozen=True)
class PaymentResult:
    id: str
    order_id: str | None
    amount_paise: int
    currency: str
    status: str
    method: str | None
    captured: bool
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True, frozen=True)
class SubscriptionResult:
    id: str
    status: str
    cancel_at_period_end: bool
    current_end_at: datetime | None
    raw: dict[str, Any] = field(default_factory=dict)


class AbstractPaymentProvider(Protocol):
    async def create_order(
        self,
        amount_paise: int,
        currency: str,
        receipt_id: str,
        notes: dict[str, str],
    ) -> OrderResult: ...

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool: ...

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool: ...

    async def fetch_payment(self, payment_id: str) -> PaymentResult: ...

    async def cancel_subscription(self, sub_id: str, at_period_end: bool) -> bool: ...
