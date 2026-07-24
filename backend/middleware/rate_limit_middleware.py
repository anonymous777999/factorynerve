"""Shared helpers for extracting client identity for rate limiting."""

from __future__ import annotations

from fastapi import Request


def _is_private_ip(ip: str) -> bool:
    """Check if an IP is a private/loopback address."""
    import ipaddress
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback
    except ValueError:
        return False


def extract_client_ip(request: Request) -> str:
    """
    Extract the real client IP for rate limiting.

    Security consideration (CVE-style):
    - If the request comes directly to us (client.host is public), never trust
      client-supplied ``X-Forwarded-For`` headers — an attacker can spoof them.
    - If the request arrives through a trusted reverse proxy (client.host is
      private / loopback), parse the *last* IP from X-Forwarded-For because
      the outermost proxy adds the most recently trusted hop.
    - When X-Forwarded-For is absent, fall back to client.host.
    """
    direct_ip = request.client.host if request.client else None
    forwarded_for = (request.headers.get("x-forwarded-for") or "").strip()

    if direct_ip and not _is_private_ip(direct_ip):
        # Request arrived directly from a public IP — no proxy in front.
        # X-Forwarded-For is client-controlled and MUST NOT be trusted.
        return direct_ip

    if forwarded_for:
        # Behind a trusted proxy: take the FIRST IP in the chain (the
        # original client), not the last (which is the nearest proxy).
        # Taking the nearest proxy would mean all clients behind that proxy
        # share the same rate limit, making the limit ineffective.
        parts = [p.strip() for p in forwarded_for.split(",") if p.strip()]
        if parts:
            return parts[0]

    return direct_ip or "unknown"
