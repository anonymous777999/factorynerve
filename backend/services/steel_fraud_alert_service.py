"""Fraud alert lifecycle management — sync, acknowledge, resolve, dismiss.

Alerts are created when the fraud intelligence pipeline detects critical/high
signals across any domain. Each alert is deduplicated by signal_fingerprint
(a hash of signal_type + resource_id + domain + date).
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.steel_fraud_alert import SteelFraudAlert
from backend.models.user import User


def _make_fingerprint(signal: dict[str, Any], domain: str) -> str:
    """Deterministic hash for deduplication."""
    raw = f"{signal.get('signal_type','')}:{signal.get('instance_id') or signal.get('dispatch_id') or signal.get('transaction_id') or signal.get('attendance_date','') or ''}:{domain}:{date.today().isoformat()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


def _signal_to_evidence(signal: dict[str, Any]) -> dict[str, Any]:
    """Extract evidence payload, omitting internal fields."""
    keys = {
        "signal_type", "severity", "confidence", "evidence_summary",
        "recommended_action", "item_name", "item_code", "variance_kg",
        "variance_percent", "dispatch_number", "header_weight_kg",
        "line_total_kg", "delta_kg", "quantity_kg", "adjustment_count",
        "workflow_key", "duration_minutes", "pair_count", "pair_percent",
        "approval_count", "worked_minutes", "overtime_minutes",
        "late_minutes", "late_occurrences", "self_approval_count",
        "auto_count", "never_reviewed_count", "shift",
    }
    return {k: signal[k] for k in keys if k in signal}


def sync_fraud_alerts(
    db: Session,
    factory_id: str,
    org_id: str,
    fraud_intelligence: dict[str, Any],
) -> dict[str, Any]:
    """Sync critical/high signals from fraud intelligence to persistent alerts.

    Called after build_fraud_intelligence(). Scans all 5 signal domains,
    deduplicates by fingerprint, and creates new alert records.

    Returns:
        dict with new_count, total_active, by_domain breakdown.
    """
    domains = [
        ("inventory", "inventory_loss_signals"),
        ("dispatch", "dispatch_mismatch_signals"),
        ("transaction", "transaction_anomalies"),
        ("approval", "approval_risk_signals"),
        ("attendance", "attendance_risk_signals"),
    ]

    new_count = 0
    domain_counts: dict[str, int] = {}
    now = datetime.now(timezone.utc)

    for domain_key, section_key in domains:
        section = fraud_intelligence.get(section_key, {})
        signals = section.get("signals", [])
        if not signals:
            continue

        domain_new = 0
        for sig in signals:
            if sig.get("severity") not in ("critical", "high"):
                continue

            fingerprint = _make_fingerprint(sig, domain_key)

            # Skip if already exists as active
            existing = (
                db.query(SteelFraudAlert)
                .filter(
                    SteelFraudAlert.factory_id == factory_id,
                    SteelFraudAlert.signal_fingerprint == fingerprint,
                    SteelFraudAlert.status.in_(["active", "acknowledged", "investigating"]),
                )
                .first()
            )
            if existing:
                # Touch updated_at so it stays fresh
                existing.updated_at = now
                continue

            # Check if resolved/dismissed — skip (historic)
            historic = (
                db.query(SteelFraudAlert)
                .filter(
                    SteelFraudAlert.factory_id == factory_id,
                    SteelFraudAlert.signal_fingerprint == fingerprint,
                )
                .first()
            )
            if historic:
                continue

            # Create new alert
            alert = SteelFraudAlert(
                org_id=org_id,
                factory_id=factory_id,
                signal_fingerprint=fingerprint,
                domain=domain_key,
                signal_type=sig.get("signal_type", "unknown"),
                severity=sig.get("severity", "high"),
                confidence=sig.get("confidence", "derived"),
                summary=sig.get("evidence_summary", ""),
                evidence=_signal_to_evidence(sig),
                recommended_action=sig.get("recommended_action"),
                resource_type=sig.get("resource_type"),
                resource_id=sig.get("instance_id") or sig.get("dispatch_id") or sig.get("transaction_id"),
                actor_user_id=sig.get("actor_user_id") or sig.get("user_id") or sig.get("created_by_user_id"),
                status="active",
            )
            db.add(alert)
            domain_new += 1

        if domain_new:
            domain_counts[domain_key] = domain_new
            new_count += domain_new

    db.flush()

    # Count active alerts
    total_active = (
        db.query(func.count(SteelFraudAlert.id))
        .filter(
            SteelFraudAlert.factory_id == factory_id,
            SteelFraudAlert.status.in_(["active", "acknowledged", "investigating"]),
        )
        .scalar()
    ) or 0

    return {
        "new_count": new_count,
        "total_active": total_active,
        "by_domain": domain_counts,
    }


def acknowledge_alert(db: Session, alert_id: int, user_id: int) -> SteelFraudAlert | None:
    """Mark an alert as acknowledged by a user."""
    alert = db.query(SteelFraudAlert).filter(SteelFraudAlert.id == alert_id).first()
    if not alert or alert.status != "active":
        return None
    alert.status = "acknowledged"
    alert.acknowledged_by_user_id = user_id
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.flush()
    return alert


def start_investigation(db: Session, alert_id: int, user_id: int) -> SteelFraudAlert | None:
    """Move alert to investigating status."""
    alert = db.query(SteelFraudAlert).filter(SteelFraudAlert.id == alert_id).first()
    if not alert or alert.status not in ("active", "acknowledged"):
        return None
    alert.status = "investigating"
    alert.acknowledged_by_user_id = alert.acknowledged_by_user_id or user_id
    alert.acknowledged_at = alert.acknowledged_at or datetime.now(timezone.utc)
    db.flush()
    return alert


def resolve_alert(
    db: Session,
    alert_id: int,
    user_id: int,
    resolution_note: str | None = None,
) -> SteelFraudAlert | None:
    """Mark an alert as resolved."""
    alert = db.query(SteelFraudAlert).filter(SteelFraudAlert.id == alert_id).first()
    if not alert or alert.status in ("resolved", "dismissed"):
        return None
    alert.status = "resolved"
    alert.resolved_by_user_id = user_id
    alert.resolved_at = datetime.now(timezone.utc)
    if resolution_note:
        alert.resolution_note = resolution_note
    db.flush()
    return alert


def dismiss_alert(
    db: Session,
    alert_id: int,
    user_id: int,
    dismissed_reason: str,
) -> SteelFraudAlert | None:
    """Dismiss an alert with a reason (e.g. false positive)."""
    alert = db.query(SteelFraudAlert).filter(SteelFraudAlert.id == alert_id).first()
    if not alert or alert.status in ("resolved", "dismissed"):
        return None
    alert.status = "dismissed"
    alert.resolved_by_user_id = user_id
    alert.resolved_at = datetime.now(timezone.utc)
    alert.dismissed_reason = dismissed_reason
    db.flush()
    return alert


def list_alerts(
    db: Session,
    factory_id: str,
    *,
    status: str | None = None,
    domain: str | None = None,
    severity: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """List alerts with optional filters. Returns (items, total_count)."""
    query = db.query(SteelFraudAlert).filter(SteelFraudAlert.factory_id == factory_id)

    if status:
        if status == "open":
            query = query.filter(SteelFraudAlert.status.in_(["active", "acknowledged", "investigating"]))
        else:
            query = query.filter(SteelFraudAlert.status == status)
    if domain:
        query = query.filter(SteelFraudAlert.domain == domain)
    if severity:
        query = query.filter(SteelFraudAlert.severity == severity)

    total = query.count()
    alerts = (
        query.order_by(
            # Active alerts first, then by severity, then newest
            func.case(
                (SteelFraudAlert.status == "active", 0),
                (SteelFraudAlert.status == "acknowledged", 1),
                (SteelFraudAlert.status == "investigating", 2),
                else_=3,
            ),
            func.case(
                (SteelFraudAlert.severity == "critical", 0),
                (SteelFraudAlert.severity == "high", 1),
                else_=2,
            ),
            SteelFraudAlert.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [_alert_to_dict(a) for a in alerts], total


def get_active_alert_count(db: Session, factory_id: str) -> int:
    """Fast count of active/acknowledged/investigating alerts."""
    return (
        db.query(func.count(SteelFraudAlert.id))
        .filter(
            SteelFraudAlert.factory_id == factory_id,
            SteelFraudAlert.status.in_(["active", "acknowledged", "investigating"]),
        )
        .scalar()
    ) or 0


def _alert_to_dict(alert: SteelFraudAlert) -> dict[str, Any]:
    return {
        "id": alert.id,
        "org_id": alert.org_id,
        "factory_id": alert.factory_id,
        "domain": alert.domain,
        "signal_type": alert.signal_type,
        "severity": alert.severity,
        "confidence": alert.confidence,
        "summary": alert.summary,
        "evidence": alert.evidence,
        "recommended_action": alert.recommended_action,
        "resource_type": alert.resource_type,
        "resource_id": alert.resource_id,
        "actor_user_id": alert.actor_user_id,
        "status": alert.status,
        "acknowledged_by_user_id": alert.acknowledged_by_user_id,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "resolved_by_user_id": alert.resolved_by_user_id,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        "resolution_note": alert.resolution_note,
        "dismissed_reason": alert.dismissed_reason,
        "is_suppressed": alert.is_suppressed,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
    }
