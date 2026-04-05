"""Reconcile usage counters from audit logs to prevent drift."""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.feature_usage import FeatureUsage
from backend.models.ocr_usage import OcrUsage
from backend.models.org_feature_usage import OrgFeatureUsage
from backend.models.org_ocr_usage import OrgOcrUsage
from backend.models.report import AuditLog
from backend.models.user import User


SUMMARY_ACTIONS = {"ENTRY_SUMMARY_GENERATED", "ENTRY_SUMMARY_REGENERATED"}
EMAIL_ACTIONS = {"EMAIL_SUMMARY_GENERATED"}
SMART_ACTIONS = {"SMART_INPUT_USED"}
OCR_ACTIONS = {
    "OCR_LEDGER_EXCEL",
    "OCR_TABLE_EXCEL",
    "OCR_LEDGER_EXCEL_ASYNC",
    "OCR_TABLE_EXCEL_ASYNC",
}


def _period_key(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    return current.strftime("%Y-%m")


def _period_bounds(period: str) -> tuple[datetime, datetime]:
    year, month = period.split("-")
    start = datetime(int(year), int(month), 1, tzinfo=timezone.utc)
    if int(month) == 12:
        end = datetime(int(year) + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(int(year), int(month) + 1, 1, tzinfo=timezone.utc)
    return start, end


def _extract_size_bytes(detail: str | None) -> int | None:
    if not detail:
        return None
    match = re.search(r"size_bytes=(\d+)", detail)
    if not match:
        return None
    try:
        return int(match.group(1))
    except Exception:
        return None


def _compute_ocr_credits(image_bytes: int) -> int:
    credits_per_mb = int(os.getenv("OCR_CREDITS_PER_MB", "4"))
    if credits_per_mb <= 0:
        return 1
    mb = max(1, int((image_bytes + (1024 * 1024 - 1)) / (1024 * 1024)))
    return mb * credits_per_mb


def _count_actions(
    db: Session,
    actions: set[str],
    start: datetime,
    end: datetime,
) -> tuple[dict[int, int], dict[int, datetime]]:
    counts: dict[int, int] = {}
    last_seen: dict[int, datetime] = {}
    rows = (
        db.query(AuditLog.user_id, func.count(AuditLog.id), func.max(AuditLog.timestamp))
        .filter(
            AuditLog.action.in_(actions),
            AuditLog.timestamp >= start,
            AuditLog.timestamp < end,
            AuditLog.user_id.isnot(None),
        )
        .group_by(AuditLog.user_id)
        .all()
    )
    for user_id, total, last in rows:
        counts[int(user_id)] = int(total or 0)
        if last:
            last_seen[int(user_id)] = last
    return counts, last_seen


def _count_ocr(
    db: Session,
    start: datetime,
    end: datetime,
) -> tuple[dict[int, int], dict[int, int], dict[int, datetime]]:
    counts: dict[int, int] = {}
    credits: dict[int, int] = {}
    last_seen: dict[int, datetime] = {}
    rows = (
        db.query(AuditLog.user_id, AuditLog.details, AuditLog.timestamp)
        .filter(
            AuditLog.action.in_(OCR_ACTIONS),
            AuditLog.timestamp >= start,
            AuditLog.timestamp < end,
            AuditLog.user_id.isnot(None),
        )
        .all()
    )
    for user_id, details, timestamp in rows:
        uid = int(user_id)
        counts[uid] = counts.get(uid, 0) + 1
        size_bytes = _extract_size_bytes(details)
        if size_bytes is not None:
            credits[uid] = credits.get(uid, 0) + _compute_ocr_credits(size_bytes)
        if timestamp and (uid not in last_seen or timestamp > last_seen[uid]):
            last_seen[uid] = timestamp
    return counts, credits, last_seen


def _count_actions_by_org(
    db: Session,
    actions: set[str],
    start: datetime,
    end: datetime,
) -> tuple[dict[str, int], dict[str, datetime]]:
    counts: dict[str, int] = {}
    last_seen: dict[str, datetime] = {}
    org_expr = func.coalesce(AuditLog.org_id, User.org_id)
    rows = (
        db.query(org_expr, func.count(AuditLog.id), func.max(AuditLog.timestamp))
        .outerjoin(User, User.id == AuditLog.user_id)
        .filter(
            AuditLog.action.in_(actions),
            AuditLog.timestamp >= start,
            AuditLog.timestamp < end,
            org_expr.isnot(None),
        )
        .group_by(org_expr)
        .all()
    )
    for org_id, total, last in rows:
        if not org_id:
            continue
        org_key = str(org_id)
        counts[org_key] = int(total or 0)
        if last:
            last_seen[org_key] = last
    return counts, last_seen


def _count_ocr_by_org(
    db: Session,
    start: datetime,
    end: datetime,
) -> tuple[dict[str, int], dict[str, int], dict[str, datetime]]:
    counts: dict[str, int] = {}
    credits: dict[str, int] = {}
    last_seen: dict[str, datetime] = {}
    org_expr = func.coalesce(AuditLog.org_id, User.org_id)
    rows = (
        db.query(org_expr, AuditLog.details, AuditLog.timestamp)
        .outerjoin(User, User.id == AuditLog.user_id)
        .filter(
            AuditLog.action.in_(OCR_ACTIONS),
            AuditLog.timestamp >= start,
            AuditLog.timestamp < end,
            org_expr.isnot(None),
        )
        .all()
    )
    for org_id, details, timestamp in rows:
        if not org_id:
            continue
        org_key = str(org_id)
        counts[org_key] = counts.get(org_key, 0) + 1
        size_bytes = _extract_size_bytes(details)
        if size_bytes is not None:
            credits[org_key] = credits.get(org_key, 0) + _compute_ocr_credits(size_bytes)
        if timestamp and (org_key not in last_seen or timestamp > last_seen[org_key]):
            last_seen[org_key] = timestamp
    return counts, credits, last_seen


def _apply_feature_usage(
    db: Session,
    *,
    period: str,
    feature: str,
    counts: dict[int, int],
    last_seen: dict[int, datetime],
    allow_decrease: bool,
    dry_run: bool,
) -> dict[str, Any]:
    changes = 0
    created = 0
    existing = (
        db.query(FeatureUsage)
        .filter(FeatureUsage.period == period, FeatureUsage.feature == feature)
        .all()
    )
    existing_map = {row.user_id: row for row in existing}
    for user_id, new_count in counts.items():
        row = existing_map.get(user_id)
        if row:
            final_count = new_count if allow_decrease else max(row.request_count, new_count)
            if row.request_count != final_count:
                changes += 1
                if not dry_run:
                    row.request_count = final_count
                    row.last_request_at = last_seen.get(user_id)
            elif last_seen.get(user_id) and not dry_run:
                row.last_request_at = last_seen.get(user_id)
        else:
            created += 1
            if not dry_run:
                db.add(
                    FeatureUsage(
                        user_id=user_id,
                        period=period,
                        feature=feature,
                        request_count=new_count,
                        last_request_at=last_seen.get(user_id),
                    )
                )
    if allow_decrease:
        for user_id, row in existing_map.items():
            if user_id not in counts and row.request_count != 0:
                changes += 1
                if not dry_run:
                    row.request_count = 0
                    row.last_request_at = None
    return {"updated": changes, "created": created, "total": len(existing_map) + created}


def _apply_ocr_usage(
    db: Session,
    *,
    period: str,
    requests: dict[int, int],
    credits: dict[int, int],
    last_seen: dict[int, datetime],
    allow_decrease: bool,
    dry_run: bool,
) -> dict[str, Any]:
    changes = 0
    created = 0
    existing = db.query(OcrUsage).filter(OcrUsage.period == period).all()
    existing_map = {row.user_id: row for row in existing}
    for user_id, new_requests in requests.items():
        row = existing_map.get(user_id)
        new_credits = credits.get(user_id, 0)
        if row:
            final_requests = new_requests if allow_decrease else max(row.request_count, new_requests)
            final_credits = new_credits if allow_decrease else max(row.credit_count, new_credits)
            if row.request_count != final_requests or row.credit_count != final_credits:
                changes += 1
                if not dry_run:
                    row.request_count = final_requests
                    row.credit_count = final_credits
                    row.last_request_at = last_seen.get(user_id)
            elif last_seen.get(user_id) and not dry_run:
                row.last_request_at = last_seen.get(user_id)
        else:
            created += 1
            if not dry_run:
                db.add(
                    OcrUsage(
                        user_id=user_id,
                        period=period,
                        request_count=new_requests,
                        credit_count=new_credits,
                        last_request_at=last_seen.get(user_id),
                    )
                )
    if allow_decrease:
        for user_id, row in existing_map.items():
            if user_id not in requests and (row.request_count != 0 or row.credit_count != 0):
                changes += 1
                if not dry_run:
                    row.request_count = 0
                    row.credit_count = 0
                    row.last_request_at = None
    return {"updated": changes, "created": created, "total": len(existing_map) + created}


def _apply_org_feature_usage(
    db: Session,
    *,
    period: str,
    feature: str,
    counts: dict[str, int],
    last_seen: dict[str, datetime],
    allow_decrease: bool,
    dry_run: bool,
) -> dict[str, Any]:
    changes = 0
    created = 0
    existing = (
        db.query(OrgFeatureUsage)
        .filter(OrgFeatureUsage.period == period, OrgFeatureUsage.feature == feature)
        .all()
    )
    existing_map = {row.org_id: row for row in existing}
    for org_id, new_count in counts.items():
        row = existing_map.get(org_id)
        if row:
            final_count = new_count if allow_decrease else max(row.request_count, new_count)
            if row.request_count != final_count:
                changes += 1
                if not dry_run:
                    row.request_count = final_count
                    row.last_request_at = last_seen.get(org_id)
            elif last_seen.get(org_id) and not dry_run:
                row.last_request_at = last_seen.get(org_id)
        else:
            created += 1
            if not dry_run:
                db.add(
                    OrgFeatureUsage(
                        org_id=org_id,
                        period=period,
                        feature=feature,
                        request_count=new_count,
                        last_request_at=last_seen.get(org_id),
                    )
                )
    if allow_decrease:
        for org_id, row in existing_map.items():
            if org_id not in counts and row.request_count != 0:
                changes += 1
                if not dry_run:
                    row.request_count = 0
                    row.last_request_at = None
    return {"updated": changes, "created": created, "total": len(existing_map) + created}


def _apply_org_ocr_usage(
    db: Session,
    *,
    period: str,
    requests: dict[str, int],
    credits: dict[str, int],
    last_seen: dict[str, datetime],
    allow_decrease: bool,
    dry_run: bool,
) -> dict[str, Any]:
    changes = 0
    created = 0
    existing = db.query(OrgOcrUsage).filter(OrgOcrUsage.period == period).all()
    existing_map = {row.org_id: row for row in existing}
    for org_id, new_requests in requests.items():
        row = existing_map.get(org_id)
        new_credits = credits.get(org_id, 0)
        if row:
            final_requests = new_requests if allow_decrease else max(row.request_count, new_requests)
            final_credits = new_credits if allow_decrease else max(row.credit_count, new_credits)
            if row.request_count != final_requests or row.credit_count != final_credits:
                changes += 1
                if not dry_run:
                    row.request_count = final_requests
                    row.credit_count = final_credits
                    row.last_request_at = last_seen.get(org_id)
            elif last_seen.get(org_id) and not dry_run:
                row.last_request_at = last_seen.get(org_id)
        else:
            created += 1
            if not dry_run:
                db.add(
                    OrgOcrUsage(
                        org_id=org_id,
                        period=period,
                        request_count=new_requests,
                        credit_count=new_credits,
                        last_request_at=last_seen.get(org_id),
                    )
                )
    if allow_decrease:
        for org_id, row in existing_map.items():
            if org_id not in requests and (row.request_count != 0 or row.credit_count != 0):
                changes += 1
                if not dry_run:
                    row.request_count = 0
                    row.credit_count = 0
                    row.last_request_at = None
    return {"updated": changes, "created": created, "total": len(existing_map) + created}


def reconcile_usage(
    db: Session,
    *,
    period: str | None = None,
    allow_decrease: bool = True,
    dry_run: bool = False,
) -> dict[str, Any]:
    target_period = period or _period_key()
    start, end = _period_bounds(target_period)

    summary_counts, summary_last = _count_actions(db, SUMMARY_ACTIONS, start, end)
    email_counts, email_last = _count_actions(db, EMAIL_ACTIONS, start, end)
    smart_counts, smart_last = _count_actions(db, SMART_ACTIONS, start, end)
    ocr_counts, ocr_credits, ocr_last = _count_ocr(db, start, end)

    results = {
        "period": target_period,
        "dry_run": dry_run,
        "allow_decrease": allow_decrease,
        "features": {},
        "ocr": {},
    }

    results["features"]["summary"] = _apply_feature_usage(
        db,
        period=target_period,
        feature="summary",
        counts=summary_counts,
        last_seen=summary_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["features"]["email"] = _apply_feature_usage(
        db,
        period=target_period,
        feature="email",
        counts=email_counts,
        last_seen=email_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["features"]["smart"] = _apply_feature_usage(
        db,
        period=target_period,
        feature="smart",
        counts=smart_counts,
        last_seen=smart_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["ocr"] = _apply_ocr_usage(
        db,
        period=target_period,
        requests=ocr_counts,
        credits=ocr_credits,
        last_seen=ocr_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )

    if not dry_run:
        db.commit()
    return results


def _aggregate_feature_usage_by_org(
    db: Session,
    *,
    period: str,
    feature: str,
) -> tuple[dict[str, int], dict[str, datetime]]:
    counts: dict[str, int] = {}
    last_seen: dict[str, datetime] = {}
    rows = (
        db.query(User.org_id, func.sum(FeatureUsage.request_count), func.max(FeatureUsage.last_request_at))
        .select_from(FeatureUsage)
        .join(User, User.id == FeatureUsage.user_id)
        .filter(
            FeatureUsage.period == period,
            FeatureUsage.feature == feature,
            User.org_id.isnot(None),
        )
        .group_by(User.org_id)
        .all()
    )
    for org_id, total, last in rows:
        if not org_id:
            continue
        org_key = str(org_id)
        counts[org_key] = int(total or 0)
        if last:
            last_seen[org_key] = last
    return counts, last_seen


def _aggregate_ocr_usage_by_org(
    db: Session,
    *,
    period: str,
) -> tuple[dict[str, int], dict[str, int], dict[str, datetime]]:
    counts: dict[str, int] = {}
    credits: dict[str, int] = {}
    last_seen: dict[str, datetime] = {}
    rows = (
        db.query(
            User.org_id,
            func.sum(OcrUsage.request_count),
            func.sum(OcrUsage.credit_count),
            func.max(OcrUsage.last_request_at),
        )
        .select_from(OcrUsage)
        .join(User, User.id == OcrUsage.user_id)
        .filter(OcrUsage.period == period, User.org_id.isnot(None))
        .group_by(User.org_id)
        .all()
    )
    for org_id, total_requests, total_credits, last in rows:
        if not org_id:
            continue
        org_key = str(org_id)
        counts[org_key] = int(total_requests or 0)
        credits[org_key] = int(total_credits or 0)
        if last:
            last_seen[org_key] = last
    return counts, credits, last_seen


def seed_org_usage_from_user_usage(
    db: Session,
    *,
    period: str | None = None,
    allow_decrease: bool = True,
    dry_run: bool = False,
) -> dict[str, Any]:
    target_period = period or _period_key()
    summary_counts, summary_last = _aggregate_feature_usage_by_org(db, period=target_period, feature="summary")
    email_counts, email_last = _aggregate_feature_usage_by_org(db, period=target_period, feature="email")
    smart_counts, smart_last = _aggregate_feature_usage_by_org(db, period=target_period, feature="smart")
    ocr_counts, ocr_credits, ocr_last = _aggregate_ocr_usage_by_org(db, period=target_period)

    results = {
        "period": target_period,
        "dry_run": dry_run,
        "allow_decrease": allow_decrease,
        "source": "user_usage",
        "features": {},
        "ocr": {},
    }

    results["features"]["summary"] = _apply_org_feature_usage(
        db,
        period=target_period,
        feature="summary",
        counts=summary_counts,
        last_seen=summary_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["features"]["email"] = _apply_org_feature_usage(
        db,
        period=target_period,
        feature="email",
        counts=email_counts,
        last_seen=email_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["features"]["smart"] = _apply_org_feature_usage(
        db,
        period=target_period,
        feature="smart",
        counts=smart_counts,
        last_seen=smart_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["ocr"] = _apply_org_ocr_usage(
        db,
        period=target_period,
        requests=ocr_counts,
        credits=ocr_credits,
        last_seen=ocr_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )

    if not dry_run:
        db.commit()
    return results


def reconcile_org_usage(
    db: Session,
    *,
    period: str | None = None,
    allow_decrease: bool = True,
    dry_run: bool = False,
    seed_from_user: bool = False,
) -> dict[str, Any]:
    if seed_from_user:
        return seed_org_usage_from_user_usage(
            db,
            period=period,
            allow_decrease=allow_decrease,
            dry_run=dry_run,
        )

    target_period = period or _period_key()
    start, end = _period_bounds(target_period)

    summary_counts, summary_last = _count_actions_by_org(db, SUMMARY_ACTIONS, start, end)
    email_counts, email_last = _count_actions_by_org(db, EMAIL_ACTIONS, start, end)
    smart_counts, smart_last = _count_actions_by_org(db, SMART_ACTIONS, start, end)
    ocr_counts, ocr_credits, ocr_last = _count_ocr_by_org(db, start, end)

    results = {
        "period": target_period,
        "dry_run": dry_run,
        "allow_decrease": allow_decrease,
        "source": "audit_logs",
        "features": {},
        "ocr": {},
    }

    results["features"]["summary"] = _apply_org_feature_usage(
        db,
        period=target_period,
        feature="summary",
        counts=summary_counts,
        last_seen=summary_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["features"]["email"] = _apply_org_feature_usage(
        db,
        period=target_period,
        feature="email",
        counts=email_counts,
        last_seen=email_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["features"]["smart"] = _apply_org_feature_usage(
        db,
        period=target_period,
        feature="smart",
        counts=smart_counts,
        last_seen=smart_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )
    results["ocr"] = _apply_org_ocr_usage(
        db,
        period=target_period,
        requests=ocr_counts,
        credits=ocr_credits,
        last_seen=ocr_last,
        allow_decrease=allow_decrease,
        dry_run=dry_run,
    )

    if not dry_run:
        db.commit()
    return results
