"""Decision engine for autonomous UI telemetry, preferences, and recommendations."""

from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.models.ui_autonomy import UiBehaviorSignal, UiPreference, UiRecommendation
from backend.tenancy import resolve_factory_id, resolve_org_id


RECENT_WINDOW_DAYS = 14
RECOMMENDATION_SOURCE = "local-heuristics"
PRIORITY_SCORE = {"high": 3, "medium": 2, "low": 1}
STATUS_SCORE = {"open": 3, "applied": 2, "resolved": 1, "dismissed": 0}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_text(value: str | None, *, fallback: str | None = None, max_length: int = 300) -> str | None:
    if value is None:
        return fallback
    cleaned = value.strip()
    if not cleaned:
        return fallback
    return cleaned[:max_length]


def _priority_rank(priority: str) -> int:
    return PRIORITY_SCORE.get(priority, 0)


def _status_rank(status: str) -> int:
    return STATUS_SCORE.get(status, 0)


def _signal_to_dict(signal: UiBehaviorSignal) -> dict[str, Any]:
    return {
        "id": signal.id,
        "route": signal.route,
        "signal_type": signal.signal_type,
        "signal_key": signal.signal_key,
        "severity": signal.severity,
        "duration_ms": signal.duration_ms,
        "value": signal.value,
        "payload": signal.payload_json,
        "created_at": signal.created_at,
    }


def _preference_to_dict(preference: UiPreference) -> dict[str, Any]:
    return {
        "id": preference.id,
        "key": preference.preference_key,
        "value": preference.preference_value,
        "source": preference.source,
        "created_at": preference.created_at,
        "updated_at": preference.updated_at,
    }


def _recommendation_to_dict(recommendation: UiRecommendation) -> dict[str, Any]:
    return {
        "id": recommendation.id,
        "route": recommendation.route,
        "category": recommendation.category,
        "priority": recommendation.priority,
        "title": recommendation.title,
        "summary": recommendation.summary,
        "suggested_action": recommendation.suggested_action,
        "evidence": recommendation.evidence_json,
        "source": recommendation.source,
        "status": recommendation.status,
        "created_at": recommendation.created_at,
        "updated_at": recommendation.updated_at,
    }


def _recent_signals(db: Session, *, user_id: int, days: int = RECENT_WINDOW_DAYS) -> list[UiBehaviorSignal]:
    window_start = _now() - timedelta(days=days)
    return (
        db.query(UiBehaviorSignal)
        .filter(UiBehaviorSignal.user_id == user_id, UiBehaviorSignal.created_at >= window_start)
        .order_by(UiBehaviorSignal.created_at.desc())
        .all()
    )


def record_signal(
    db: Session,
    *,
    current_user: Any,
    route: str | None,
    signal_type: str,
    signal_key: str,
    severity: str | None = None,
    duration_ms: int | None = None,
    value: float | None = None,
    payload: dict[str, Any] | list[Any] | None = None,
) -> UiBehaviorSignal:
    signal = UiBehaviorSignal(
        org_id=resolve_org_id(current_user),
        factory_id=resolve_factory_id(db, current_user),
        user_id=int(current_user.id),
        route=_clean_text(route, fallback="unknown"),
        signal_type=_clean_text(signal_type, fallback="unknown", max_length=40) or "unknown",
        signal_key=_clean_text(signal_key, fallback="unknown", max_length=80) or "unknown",
        severity=_clean_text(severity, max_length=16),
        duration_ms=max(0, int(duration_ms)) if duration_ms is not None else None,
        value=float(value) if value is not None else None,
        payload_json=payload,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


def list_preferences(db: Session, *, current_user: Any) -> list[dict[str, Any]]:
    records = (
        db.query(UiPreference)
        .filter(UiPreference.user_id == int(current_user.id))
        .order_by(UiPreference.preference_key.asc())
        .all()
    )
    return [_preference_to_dict(record) for record in records]


def upsert_preference(
    db: Session,
    *,
    current_user: Any,
    preference_key: str,
    preference_value: Any,
    source: str = "manual",
    commit: bool = True,
    allow_manual_override: bool = False,
) -> tuple[UiPreference, bool]:
    normalized_key = _clean_text(preference_key, fallback="unknown", max_length=80) or "unknown"
    normalized_source = _clean_text(source, fallback="manual", max_length=24) or "manual"
    preference = (
        db.query(UiPreference)
        .filter(UiPreference.user_id == int(current_user.id), UiPreference.preference_key == normalized_key)
        .first()
    )
    changed = False
    if preference and preference.source == "manual" and normalized_source != "manual" and not allow_manual_override:
        return preference, False
    if not preference:
        preference = UiPreference(
            org_id=resolve_org_id(current_user),
            factory_id=resolve_factory_id(db, current_user),
            user_id=int(current_user.id),
            preference_key=normalized_key,
            preference_value=preference_value,
            source=normalized_source,
        )
        db.add(preference)
        changed = True
    elif preference.preference_value != preference_value or preference.source != normalized_source:
        preference.preference_value = preference_value
        preference.source = normalized_source
        preference.factory_id = resolve_factory_id(db, current_user)
        preference.org_id = resolve_org_id(current_user)
        preference.updated_at = _now()
        db.add(preference)
        changed = True
    if commit:
        db.commit()
        db.refresh(preference)
    return preference, changed


def list_recommendations(db: Session, *, current_user: Any) -> list[dict[str, Any]]:
    records = (
        db.query(UiRecommendation)
        .filter(UiRecommendation.user_id == int(current_user.id))
        .all()
    )
    records.sort(
        key=lambda item: (
            _status_rank(item.status),
            _priority_rank(item.priority),
            item.updated_at,
        ),
        reverse=True,
    )
    return [_recommendation_to_dict(record) for record in records]


def update_recommendation_status(
    db: Session,
    *,
    current_user: Any,
    recommendation_id: int,
    status: str,
) -> UiRecommendation | None:
    recommendation = (
        db.query(UiRecommendation)
        .filter(UiRecommendation.id == recommendation_id, UiRecommendation.user_id == int(current_user.id))
        .first()
    )
    if not recommendation:
        return None
    recommendation.status = _clean_text(status, fallback="open", max_length=24) or "open"
    recommendation.updated_at = _now()
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)
    return recommendation


