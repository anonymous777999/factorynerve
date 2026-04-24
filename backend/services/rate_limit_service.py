"""Redis-backed rate limiting for OTP send and verification flows."""

from __future__ import annotations

from dataclasses import dataclass
import threading
import time

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


class InMemoryRateLimitService:
    PHONE_SEND_LIMIT = 3
    PHONE_SEND_WINDOW_SECONDS = 900
    IP_SEND_LIMIT = 10
    IP_SEND_WINDOW_SECONDS = 900
    COOLDOWN_SECONDS = 60

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._phone_sends: dict[str, list[float]] = {}
        self._ip_sends: dict[str, list[float]] = {}
        self._cooldowns: dict[str, float] = {}

    @staticmethod
    def _phone_send_key(phone_e164: str) -> str:
        return f"otp:sends:{phone_e164}"

    @staticmethod
    def _ip_send_key(ip_address: str) -> str:
        return f"otp:sends:ip:{hash_ip_for_rate_limit(ip_address)}"

    @staticmethod
    def _cooldown_key(phone_e164: str) -> str:
        return f"otp:cooldown:{phone_e164}"

    @staticmethod
    def _prune(entries: list[float], *, window_seconds: int, now: float) -> list[float]:
        cutoff = now - window_seconds
        return [value for value in entries if value >= cutoff]

    def check_send_allowed(self, phone: str, ip: str) -> RateLimitResult:
        now = time.time()
        with self._lock:
            phone_entries = self._prune(
                self._phone_sends.get(phone, []),
                window_seconds=self.PHONE_SEND_WINDOW_SECONDS,
                now=now,
            )
            self._phone_sends[phone] = phone_entries
            if len(phone_entries) >= self.PHONE_SEND_LIMIT:
                retry_after = max(0, int(self.PHONE_SEND_WINDOW_SECONDS - (now - phone_entries[0])))
                return RateLimitResult(allowed=False, retry_after=retry_after, limit_type="send_count")

            ip_entries = self._prune(
                self._ip_sends.get(ip, []),
                window_seconds=self.IP_SEND_WINDOW_SECONDS,
                now=now,
            )
            self._ip_sends[ip] = ip_entries
            if len(ip_entries) >= self.IP_SEND_LIMIT:
                retry_after = max(0, int(self.IP_SEND_WINDOW_SECONDS - (now - ip_entries[0])))
                return RateLimitResult(allowed=False, retry_after=retry_after, limit_type="ip")
        return RateLimitResult(allowed=True)

    def record_send(self, phone: str, ip: str) -> None:
        now = time.time()
        with self._lock:
            self._phone_sends[phone] = self._prune(
                self._phone_sends.get(phone, []),
                window_seconds=self.PHONE_SEND_WINDOW_SECONDS,
                now=now,
            ) + [now]
            self._ip_sends[ip] = self._prune(
                self._ip_sends.get(ip, []),
                window_seconds=self.IP_SEND_WINDOW_SECONDS,
                now=now,
            ) + [now]

    def check_cooldown(self, phone: str) -> CooldownResult:
        now = time.time()
        with self._lock:
            expires_at = self._cooldowns.get(phone, 0)
            if expires_at <= now:
                self._cooldowns.pop(phone, None)
                return CooldownResult(allowed=True, seconds_remaining=0)
            return CooldownResult(allowed=False, seconds_remaining=max(0, int(expires_at - now)))

    def set_cooldown(self, phone: str) -> None:
        with self._lock:
            self._cooldowns[phone] = time.time() + self.COOLDOWN_SECONDS


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


def build_otp_rate_limit_service():
    client = get_redis_client()
    if client is not None:
        return RateLimitService(client=client)
    return InMemoryRateLimitService()
