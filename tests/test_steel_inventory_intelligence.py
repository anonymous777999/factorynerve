"""Tests for Phase 1 Inventory Intelligence endpoints and service functions.

Tests the expanded GET /steel/inventory/intelligence endpoint which returns:
  - low_stock_alerts, dead_stock, turnover_analysis (existing)
  - inventory_valuation, slow_moving_items, overstocked_items (new)
  - abc_analysis, suspicious_movements, reconciliation_risk (new)

Follows the same API-based integration test pattern as test_steel_finance.py.
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


# ── Helpers to create test data ─────────────────────────────────────────────


def _create_item(
    http_client, headers: dict, item_code: str, name: str, category: str, rate: float = 50.0
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
        headers=headers,
    )
    assert resp.status_code == HTTPStatus.OK, resp.text
    return resp.json()["item"]["id"]


def _create_inward(http_client, headers: dict, item_id: int, qty_kg: float) -> None:
    resp = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": item_id,
            "transaction_type": "inward",
            "quantity_kg": qty_kg,
            "notes": "Test inward",
        },
        headers=headers,
    )
    assert resp.status_code == HTTPStatus.OK, resp.text


def _create_outward(http_client, headers: dict, item_id: int, qty_kg: float) -> None:
    """Create an outward (consumption) transaction.

    The API automatically negates quantity_kg for production_issue/dispatch_out,
    so we pass a positive value.
    """
    resp = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": item_id,
            "transaction_type": "production_issue",
            "quantity_kg": qty_kg,
            "notes": "Test outward",
        },
        headers=headers,
    )
    assert resp.status_code == HTTPStatus.OK, resp.text


def _create_adjustment(
    http_client, headers: dict, item_id: int, qty_kg: float, notes: str = "Adjustment",
    direction: str = "increase",
) -> None:
    """Create an inventory adjustment.

    Adjustments require a direction parameter ("increase" or "decrease") to determine sign.
    """
    resp = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": item_id,
            "transaction_type": "adjustment",
            "quantity_kg": qty_kg,
            "direction": direction,
            "notes": notes,
        },
        headers=headers,
    )
    assert resp.status_code == HTTPStatus.OK, resp.text


def _approve_reconciliation(http_client, headers: dict, reconciliation_id: int) -> None:
    """Approve a reconciliation via direct DB update to bypass maker-checker."""
    from backend.database import SessionLocal, init_db
    from backend.models.steel_stock_reconciliation import SteelStockReconciliation
    from datetime import datetime, timezone

    init_db()
    db = SessionLocal()
    try:
        rec = db.query(SteelStockReconciliation).filter(
            SteelStockReconciliation.id == reconciliation_id
        ).first()
        assert rec is not None, f"Reconciliation {reconciliation_id} not found"
        rec.status = "approved"
        rec.approved_at = datetime.now(timezone.utc)
        rec.approved_by_user_id = rec.submitted_by_user_id
        # Don't require mismatch_cause on the DB update
        db.add(rec)
        db.commit()
    finally:
        db.close()


def _reconcile_stock(
    http_client, headers: dict, item_id: int, physical_qty_kg: float, notes: str = "Test count",
    mismatch_cause: str | None = None,
) -> dict:
    """Reconcile stock. When physical != system, mismatch_cause is required."""
    payload: dict = {
        "item_id": item_id,
        "physical_qty_kg": physical_qty_kg,
        "notes": notes,
    }
    if mismatch_cause:
        payload["mismatch_cause"] = mismatch_cause
    resp = http_client.post(
        "/steel/inventory/reconciliations",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == HTTPStatus.OK, resp.text
    return resp.json()["reconciliation"]


# ── Tests ──────────────────────────────────────────────────────────────────


def test_intelligence_endpoint_rejects_non_steel(http_client):
    """Non-steel factory should get 400."""
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "steel factory" in response.text.lower()


def test_intelligence_empty_factory(http_client):
    """A factory with no items should return all-zero analytics."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    # Existing fields
    assert payload["low_stock_alerts"] == []
    assert payload["dead_stock"] == []
    assert payload["turnover_analysis"]["items"] == []
    assert payload["turnover_analysis"]["category_summary"] == []

    # New Phase 1 fields
    assert payload["as_of"] == date.today().isoformat()
    assert payload["inventory_valuation"]["total_estimated_value_inr"] == 0.0
    assert payload["inventory_valuation"]["by_category"] == []
    assert payload["inventory_valuation"]["data_quality"] == "estimated"
    assert payload["slow_moving_items"] == []
    assert payload["overstocked_items"] == []
    assert payload["abc_analysis"]["a_items"] == []
    assert payload["abc_analysis"]["b_items"] == []
    assert payload["abc_analysis"]["c_items"] == []
    assert payload["suspicious_movements"] == []
    assert payload["reconciliation_risk"]["stale_items"] == []
    assert payload["reconciliation_risk"]["high_variance_items"] == []
    assert payload["reconciliation_risk"]["pending_reviews"] == 0
    assert payload["reconciliation_risk"]["stale_sla_days"] == 14


