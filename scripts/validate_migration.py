from __future__ import annotations

import asyncio

from sqlalchemy import func, select

from backend.database import SessionLocal
from backend.models.organization import Organization
from backend.models.subscription import Subscription
from backend.services.billing_manager import detect_orphaned_subscriptions


def _print_result(name: str, passed: bool, detail: str) -> bool:
    status = "PASS" if passed else "FAIL"
    print(f"{status} - {name}: {detail}")
    return passed


def _run_checks() -> bool:
    db = SessionLocal()
    try:
        missing_org_id_count = db.execute(
            select(func.count()).select_from(Subscription).where(Subscription.org_id.is_(None))
        ).scalar_one()

        duplicate_active_orgs = db.execute(
            select(Subscription.org_id)
            .where(Subscription.status == "active")
            .group_by(Subscription.org_id)
            .having(func.count(Subscription.id) > 1)
        ).scalars().all()

        missing_organizations = db.execute(
            select(Subscription.id)
            .outerjoin(Organization, Organization.org_id == Subscription.org_id)
            .where(Organization.org_id.is_(None))
        ).scalars().all()

        orphaned_ids = detect_orphaned_subscriptions(db)

        results = [
            _print_result(
                "every subscription has non-null org_id",
                missing_org_id_count == 0,
                f"missing_org_id_count={missing_org_id_count}",
            ),
            _print_result(
                "no org has more than one active subscription",
                len(duplicate_active_orgs) == 0,
                f"duplicate_active_org_ids={list(duplicate_active_orgs)}",
            ),
            _print_result(
                "every subscription org_id exists in organizations",
                len(missing_organizations) == 0,
                f"missing_organization_subscription_ids={list(missing_organizations)}",
            ),
            _print_result(
                "orphaned subscriptions count",
                len(orphaned_ids) == 0,
                f"orphaned_subscription_count={len(orphaned_ids)} ids={orphaned_ids}",
            ),
        ]
        return all(results)
    finally:
        db.close()


async def main() -> int:
    success = await asyncio.to_thread(_run_checks)
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
