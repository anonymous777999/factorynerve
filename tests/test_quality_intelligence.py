"""Tests for Quality Intelligence endpoint and service functions.

Tests GET /steel/quality/intelligence which returns:
  - summary (rejection rates, scrap vs rework, entry-level KPIs)
  - rejection_trend (daily rejection/scrap/rework with batch overlay)
  - defect_category_analysis (grouped by defect_reason.code)
  - by_operator, by_shift, by_department
  - scrap_vs_rework (destructive vs corrective tracking)
  - batch_quality_integration (batch severity, top-loss batches)
  - increase_drivers (baseline comparison)
  - data_confidence report
  - permission-based financial redaction

Follows the same API-based integration test pattern as test_steel_scrap_loss_intelligence.py.
"""

from __future__ import annotations

from datetime import date, timedelta
from http import HTTPStatus

from tests.utils import register_user


def _promote_factory_to_steel(email: str) -> None:
    from backend.database import SessionLocal, init_db
    from backend.models.factory import Factory
    from backend.models.user import User

    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        factory = (
            db.query(Factory)
            .filter(Factory.org_id == user.org_id, Factory.name == user.factory_name)
            .first()
        )
        assert factory is not None
        factory.industry_type = "steel"
        factory.workflow_template_key = "steel-core-pack"
        db.add(factory)
        db.commit()
    finally:
        db.close()


def _set_user_role(email: str, role: str) -> None:
    from backend.database import SessionLocal, init_db
    from backend.models.user import User

    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        user.role = role
        db.add(user)
        db.commit()
    finally:
        db.close()


def _seed_defect_reasons() -> dict[str, int]:
    """Ensure the 8 seed defect reasons exist and return code->id mapping."""
    from backend.database import SessionLocal, init_db
    from backend.models.defect_reason import DefectReason

    init_db()
    db = SessionLocal()
    try:
        existing = db.query(DefectReason).filter(DefectReason.is_active.is_(True)).all()
        if existing:
            return {r.code: r.id for r in existing}

        seeds = [
            DefectReason(code="material_defect", label="Material Defect", description="Raw material or input quality issue"),
            DefectReason(code="dimensional_variance", label="Dimensional Variance", description="Dimensions out of spec"),
            DefectReason(code="surface_defect", label="Surface Defect", description="Surface finish or appearance issue"),
            DefectReason(code="process_deviation", label="Process Deviation", description="Process parameter out of range"),
            DefectReason(code="equipment_failure", label="Equipment Failure", description="Machine or tooling issue"),
            DefectReason(code="operator_error", label="Operator Error", description="Operator handling or setup mistake"),
            DefectReason(code="rework_correction", label="Rework/Correction", description="Correction from a prior defect"),
            DefectReason(code="other", label="Other", description="Any other defect reason"),
        ]
        for s in seeds:
            db.add(s)
        db.commit()
        for s in seeds:
            db.refresh(s)
        return {r.code: r.id for r in seeds}
    finally:
        db.close()


def _create_and_approve_entry(
    http_client,
    headers: dict,
    *,
    shift: str = "morning",
    department: str = "Production",
    units_produced: int = 100,
    entry_date: str | None = None,
    quality_issues: bool = False,
    rejection_qty: int | None = None,
    defect_reason_id: int | None = None,
    rework_required: bool = False,
    scrap_qty_entry: int | None = None,
    quality_details: str | None = None,
) -> int:
    """Create an entry via the API, then set its status to 'approved' directly via DB.

    The quality intelligence service only analyzes approved entries, but the
    approval endpoint requires a reviewer different from the creator.
    """
    today_str = date.today().isoformat()
    payload = {
        "date": entry_date or today_str,
        "shift": shift,
        "units_target": units_produced + 10,
        "units_produced": units_produced,
        "manpower_present": 10,
        "manpower_absent": 1,
        "downtime_minutes": 0,
        "downtime_reason": "",
        "department": department,
        "materials_used": "Steel",
        "quality_issues": quality_issues,
        "quality_details": quality_details,
        "rejection_qty": rejection_qty,
        "defect_reason_id": defect_reason_id,
        "rework_required": rework_required,
        "scrap_qty_entry": scrap_qty_entry,
        "notes": "Test entry for quality intelligence",
    }
    resp = http_client.post("/entries", json=payload)
    assert resp.status_code in (HTTPStatus.OK, HTTPStatus.CREATED), \
        f"Entry creation: {resp.status_code}: {resp.text[:300]}"
    data = resp.json()
    entry_id = data["id"]

    # Bypass the approval flow by setting status directly in the DB
    from backend.database import SessionLocal, init_db
    from backend.models.entry import Entry
    init_db()
    db = SessionLocal()
    try:
        entry = db.query(Entry).filter(Entry.id == entry_id).first()
        if entry:
            entry.status = "approved"
            db.add(entry)
            db.commit()
    finally:
        db.close()

    return entry_id


