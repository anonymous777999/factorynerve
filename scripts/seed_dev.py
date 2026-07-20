"""
seed_dev.py — Comprehensive local development seed script.

Creates a complete test environment:
  - Organization + Steel Factory
  - Owner test user (email verified, + AuthUser for /auth/v2/login)
  - Active subscription (so plan gates resolve)
  - 7 days of DPR entries with anomaly data
  - Steel inventory items + transactions + production batches (theft demo)

Usage:
    cd /d/DPR\ APP/DPR.ai
    python scripts/seed_dev.py

Login:  owner@example.com / TestOwner@123456
Backend: http://127.0.0.1:8765
Frontend: http://127.0.0.1:3000 (cd web && npm run dev)
"""

import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_ROOT)
sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///dpr_ai.db")
os.environ.setdefault("JWT_SECRET_KEY", "dev-seed-secret-key-do-not-use-in-prod")
os.environ.setdefault("AI_PROVIDER", "groq")
os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("EMAIL_VERIFICATION_EXPOSE_LINK", "1")
os.environ.setdefault("PASSWORD_RESET_EXPOSE_LINK", "1")
os.environ.setdefault("SMTP_DRY_RUN", "1")
os.environ["DATA_ENCRYPTION_KEY"] = "JNIpD1HUnuaLBG7mXWIUY_sFV-iA9MfpZ_y-jvDF4LM="  # force overwrite
# Local dev: disable HTTPS-only cookies so they work over HTTP
os.environ["AUTH_SESSION_SECURE"] = "false"
os.environ["JWT_COOKIE_SECURE"] = "false"

from backend.database import SessionLocal, init_db
from backend.models.organization import Organization
from backend.models.factory import Factory
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.models.user_plan import UserPlan
from backend.models.subscription import Subscription
from backend.models.entry import Entry, ShiftType
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_production_batch import SteelProductionBatch
from backend.security import hash_password
from backend.services.user_code_service import next_user_code
from backend.models.auth_user import AuthUser as BackendAuthUser
from backend.auth_security.passwords import hash_password as auth_hash_password


TEST_EMAIL = "owner@example.com"
TEST_PASSWORD = "TestOwner@123456"
TEST_FACTORY = "QA Steel Plant"
ORG_NAME = "Test Organization"
DEMO_DAYS_BACK = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _p(text: str) -> None:
    """Print with safe encoding for Windows terminals."""
    try:
        print(text)
    except UnicodeEncodeError:
        safe = text.encode("ascii", errors="replace").decode("ascii")
        print(safe)


def _check_server() -> bool:
    import urllib.request
    try:
        resp = urllib.request.urlopen("http://127.0.0.1:8765/health", timeout=3)
        return resp.status == 200
    except Exception:
        return False


def _ensure_frontend_env() -> None:
    env_path = os.path.join(PROJECT_ROOT, "web", ".env.local")
    if not os.path.exists(env_path):
        try:
            with open(env_path, "w") as f:
                f.write("NEXT_PUBLIC_API_BASE_URL=/api\n")
            _p("  Created web/.env.local")
        except OSError:
            _p("  Warning: Could not create web/.env.local")
    else:
        _p("  web/.env.local already exists")


