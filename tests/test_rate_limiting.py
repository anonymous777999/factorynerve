from __future__ import annotations

import fakeredis

from backend.services.rate_limit_service import RateLimitService


def _service() -> RateLimitService:
    return RateLimitService(client=fakeredis.FakeStrictRedis(decode_responses=True))


def test_cooldown_blocks_resend_within_window():
    service = _service()

    service.set_cooldown("+919876543210")
    result = service.check_cooldown("+919876543210")

    assert result.allowed is False
    assert result.seconds_remaining > 0


def test_send_count_blocks_after_three_sends():
    service = _service()
    phone = "+919876543211"

    for _ in range(3):
        allowed = service.check_send_allowed(phone, "127.0.0.1")
        assert allowed.allowed is True
        service.record_send(phone, "127.0.0.1")

    blocked = service.check_send_allowed(phone, "127.0.0.1")

    assert blocked.allowed is False
    assert blocked.limit_type == "send_count"
    assert blocked.retry_after > 0


def test_different_phones_are_rate_limited_independently():
    service = _service()

    for _ in range(3):
        service.record_send("+919876543212", "127.0.0.2")

    blocked = service.check_send_allowed("+919876543212", "127.0.0.2")
    other_phone = service.check_send_allowed("+919876543213", "127.0.0.2")

    assert blocked.allowed is False
    assert other_phone.allowed is True


def test_ip_limit_triggers_independently_of_phone_limit():
    service = _service()

    for index in range(10):
        service.record_send(f"+9198765432{index:02d}", "127.0.0.9")

    blocked = service.check_send_allowed("+919876543299", "127.0.0.9")

    assert blocked.allowed is False
    assert blocked.limit_type == "ip"
