"""Data integrity audit tool for DPR.ai production backend."""

from __future__ import annotations

import sys
import os
from datetime import datetime, timezone
from collections import defaultdict

# Add current directory to path so we can import backend
sys.path.append(os.getcwd())

from backend.database import SessionLocal
from backend.models.organization import Organization
from backend.models.factory import Factory
from backend.models.subscription import Subscription
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.models.entry import Entry # Added
from backend.models.report import AuditLog, TokenBlacklist # Corrected
from backend.models.email_queue import EmailQueue # Added
from backend.models.refresh_token import RefreshToken # Added
from sqlalchemy import func

def audit():
    db = SessionLocal()
    report = []
    
    report.append("=== DPR.ai Integrity Audit Report ===")
    report.append(f"Generated at: {datetime.now(timezone.utc)}")
    report.append("")

    # 1. Duplicate Organizations by name
    org_counts = db.query(Organization.name, func.count(Organization.org_id)).group_by(Organization.name).having(func.count(Organization.org_id) > 1).all()
    if org_counts:
        report.append(f"[RISK] Found {len(org_counts)} duplicate organization names:")
        for name, count in org_counts:
            ids = [o.org_id for o in db.query(Organization).filter(Organization.name == name).all()]
            report.append(f"  - '{name}': {count} records ({', '.join(ids)})")
    else:
        report.append("[OK] No duplicate organization names found.")

    # 2. Duplicate Factories by name within same org
    factory_counts = db.query(Factory.org_id, Factory.name, func.count(Factory.factory_id)).group_by(Factory.org_id, Factory.name).having(func.count(Factory.factory_id) > 1).all()
    if factory_counts:
        report.append(f"[RISK] Found {len(factory_counts)} duplicate factory names within same org:")
        for org_id, name, count in factory_counts:
            report.append(f"  - Org '{org_id}', Factory '{name}': {count} records")
    else:
        report.append("[OK] No duplicate factory names found within same org.")

    # 3. Subscriptions without org_id (legacy)
    orphans = db.query(Subscription).filter(Subscription.org_id == None).all()
    if orphans:
        report.append(f"[CRITICAL] Found {len(orphans)} subscriptions missing org_id:")
        for sub in orphans:
            report.append(f"  - Sub ID {sub.id}, User ID {sub.user_id}")
    else:
        report.append("[OK] All subscriptions have org_id.")

    # 4. Duplicate active/trialing subscriptions per org
    sub_counts = db.query(Subscription.org_id, func.count(Subscription.id)).filter(Subscription.status.in_(['active', 'trialing'])).group_by(Subscription.org_id).having(func.count(Subscription.id) > 1).all()
    if sub_counts:
        report.append(f"[CRITICAL] Found {len(sub_counts)} organizations with multiple active/trialing subscriptions:")
        for org_id, count in sub_counts:
            subs = db.query(Subscription).filter(Subscription.org_id == org_id, Subscription.status.in_(['active', 'trialing'])).all()
            sub_details = [f"ID {s.id} ({s.status}, {s.plan})" for s in subs]
            report.append(f"  - Org '{org_id}': {count} subs [{', '.join(sub_details)}]")
    else:
        report.append("[OK] All organizations have at most one active/trialing subscription.")

    # 5. Organizations without any subscription
    orgs_no_sub = db.query(Organization).outerjoin(Subscription).filter(Subscription.id == None).all()
    if orgs_no_sub:
        report.append(f"[RISK] Found {len(orgs_no_sub)} organizations without any subscription:")
        for org in orgs_no_sub:
            report.append(f"  - Org '{org.name}' ({org.org_id})")
    else:
        report.append("[OK] All organizations have at least one subscription record.")

    # 6. First user role audit (Should be OWNER)
    org_users = db.query(User.org_id).distinct().all()
    missing_owner = 0
    for (org_id,) in org_users:
        has_owner = db.query(User).filter(User.org_id == org_id, User.role == UserRole.OWNER).first()
        if not has_owner:
            missing_owner += 1
            admins = [u.email for u in db.query(User).filter(User.org_id == org_id, User.role == UserRole.ADMIN).all()]
            report.append(f"[RISK] Org '{org_id}' has NO OWNER. Admins: {', '.join(admins) or 'None'}")
    
    if missing_owner == 0:
        report.append("[OK] All organizations have at least one OWNER.")

    # 7. UserFactoryRole vs User.org_id consistency
    mismatched = db.query(UserFactoryRole).join(User).filter(UserFactoryRole.org_id != User.org_id).all()
    if mismatched:
        report.append(f"[CRITICAL] Found {len(mismatched)} UserFactoryRole records with org_id mismatching User.org_id:")
        for m in mismatched:
            report.append(f"  - User {m.user_id} (Org {m.user.org_id}) has role in Factory {m.factory_id} (Org {m.org_id})")
    else:
        report.append("[OK] UserFactoryRole org_id consistency verified.")

    db.close()
    return "\n".join(report)

if __name__ == "__main__":
    print(audit())
