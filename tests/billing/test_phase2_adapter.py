from __future__ import annotations

import importlib
import sys
import types

import httpx
import pytest


WEBHOOK_BODY = b'{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123"}}}}'
WEBHOOK_SIGNATURE = "8280e88d7498c8335eb1243c9e7d9f5f69e39a39999414ee6f57c2510e86e010"
ORDER_ID = "order_9A33XWu170gUtm"
PAYMENT_ID = "pay_29QQoUBi66xm2f"
PAYMENT_SIGNATURE = "be4e268d18aa939d543a5808c01361b6df396a8a94c9162ce3219c7ef2e2334a"


def _fake_razorpay_module() -> types.ModuleType:
    module = types.ModuleType("razorpay")

    class FakeOrderClient:
        def create(self, payload):
            return {
                "id": "order_test",
                "amount": payload["amount"],
                "currency": payload["currency"],
                "receipt": payload["receipt"],
                "status": "created",
                "notes": payload.get("notes", {}),
            }

    class FakeSubscriptionClient:
        def cancel(self, sub_id, payload):
            return {
                "id": sub_id,
                "status": "cancelled",
                "cancel_at_cycle_end": bool(payload.get("cancel_at_cycle_end")),
            }

    class FakeClient:
        def __init__(self, auth):
            self.auth = auth
            self.order = FakeOrderClient()
            self.subscription = FakeSubscriptionClient()

    module.Client = FakeClient
    return module


def _reset_billing_modules() -> None:
    for name in [
        "backend.services.billing.razorpay_adapter",
        "backend.services.billing.settings",
        "backend.services.billing.provider_adapter",
        "backend.services.billing",
    ]:
        sys.modules.pop(name, None)


def _import_adapter_module(monkeypatch: pytest.MonkeyPatch, **env: str):
    monkeypatch.setitem(sys.modules, "razorpay", _fake_razorpay_module())
    for key in [
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
        "PAYMENT_PROVIDER",
        "WHATSAPP_PROVIDER_MODE",
        "ENV",
        "APP_ENV",
    ]:
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    _reset_billing_modules()
    return importlib.import_module("backend.services.billing.razorpay_adapter")


def _import_settings_module(monkeypatch: pytest.MonkeyPatch, **env: str):
    monkeypatch.setitem(sys.modules, "razorpay", _fake_razorpay_module())
    for key in [
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
        "PAYMENT_PROVIDER",
        "WHATSAPP_PROVIDER_MODE",
        "ENV",
        "APP_ENV",
    ]:
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    _reset_billing_modules()
    return importlib.import_module("backend.services.billing.settings")


@pytest.mark.asyncio
async def test_valid_webhook_signature_passes(monkeypatch: pytest.MonkeyPatch):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"ok": True}))
    adapter_module = _import_adapter_module(
        monkeypatch,
        RAZORPAY_KEY_ID="rzp_test_key",
        RAZORPAY_KEY_SECRET="secret_demo",
        RAZORPAY_WEBHOOK_SECRET="whsec_demo",
        WHATSAPP_PROVIDER_MODE="razorpay",
    )
    adapter = adapter_module.RazorpayPaymentAdapter(transport=transport)

    assert adapter.verify_webhook_signature(WEBHOOK_BODY, WEBHOOK_SIGNATURE) is True


@pytest.mark.asyncio
async def test_tampered_webhook_signature_fails(monkeypatch: pytest.MonkeyPatch):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"ok": True}))
    adapter_module = _import_adapter_module(
        monkeypatch,
        RAZORPAY_KEY_ID="rzp_test_key",
        RAZORPAY_KEY_SECRET="secret_demo",
        RAZORPAY_WEBHOOK_SECRET="whsec_demo",
        WHATSAPP_PROVIDER_MODE="razorpay",
    )
    adapter = adapter_module.RazorpayPaymentAdapter(transport=transport)

    assert adapter.verify_webhook_signature(WEBHOOK_BODY + b" ", WEBHOOK_SIGNATURE) is False


@pytest.mark.asyncio
async def test_valid_payment_signature_passes(monkeypatch: pytest.MonkeyPatch):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"ok": True}))
    adapter_module = _import_adapter_module(
        monkeypatch,
        RAZORPAY_KEY_ID="rzp_test_key",
        RAZORPAY_KEY_SECRET="secret_demo",
        RAZORPAY_WEBHOOK_SECRET="whsec_demo",
        WHATSAPP_PROVIDER_MODE="razorpay",
    )
    adapter = adapter_module.RazorpayPaymentAdapter(transport=transport)

    assert adapter.verify_payment_signature(ORDER_ID, PAYMENT_ID, PAYMENT_SIGNATURE) is True


@pytest.mark.asyncio
async def test_wrong_key_payment_signature_fails(monkeypatch: pytest.MonkeyPatch):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"ok": True}))
    adapter_module = _import_adapter_module(
        monkeypatch,
        RAZORPAY_KEY_ID="rzp_test_key",
        RAZORPAY_KEY_SECRET="wrong_secret",
        RAZORPAY_WEBHOOK_SECRET="whsec_demo",
        WHATSAPP_PROVIDER_MODE="razorpay",
    )
    adapter = adapter_module.RazorpayPaymentAdapter(transport=transport)

    assert adapter.verify_payment_signature(ORDER_ID, PAYMENT_ID, PAYMENT_SIGNATURE) is False


@pytest.mark.asyncio
async def test_test_key_in_production_raises_at_startup(monkeypatch: pytest.MonkeyPatch):
    with pytest.raises(ValueError, match="test key"):
        _import_settings_module(
            monkeypatch,
            ENV="production",
            RAZORPAY_KEY_ID="rzp_live_key",
            RAZORPAY_KEY_SECRET="test_secret_demo",
            RAZORPAY_WEBHOOK_SECRET="whsec_demo",
            WHATSAPP_PROVIDER_MODE="razorpay",
        )


@pytest.mark.asyncio
async def test_fetch_payment_uses_mock_transport(monkeypatch: pytest.MonkeyPatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/v1/payments/{PAYMENT_ID}"
        return httpx.Response(
            200,
            json={
                "id": PAYMENT_ID,
                "order_id": ORDER_ID,
                "amount": 5000,
                "currency": "INR",
                "status": "captured",
                "method": "upi",
                "captured": True,
            },
        )

    adapter_module = _import_adapter_module(
        monkeypatch,
        RAZORPAY_KEY_ID="rzp_test_key",
        RAZORPAY_KEY_SECRET="secret_demo",
        RAZORPAY_WEBHOOK_SECRET="whsec_demo",
        WHATSAPP_PROVIDER_MODE="razorpay",
    )
    adapter = adapter_module.RazorpayPaymentAdapter(transport=httpx.MockTransport(handler))

    result = await adapter.fetch_payment(PAYMENT_ID)

    assert result.id == PAYMENT_ID
    assert result.order_id == ORDER_ID
    assert result.amount_paise == 5000
    assert result.status == "captured"