def summarize_behavior(
    db: Session,
    *,
    current_user: Any,
    days: int = RECENT_WINDOW_DAYS,
) -> dict[str, Any]:
    signals = _recent_signals(db, user_id=int(current_user.id), days=days)
    route_stats: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {
            "visits": 0,
            "interactions": 0,
            "issue_count": 0,
            "duration_total": 0,
            "duration_count": 0,
            "long_tasks": 0,
        }
    )
    issue_counts: dict[str, int] = defaultdict(int)

    for signal in signals:
        route = signal.route or "unknown"
        stats = route_stats[route]
        if signal.signal_type == "route_visit":
            stats["visits"] += 1
            if signal.duration_ms is not None:
                stats["duration_total"] += signal.duration_ms
                stats["duration_count"] += 1
        elif signal.signal_type == "interaction":
            stats["interactions"] += 1
        else:
            stats["issue_count"] += 1
            issue_counts[f"{signal.signal_type}:{signal.signal_key}"] += 1

        if signal.signal_type == "performance" and signal.signal_key == "long_task":
            stats["long_tasks"] += 1

    top_routes: list[dict[str, Any]] = []
    slow_routes: list[dict[str, Any]] = []
    drop_off_routes: list[dict[str, Any]] = []
    for route, stats in route_stats.items():
        duration_count = int(stats["duration_count"])
        avg_duration_ms = (
            int(round(float(stats["duration_total"]) / duration_count))
            if duration_count > 0
            else None
        )
        route_summary = {
            "route": route,
            "visits": int(stats["visits"]),
            "interactions": int(stats["interactions"]),
            "issue_count": int(stats["issue_count"]),
            "avg_duration_ms": avg_duration_ms,
            "long_tasks": int(stats["long_tasks"]),
        }
        top_routes.append(route_summary)
        if avg_duration_ms and (avg_duration_ms >= 45_000 or int(stats["long_tasks"]) >= 2):
            slow_routes.append(route_summary)
        if int(stats["visits"]) >= 2 and avg_duration_ms is not None and avg_duration_ms <= 8_000:
            drop_off_routes.append(route_summary)

    top_routes.sort(
        key=lambda item: (
            item["visits"] + item["interactions"],
            item["issue_count"],
            item["avg_duration_ms"] or 0,
        ),
        reverse=True,
    )
    slow_routes.sort(key=lambda item: (item["avg_duration_ms"] or 0, item["long_tasks"]), reverse=True)
    drop_off_routes.sort(key=lambda item: (item["visits"], -1 * (item["avg_duration_ms"] or 0)), reverse=True)

    open_recommendations = (
        db.query(UiRecommendation)
        .filter(
            UiRecommendation.user_id == int(current_user.id),
            UiRecommendation.status == "open",
        )
        .count()
    )

    return {
        "window_days": days,
        "total_signals": len(signals),
        "signal_breakdown": dict(sorted(issue_counts.items())),
        "top_routes": top_routes[:6],
        "slow_routes": slow_routes[:5],
        "drop_off_routes": drop_off_routes[:5],
        "open_recommendations": open_recommendations,
        "recent_signals": [_signal_to_dict(signal) for signal in signals[:20]],
    }


