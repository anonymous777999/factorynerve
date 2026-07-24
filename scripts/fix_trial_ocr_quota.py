#!/usr/bin/env python
"""Fix missing OCR quota rows for trial orgs.

During trial signup, _ensure_trial() creates a Subscription record but until
recently never initialized the org_ocr_usage row.  All OCR requests for trial
orgs immediately returned 429 QUOTA_EXHAUSTED.

This script finds subscriptions with status='trialing' that have no
corresponding org_ocr_usage row and creates one with the plan's OCR limit.

Usage:
    python scripts/fix_trial_ocr_quota.py              # dry-run
    python scripts/fix_trial_ocr_quota.py --apply       # apply fixes

Environment:
    DATABASE_URL (optional — falls back to the app config)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

# Ensure the project root is on sys.path so we can import backend modules.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Lazy imports so the script works even if the app environment is incomplete
# ---------------------------------------------------------------------------

try:
    from backend.database import SessionLocal
    from backend.models.subscription import Subscription
    from backend.plans import get_plan, normalize_plan, plan_limit
except ImportError as exc:
    print(f"ERROR: Could not import backend modules — {exc}", file=sys.stderr)
    print("Run this script from the project root or adjust PYTHONPATH.", file=sys.stderr)
    sys.exit(1)


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def fix_missing_ocr_quota(db: Session, *, dry_run: bool) -> int:
    """Find trial subscriptions without an org_ocr_usage row and create one.

    Returns the number of orgs that were (or would be) fixed.
    """
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    now = datetime.now(timezone.utc)
    fixed = 0

    # Fetch all trial subscriptions that are still within their trial window.
    trials = (
        db.query(Subscription)
        .filter(
            Subscription.status == "trialing",
            Subscription.org_id.isnot(None),
        )
        .all()
    )

    for sub in trials:
        org_id: str | None = sub.org_id
        if not org_id:
            continue

        # Check if an org_ocr_usage row already exists for this period.
        existing = db.execute(
            text(
                "SELECT id FROM org_ocr_usage WHERE org_id = :org_id AND period = :period"
            ),
            {"org_id": org_id, "period": period},
        ).first()

        if existing:
            continue

        # Determine the OCR limit from the plan.
        plan_key = normalize_plan(sub.plan)
        ocr_limit = int(plan_limit(plan_key, "ocr") or 0)
        if ocr_limit <= 0:
            logger.info(
                "SKIP  org=%s plan=%s — plan has no built-in OCR limit (ocr_limit=%s)",
                org_id,
                plan_key,
                ocr_limit,
            )
            continue

        # Use the trial end date as the quota period end.
        period_end = sub.trial_end_at or (now)
        logger.info(
            "%s  org=%s plan=%s ocr_limit=%s period=%s period_end=%s",
            "WOULD CREATE" if dry_run else "CREATING",
            org_id,
            plan_key,
            ocr_limit,
            period,
            period_end.isoformat(),
        )

        if not dry_run:
            db.execute(
                text(
                    """
                    INSERT INTO org_ocr_usage
                        (org_id, period, ocr_limit, request_count, credit_count,
                         period_start, period_end, created_at, updated_at)
                    VALUES
                        (:org_id, :period, :ocr_limit, 0, 0,
                         :period_start, :period_end, :now, :now)
                    ON CONFLICT (org_id, period) DO NOTHING
                    """
                ),
                {
                    "org_id": org_id,
                    "period": period,
                    "ocr_limit": ocr_limit,
                    "period_start": now,
                    "period_end": period_end,
                    "now": now,
                },
            )
        fixed += 1

    if not dry_run:
        db.commit()
        logger.info("Committed %d quota row(s) to the database.", fixed)
    else:
        logger.info("Dry-run complete — %d org(s) would be fixed.", fixed)

    return fixed


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fix missing OCR quota rows for trial orgs."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply fixes (default is dry-run / read-only).",
    )
    args = parser.parse_args()

    db: Session = SessionLocal()
    try:
        fixed = fix_missing_ocr_quota(db, dry_run=not args.apply)
    finally:
        db.close()

    if fixed > 0 and not args.apply:
        print("")
        print("Run with --apply to commit these changes.")
    elif fixed > 0 and args.apply:
        print("")
        print("Done. Trial org OCR quotas have been initialized.")
    else:
        print("No trial orgs are missing OCR quota rows. Nothing to do.")


if __name__ == "__main__":
    main()
