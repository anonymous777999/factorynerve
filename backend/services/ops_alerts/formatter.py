"""Message formatting helpers for WhatsApp operational alerts."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from backend.services.ops_alerts.types import AlertCandidate


def _resolve_timezone(timezone_name: str):
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        if timezone_name in {"Asia/Kolkata", "Asia/Calcutta"}:
            return timezone(timedelta(hours=5, minutes=30))
        if timezone_name == "UTC":
            return timezone.utc
        raise ValueError(f"Unknown alert timezone: {timezone_name}")


def _stringify_meta_value(value: object) -> str:
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float, str)):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat(timespec="seconds")
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def format_alert_message(
    candidate: AlertCandidate,
    *,
    app_name: str,
    env_name: str,
    timezone_name: str,
) -> str:
    tzinfo = _resolve_timezone(timezone_name)
    alert_time = candidate.timestamp.astimezone(tzinfo)
    org_name = (candidate.org_name or app_name or "Unknown").strip() or "Unknown"
    prefix = f"Escalated x{candidate.escalation_level} | " if candidate.escalation_level and candidate.escalation_level > 1 else ""
    meta_pairs = [
        f"{key}: {_stringify_meta_value(value)}"
        for key, value in candidate.meta.items()
    ]
    meta_line = " | ".join(meta_pairs) if meta_pairs else "-"
    return "\n".join(
        [
            f"{prefix}🚨 {candidate.severity.value} — {candidate.event_type.label}",
            f"Org: {org_name} | App: {app_name} | Env: {env_name}",
            f"Time: {alert_time.isoformat(timespec='seconds')}",
            f"Context: {candidate.summary.strip()}",
            f"Meta: {meta_line}",
            f"Ref ID: {candidate.ref_id or '-'}",
        ]
    )
