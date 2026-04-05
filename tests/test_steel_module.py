from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus

from backend.database import SessionLocal, init_db
from backend.models.factory import Factory
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.models.user import User
from tests.utils import register_user, set_org_plan_for_user_email


def _promote_factory_to_steel(email: str) -> None:
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


def _set_reconciliation_counted_at(reconciliation_id: int, counted_at: datetime) -> None:
    init_db()
    db = SessionLocal()
    try:
        row = db.query(SteelStockReconciliation).filter(SteelStockReconciliation.id == reconciliation_id).first()
        assert row is not None
        row.counted_at = counted_at
        db.add(row)
        db.commit()
    finally:
        db.close()


def _get_reconciliation_counted_at(reconciliation_id: int) -> datetime:
    init_db()
    db = SessionLocal()
    try:
        row = db.query(SteelStockReconciliation).filter(SteelStockReconciliation.id == reconciliation_id).first()
        assert row is not None
        assert row.counted_at is not None
        return row.counted_at
    finally:
        db.close()


def test_steel_overview_rejects_non_steel_factory(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.get("/steel/overview", headers=headers)

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "steel factory" in response.text.lower()


def test_steel_inventory_and_batch_flow(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    _set_user_role(user["email"], "owner")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    scrap = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "SCRAP-01",
            "name": "Scrap Iron",
            "category": "raw_material",
            "display_unit": "kg",
            "current_rate_per_kg": 45,
        },
        headers=headers,
    )
    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "ROD-01",
            "name": "Steel Rods",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 65,
        },
        headers=headers,
    )
    assert scrap.status_code == HTTPStatus.OK, scrap.text
    assert rods.status_code == HTTPStatus.OK, rods.text

    scrap_id = scrap.json()["item"]["id"]
    rods_id = rods.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": scrap_id,
            "transaction_type": "inward",
            "quantity_kg": 10000,
            "notes": "Initial raw material inward",
        },
        headers=headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    stock_before_reconcile = http_client.get("/steel/inventory/stock", headers=headers)
    assert stock_before_reconcile.status_code == HTTPStatus.OK, stock_before_reconcile.text
    scrap_row = next(row for row in stock_before_reconcile.json()["items"] if row["item_id"] == scrap_id)
    assert scrap_row["stock_balance_kg"] == 10000
    assert scrap_row["confidence_status"] == "yellow"

    reconcile = http_client.post(
        "/steel/inventory/reconciliations",
        json={
            "item_id": scrap_id,
            "physical_qty_kg": 10000,
            "notes": "Verified on floor",
        },
        headers=headers,
    )
    assert reconcile.status_code == HTTPStatus.OK, reconcile.text
    assert reconcile.json()["reconciliation"]["confidence_status"] == "green"

    batch = http_client.post(
        "/steel/batches",
        json={
            "production_date": date.today().isoformat(),
            "input_item_id": scrap_id,
            "output_item_id": rods_id,
            "input_quantity_kg": 10000,
            "expected_output_kg": 9500,
            "actual_output_kg": 9200,
            "notes": "Abnormal loss check",
        },
        headers=headers,
    )
    assert batch.status_code == HTTPStatus.OK, batch.text
    batch_payload = batch.json()["batch"]
    assert batch_payload["batch_code"].startswith("ST-")
    assert batch_payload["variance_kg"] == 300
    assert batch_payload["severity"] in {"high", "critical"}

    overview = http_client.get("/steel/overview", headers=headers)
    assert overview.status_code == HTTPStatus.OK, overview.text
    overview_payload = overview.json()
    assert overview_payload["inventory_totals"]["raw_material_kg"] == 0
    assert overview_payload["inventory_totals"]["finished_goods_kg"] == 9200
    assert overview_payload["top_loss_batch"]["batch_code"] == batch_payload["batch_code"]
    assert overview_payload["batch_metrics"]["high_severity_batches"] >= 1
    assert overview_payload["profit_summary"]["estimated_input_cost_inr"] == 450000
    assert overview_payload["profit_summary"]["estimated_output_value_inr"] == 598000
    assert overview_payload["profit_summary"]["estimated_gross_profit_inr"] == 148000
    assert overview_payload["anomaly_summary"]["total_estimated_leakage_value_inr"] == 19500
    assert overview_payload["ranked_anomalies"][0]["batch"]["batch_code"] == batch_payload["batch_code"]
    assert overview_payload["ranked_anomalies"][0]["reason"]
    assert overview_payload["responsibility_analytics"]["by_operator"][0]["total_variance_kg"] == 300
    assert overview_payload["responsibility_analytics"]["by_operator"][0]["total_estimated_gross_profit_inr"] == 148000
    assert overview_payload["responsibility_analytics"]["by_day"][0]["date"] == date.today().isoformat()
    assert overview_payload["responsibility_analytics"]["by_batch"][0]["batch_code"] == batch_payload["batch_code"]

    detail = http_client.get(f"/steel/batches/{batch_payload['id']}", headers=headers)
    assert detail.status_code == HTTPStatus.OK, detail.text
    detail_payload = detail.json()
    assert detail_payload["batch"]["batch_code"] == batch_payload["batch_code"]
    assert detail_payload["traceability"]["input_item"]["movement"]["balance_before_kg"] == 10000
    assert detail_payload["traceability"]["input_item"]["movement"]["balance_after_kg"] == 0
    assert detail_payload["traceability"]["output_item"]["movement"]["balance_before_kg"] == 0
    assert detail_payload["traceability"]["output_item"]["movement"]["balance_after_kg"] == 9200
    assert len(detail_payload["inventory_movements"]) == 2
    assert any(event["action"] == "STEEL_BATCH_RECORDED" for event in detail_payload["audit_events"])


