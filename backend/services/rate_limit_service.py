"""Redis-backed rate limiting for OTP send and verification flows."""

from __future__ import annotations

from dataclasses import dataclass

from backend.cache import get_redis_client
from backend.phone_utils import hash_ip_for_rate_limit


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after: int = 0
    limit_type: str | None = None


@dataclass(frozen=True)
class CooldownResult:
    allowed: bool
    seconds_remaining: int = 0


class RateLimitService:
    PHONE_SEND_LIMIT = 3
    PHONE_SEND_WINDOW_SECONDS = 900
    IP_SEND_LIMIT = 10
    IP_SEND_WINDOW_SECONDS = 900
    COOLDOWN_SECONDS = 60

    def __init__(self, client=None) -> None:
        self._client = client or get_redis_client()
        if self._client is None:
            raise RuntimeError("Redis is required for OTP rate limiting.")

    @staticmethod
    def _phone_send_key(phone_e164: str) -> str:
        return f"otp:sends:{phone_e164}"

    @staticmethod
    def _ip_send_key(ip_address: str) -> str:
        return f"otp:sends:ip:{hash_ip_for_rate_limit(ip_address)}"

    @staticmethod
    def _cooldown_key(phone_e164: str) -> str:
        return f"otp:cooldown:{phone_e164}"

    def check_send_allowed(self, phone: str, ip: str) -> RateLimitResult:
        phone_count = int(self._client.get(self._phone_send_key(phone)) or 0)
        if phone_count >= self.PHONE_SEND_LIMIT:
            retry_after = max(0, int(self._client.ttl(self._phone_send_key(phone)) or 0))
            return RateLimitResult(allowed=False, retry_after=retry_after, limit_type="send_count")
        ip_key = self._ip_send_key(ip)
        ip_count = int(self._client.get(ip_key) or 0)
        if ip_count >= self.IP_SEND_LIMIT:
            retry_after = max(0, int(self._client.ttl(ip_key) or 0))
            return RateLimitResult(allowed=False, retry_after=retry_after, limit_type="ip")
        return RateLimitResult(allowed=True)

    def record_send(self, phone: str, ip: str) -> None:
        phone_key = self._phone_send_key(phone)
        ip_key = self._ip_send_key(ip)
        pipe = self._client.pipeline()
        pipe.incr(phone_key)
        pipe.expire(phone_key, self.PHONE_SEND_WINDOW_SECONDS)
        pipe.incr(ip_key)
        pipe.expire(ip_key, self.IP_SEND_WINDOW_SECONDS)
        pipe.execute()

    def check_cooldown(self, phone: str) -> CooldownResult:
        ttl = int(self._client.ttl(self._cooldown_key(phone)) or 0)
        if ttl > 0:
            return CooldownResult(allowed=False, seconds_remaining=ttl)
        return CooldownResult(allowed=True, seconds_remaining=0)

    def set_cooldown(self, phone: str) -> None:
        self._client.set(self._cooldown_key(phone), "1", ex=self.COOLDOWN_SECONDS)