def _recommendation_key(*, user_id: int, route: str | None, category: str, title: str) -> str:
    fingerprint = f"{user_id}|{route or '-'}|{category}|{title}"
    return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:32]


def _candidate(
    *,
    user_id: int,
    route: str | None,
    category: str,
    priority: str,
    title: str,
    summary: str,
    evidence: dict[str, Any],
    suggested_action: str,
) -> dict[str, Any]:
    return {
        "recommendation_key": _recommendation_key(
            user_id=user_id,
            route=route,
            category=category,
            title=title,
        ),
        "route": route,
        "category": category,
        "priority": priority,
        "title": title,
        "summary": summary,
        "evidence_json": evidence,
        "suggested_action": suggested_action,
        "source": RECOMMENDATION_SOURCE,
    }


def _build_candidates(current_user: Any, signals: list[UiBehaviorSignal]) -> list[dict[str, Any]]:
    route_issue_counts: dict[tuple[str, str], int] = defaultdict(int)
    route_issue_evidence: dict[tuple[str, str], dict[str, Any]] = defaultdict(dict)
    route_visit_stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"visits": 0, "duration_total": 0, "duration_count": 0}
    )

    for signal in signals:
        route = signal.route or "unknown"
        if signal.signal_type == "route_visit":
            route_visit_stats[route]["visits"] += 1
            if signal.duration_ms is not None:
                route_visit_stats[route]["duration_total"] += signal.duration_ms
                route_visit_stats[route]["duration_count"] += 1
            continue

        key = (route, signal.signal_key)
        route_issue_counts[key] += 1
        evidence = route_issue_evidence[key]
        evidence["count"] = route_issue_counts[key]
        evidence["signal_type"] = signal.signal_type
        if signal.duration_ms is not None:
            evidence["last_duration_ms"] = signal.duration_ms
        if signal.value is not None:
            evidence["last_value"] = signal.value

    user_id = int(current_user.id)
    candidates: list[dict[str, Any]] = []
    for (route, issue_key), count in route_issue_counts.items():
        if issue_key == "horizontal_overflow" and count >= 1:
            candidates.append(
                _candidate(
                    user_id=user_id,
                    route=route,
                    category="layout",
                    priority="high",
                    title=f"Fix horizontal overflow on {route}",
                    summary=f"{count} layout scans found content spilling past the viewport on {route}.",
                    evidence=route_issue_evidence[(route, issue_key)],
                    suggested_action="Remove min-width traps, wrap wide content in overflow containers, and verify on 360px mobile widths.",
                )
            )
        if issue_key == "tap_target_small" and count >= 2:
            candidates.append(
                _candidate(
                    user_id=user_id,
                    route=route,
                    category="accessibility",
                    priority="high" if count >= 4 else "medium",
                    title=f"Increase touch targets on {route}",
                    summary=f"{count} scans found controls below the 44px touch target guideline on {route}.",
                    evidence=route_issue_evidence[(route, issue_key)],
                    suggested_action="Increase button and link hit areas to at least 44px and keep key actions easy to tap one-handed.",
                )
            )
        if issue_key == "crowded_above_fold" and count >= 1:
            candidates.append(
                _candidate(
                    user_id=user_id,
                    route=route,
                    category="hierarchy",
                    priority="medium",
                    title=f"Reduce above-the-fold clutter on {route}",
                    summary=f"Interactive density above the fold is high on {route}, which can slow first-action decisions.",
                    evidence=route_issue_evidence[(route, issue_key)],
                    suggested_action="Demote secondary actions, keep one primary CTA visible first, and collapse low-value controls behind drawers or menus.",
                )
            )
        if issue_key == "missing_primary_heading" and count >= 1:
            candidates.append(
                _candidate(
                    user_id=user_id,
                    route=route,
                    category="clarity",
                    priority="medium",
                    title=f"Add a single clear page heading on {route}",
                    summary=f"{route} was rendered without a visible primary heading during the scan window.",
                    evidence=route_issue_evidence[(route, issue_key)],
                    suggested_action="Ensure the first screen has one strong page title that explains what the user can do next.",
                )
            )
        if issue_key == "long_page" and count >= 2:
            candidates.append(
                _candidate(
                    user_id=user_id,
                    route=route,
                    category="flow",
                    priority="low",
                    title=f"Shorten the initial scroll depth on {route}",
                    summary=f"{route} repeatedly rendered taller than three viewports, which can hide key actions below the fold.",
                    evidence=route_issue_evidence[(route, issue_key)],
                    suggested_action="Move the most-used tasks and summaries higher, and postpone secondary sections until after the first decision point.",
                )
            )
        if issue_key == "long_task" and count >= 1:
            candidates.append(
                _candidate(
                    user_id=user_id,
                    route=route,
                    category="performance",
                    priority="high" if count >= 3 else "medium",
                    title=f"Reduce main-thread work on {route}",
                    summary=f"{count} long-task events were recorded on {route}, indicating the UI may feel sluggish during interaction.",
                    evidence=route_issue_evidence[(route, issue_key)],
                    suggested_action="Break up heavy client-side work, defer non-critical rendering, and trim expensive effects for the first screen.",
                )
            )

    for route, stats in route_visit_stats.items():
        duration_count = stats["duration_count"]
        avg_duration_ms = int(round(stats["duration_total"] / duration_count)) if duration_count else None
        if stats["visits"] >= 3 and avg_duration_ms is not None and avg_duration_ms <= 8_000:
            candidates.append(
                _candidate(
                    user_id=user_id,
                    route=route,
                    category="navigation",
                    priority="medium",
                    title=f"Review drop-off risk on {route}",
                    summary=f"Users are reaching {route} repeatedly but spending only about {avg_duration_ms}ms before leaving.",
                    evidence={"visits": stats["visits"], "avg_duration_ms": avg_duration_ms},
                    suggested_action="Clarify the primary action, reduce initial cognitive load, and verify that the route matches the user's expected next step.",
                )
            )

    unique_candidates: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        unique_candidates[candidate["recommendation_key"]] = candidate
    return list(unique_candidates.values())