def test_steel_ledger_blocks_negative_stock(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    scrap = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "SCRAP-NEG",
            "name": "Scrap Iron",
            "category": "raw_material",
            "display_unit": "kg",
        },
        headers=headers,
    )
    assert scrap.status_code == HTTPStatus.OK, scrap.text
    scrap_id = scrap.json()["item"]["id"]

    blocked = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": scrap_id,
            "transaction_type": "dispatch_out",
            "quantity_kg": 1,
            "notes": "Should fail",
        },
        headers=headers,
    )
    assert blocked.status_code == HTTPStatus.BAD_REQUEST
    assert "negative" in blocked.text.lower()


def test_steel_inventory_item_rejects_email_like_item_code(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "scrap@example.com",
            "name": "Scrap Iron",
            "category": "raw_material",
            "display_unit": "kg",
        },
        headers=headers,
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, response.text
    assert "Item code cannot be an email address." in response.text


def test_steel_overview_redacts_owner_financials_for_manager(http_client):
    user = register_user(http_client, role="manager")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    overview = http_client.get("/steel/overview", headers=headers)

    assert overview.status_code == HTTPStatus.OK, overview.text
    payload = overview.json()
    assert payload["financial_access"] is False
    assert payload["profit_summary"] is None
    assert payload["anomaly_summary"]["total_estimated_leakage_value_inr"] is None


def test_steel_overview_financials_require_owner_role(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    admin_overview = http_client.get("/steel/overview", headers=headers)
    assert admin_overview.status_code == HTTPStatus.OK, admin_overview.text
    assert admin_overview.json()["financial_access"] is False

    _set_user_role(user["email"], "owner")
    owner_overview = http_client.get("/steel/overview", headers=headers)
    assert owner_overview.status_code == HTTPStatus.OK, owner_overview.text
    assert owner_overview.json()["financial_access"] is True
    assert owner_overview.json()["profit_summary"] is not None


def test_steel_weight_invoice_flow(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "TMT-01",
            "name": "TMT Bars",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 65,
        },
        headers=headers,
    )
    assert rods.status_code == HTTPStatus.OK, rods.text
    rods_id = rods.json()["item"]["id"]

    output_inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": rods_id,
            "transaction_type": "inward",
            "quantity_kg": 5200,
            "notes": "Finished rods ready for sale",
        },
        headers=headers,
    )
    assert output_inward.status_code == HTTPStatus.OK, output_inward.text

    invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": date.today().isoformat(),
            "customer_name": "Sharma Buildmart",
            "notes": "Weight based billing test",
            "lines": [
                {
                    "item_id": rods_id,
                    "description": "Primary TMT dispatch bill",
                    "weight_kg": 2350,
                    "rate_per_kg": 65,
                }
            ],
        },
        headers=headers,
    )
    assert invoice.status_code == HTTPStatus.OK, invoice.text
    invoice_payload = invoice.json()["invoice"]
    assert invoice_payload["invoice_number"].startswith("SINV-")
    assert invoice_payload["total_weight_kg"] == 2350
    assert invoice_payload["total_amount"] == 152750
    assert invoice_payload["lines"][0]["line_total"] == 152750

    listed = http_client.get("/steel/invoices", headers=headers)
    assert listed.status_code == HTTPStatus.OK, listed.text
    assert any(row["id"] == invoice_payload["id"] for row in listed.json()["items"])

    detail = http_client.get(f"/steel/invoices/{invoice_payload['id']}", headers=headers)
    assert detail.status_code == HTTPStatus.OK, detail.text
    detail_payload = detail.json()
    assert detail_payload["invoice"]["customer_name"] == "Sharma Buildmart"
    assert detail_payload["invoice"]["lines"][0]["item_code"] == "TMT-01"
    assert detail_payload["dispatch_summary"]["dispatch_count"] == 0
    assert detail_payload["dispatches"] == []
    assert any(event["action"] == "STEEL_INVOICE_CREATED" for event in detail_payload["audit_events"])


