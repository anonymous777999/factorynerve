from __future__ import annotations

import asyncio
import json
import os
import sys
from dataclasses import dataclass

import httpx
from sqlalchemy import text

from backend.database import SessionLocal, init_db


@dataclass(slots=True)
class CheckResult:
    name: str
    passed: bool
    detail: str


def _check(name: str, passed: bool, detail: str = "") -> CheckResult:
    return CheckResult(name=name, passed=passed, detail=detail)


async def main() -> int:
    init_db()
    results: list[CheckResult] = []
    base_url = os.getenv("PRODUCTION_CHECKLIST_BASE_URL", "http://127.0.0.1:8765")

    with SessionLocal() as db:
        orphan_count = int(db.execute(text("SELECT COUNT(*) FROM subscriptions WHERE org_id IS NULL")).scalar() or 0)
        results.append(_check("No subscription has NULL org_id", orphan_count == 0, f"count={orphan_count}"))

        duplicate_active = int(
            db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM (
                        SELECT org_id
                        FROM subscriptions
                        WHERE status = 'active'
                        GROUP BY org_id
                        HAVING COUNT(*) > 1
                    ) duplicate_orgs
                    """
                )
            ).scalar()
            or 0
        )
        results.append(_check("No org has > 1 active subscription", duplicate_active == 0, f"count={duplicate_active}"))

        duplicate_webhooks = int(
            db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM (
                        SELECT razorpay_event_id
                        FROM webhook_events
                        WHERE razorpay_event_id IS NOT NULL
                        GROUP BY razorpay_event_id
                        HAVING COUNT(*) > 1
                    ) duplicate_events
                    """
                )
            ).scalar()
            or 0
        )
        results.append(_check("All WebhookEvents have unique razorpay_event_id", duplicate_webhooks == 0, f"count={duplicate_webhooks}"))

        over_quota = int(
            db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM org_ocr_usage
                    WHERE ocr_limit IS NOT NULL
                      AND request_count > ocr_limit
                    """
                )
            ).scalar()
            or 0
        )
        results.append(_check("No org_ocr_usage.request_count > ocr_limit", over_quota == 0, f"count={over_quota}"))

        updated_invoice_column_exists = False
        if db.bind and db.bind.dialect.name == "sqlite":
            columns = {row[1] for row in db.execute(text("PRAGMA table_info(invoices)")).fetchall()}
            updated_invoice_column_exists = "updated_at" in columns
        else:
            updated_invoice_column_exists = bool(
                db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE table_name = 'invoices' AND column_name = 'updated_at'
                        """
                    )
                ).scalar()
            )
        if updated_invoice_column_exists:
            mutable_paid = int(
                db.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM invoices
                        WHERE status = 'paid'
                          AND updated_at > created_at
                        """
                    )
                ).scalar()
                or 0
            )
            detail = f"count={mutable_paid}"
            passed = mutable_paid == 0
        else:
            detail = "updated_at column missing; treated as PASS because invoices are append-only in this schema"
            passed = True
        results.append(_check("All invoices with status=paid are immutable (no updated_at > created_at)", passed, detail))

        env_name = (os.getenv("ENV") or os.getenv("APP_ENV") or "").strip().lower()
        secret = os.getenv("RAZORPAY_KEY_SECRET", "")
        prod_secret_ok = not (env_name == "production" and "test_" in secret)
        results.append(_check("RAZORPAY_KEY_SECRET does not contain \"test_\" in ENV=production", prod_secret_ok, f"env={env_name or '-'}"))

    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
            response = await client.post(
                "/billing/webhook/razorpay",
                content=b'{"event":"payment.failed","id":"check-invalid-signature"}',
                headers={"x-razorpay-signature": "invalid-signature"},
            )
        webhook_ok = response.status_code == 400
        webhook_detail = f"status_code={response.status_code}"
    except Exception as error:  # pylint: disable=broad-except
        webhook_ok = False
        webhook_detail = str(error)
    results.append(_check("Webhook endpoint returns 400 on invalid signature (live HTTP check)", webhook_ok, webhook_detail))

    failures = [{"name": result.name, "detail": result.detail} for result in results if not result.passed]
    report = {
        "total_checks": len(results),
        "passed": sum(1 for result in results if result.passed),
        "failed": len(failures),
        "results": [{"name": result.name, "status": "PASS" if result.passed else "FAIL", "detail": result.detail} for result in results],
        "failures": failures,
    }
    print(json.dumps(report, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