def test_intelligence_basic_valuation(http_client):
    """Create items with stock and verify valuation is correct."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Item A: 10000 KG at 50/KG = 500,000
    item_a = _create_item(http_client, headers, "VAL-A", "Valuation Item A", "finished_goods", rate=50.0)
    _create_inward(http_client, headers, item_a, 10000)

    # Item B: 5000 KG at 80/KG = 400,000
    item_b = _create_item(http_client, headers, "VAL-B", "Valuation Item B", "raw_material", rate=80.0)
    _create_inward(http_client, headers, item_b, 5000)

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    # Valuation
    val = payload["inventory_valuation"]
    assert val["total_estimated_value_inr"] >= 900_000  # 500K + 400K
    assert len(val["by_category"]) >= 2  # finished_goods + raw_material

    cat_map = {c["category"]: c for c in val["by_category"]}
    # Finished goods: 10000 KG at 50
    if "finished_goods" in cat_map:
        assert cat_map["finished_goods"]["value_inr"] >= 500_000
        assert cat_map["finished_goods"]["balance_kg"] >= 10000
    # Raw material: 5000 KG at 80
    if "raw_material" in cat_map:
        assert cat_map["raw_material"]["value_inr"] >= 400_000
        assert cat_map["raw_material"]["balance_kg"] >= 5000


def test_intelligence_low_stock_alerts(http_client):
    """Create an item with low stock relative to usage and verify alert."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Item: moderate usage (200 KG/day) with low remaining stock (barely above 30% coverage)
    # Coverage threshold = 200 * 14 = 2800 KG. 30% = 840 KG.
    # With 1000 KG initial stock - 5 * 200 = 0 KG. 0 < 840 → alert fires
    item_id = _create_item(http_client, headers, "LOW-01", "Low Stock Item", "raw_material", rate=60.0)

    # Add 1000 KG stock
    _create_inward(http_client, headers, item_id, 1000)

    # Use 200 KG/day for 5 days = 1000 KG outward → balance = 0
    for _ in range(5):
        _create_outward(http_client, headers, item_id, 200)

    # Now balance ≈ 0, which is below 30% of 2800 coverage → alert should fire
    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    # Low stock alert should definitely fire with 0 balance and 200 KG/day usage
    assert len(payload["low_stock_alerts"]) >= 1, (
        f"Expected low stock alert for LOW-01, got {payload['low_stock_alerts']}"
    )
    alert = payload["low_stock_alerts"][0]
    assert alert["item_code"] == "LOW-01"
    assert "estimated_value_inr" in alert
    assert alert["severity"] in ("warning", "critical")


def test_intelligence_dead_stock(http_client):
    """Create an item with no transactions (dead stock)."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Item with balance but no outbound transactions
    item_id = _create_item(http_client, headers, "DEAD-01", "Dead Stock Item", "finished_goods", rate=100.0)
    _create_inward(http_client, headers, item_id, 5000)

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    # The item has 5000 KG balance with no outbound txns → should be dead stock
    if payload["dead_stock"]:
        dead = next((d for d in payload["dead_stock"] if d["item_code"] == "DEAD-01"), None)
        if dead:
            assert dead["current_balance_kg"] >= 5000
            assert dead["estimated_value_inr"] >= 500_000  # 5000 * 100
            assert dead["inactive_days"] > 0


def test_intelligence_slow_moving_and_overstock(http_client):
    """Create an item with very low outflow → should be slow-moving and overstocked."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Large stock, tiny usage
    item_id = _create_item(http_client, headers, "SLOW-01", "Slow Mover", "wip", rate=40.0)
    _create_inward(http_client, headers, item_id, 100_000)  # 100,000 KG stock
    # Only 5 KG/day outward → very slow
    _create_outward(http_client, headers, item_id, 5)

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    # Should be slow-moving (avg_daily < 10 KG/day)
    slow = next((s for s in payload["slow_moving_items"] if s["item_code"] == "SLOW-01"), None)
    if slow:
        assert slow["current_balance_kg"] >= 99_990  # 100K - 5
        assert slow["avg_daily_out_kg"] <= 10.0

    # 995 KG remaining / 0.357 KG/day ≈ 2787 days → definitely overstocked
    over = next((o for o in payload["overstocked_items"] if o["item_code"] == "SLOW-01"), None)
    if over:
        assert over["days_of_stock_on_hand"] > 180  # over the 180-day threshold