def test_steel_dispatch_gate_pass_flow(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "TMT-DISP",
            "name": "TMT Bars Dispatch",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 68,
        },
        headers=headers,
    )
    assert rods.status_code == HTTPStatus.OK, rods.text
    rods_id = rods.json()["item"]["id"]

    output_inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": rods_id,
            "transaction_type": "inward",
            "quantity_kg": 5200,
            "notes": "Finished goods for dispatch",
        },
        headers=headers,
    )
    assert output_inward.status_code == HTTPStatus.OK, output_inward.text

    invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": date.today().isoformat(),
            "customer_name": "Verma Traders",
            "lines": [
                {
                    "item_id": rods_id,
                    "weight_kg": 2350,
                    "rate_per_kg": 68,
                }
            ],
        },
        headers=headers,
    )
    assert invoice.status_code == HTTPStatus.OK, invoice.text
    invoice_payload = invoice.json()["invoice"]
    invoice_line_id = invoice_payload["lines"][0]["id"]

    dispatch = http_client.post(
        "/steel/dispatches",
        json={
            "invoice_id": invoice_payload["id"],
            "dispatch_date": date.today().isoformat(),
            "truck_number": "RJ14-GA-7788",
            "driver_name": "Suresh Yadav",
            "driver_phone": "+919999999999",
            "notes": "Morning gate pass",
            "lines": [
                {
                    "invoice_line_id": invoice_line_id,
                    "weight_kg": 2000,
                }
            ],
        },
        headers=headers,
    )
    assert dispatch.status_code == HTTPStatus.OK, dispatch.text
    dispatch_payload = dispatch.json()["dispatch"]
    assert dispatch_payload["dispatch_number"].startswith("SDISP-")
    assert dispatch_payload["gate_pass_number"].startswith("GP-")
    assert dispatch_payload["total_weight_kg"] == 2000

    listed = http_client.get("/steel/dispatches", headers=headers)
    assert listed.status_code == HTTPStatus.OK, listed.text
    assert any(row["id"] == dispatch_payload["id"] for row in listed.json()["items"])

    detail = http_client.get(f"/steel/dispatches/{dispatch_payload['id']}", headers=headers)
    assert detail.status_code == HTTPStatus.OK, detail.text
    detail_payload = detail.json()
    assert detail_payload["dispatch"]["truck_number"] == "RJ14-GA-7788"
    assert detail_payload["dispatch"]["lines"][0]["invoice_line_id"] == invoice_line_id
    assert any(event["action"] == "STEEL_DISPATCH_CREATED" for event in detail_payload["audit_events"])
    assert any(movement["transaction_type"] == "dispatch_out" for movement in detail_payload["ledger_movements"])

    stock = http_client.get("/steel/inventory/stock", headers=headers)
    assert stock.status_code == HTTPStatus.OK, stock.text
    row = next(item for item in stock.json()["items"] if item["item_id"] == rods_id)
    assert row["stock_balance_kg"] == 3200

    invoice_detail = http_client.get(f"/steel/invoices/{invoice_payload['id']}", headers=headers)
    assert invoice_detail.status_code == HTTPStatus.OK, invoice_detail.text
    assert invoice_detail.json()["invoice"]["lines"][0]["remaining_weight_kg"] == 350
    assert invoice_detail.json()["dispatch_summary"]["dispatch_count"] == 1
    assert invoice_detail.json()["dispatch_summary"]["dispatched_weight_kg"] == 2000
    assert invoice_detail.json()["dispatches"][0]["dispatch_number"] == dispatch_payload["dispatch_number"]

    over_dispatch = http_client.post(
        "/steel/dispatches",
        json={
            "invoice_id": invoice_payload["id"],
            "dispatch_date": date.today().isoformat(),
            "truck_number": "RJ14-GA-9999",
            "driver_name": "Over Weight",
            "lines": [
                {
                    "invoice_line_id": invoice_line_id,
                    "weight_kg": 400,
                }
            ],
        },
        headers=headers,
    )
    assert over_dispatch.status_code == HTTPStatus.BAD_REQUEST
    assert "remaining invoice quantity" in over_dispatch.text


def test_steel_dispatch_draft_progression_posts_inventory_only_on_dispatch(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "TMT-DRAFT",
            "name": "Draft Dispatch Bars",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 72,
        },
        headers=headers,
    )
    assert rods.status_code == HTTPStatus.OK, rods.text
    rods_id = rods.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": rods_id,
            "transaction_type": "inward",
            "quantity_kg": 3000,
            "notes": "Draft dispatch stock",
        },
        headers=headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": date.today().isoformat(),
            "customer_name": "Draft Dispatch Buyer",
            "lines": [
                {
                    "item_id": rods_id,
                    "weight_kg": 1200,
                    "rate_per_kg": 72,
                }
            ],
        },
        headers=headers,
    )
    assert invoice.status_code == HTTPStatus.OK, invoice.text
    invoice_payload = invoice.json()["invoice"]
    invoice_line_id = invoice_payload["lines"][0]["id"]

    draft = http_client.post(
        "/steel/dispatches",
        json={
            "invoice_id": invoice_payload["id"],
            "dispatch_date": date.today().isoformat(),
            "truck_number": "MH12-DRAFT-1",
            "transporter_name": "Draft Logistics",
            "truck_capacity_kg": 1500,
            "driver_name": "Mahesh",
            "status": "pending",
            "lines": [{"invoice_line_id": invoice_line_id, "weight_kg": 1000}],
        },
        headers=headers,
    )
    assert draft.status_code == HTTPStatus.OK, draft.text
    draft_payload = draft.json()["dispatch"]
    assert draft_payload["status"] == "pending"
    assert draft_payload["inventory_posted_at"] is None

    draft_detail = http_client.get(f"/steel/dispatches/{draft_payload['id']}", headers=headers)
    assert draft_detail.status_code == HTTPStatus.OK, draft_detail.text
    assert draft_detail.json()["ledger_movements"] == []

    stock_before_post = http_client.get("/steel/inventory/stock", headers=headers)
    assert stock_before_post.status_code == HTTPStatus.OK, stock_before_post.text
    stock_before_row = next(item for item in stock_before_post.json()["items"] if item["item_id"] == rods_id)
    assert stock_before_row["stock_balance_kg"] == 3000

    loaded = http_client.post(
        f"/steel/dispatches/{draft_payload['id']}/status",
        json={"status": "loaded"},
        headers=headers,
    )
    assert loaded.status_code == HTTPStatus.OK, loaded.text
    assert loaded.json()["dispatch"]["status"] == "loaded"
    assert loaded.json()["dispatch"]["inventory_posted_at"] is None

    dispatched = http_client.post(
        f"/steel/dispatches/{draft_payload['id']}/status",
        json={"status": "dispatched"},
        headers=headers,
    )
    assert dispatched.status_code == HTTPStatus.OK, dispatched.text
    dispatched_payload = dispatched.json()["dispatch"]
    assert dispatched_payload["status"] == "dispatched"
    assert dispatched_payload["inventory_posted_at"] is not None

    stock_after_post = http_client.get("/steel/inventory/stock", headers=headers)
    assert stock_after_post.status_code == HTTPStatus.OK, stock_after_post.text
    stock_after_row = next(item for item in stock_after_post.json()["items"] if item["item_id"] == rods_id)
    assert stock_after_row["stock_balance_kg"] == 2000

    delivered = http_client.post(
        f"/steel/dispatches/{draft_payload['id']}/status",
        json={
            "status": "delivered",
            "receiver_name": "Store Receiver",
            "pod_notes": "Material received and signed.",
        },
        headers=headers,
    )
    assert delivered.status_code == HTTPStatus.OK, delivered.text
    delivered_payload = delivered.json()["dispatch"]
    assert delivered_payload["status"] == "delivered"
    assert delivered_payload["delivered_at"] is not None
    assert delivered_payload["receiver_name"] == "Store Receiver"
    assert delivered_payload["pod_notes"] == "Material received and signed."