def seed():
    _p("=" * 60)
    _p("  DPR.ai -- Local Development Seed Script")
    _p("=" * 60)
    _p("")

    # Warn if server is running
    if _check_server():
        _p("")
        _p("WARNING: Backend server is running at http://127.0.0.1:8765")
        _p("  This script writes directly to dpr_ai.db.")
        _p("  Continuing anyway...")

    # Ensure frontend env
    _ensure_frontend_env()

    # Delete the entire DB file to avoid FK constraint issues
    _p("")
    _p("Deleting existing database (dpr_ai.db)...")
    db_path = os.path.join(PROJECT_ROOT, "dpr_ai.db")
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            # Also clean up SQLite WAL artifacts
            for suffix in ("-wal", "-shm"):
                p = db_path + suffix
                if os.path.exists(p):
                    os.remove(p)
            _p("  Deleted.")
        except OSError as e:
            _p(f"  Could not delete: {e}")
            sys.exit(1)
    else:
        _p("  No existing database found.")

    # Reinitialize
    init_db()
    db = SessionLocal()

    try:
        # -- Organization --
        _p("")
        _p("1. Creating Organization...")
        org_id = str(uuid.uuid4())
        org = Organization(org_id=org_id, name=ORG_NAME, plan="pilot", is_active=True)
        db.add(org)
        db.flush()
        _p(f"  org_id={org_id}")

        # -- Factory --
        _p("")
        _p("2. Creating Factory (steel)...")
        factory_id = str(uuid.uuid4())
        factory = Factory(
            factory_id=factory_id, org_id=org_id, name=TEST_FACTORY,
            location="Pune, Maharashtra", timezone="Asia/Kolkata",
            industry_type="steel", workflow_template_key="steel-mill",
            factory_code="QA001", is_active=True,
        )
        db.add(factory)
        db.flush()
        _p(f"  factory_id={factory_id}")

        # -- User --
        _p("")
        _p("3. Creating test user (Owner)...")
        user = User(
            org_id=org_id,
            user_code=next_user_code(db, org_id=org_id),
            name="Test Owner", email=TEST_EMAIL,
            password_hash=hash_password(TEST_PASSWORD),
            role=UserRole.OWNER, factory_name=TEST_FACTORY,
            factory_code="QA001", phone_number="+919999999999",
            phone_e164="+919999999999", is_active=True,
            email_verified_at=_now(), auth_provider="local",
        )
        db.add(user)
        db.flush()
        _p(f"  user_id={user.id}")

        # -- UserFactoryRole --
        _p("")
        _p("4. Assigning factory role...")
        db.add(UserFactoryRole(user_id=user.id, factory_id=factory_id, org_id=org_id, role=UserRole.OWNER))
        db.flush()

        # -- UserPlan --
        _p("")
        _p("5. Creating UserPlan...")
        db.add(UserPlan(user_id=user.id, plan="pilot"))

        # -- Subscription (critical: get_effective_plan reads this) --
        _p("")
        _p("6. Creating Subscription (active, pilot)...")
        now = _now()
        db.add(Subscription(
            org_id=org_id, user_id=user.id, plan="pilot", status="active",
            trial_start_at=now, trial_end_at=now + timedelta(days=14),
            current_period_end_at=now + timedelta(days=30),
        ))
        db.flush()

        # -- AuthUser (for /auth/v2/login cookie auth) --
        _p("")
        _p("7. Creating AuthUser (browser login)...")
        existing = db.query(BackendAuthUser).filter(BackendAuthUser.email == TEST_EMAIL).first()
        if not existing:
            db.add(BackendAuthUser(
                email=TEST_EMAIL,
                password_hash=auth_hash_password(TEST_PASSWORD),
                is_active=True, mfa_enabled=False, password_changed_at=_now(),
            ))
            _p("  Done.")
        else:
            _p("  Already exists.")

        # -- DPR Entries --
        _p("")
        _p("8. Creating DPR entries (7 days, 16 entries)...")
        today = date.today()
        count = 0
        for day_offset in range(DEMO_DAYS_BACK, -1, -1):
            entry_date = today - timedelta(days=day_offset)
            # Morning - normal
            db.add(Entry(
                user_id=user.id, org_id=org_id, factory_id=factory_id,
                date=entry_date, shift=ShiftType.MORNING,
                units_target=100, units_produced=92,
                manpower_present=18, manpower_absent=2,
                downtime_minutes=15, downtime_reason="Scheduled maintenance",
                department="Production", materials_used="Steel coils, 500kg",
                quality_issues=False, status="submitted", is_active=True,
            ))
            count += 1

            # Evening - anomaly on days 2 and 4
            if day_offset in {2, 4}:
                db.add(Entry(
                    user_id=user.id, org_id=org_id, factory_id=factory_id,
                    date=entry_date, shift=ShiftType.EVENING,
                    units_target=100, units_produced=58,
                    manpower_present=15, manpower_absent=5,
                    downtime_minutes=120, downtime_reason="Conveyor breakdown",
                    department="Production", materials_used="Steel coils, 300kg",
                    quality_issues=True, quality_details="Surface defects on 12 units",
                    status="submitted", is_active=True,
                ))
            else:
                db.add(Entry(
                    user_id=user.id, org_id=org_id, factory_id=factory_id,
                    date=entry_date, shift=ShiftType.EVENING,
                    units_target=100, units_produced=95,
                    manpower_present=19, manpower_absent=1,
                    downtime_minutes=8, downtime_reason="Minor adjustments",
                    department="Production", materials_used="Steel coils, 450kg",
                    quality_issues=False, status="submitted", is_active=True,
                ))
            count += 1
        db.flush()
        _p(f"  Created {count} entries")

        # -- Steel Inventory Items --
        _p("")
        _p("9. Creating steel inventory items...")
        items = {
            "HRC": SteelInventoryItem(
                org_id=org_id, factory_id=factory_id,
                item_code="HRC-001", name="Hot Rolled Coil 2.5mm",
                category="raw_material", current_rate_per_kg=62.0,
                created_by_user_id=user.id,
            ),
            "CRC": SteelInventoryItem(
                org_id=org_id, factory_id=factory_id,
                item_code="CRC-001", name="Cold Rolled Coil 1.2mm",
                category="raw_material", current_rate_per_kg=78.0,
                created_by_user_id=user.id,
            ),
            "FIN-SHEET": SteelInventoryItem(
                org_id=org_id, factory_id=factory_id,
                item_code="FIN-SHT-001", name="Finished Sheet 2B",
                category="finished_goods", current_rate_per_kg=95.0,
                created_by_user_id=user.id,
            ),
            "FIN-COIL": SteelInventoryItem(
                org_id=org_id, factory_id=factory_id,
                item_code="FIN-CL-001", name="Finished Coil Annealed",
                category="finished_goods", current_rate_per_kg=110.0,
                created_by_user_id=user.id,
            ),
        }
        for item in items.values():
            db.add(item)
        db.flush()
        hrc_id = items["HRC"].id
        crc_id = items["CRC"].id
        fin_sheet_id = items["FIN-SHEET"].id
        fin_coil_id = items["FIN-COIL"].id
        _p(f"  Created {len(items)} items")

        # -- Inventory Transactions --
        _p("")
        _p("10. Creating inventory transactions...")
        txns = [
            (hrc_id, "inward", 10000.0, "Opening stock - HR coils"),
            (crc_id, "inward", 5000.0, "Opening stock - CR coils"),
            (fin_sheet_id, "production_output", 2000.0, "Prior stock - sheets"),
            (fin_coil_id, "production_output", 1500.0, "Prior stock - coils"),
        ]
        for item_id, txn_type, qty, note in txns:
            db.add(SteelInventoryTransaction(
                org_id=org_id, factory_id=factory_id, item_id=item_id,
                transaction_type=txn_type, quantity_kg=qty,
                reference_type="seed", notes=note,
                created_by_user_id=user.id,
            ))
        db.flush()
        _p(f"  Created {len(txns)} transactions")

        # -- Production Batches --
        _p("")
        _p("11. Creating production batches (theft demo)...")
        batches = [
            # Normal batch
            SteelProductionBatch(
                org_id=org_id, factory_id=factory_id,
                operator_user_id=user.id, created_by_user_id=user.id,
                batch_code="ST-QA001-2026-001",
                production_date=today - timedelta(days=3),
                input_item_id=hrc_id, output_item_id=fin_sheet_id,
                input_quantity_kg=1000.0, expected_output_kg=950.0,
                actual_output_kg=940.0, loss_kg=60.0, loss_percent=6.0,
                variance_kg=-10.0, variance_percent=1.05,
                variance_value_inr=620.0, severity="normal",
                status="recorded", notes="Standard production run.",
            ),
            # THEFT batch - 100kg missing!
            SteelProductionBatch(
                org_id=org_id, factory_id=factory_id,
                operator_user_id=user.id, created_by_user_id=user.id,
                batch_code="ST-QA001-2026-002",
                production_date=today - timedelta(days=2),
                input_item_id=hrc_id, output_item_id=fin_coil_id,
                input_quantity_kg=1000.0, expected_output_kg=950.0,
                actual_output_kg=850.0, loss_kg=150.0, loss_percent=15.0,
                variance_kg=-100.0, variance_percent=10.53,
                variance_value_inr=6200.0, severity="critical",
                status="recorded",
                notes="100kg unaccounted loss - suspected theft (Ramesh)",
            ),
            # High loss batch
            SteelProductionBatch(
                org_id=org_id, factory_id=factory_id,
                operator_user_id=user.id, created_by_user_id=user.id,
                batch_code="ST-QA001-2026-003",
                production_date=today - timedelta(days=1),
                input_item_id=crc_id, output_item_id=fin_sheet_id,
                input_quantity_kg=500.0, expected_output_kg=475.0,
                actual_output_kg=440.0, loss_kg=60.0, loss_percent=12.0,
                variance_kg=-35.0, variance_percent=7.37,
                variance_value_inr=2730.0, severity="high",
                status="recorded", notes="Calibration issue, low yield.",
            ),
        ]
        for batch in batches:
            db.add(batch)
        db.flush()
        _p(f"  Created {len(batches)} batches (1 critical theft, 1 high loss)")

        # -- Commit --
        db.commit()

        _p("")
        _p("=" * 60)
        _p("  SEED COMPLETE")
        _p("=" * 60)
        _p("")
        _p("  BACKEND:  http://127.0.0.1:8765")
        _p("  FRONTEND: http://127.0.0.1:3000 (cd web && npm run dev)")
        _p("")
        _p("  LOGIN:  owner@example.com / TestOwner@123456")
        _p("")
        _p("  AUTH: Login at frontend or use /auth/v2/login for API access")
        _p("")
        _p("  WHAT TO TEST:")
        _p("    1. Login at frontend with above credentials")
        _p("    2. AI Insights - anomalies (low output, high downtime)")
        _p("    3. Steel Overview - 100kg theft batch (critical)")
        _p("    4. Steel Overview - highest-risk operator stats")
        _p("    5. DPR entries - 7 days morning/evening data")
        _p("    6. All features accessible on Pilot plan")
        _p("")

    except Exception:
        db.rollback()
        import traceback
        traceback.print_exc()
        _p("")
        _p("SEED FAILED - check errors above.")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