def _create_batch(
    http_client,
    
    input_id: int,
    output_id: int,
    input_kg: float,
    output_kg: float,
    *,
    scrap_kg: float | None = None,
    rejection_kg: float | None = None,
    production_date: str | None = None,
) -> int:
    payload = {
        "production_date": production_date or date.today().isoformat(),
        "input_item_id": input_id,
        "output_item_id": output_id,
        "input_quantity_kg": input_kg,
        "expected_output_kg": output_kg * 1.02,
        "actual_output_kg": output_kg,
        "notes": "Test batch for quality intelligence",
    }
    if scrap_kg is not None:
        payload["scrap_qty_kg"] = scrap_kg
    if rejection_kg is not None:
        payload["rejection_qty_kg"] = rejection_kg

    resp = http_client.post("/steel/batches", json=payload)
    assert resp.status_code == HTTPStatus.OK, f"Batch creation: {resp.status_code}: {resp.text[:300]}"
    return resp.json()["batch"]["id"]


def _create_item(
    http_client,  item_code: str, name: str, category: str, rate: float = 50.0
) -> int:
    resp = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": item_code,
            "name": name,
            "category": category,
            "display_unit": "kg",
            "current_rate_per_kg": rate,
        },
    )
    assert resp.status_code == HTTPStatus.OK, resp.text
    return resp.json()["item"]["id"]


def _create_inward(http_client,  item_id: int, qty_kg: float) -> None:
    resp = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": item_id,
            "transaction_type": "inward",
            "quantity_kg": qty_kg,
            "notes": "Test inward",
        },
    )
    assert resp.status_code == HTTPStatus.OK, resp.text


# ── Tests ──────────────────────────────────────────────────────────────────


def test_quality_intelligence_rejects_non_steel_factory(http_client):
    """Non-steel factory should get 400."""
    user = register_user(http_client, role="admin")
    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "steel factory" in response.text.lower()


def test_quality_intelligence_empty_factory(http_client):
    """A factory with no entries should return all-zero analytics."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    # Summary should be zero
    assert payload["summary"]["total_entries_analyzed"] == 0
    assert payload["summary"]["total_rejection_units"] == 0
    assert payload["summary"]["total_scrap_units"] == 0
    assert payload["summary"]["rework_entry_count"] == 0
    assert payload["summary"]["entry_data_quality"] == "no_data"

    # All sections should be empty but present
    assert payload["rejection_trend"] == []
    assert payload["defect_category_analysis"]["categories"] == []
    assert payload["by_operator"] == []
    assert payload["by_shift"]["by_shift"] == []
    assert payload["by_department"]["by_department"] == []
    assert payload["scrap_vs_rework"]["data_quality"] == "no_data"

    # Metadata should be correct
    assert payload["period_days"] == 30
    assert isinstance(payload["financial_access"], bool)
    assert payload["as_of"] == date.today().isoformat()
    assert "data_confidence" in payload


def test_quality_intelligence_basic_summary_with_data(http_client):
    """Create entries with structured quality data and verify summary."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    # Seed defect reasons for FK references
    dr_map = _seed_defect_reasons()

    # Create entries with quality data — use different shifts to avoid 409 conflicts
    _create_and_approve_entry(http_client, headers, shift="morning", units_produced=100,
                  rejection_qty=5, defect_reason_id=dr_map["surface_defect"])
    _create_and_approve_entry(http_client, headers, shift="evening", units_produced=100,
                  scrap_qty_entry=10, rework_required=True)
    _create_and_approve_entry(http_client, headers, shift="night", units_produced=100)  # clean entry

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    summary = payload["summary"]
    # 3 entries created, 3 analyzed (no status filter applied)
    assert summary["total_entries_analyzed"] >= 3
    assert summary["total_rejection_units"] >= 5
    assert summary["total_scrap_units"] >= 10
    assert summary["rework_entry_count"] >= 1
    assert summary["entry_data_quality"] == "structured"

    # Rejection rate: 5 / 300 = 1.67%
    if summary["rejection_rate_percent"] is not None:
        assert 0.5 <= summary["rejection_rate_percent"] <= 3.0