def test_steel_customer_ledger_and_payments(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "TMT-CUST",
            "name": "Customer Ledger Bars",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 70,
        },
        headers=headers,
    )
    assert rods.status_code == HTTPStatus.OK, rods.text
    rods_id = rods.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": rods_id,
            "transaction_type": "inward",
            "quantity_kg": 6000,
            "notes": "Finished goods for customer ledger",
        },
        headers=headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": date.today().isoformat(),
            "customer_name": "Mahadev Steels Buyer",
            "lines": [
                {
                    "item_id": rods_id,
                    "weight_kg": 2000,
                    "rate_per_kg": 70,
                }
            ],
        },
        headers=headers,
    )
    assert invoice.status_code == HTTPStatus.OK, invoice.text
    invoice_payload = invoice.json()["invoice"]
    assert invoice_payload["customer_id"] is not None

    customers = http_client.get("/steel/customers", headers=headers)
    assert customers.status_code == HTTPStatus.OK, customers.text
    customer = next(row for row in customers.json()["items"] if row["id"] == invoice_payload["customer_id"])
    assert customer["outstanding_amount_inr"] == 140000

    payment = http_client.post(
        "/steel/customers/payments",
        json={
            "customer_id": customer["id"],
            "invoice_id": invoice_payload["id"],
            "payment_date": date.today().isoformat(),
            "amount": 50000,
            "payment_mode": "bank_transfer",
            "reference_number": "UTR-STEEL-001",
        },
        headers=headers,
    )
    assert payment.status_code == HTTPStatus.OK, payment.text

    ledger = http_client.get(f"/steel/customers/{customer['id']}", headers=headers)
    assert ledger.status_code == HTTPStatus.OK, ledger.text
    ledger_payload = ledger.json()
    assert ledger_payload["ledger_summary"]["invoice_total_inr"] == 140000
    assert ledger_payload["ledger_summary"]["payments_total_inr"] == 50000
    assert ledger_payload["ledger_summary"]["outstanding_amount_inr"] == 90000
    assert ledger_payload["invoices"][0]["paid_amount_inr"] == 50000
    assert ledger_payload["invoices"][0]["outstanding_amount_inr"] == 90000
    assert ledger_payload["payments"][0]["invoice_number"] == invoice_payload["invoice_number"]


def test_steel_customer_follow_up_tasks_feed_lifecycle_alerts(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    customer = http_client.post(
        "/steel/customers",
        json={
            "name": "Recovery Buyer",
            "status": "on_hold",
            "credit_limit": 100000,
            "payment_terms_days": 15,
        },
        headers=headers,
    )
    assert customer.status_code == HTTPStatus.OK, customer.text
    customer_id = customer.json()["customer"]["id"]

    task = http_client.post(
        f"/steel/customers/{customer_id}/tasks",
        json={
            "title": "Call for payment commitment",
            "priority": "high",
            "due_date": date.today().isoformat(),
            "note": "Confirm promised collection date.",
        },
        headers=headers,
    )
    assert task.status_code == HTTPStatus.OK, task.text
    task_payload = task.json()["task"]
    assert task_payload["status"] == "open"
    assert task_payload["priority"] == "high"

    ledger = http_client.get(f"/steel/customers/{customer_id}", headers=headers)
    assert ledger.status_code == HTTPStatus.OK, ledger.text
    ledger_payload = ledger.json()
    assert ledger_payload["customer"]["open_follow_up_count"] == 1
    assert ledger_payload["follow_up_tasks"][0]["title"] == "Call for payment commitment"
    alert_titles = {alert["title"] for alert in ledger_payload["alerts"]}
    assert "Customer is on hold" in alert_titles
    assert "Collection follow-up open" in alert_titles

    in_progress = http_client.post(
        f"/steel/customers/{customer_id}/tasks/{task_payload['id']}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert in_progress.status_code == HTTPStatus.OK, in_progress.text
    assert in_progress.json()["task"]["status"] == "in_progress"
    assert in_progress.json()["task"]["completed_at"] is None

    done = http_client.post(
        f"/steel/customers/{customer_id}/tasks/{task_payload['id']}/status",
        json={"status": "done"},
        headers=headers,
    )
    assert done.status_code == HTTPStatus.OK, done.text
    done_payload = done.json()["task"]
    assert done_payload["status"] == "done"
    assert done_payload["completed_at"] is not None

    customers = http_client.get("/steel/customers", headers=headers)
    assert customers.status_code == HTTPStatus.OK, customers.text
    customer_row = next(row for row in customers.json()["items"] if row["id"] == customer_id)
    assert customer_row["open_follow_up_count"] == 0
    assert customer_row["next_follow_up_date"] is None


def test_steel_customer_lifecycle_fields_and_credit_limit_block(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "TMT-LIFE",
            "name": "Lifecycle Bars",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 50,
        },
        headers=headers,
    )
    assert rods.status_code == HTTPStatus.OK, rods.text
    rods_id = rods.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": rods_id,
            "transaction_type": "inward",
            "quantity_kg": 8000,
            "notes": "Lifecycle stock",
        },
        headers=headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    customer = http_client.post(
        "/steel/customers",
        json={
            "name": "Lifecycle Buyer",
            "phone": "+919876543210",
            "gst_number": "27ABCDE1234F1Z5",
            "pan_number": "ABCDE1234F",
            "company_type": "trader",
            "contact_person": "Ramesh Sharma",
            "designation": "Purchase Manager",
            "credit_limit": 200000,
            "payment_terms_days": 30,
            "status": "active",
        },
        headers=headers,
    )
    assert customer.status_code == HTTPStatus.OK, customer.text
    customer_payload = customer.json()["customer"]
    assert customer_payload["customer_code"].startswith("CUST-")
    assert customer_payload["gst_number"] == "27ABCDE1234F1Z5"
    assert customer_payload["credit_limit"] == 200000
    assert customer_payload["payment_terms_days"] == 30

    invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": date.today().isoformat(),
            "customer_id": customer_payload["id"],
            "lines": [
                {
                    "item_id": rods_id,
                    "weight_kg": 3000,
                    "rate_per_kg": 50,
                }
            ],
        },
        headers=headers,
    )
    assert invoice.status_code == HTTPStatus.OK, invoice.text
    invoice_payload = invoice.json()["invoice"]
    assert invoice_payload["payment_terms_days"] == 30
    assert invoice_payload["due_date"] == (date.today() + timedelta(days=30)).isoformat()

    blocked = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": date.today().isoformat(),
            "customer_id": customer_payload["id"],
            "lines": [
                {
                    "item_id": rods_id,
                    "weight_kg": 1200,
                    "rate_per_kg": 50,
                }
            ],
        },
        headers=headers,
    )
    assert blocked.status_code == HTTPStatus.CONFLICT, blocked.text
    assert "credit limit" in blocked.text.lower()