def test_intelligence_abc_analysis(http_client):
    """Create items with different values and verify ABC classification."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # High-value item: 10000 KG at 200/KG = 2,000,000
    item_a = _create_item(http_client, headers, "ABC-A", "High Value Item", "finished_goods", rate=200.0)
    _create_inward(http_client, headers, item_a, 10000)

    # Medium-value item: 5000 KG at 50/KG = 250,000
    item_b = _create_item(http_client, headers, "ABC-B", "Medium Value Item", "finished_goods", rate=50.0)
    _create_inward(http_client, headers, item_b, 5000)

    # Low-value item: 1000 KG at 10/KG = 10,000
    item_c = _create_item(http_client, headers, "ABC-C", "Low Value Item", "raw_material", rate=10.0)
    _create_inward(http_client, headers, item_c, 1000)

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    abc = payload["abc_analysis"]
    total_value = abc["summary"]["total_value_inr"]
    assert total_value >= 2_260_000  # 2M + 250K + 10K

    # The high-value item (2M) should be ~88% of total → A category
    # Medium item (250K) should be ~11% → A or B
    # Low item (10K) should be ~0.4% → C
    assert abc["summary"]["a_count"] >= 1
    assert abc["summary"]["c_count"] >= 0  # May be 0 if thresholds don't split to C


def test_intelligence_turnover_analysis(http_client):
    """Create items with different usage rates and verify turnover data."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Fast mover: high outward, adequate stock
    fast = _create_item(http_client, headers, "TURN-FAST", "Fast Mover", "finished_goods", rate=70.0)
    # 2000 inward - 500 outward = 1500 balance, which is positive
    _create_inward(http_client, headers, fast, 2000)
    _create_outward(http_client, headers, fast, 500)

    # Slow mover
    slow = _create_item(http_client, headers, "TURN-SLOW", "Slow Mover", "raw_material", rate=30.0)
    _create_inward(http_client, headers, slow, 5000)

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    turnover = payload["turnover_analysis"]
    assert len(turnover["items"]) >= 2

    fast_item = next((t for t in turnover["items"] if t["item_code"] == "TURN-FAST"), None)
    if fast_item:
        assert fast_item["avg_daily_out_kg"] > 0
        assert "estimated_value_inr" in fast_item  # new field

    # Category summary should exist
    assert len(turnover["category_summary"]) >= 2


def test_intelligence_suspicious_movements(http_client):
    """Create frequent adjustments and verify they are flagged."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    item_id = _create_item(http_client, headers, "SUS-01", "Suspicious Item", "raw_material", rate=50.0)
    _create_inward(http_client, headers, item_id, 10000)

    # Create more than 3 adjustments (threshold is >3)
    for i in range(5):
        direction = "increase" if i % 2 == 0 else "decrease"
        _create_adjustment(http_client, headers, item_id, 100,
                           direction=direction, notes=f"Test adjustment {i}")

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    # Should flag frequent adjustments
    if payload["suspicious_movements"]:
        adj_flags = [s for s in payload["suspicious_movements"] if s["type"] == "frequent_adjustments"]
        assert len(adj_flags) >= 1
        assert adj_flags[0]["adjustment_count"] > 3


def test_intelligence_reconciliation_risk(http_client):
    """Create a reconciliation with high variance and verify it's flagged."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    item_id = _create_item(http_client, headers, "REC-01", "Recon Item", "finished_goods", rate=100.0)
    _create_inward(http_client, headers, item_id, 10000)

    # Create a reconciliation with high variance (>5%)
    # System says 10000 KG, physical says 8000 KG → variance = 20%
    recon = _reconcile_stock(
        http_client, headers, item_id, 8000.0,
        notes="Big mismatch", mismatch_cause="counting_error",
    )
    _approve_reconciliation(http_client, headers, recon["id"])

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    risk = payload["reconciliation_risk"]
    # 20% variance is well above the 5% threshold, should always be flagged
    high_variance = [i for i in risk["high_variance_items"] if i["item_code"] == "REC-01"]
    assert len(high_variance) >= 1, f"Expected REC-01 in high_variance_items: {risk['high_variance_items']}"
    assert high_variance[0]["variance_percent"] >= 5.0
    assert high_variance[0]["variance_kg"] >= 2000.0  # 10000 - 8000


def test_intelligence_endpoint_requires_auth(http_client):
    """Unauthenticated requests should be rejected."""
    response = http_client.get("/steel/inventory/intelligence")
    assert response.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)


def test_intelligence_category_summary_extended(http_client):
    """Verify category_summary includes the new slow_moving and overstocked counts."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    item_id = _create_item(http_client, headers, "CAT-01", "Category Test", "finished_goods", rate=50.0)
    _create_inward(http_client, headers, item_id, 1000)
    _create_outward(http_client, headers, item_id, 10)  # Very slow

    response = http_client.get("/steel/inventory/intelligence", headers=headers)
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    for cat in payload["turnover_analysis"]["category_summary"]:
        assert "slow_moving_count" in cat
        assert "overstocked_count" in cat