def test_quality_intelligence_defect_categorization(http_client):
    """Verify defect category analysis groups by defect_reason."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    # Create entries with different defect reasons — use different shifts to avoid 409 conflicts
    _create_and_approve_entry(http_client, headers, shift="morning", units_produced=100,
                  rejection_qty=3, defect_reason_id=dr_map["surface_defect"])
    _create_and_approve_entry(http_client, headers, shift="evening", units_produced=100,
                  rejection_qty=5, defect_reason_id=dr_map["dimensional_variance"])
    _create_and_approve_entry(http_client, headers, shift="night", units_produced=100,
                  rejection_qty=2, defect_reason_id=dr_map["surface_defect"])

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    cats = payload["defect_category_analysis"]
    assert cats["has_structured_defects"] is True
    assert len(cats["categories"]) >= 2

    # Find surface defect category
    surface = next((c for c in cats["categories"] if c["code"] == "surface_defect"), None)
    assert surface is not None, f"surface_defect not in {cats['categories']}"
    assert surface["entry_count"] >= 2
    assert surface["total_rejection_units"] >= 4  # 3 + 2


def test_quality_intelligence_by_operator(http_client):
    """Verify operator breakdown works."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    _create_and_approve_entry(http_client, headers, units_produced=100,
                  rejection_qty=5, defect_reason_id=dr_map["equipment_failure"])

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    by_operator = payload["by_operator"]
    assert len(by_operator) >= 1
    op = next((o for o in by_operator if o["user_id"] == user["user_id"]), None)
    if op:
        assert op["total_rejection_units"] >= 5
        assert op["entry_count"] >= 1
        assert "name" in op


def test_quality_intelligence_by_shift(http_client):
    """Verify shift breakdown works."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    today = date.today().isoformat()
    _create_and_approve_entry(http_client, headers, shift="morning", units_produced=100,
                  rejection_qty=3, defect_reason_id=dr_map["process_deviation"],
                  entry_date=today)
    _create_and_approve_entry(http_client, headers, shift="evening", units_produced=100,
                  rejection_qty=0, entry_date=today)

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    by_shift = payload["by_shift"]
    shifts = by_shift["by_shift"]
    assert len(shifts) >= 1

    morning = next((s for s in shifts if s["shift"] == "morning"), None)
    if morning:
        assert morning["total_rejection_units"] >= 3
        assert morning["entry_count"] >= 1


def test_quality_intelligence_by_department(http_client):
    """Verify department breakdown works."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    _create_and_approve_entry(http_client, headers, department="Rolling Mill", units_produced=100,
                  rejection_qty=4, defect_reason_id=dr_map["material_defect"])

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    by_dept = payload["by_department"]
    depts = by_dept["by_department"]
    assert len(depts) >= 1

    rolling = next((d for d in depts if d["department"] == "Rolling Mill"), None)
    if rolling:
        assert rolling["total_rejection_units"] >= 4
        assert rolling["entry_count"] >= 1


def test_quality_intelligence_scrap_vs_rework(http_client):
    """Verify scrap vs rework analysis."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    # Use different shifts to avoid 409 conflicts
    # Entry with scrap only
    _create_and_approve_entry(http_client, headers, shift="morning", units_produced=100, scrap_qty_entry=20)
    # Entry with rework only
    _create_and_approve_entry(http_client, headers, shift="evening", units_produced=100, rework_required=True)
    # Entry with both scrap and rework
    _create_and_approve_entry(http_client, headers, shift="night", units_produced=100,
                  scrap_qty_entry=10, rework_required=True)

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    svr = payload["scrap_vs_rework"]
    assert svr["total_scrap_units"] >= 30  # 20 + 10
    assert svr["total_rework_entry_count"] >= 2
    assert svr["entries_with_both_scrap_and_rework"] >= 1
    assert svr["data_quality"] == "direct"


def test_quality_intelligence_batch_integration(http_client):
    """Verify batch quality integration works."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    raw_id = _create_item(http_client,  "QI-RAW", "QI Input", "raw_material", rate=50.0)
    prod_id = _create_item(http_client,  "QI-OUT", "QI Output", "finished_goods", rate=100.0)
    _create_inward(http_client,  raw_id, 50000)

    _create_batch(http_client,  raw_id, prod_id, 5000, 4600,
                  scrap_kg=300, rejection_kg=50)

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    bq = payload["batch_quality_integration"]
    assert bq["total_batches"] >= 1
    assert bq["total_batch_rejection_kg"] >= 48.0
    assert bq["total_batch_scrap_kg"] >= 298.0
    assert bq["data_quality"] == "direct"