def test_steel_customer_verification_flow(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    customer = http_client.post(
        "/steel/customers",
        json={
            "name": "Verified Buyer LLP",
            "state": "Maharashtra",
            "gst_number": "27ABCDE1234F1Z5",
            "pan_number": "ABCDE1234F",
        },
        headers=headers,
    )
    assert customer.status_code == HTTPStatus.OK, customer.text
    customer_payload = customer.json()["customer"]
    customer_id = customer_payload["id"]
    assert customer_payload["verification_status"] == "format_valid"

    checked = http_client.post(
        f"/steel/customers/{customer_id}/verification/run-check",
        headers=headers,
    )
    assert checked.status_code == HTTPStatus.OK, checked.text
    checked_customer = checked.json()["customer"]
    assert checked_customer["verification_status"] == "format_valid"
    assert checked_customer["match_score"] == 60

    upload_pan = http_client.post(
        f"/steel/customers/{customer_id}/verification-documents/pan",
        files={"file": ("pan-card.pdf", b"%PDF-1.4 PAN CARD", "application/pdf")},
        headers=headers,
    )
    assert upload_pan.status_code == HTTPStatus.OK, upload_pan.text
    assert upload_pan.json()["customer"]["verification_status"] == "pending_review"

    upload_gst = http_client.post(
        f"/steel/customers/{customer_id}/verification-documents/gst",
        files={"file": ("gst-cert.png", b"fake-png-binary", "image/png")},
        headers=headers,
    )
    assert upload_gst.status_code == HTTPStatus.OK, upload_gst.text
    assert upload_gst.json()["customer"]["match_score"] == 80

    approve = http_client.post(
        f"/steel/customers/{customer_id}/verification/review",
        json={
            "decision": "approve",
            "verification_source": "manual_review",
            "official_legal_name": "Verified Buyer LLP",
            "official_state": "Maharashtra",
        },
        headers=headers,
    )
    assert approve.status_code == HTTPStatus.OK, approve.text
    approved_customer = approve.json()["customer"]
    assert approved_customer["verification_status"] == "verified"
    assert approved_customer["name_match_status"] == "matched"
    assert approved_customer["state_match_status"] == "matched"
    assert approved_customer["verified_by_name"] == "QA User"
    assert approved_customer["match_score"] == 100

    ledger = http_client.get(f"/steel/customers/{customer_id}", headers=headers)
    assert ledger.status_code == HTTPStatus.OK, ledger.text
    assert ledger.json()["customer"]["verification_status"] == "verified"
    assert ledger.json()["customer"]["pan_document_url"]
    assert ledger.json()["customer"]["gst_document_url"]

    pan_doc = http_client.get(f"/steel/customers/{customer_id}/verification-documents/pan", headers=headers)
    assert pan_doc.status_code == HTTPStatus.OK, pan_doc.text
    assert pan_doc.headers["content-type"].startswith("application/pdf")


def test_steel_customer_verification_mismatch_requires_reject(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    customer = http_client.post(
        "/steel/customers",
        json={
            "name": "Mismatch Buyer",
            "state": "Maharashtra",
            "gst_number": "27ABCDE1234F1Z5",
            "pan_number": "ZZZZZ9999Z",
        },
        headers=headers,
    )
    assert customer.status_code == HTTPStatus.OK, customer.text
    customer_id = customer.json()["customer"]["id"]

    checked = http_client.post(
        f"/steel/customers/{customer_id}/verification/run-check",
        headers=headers,
    )
    assert checked.status_code == HTTPStatus.OK, checked.text
    checked_customer = checked.json()["customer"]
    assert checked_customer["verification_status"] == "mismatch"
    assert "embedded in GSTIN" in (checked_customer["mismatch_reason"] or "")

    blocked_approve = http_client.post(
        f"/steel/customers/{customer_id}/verification/review",
        json={
            "decision": "approve",
            "verification_source": "manual_review",
            "official_legal_name": "Mismatch Buyer",
            "official_state": "Maharashtra",
        },
        headers=headers,
    )
    assert blocked_approve.status_code == HTTPStatus.BAD_REQUEST, blocked_approve.text

    rejected = http_client.post(
        f"/steel/customers/{customer_id}/verification/review",
        json={
            "decision": "reject",
            "verification_source": "manual_review",
            "mismatch_reason": "PAN and GST certificate do not belong to the same entity.",
        },
        headers=headers,
    )
    assert rejected.status_code == HTTPStatus.OK, rejected.text
    rejected_customer = rejected.json()["customer"]
    assert rejected_customer["verification_status"] == "rejected"
    assert "same entity" in (rejected_customer["mismatch_reason"] or "")


def test_steel_customer_payment_auto_allocates_oldest_invoices(http_client):
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "TMT-AUTO",
            "name": "Auto Allocate Bars",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 70,
        },
        headers=headers,
    )
    assert rods.status_code == HTTPStatus.OK, rods.text
    rods_id = rods.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": rods_id,
            "transaction_type": "inward",
            "quantity_kg": 5000,
            "notes": "Auto allocation stock",
        },
        headers=headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    customer = http_client.post(
        "/steel/customers",
        json={"name": "Auto Allocate Buyer"},
        headers=headers,
    )
    assert customer.status_code == HTTPStatus.OK, customer.text
    customer_id = customer.json()["customer"]["id"]

    first_invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": (date.today() - timedelta(days=2)).isoformat(),
            "customer_id": customer_id,
            "payment_terms_days": 0,
            "lines": [
                {
                    "item_id": rods_id,
                    "weight_kg": 1000,
                    "rate_per_kg": 70,
                }
            ],
        },
        headers=headers,
    )
    second_invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": (date.today() - timedelta(days=1)).isoformat(),
            "customer_id": customer_id,
            "payment_terms_days": 0,
            "lines": [
                {
                    "item_id": rods_id,
                    "weight_kg": 500,
                    "rate_per_kg": 70,
                }
            ],
        },
        headers=headers,
    )
    assert first_invoice.status_code == HTTPStatus.OK, first_invoice.text
    assert second_invoice.status_code == HTTPStatus.OK, second_invoice.text
    first_payload = first_invoice.json()["invoice"]
    second_payload = second_invoice.json()["invoice"]

    payment = http_client.post(
        "/steel/customers/payments",
        json={
            "customer_id": customer_id,
            "payment_date": date.today().isoformat(),
            "amount": 80000,
            "payment_mode": "bank_transfer",
            "reference_number": "AUTO-ALLOC-001",
        },
        headers=headers,
    )
    assert payment.status_code == HTTPStatus.OK, payment.text
    payment_payload = payment.json()["payment"]
    assert len(payment_payload["allocations"]) == 2

    ledger = http_client.get(f"/steel/customers/{customer_id}", headers=headers)
    assert ledger.status_code == HTTPStatus.OK, ledger.text
    invoices_by_number = {row["invoice_number"]: row for row in ledger.json()["invoices"]}
    assert invoices_by_number[first_payload["invoice_number"]]["status"] == "paid"
    assert invoices_by_number[first_payload["invoice_number"]]["outstanding_amount_inr"] == 0
    assert invoices_by_number[second_payload["invoice_number"]]["status"] == "partial"
    assert invoices_by_number[second_payload["invoice_number"]]["outstanding_amount_inr"] == 25000


