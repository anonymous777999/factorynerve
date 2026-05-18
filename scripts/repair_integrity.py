"""Data integrity repair tool for DPR.ai production backend."""

from __future__ import annotations

import sys
import os
from datetime import datetime, timezone

# Add current directory to path so we can import backend
sys.path.append(os.getcwd())

from backend.database import SessionLocal
from backend.models.organization import Organization
from backend.models.factory import Factory
from backend.models.subscription import Subscription
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.models.entry import Entry
from backend.models.report import AuditLog, TokenBlacklist
from backend.models.email_queue import EmailQueue
from backend.models.refresh_token import RefreshToken
from sqlalchemy import func, case # Updated

def repair(dry_run=True):
    db = SessionLocal()
    report = []
    
    if dry_run:
        report.append("!!! DRY RUN MODE - No changes will be committed !!!")
    
    report.append("=== DPR.ai Integrity Repair Log ===")
    report.append(f"Started at: {datetime.now(timezone.utc)}")
    report.append("")

    # 1. Promote ADMIN to OWNER where OWNER is missing
    org_users = db.query(User.org_id).distinct().all()
    promoted_count = 0
    for (org_id,) in org_users:
        has_owner = db.query(User).filter(User.role == UserRole.OWNER, User.org_id == org_id).first()
        if not has_owner:
            # Find the best candidate: first ADMIN, or first user
            candidate = db.query(User).filter(User.role == UserRole.ADMIN, User.org_id == org_id).order_by(User.id.asc()).first()
            if not candidate:
                candidate = db.query(User).filter(User.org_id == org_id).order_by(User.id.asc()).first()
            
            if candidate:
                report.append(f"[REPAIR] Promoting User {candidate.id} ({candidate.email}) in Org {org_id} to OWNER.")
                candidate.role = UserRole.OWNER
                
                # Also update UserFactoryRole
                factory_role = db.query(UserFactoryRole).filter(UserFactoryRole.user_id == candidate.id).first()
                if factory_role:
                    factory_role.role = UserRole.OWNER
                
                promoted_count += 1
    
    report.append(f"Total users promoted to OWNER: {promoted_count}")

    # 2. Fix Duplicate Subscriptions
    sub_counts = db.query(Subscription.org_id, func.count(Subscription.id)).filter(Subscription.status.in_(['active', 'trialing'])).group_by(Subscription.org_id).having(func.count(Subscription.id) > 1).all()
    deduplicated_count = 0
    for org_id, count in sub_counts:
        subs = db.query(Subscription).filter(Subscription.org_id == org_id, Subscription.status.in_(['active', 'trialing'])).order_by(
            # Sort by status priority: active > trialing, then by id desc (newest)
            case(
                (Subscription.status == 'active', 1),
                (Subscription.status == 'trialing', 2),
                else_=3
            ),
            Subscription.id.desc()
        ).all()
        
        canonical = subs[0]
        duplicates = subs[1:]
        
        report.append(f"[REPAIR] Org {org_id} has {count} subs. Keeping ID {canonical.id} ({canonical.status}).")
        for dup in duplicates:
            report.append(f"  - Marking ID {dup.id} ({dup.status}) as 'stale'.")
            dup.status = 'stale'
            deduplicated_count += 1

    report.append(f"Total duplicate subscriptions marked as stale: {deduplicated_count}")

    if not dry_run:
        db.commit()
        report.append("Changes committed successfully.")
    else:
        db.rollback()
        report.append("Dry run: Changes rolled back.")

    db.close()
    return "\n".join(report)

if __name__ == "__main__":
    is_dry = "--commit" not in sys.argv
    print(repair(dry_run=is_dry))
    if is_dry:
        print("\nNote: Run with '--commit' to apply changes.")