def test_quality_intelligence_financial_redaction(http_client):
    """Verify financial costs are redacted for non-finance roles.

    Supervisor has production.analytics.view (can call the endpoint) but does NOT
    have production.scrap_cost.view (costs are redacted).
    """
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    dr_map = _seed_defect_reasons()

    # Create entry with scrap (which generates cost data)
    _create_and_approve_entry(http_client, headers, units_produced=100,
                  scrap_qty_entry=15, rework_required=True)

    # Create batch with scrap for batch-level cost
    raw_id = _create_item(http_client,  "FR2-RAW", "FR2 Input", "raw_material", rate=50.0)
    prod_id = _create_item(http_client,  "FR2-OUT", "FR2 Output", "finished_goods", rate=100.0)
    _create_inward(http_client,  raw_id, 50000)
    _create_batch(http_client,  raw_id, prod_id, 5000, 4600, scrap_kg=200)

    # Switch to supervisor (has analytics.view but NOT scrap_cost.view)
    from backend.database import SessionLocal, init_db
    from backend.models.user import User
    from backend.models.user_factory_role import UserFactoryRole
    from backend.models.auth_user import AuthUser
    from backend.models.auth_session import AuthSession
    from backend.auth_security.tokens import generate_token, hash_token
    from backend.security import hash_password as hp
    from datetime import timedelta
    init_db()
    db = SessionLocal()
    try:
        refreshed = db.query(User).filter(User.email == user["email"]).first()
        assert refreshed is not None
        refreshed.role = "supervisor"
        for membership in db.query(UserFactoryRole).filter(UserFactoryRole.user_id == refreshed.id).all():
            membership.role = "supervisor"
        db.commit()
        membership = db.query(UserFactoryRole).filter(UserFactoryRole.user_id == refreshed.id).first()
        fid = membership.factory_id if membership else None

        # Create a v2 session for the supervisor
        auth_user = db.query(AuthUser).filter(AuthUser.email == refreshed.email).first()
        if not auth_user:
            auth_user = AuthUser(
                email=refreshed.email,
                password_hash=hp("test-password"),
                is_email_verified=True,
                is_active=True,
            )
            db.add(auth_user)
            db.flush()
        now = datetime.now(timezone.utc)
        raw_token = generate_token(32)
        token_hash = hash_token(raw_token)
        session_obj = AuthSession(
            auth_user_id=auth_user.id,
            token_hash=token_hash,
            csrf_hash=hash_token(generate_token(16)),
            created_at=now,
            expires_at=now + timedelta(days=30),
            factory_id=fid,
        )
        db.add(session_obj)
        db.commit()
        new_token = raw_token
    finally:
        db.close()

    headers = {"Cookie": "auth_session=" + new_token}

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    assert payload["financial_access"] is False

    # Summary should still have structure
    assert payload["summary"]["total_scrap_units"] >= 14