def refresh_recommendations_for_user(
    db: Session,
    *,
    current_user: Any,
    days: int = RECENT_WINDOW_DAYS,
) -> dict[str, Any]:
    signals = _recent_signals(db, user_id=int(current_user.id), days=days)
    candidates = _build_candidates(current_user, signals)
    existing_records = (
        db.query(UiRecommendation)
        .filter(
            UiRecommendation.user_id == int(current_user.id),
            UiRecommendation.source == RECOMMENDATION_SOURCE,
        )
        .all()
    )
    existing_map = {record.recommendation_key: record for record in existing_records}
    active_keys = {candidate["recommendation_key"] for candidate in candidates}

    created = 0
    updated = 0
    reopened = 0
    resolved = 0
    for candidate in candidates:
        recommendation = existing_map.get(candidate["recommendation_key"])
        if recommendation is None:
            recommendation = UiRecommendation(
                org_id=resolve_org_id(current_user),
                factory_id=resolve_factory_id(db, current_user),
                user_id=int(current_user.id),
                **candidate,
            )
            db.add(recommendation)
            created += 1
            continue
        if recommendation.status != "open":
            reopened += 1
        recommendation.org_id = resolve_org_id(current_user)
        recommendation.factory_id = resolve_factory_id(db, current_user)
        recommendation.route = candidate["route"]
        recommendation.category = candidate["category"]
        recommendation.priority = candidate["priority"]
        recommendation.title = candidate["title"]
        recommendation.summary = candidate["summary"]
        recommendation.suggested_action = candidate["suggested_action"]
        recommendation.evidence_json = candidate["evidence_json"]
        recommendation.status = "open"
        recommendation.updated_at = _now()
        db.add(recommendation)
        updated += 1

    for record in existing_records:
        if record.recommendation_key not in active_keys and record.status == "open":
            record.status = "resolved"
            record.updated_at = _now()
            db.add(record)
            resolved += 1

    top_routes = summarize_behavior(db, current_user=current_user, days=days)["top_routes"]
    preferred_routes = [
        item["route"]
        for item in top_routes
        if item["route"] and item["route"] != "unknown"
    ][:4]
    preference_changed = False
    if preferred_routes:
        _, preference_changed = upsert_preference(
            db,
            current_user=current_user,
            preference_key="priority_routes_auto",
            preference_value={
                "routes": preferred_routes,
                "generated_at": _now().isoformat(),
            },
            source="automatic",
            commit=False,
        )

    db.commit()
    return {
        "window_days": days,
        "signals_considered": len(signals),
        "created": created,
        "updated": updated,
        "reopened": reopened,
        "resolved": resolved,
        "preference_changed": preference_changed,
        "recommendations": list_recommendations(db, current_user=current_user),
    }


def build_overview(
    db: Session,
    *,
    current_user: Any,
    days: int = RECENT_WINDOW_DAYS,
) -> dict[str, Any]:
    summary = summarize_behavior(db, current_user=current_user, days=days)
    return {
        "status": "active",
        "window_days": days,
        "summary": summary,
        "preferences": list_preferences(db, current_user=current_user),
        "recommendations": list_recommendations(db, current_user=current_user),
        "automation_contract": {
            "analysis": ["dom_heuristics", "behavior_telemetry", "recommendation_cycle"],
            "safe_runtime_changes": ["nav_priority_routes"],
            "mcp_note": "Vercel MCP is used outside the runtime for deployment verification; UI analysis is powered by local telemetry and heuristics.",
        },
    }