def test_steel_customer_validation_rejects_bad_email_and_payment_mode(http_client):
    manager = register_user(http_client, role="manager")
    _promote_factory_to_steel(manager["email"])
    headers = {"Authorization": f"Bearer {manager['access_token']}"}

    bad_customer = http_client.post(
        "/steel/customers",
        json={
            "name": "Invalid Email Buyer",
            "email": "abc",
        },
        headers=headers,
    )
    assert bad_customer.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, bad_customer.text
    assert "email" in bad_customer.text

    created = http_client.post(
        "/steel/customers",
        json={
            "name": "Valid Ledger Buyer",
            "email": "buyer@example.com",
        },
        headers=headers,
    )
    assert created.status_code == HTTPStatus.OK, created.text
    customer_id = created.json()["customer"]["id"]

    bad_payment = http_client.post(
        "/steel/customers/payments",
        json={
            "customer_id": customer_id,
            "payment_date": date.today().isoformat(),
            "amount": 1500,
            "payment_mode": "wire_room",
        },
        headers=headers,
    )
    assert bad_payment.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, bad_payment.text
    assert "payment_mode" in bad_payment.text


def test_steel_reconciliation_approval_workflow(http_client):
    manager = register_user(http_client, role="manager")
    _promote_factory_to_steel(manager["email"])
    manager_headers = {"Authorization": f"Bearer {manager['access_token']}"}

    item = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "SCRAP-REC",
            "name": "Scrap Reconcile",
            "category": "raw_material",
            "display_unit": "kg",
            "current_rate_per_kg": 40,
        },
        headers=manager_headers,
    )
    assert item.status_code == HTTPStatus.OK, item.text
    item_id = item.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": item_id,
            "transaction_type": "inward",
            "quantity_kg": 1000,
            "notes": "Reconciliation stock",
        },
        headers=manager_headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    pending = http_client.post(
        "/steel/inventory/reconciliations",
        json={
            "item_id": item_id,
            "physical_qty_kg": 980,
            "notes": "Manager floor count",
            "mismatch_cause": "counting_error",
        },
        headers=manager_headers,
    )
    assert pending.status_code == HTTPStatus.OK, pending.text
    pending_id = pending.json()["reconciliation"]["id"]
    assert pending.json()["reconciliation"]["status"] == "pending"
    assert pending.json()["reconciliation"]["mismatch_cause"] == "counting_error"

    owner = register_user(
        http_client,
        role="admin",
        factory_name=manager["factory_name"],
        company_code=manager["company_code"],
    )
    _promote_factory_to_steel(owner["email"])
    _set_user_role(owner["email"], "owner")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    approve = http_client.post(
        f"/steel/inventory/reconciliations/{pending_id}/approve",
        json={"approver_notes": "Count validated by owner", "mismatch_cause": "counting_error"},
        headers=owner_headers,
    )
    assert approve.status_code == HTTPStatus.OK, approve.text
    assert approve.json()["reconciliation"]["status"] == "approved"
    assert approve.json()["reconciliation"]["mismatch_cause"] == "counting_error"

    history = http_client.get("/steel/inventory/reconciliations?status=approved", headers=owner_headers)
    assert history.status_code == HTTPStatus.OK, history.text
    approved_row = next(row for row in history.json()["items"] if row["id"] == pending_id)
    assert approved_row["approved_by_name"] == "QA User"
    assert approved_row["status"] == "approved"
    assert approved_row["mismatch_cause"] == "counting_error"

    second_pending = http_client.post(
        "/steel/inventory/reconciliations",
        json={
            "item_id": item_id,
            "physical_qty_kg": 930,
            "notes": "Second manager count",
            "mismatch_cause": "theft_or_leakage",
        },
        headers=manager_headers,
    )
    assert second_pending.status_code == HTTPStatus.OK, second_pending.text
    second_pending_id = second_pending.json()["reconciliation"]["id"]

    reject = http_client.post(
        f"/steel/inventory/reconciliations/{second_pending_id}/reject",
        json={
            "rejection_reason": "Count sheet mismatch",
            "approver_notes": "Recount required",
            "mismatch_cause": "theft_or_leakage",
        },
        headers=owner_headers,
    )
    assert reject.status_code == HTTPStatus.OK, reject.text
    assert reject.json()["reconciliation"]["status"] == "rejected"
    assert reject.json()["reconciliation"]["mismatch_cause"] == "theft_or_leakage"

    rejected_history = http_client.get("/steel/inventory/reconciliations?status=rejected", headers=owner_headers)
    assert rejected_history.status_code == HTTPStatus.OK, rejected_history.text
    rejected_row = next(row for row in rejected_history.json()["items"] if row["id"] == second_pending_id)
    assert rejected_row["rejection_reason"] == "Count sheet mismatch"
    assert rejected_row["status"] == "rejected"
    assert rejected_row["mismatch_cause"] == "theft_or_leakage"