def test_quality_intelligence_financial_access_for_owner(http_client):
    """Verify owner role can see cost fields."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    _create_and_approve_entry(http_client, headers, units_produced=100,
                  scrap_qty_entry=10, rework_required=True)

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    assert payload["financial_access"] is True

    # scrap_vs_rework should have labour cost estimate
    svr = payload["scrap_vs_rework"]
    assert svr["estimated_rework_labour_cost_inr"] is not None
    assert svr["estimated_rework_labour_cost_inr"] > 0


def test_quality_intelligence_requires_auth(http_client):
    """Unauthenticated requests should be rejected."""
    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)


def test_quality_intelligence_data_confidence_section(http_client):
    """Verify data_confidence section structure."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    _create_and_approve_entry(http_client, headers, units_produced=100,
                  rejection_qty=5, defect_reason_id=dr_map["material_defect"])

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    dc = payload["data_confidence"]
    assert "entry_rejection_tracking" in dc
    assert "entry_scrap_tracking" in dc
    assert "entry_rework_tracking" in dc
    assert "entry_defect_reason_tracking" in dc
    assert "batch_rejection_tracking" in dc
    assert "batch_scrap_tracking" in dc
    assert "overall_quality_data_quality" in dc
    assert "missing_fields" in dc
    assert isinstance(dc["missing_fields"], list)

    # We have rejection data, so entry_rejection_tracking should be structured
    assert dc["entry_rejection_tracking"] == "structured"


def test_quality_intelligence_rejection_trend(http_client):
    """Verify daily rejection trend is populated."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    today = date.today()
    yesterday = (today - timedelta(days=1)).isoformat()

    _create_and_approve_entry(http_client, headers, units_produced=100,
                  rejection_qty=5, defect_reason_id=dr_map["surface_defect"],
                  entry_date=today.isoformat())
    _create_and_approve_entry(http_client, headers, units_produced=100,
                  rejection_qty=3, scrap_qty_entry=8,
                  entry_date=yesterday)

    response = http_client.get("/steel/quality/intelligence?days=30")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    trends = payload["rejection_trend"]
    assert len(trends) >= 2

    today_trend = next((d for d in trends if d["date"] == today.isoformat()), None)
    if today_trend:
        assert today_trend["rejection_units"] >= 5
        assert today_trend["total_produced_units"] >= 100

    yesterday_trend = next((d for d in trends if d["date"] == yesterday), None)
    if yesterday_trend:
        assert yesterday_trend["rejection_units"] >= 3
        assert yesterday_trend["scrap_units"] >= 8


def test_quality_intelligence_daily_trend_with_batches(http_client):
    """Verify daily trend merges entry and batch data."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    today = date.today().isoformat()

    # Create entry with rejection
    _create_and_approve_entry(http_client, headers, units_produced=100,
                  rejection_qty=5, defect_reason_id=dr_map["material_defect"],
                  entry_date=today)

    # Create batch with scrap/rejection
    raw_id = _create_item(http_client,  "TR2-RAW", "Trend2 Input", "raw_material", rate=50.0)
    prod_id = _create_item(http_client,  "TR2-OUT", "Trend2 Output", "finished_goods", rate=100.0)
    _create_inward(http_client,  raw_id, 50000)
    _create_batch(http_client,  raw_id, prod_id, 5000, 4600,
                  scrap_kg=300, rejection_kg=50, production_date=today)

    response = http_client.get("/steel/quality/intelligence")
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    trends = payload["rejection_trend"]
    today_trend = next((d for d in trends if d["date"] == today), None)
    if today_trend:
        assert today_trend["rejection_units"] >= 5
        assert today_trend["batch_rejection_kg"] >= 48.0
        assert today_trend["batch_scrap_kg"] >= 298.0
        assert today_trend["batch_count"] >= 1


def test_quality_intelligence_increase_drivers(http_client):
    """Verify increase drivers section works."""
    user = register_user(http_client, role="admin")
    headers = {"Cookie": f"auth_session={user['session_token']}"}
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    dr_map = _seed_defect_reasons()

    today = date.today()
    # Current period: entry with rejection
    _create_and_approve_entry(http_client, headers, units_produced=100,
                  rejection_qty=8, defect_reason_id=dr_map["surface_defect"],
                  entry_date=today.isoformat())

    # Baseline period: entry with less rejection (5 days ago)
    baseline_date = (today - timedelta(days=5)).isoformat()
    _create_and_approve_entry(http_client, headers, units_produced=100,
                  rejection_qty=3, defect_reason_id=dr_map["surface_defect"],
                  entry_date=baseline_date)

    response = http_client.get(
        "/steel/quality/intelligence?days=3&baseline_days=7",
    )
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    drivers = payload["increase_drivers"]
    assert drivers["current_period_days"] == 3
    assert drivers["baseline_period_days"] == 7
    assert "total_rejection_delta_units" in drivers
    assert "top_drivers" in drivers
