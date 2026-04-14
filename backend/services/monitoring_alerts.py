"""Monitoring alert definitions and evaluators for post-launch operational health."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session


logger = logging.getLogger(__name__)
MOBILE_DROPOFF_ALERT = "mobile_dropoff_threshold_breach"
MANAGER_SESSION_ALERT = "manager_session_health_degraded"
BACKLOG_PATH = Path(os.getenv("MONITORING_BACKLOG_PATH", "var/monitoring_backlog.jsonl"))


def list_monitoring_alert_rules() -> list[dict[str, Any]]:
    return [
        {
            "name": MOBILE_DROPOFF_ALERT,
            "trigger": "weekly",
            "routes": {
                "/control-tower": {"min_views": 30, "dropoff_threshold": 0.40},
                "/settings": {"min_views": 40, "dropoff_threshold": 0.30},
            },
            "action": "post to ops channel + create a P1 backlog item",
        },
        {
            "name": MANAGER_SESSION_ALERT,
            "trigger": "daily",
            "thresholds": {
                "redirect_login_ratio": 0.02,
                "placeholder_rendered_count": 0,
            },
            "action": "post to engineering channel immediately",
        },
    ]


def _post_channel_message(webhook_url: str | None, payload: dict[str, Any], *, channel_name: str) -> None:
    if not webhook_url:
        logger.warning("Monitoring webhook missing for %s payload=%s", channel_name, payload)
        return
    try:
        httpx.post(webhook_url, json=payload, timeout=5.0)
    except Exception:  # pragma: no cover - notification failures are best effort only
        logger.exception("Failed to post monitoring alert to %s", channel_name)


def _append_backlog_item(item: dict[str, Any]) -> None:
    try:
        BACKLOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with BACKLOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(item, ensure_ascii=True) + "\n")
    except Exception:  # pragma: no cover - notification failures are best effort only
        logger.exception("Failed to append monitoring backlog item.")


def evaluate_mobile_dropoff_threshold_breach(db: Session) -> dict[str, Any]:
    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect == "sqlite":
        sql = """
        SELECT
          COALESCE(json_extract(properties, '$.route'), 'unknown') AS route,
          SUM(CASE WHEN json_extract(properties, '$.step') = 'view' THEN 1 ELSE 0 END) AS view_events,
          SUM(CASE WHEN json_extract(properties, '$.step') = 'primary_action_completed' THEN 1 ELSE 0 END) AS completion_events
        FROM product_events
        WHERE event_name = 'mobile_route_funnel_step'
          AND occurred_at >= datetime('now', '-7 days')
        GROUP BY 1
        """
    else:
        sql = """
        SELECT
          properties->>'route' AS route,
          SUM(CASE WHEN properties->>'step' = 'view' THEN 1 ELSE 0 END) AS view_events,
          SUM(CASE WHEN properties->>'step' = 'primary_action_completed' THEN 1 ELSE 0 END) AS completion_events
        FROM product_events
        WHERE event_name = 'mobile_route_funnel_step'
          AND occurred_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1
        """

    rows = [dict(row) for row in db.execute(text(sql)).mappings().all()]
    thresholds = {
        "/control-tower": {"min_views": 30, "dropoff_threshold": 0.40},
        "/settings": {"min_views": 40, "dropoff_threshold": 0.30},
    }
    triggered: list[dict[str, Any]] = []

    for row in rows:
        route = str(row.get("route") or "")
        if route not in thresholds:
            continue
        view_events = int(row.get("view_events") or 0)
        completion_events = int(row.get("completion_events") or 0)
        dropoff = 1.0 - (completion_events / view_events) if view_events else 1.0
        threshold = thresholds[route]
        if view_events >= threshold["min_views"] and dropoff >= threshold["dropoff_threshold"]:
            triggered.append(
                {
                    "route": route,
                    "view_events": view_events,
                    "completion_events": completion_events,
                    "dropoff": round(dropoff, 4),
                    "threshold": threshold["dropoff_threshold"],
                }
            )

    return {
        "name": MOBILE_DROPOFF_ALERT,
        "triggered": bool(triggered),
        "window": "7d",
        "items": triggered,
    }


def evaluate_manager_session_health_degraded(db: Session) -> dict[str, Any]:
    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect == "sqlite":
        sql = """
        SELECT
          COUNT(*) AS total_events,
          SUM(CASE WHEN json_extract(properties, '$.result') = 'redirect_login' THEN 1 ELSE 0 END) AS redirect_login_events,
          SUM(CASE WHEN json_extract(properties, '$.result') = 'placeholder_rendered' THEN 1 ELSE 0 END) AS placeholder_events
        FROM product_events
        WHERE event_name = 'manager_session_guard_result'
          AND occurred_at >= datetime('now', '-1 day')
        """
    else:
        sql = """
        SELECT
          COUNT(*) AS total_events,
          SUM(CASE WHEN properties->>'result' = 'redirect_login' THEN 1 ELSE 0 END) AS redirect_login_events,
          SUM(CASE WHEN properties->>'result' = 'placeholder_rendered' THEN 1 ELSE 0 END) AS placeholder_events
        FROM product_events
        WHERE event_name = 'manager_session_guard_result'
          AND occurred_at >= NOW() - INTERVAL '1 day'
        """

    row = dict(db.execute(text(sql)).mappings().first() or {})
    total_events = int(row.get("total_events") or 0)
    redirect_login_events = int(row.get("redirect_login_events") or 0)
    placeholder_events = int(row.get("placeholder_events") or 0)
    redirect_ratio = (redirect_login_events / total_events) if total_events else 0.0

    return {
        "name": MANAGER_SESSION_ALERT,
        "triggered": redirect_ratio > 0.02 or placeholder_events > 0,
        "window": "1d",
        "summary": {
            "total_events": total_events,
            "redirect_login_events": redirect_login_events,
            "placeholder_rendered_events": placeholder_events,
            "redirect_login_ratio": round(redirect_ratio, 4),
        },
    }


def run_monitoring_alert_rule(db: Session, rule_name: str) -> dict[str, Any]:
    if rule_name == MOBILE_DROPOFF_ALERT:
        result = evaluate_mobile_dropoff_threshold_breach(db)
        if result["triggered"]:
            payload = {
                "alert": MOBILE_DROPOFF_ALERT,
                "severity": "p1",
                "items": result["items"],
                "occurred_at": datetime.now(timezone.utc).isoformat(),
            }
            _post_channel_message(
                os.getenv("MONITORING_OPS_WEBHOOK_URL"),
                payload,
                channel_name="ops",
            )
            _append_backlog_item(
                {
                    "title": "P1: Mobile drop-off threshold breach",
                    "priority": "P1",
                    "source": MOBILE_DROPOFF_ALERT,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "items": result["items"],
                }
            )
        return result

    if rule_name == MANAGER_SESSION_ALERT:
        result = evaluate_manager_session_health_degraded(db)
        if result["triggered"]:
            _post_channel_message(
                os.getenv("MONITORING_ENGINEERING_WEBHOOK_URL"),
                {
                    "alert": MANAGER_SESSION_ALERT,
                    "severity": "high",
                    "summary": result["summary"],
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                },
                channel_name="engineering",
            )
        return result

    raise KeyError(rule_name)