def test_steel_reconciliation_requires_mismatch_cause_when_stock_differs(http_client):
    manager = register_user(http_client, role="manager")
    _promote_factory_to_steel(manager["email"])
    headers = {"Authorization": f"Bearer {manager['access_token']}"}

    item = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "SCRAP-CAUSE",
            "name": "Scrap Cause Guardrail",
            "category": "raw_material",
            "display_unit": "kg",
        },
        headers=headers,
    )
    assert item.status_code == HTTPStatus.OK, item.text
    item_id = item.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": item_id,
            "transaction_type": "inward",
            "quantity_kg": 500,
        },
        headers=headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    missing_cause = http_client.post(
        "/steel/inventory/reconciliations",
        json={
            "item_id": item_id,
            "physical_qty_kg": 450,
            "notes": "Count differs but no cause selected",
        },
        headers=headers,
    )
    assert missing_cause.status_code == HTTPStatus.BAD_REQUEST, missing_cause.text
    assert "Mismatch cause is required" in missing_cause.text


def test_steel_reconciliation_summary_reports_kpis(http_client):
    owner = register_user(http_client, role="admin")
    _promote_factory_to_steel(owner["email"])
    _set_user_role(owner["email"], "owner")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    manager = register_user(
        http_client,
        role="manager",
        factory_name=owner["factory_name"],
        company_code=owner["company_code"],
    )
    _promote_factory_to_steel(manager["email"])
    manager_headers = {"Authorization": f"Bearer {manager['access_token']}"}

    created_items = []
    for item_code, item_name in [
        ("SCRAP-SUM-1", "Summary Scrap 1"),
        ("SCRAP-SUM-2", "Summary Scrap 2"),
        ("SCRAP-SUM-3", "Summary Scrap 3"),
    ]:
        created = http_client.post(
            "/steel/inventory/items",
            json={
                "item_code": item_code,
                "name": item_name,
                "category": "raw_material",
                "display_unit": "kg",
            },
            headers=owner_headers,
        )
        assert created.status_code == HTTPStatus.OK, created.text
        created_items.append(created.json()["item"]["id"])

    for item_id in created_items[:2]:
        inward = http_client.post(
            "/steel/inventory/transactions",
            json={
                "item_id": item_id,
                "transaction_type": "inward",
                "quantity_kg": 100,
                "notes": "Summary seed stock",
            },
            headers=owner_headers,
        )
        assert inward.status_code == HTTPStatus.OK, inward.text

    matched = http_client.post(
        "/steel/inventory/reconciliations",
        json={
            "item_id": created_items[0],
            "physical_qty_kg": 100,
            "notes": "Matched count",
        },
        headers=owner_headers,
    )
    assert matched.status_code == HTTPStatus.OK, matched.text
    matched_id = matched.json()["reconciliation"]["id"]

    mismatched = http_client.post(
        "/steel/inventory/reconciliations",
        json={
            "item_id": created_items[1],
            "physical_qty_kg": 90,
            "notes": "Mismatch count",
            "mismatch_cause": "wrong_entry",
        },
        headers=owner_headers,
    )
    assert mismatched.status_code == HTTPStatus.OK, mismatched.text
    mismatched_id = mismatched.json()["reconciliation"]["id"]

    pending = http_client.post(
        "/steel/inventory/reconciliations",
        json={
            "item_id": created_items[0],
            "physical_qty_kg": 98,
            "notes": "Pending manager recount",
            "mismatch_cause": "counting_error",
        },
        headers=manager_headers,
    )
    assert pending.status_code == HTTPStatus.OK, pending.text
    assert pending.json()["reconciliation"]["status"] == "pending"
    pending_id = pending.json()["reconciliation"]["id"]

    _set_reconciliation_counted_at(mismatched_id, datetime.now(timezone.utc) - timedelta(days=20))

    summary_response = http_client.get("/steel/inventory/reconciliations/summary", headers=owner_headers)
    assert summary_response.status_code == HTTPStatus.OK, summary_response.text
    summary = summary_response.json()["summary"]

    assert summary["active_items"] == 3
    assert summary["reviewed_items"] == 2
    assert summary["matched_items"] == 1
    assert summary["mismatch_items"] == 1
    assert summary["pending_reviews"] == 1
    assert summary["stale_reviews"] == 2
    assert summary["stale_sla_days"] == 14
    assert summary["accuracy_percent"] == 50.0
    assert summary["last_review_at"] is not None

    pending_counted_at = _get_reconciliation_counted_at(pending_id)
    assert summary["last_review_at"].startswith(pending_counted_at.date().isoformat())
    assert matched_id != mismatched_id


def test_steel_reconciliation_summary_role_scope(http_client):
    owner = register_user(http_client, role="admin")
    _promote_factory_to_steel(owner["email"])
    _set_user_role(owner["email"], "owner")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    supervisor = register_user(
        http_client,
        role="supervisor",
        factory_name=owner["factory_name"],
        company_code=owner["company_code"],
    )
    _promote_factory_to_steel(supervisor["email"])
    supervisor_headers = {"Authorization": f"Bearer {supervisor['access_token']}"}

    accountant = register_user(
        http_client,
        role="accountant",
        factory_name=owner["factory_name"],
        company_code=owner["company_code"],
    )
    _promote_factory_to_steel(accountant["email"])
    accountant_headers = {"Authorization": f"Bearer {accountant['access_token']}"}

    supervisor_summary = http_client.get("/steel/inventory/reconciliations/summary", headers=supervisor_headers)
    assert supervisor_summary.status_code == HTTPStatus.OK, supervisor_summary.text
    assert "summary" in supervisor_summary.json()

    owner_summary = http_client.get("/steel/inventory/reconciliations/summary", headers=owner_headers)
    assert owner_summary.status_code == HTTPStatus.OK, owner_summary.text

    forbidden = http_client.get("/steel/inventory/reconciliations/summary", headers=accountant_headers)
    assert forbidden.status_code == HTTPStatus.FORBIDDEN, forbidden.text


def test_steel_owner_daily_pdf_requires_owner_and_returns_pdf(http_client):
    owner = register_user(http_client, role="admin")
    _promote_factory_to_steel(owner["email"])
    _set_user_role(owner["email"], "owner")
    set_org_plan_for_user_email(owner["email"], "factory")
    owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}

    scrap = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "SCRAP-PDF",
            "name": "Scrap PDF",
            "category": "raw_material",
            "display_unit": "kg",
            "current_rate_per_kg": 45,
        },
        headers=owner_headers,
    )
    rods = http_client.post(
        "/steel/inventory/items",
        json={
            "item_code": "ROD-PDF",
            "name": "Steel Rod PDF",
            "category": "finished_goods",
            "display_unit": "kg",
            "current_rate_per_kg": 65,
        },
        headers=owner_headers,
    )
    assert scrap.status_code == HTTPStatus.OK, scrap.text
    assert rods.status_code == HTTPStatus.OK, rods.text
    scrap_id = scrap.json()["item"]["id"]
    rods_id = rods.json()["item"]["id"]

    inward = http_client.post(
        "/steel/inventory/transactions",
        json={
            "item_id": scrap_id,
            "transaction_type": "inward",
            "quantity_kg": 10000,
            "notes": "PDF raw material",
        },
        headers=owner_headers,
    )
    assert inward.status_code == HTTPStatus.OK, inward.text

    batch = http_client.post(
        "/steel/batches",
        json={
            "production_date": date.today().isoformat(),
            "input_item_id": scrap_id,
            "output_item_id": rods_id,
            "input_quantity_kg": 10000,
            "expected_output_kg": 9500,
            "actual_output_kg": 9200,
            "notes": "PDF batch",
        },
        headers=owner_headers,
    )
    assert batch.status_code == HTTPStatus.OK, batch.text
    batch_id = batch.json()["batch"]["id"]

    invoice = http_client.post(
        "/steel/invoices",
        json={
            "invoice_date": date.today().isoformat(),
            "customer_name": "PDF Buyer",
            "lines": [
                {
                    "item_id": rods_id,
                    "batch_id": batch_id,
                    "weight_kg": 3000,
                    "rate_per_kg": 65,
                }
            ],
        },
        headers=owner_headers,
    )
    assert invoice.status_code == HTTPStatus.OK, invoice.text
    invoice_payload = invoice.json()["invoice"]
    invoice_line_id = invoice_payload["lines"][0]["id"]

    dispatch = http_client.post(
        "/steel/dispatches",
        json={
            "invoice_id": invoice_payload["id"],
            "dispatch_date": date.today().isoformat(),
            "truck_number": "DL01-STEEL",
            "driver_name": "Raj",
            "lines": [{"invoice_line_id": invoice_line_id, "weight_kg": 2500}],
        },
        headers=owner_headers,
    )
    assert dispatch.status_code == HTTPStatus.OK, dispatch.text

    pdf = http_client.get(f"/steel/owner-daily-pdf?report_date={date.today().isoformat()}", headers=owner_headers)
    assert pdf.status_code == HTTPStatus.OK, pdf.text
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF")

    admin = register_user(http_client, role="admin")
    _promote_factory_to_steel(admin["email"])
    set_org_plan_for_user_email(admin["email"], "factory")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
    forbidden = http_client.get(f"/steel/owner-daily-pdf?report_date={date.today().isoformat()}", headers=admin_headers)
    assert forbidden.status_code == HTTPStatus.FORBIDDEN
