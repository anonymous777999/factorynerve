"""
FactoryNerve — COMPLETE FACTORY SIMULATION TEST
==============================================
Walks through every workflow as every role, exactly like a real factory customer.
Tests: Login -> Create Users -> Inventory -> Batches -> DPR -> Attendance ->
       Dispatch -> Invoicing -> Payments -> Vendor Bills -> AI -> Analytics

Usage: python factory_simulation_test.py
"""

import sys
import time
from datetime import date, datetime

import httpx

BASE = "http://127.0.0.1:8765"
TODAY = date.today().isoformat()

PASS = "[OK]"
FAIL = "[FAIL]"
WARN = "[WARN]"

passed = 0
failed = 0
errors = []

def log_test(step_name, success, detail=""):
    global passed, failed
    if success:
        passed += 1
        print("  %s %s" % (PASS, step_name))
    else:
        failed += 1
        print("  %s %s" % (FAIL, step_name))
        errors.append("%s: %s" % (step_name, detail))
    if detail:
        if len(detail) > 200:
            print("     %s..." % detail[:197])
        else:
            print("     %s" % detail)
    if not success:
        trimmed = detail[:250] if detail else "Unknown error"
        print("     [ERROR] %s" % trimmed)

def section(title):
    print("\n%s" % ("=" * 70))
    print("  %s" % title)
    print("%s" % ("=" * 70))


# ====================== PHASE 1: LOGIN ======================
section("PHASE 1: LOGIN AS FACTORY OWNER")

client = httpx.Client(base_url=BASE, timeout=15.0)

resp = client.post("/auth/login", json={
    "email": "owner@example.com",
    "password": "TestOwner@123456",
})
if resp.status_code != 200:
    resp = client.post("/auth/v2/login", json={
        "email": "owner@example.com",
        "password": "TestOwner@123456",
    })
log_test("1.1 Owner Login", resp.status_code == 200,
         "Status %d" % resp.status_code if resp.status_code != 200 else "OK")

if resp.status_code != 200:
    print("\n  CANNOT CONTINUE - Login failed. Response: %s" % resp.text[:500])
    sys.exit(1)

# Get auth context
resp2 = client.get("/auth/v2/context")
ctx = resp2.json().get("data", resp2.json())
user_name = ctx.get("user", {}).get("name", "N/A")
log_test("1.2 Auth Context", resp2.status_code == 200,
         "User: %s" % user_name if resp2.status_code == 200 else str(resp2.text[:200]))

owner_user_id = ctx.get("user", {}).get("id")
org_id = ctx.get("user", {}).get("org_id")
factory_id = ctx.get("active_factory_id")

if not factory_id and ctx.get("factories"):
    factory_id = ctx["factories"][0]["factory_id"]
    resp3 = client.post("/auth/v2/select-factory", json={"factory_id": factory_id})
    log_test("1.3 Select Factory", resp3.status_code == 200)

log_test("1.4 Context Complete", all([owner_user_id, org_id, factory_id]),
         "Owner: %s, Org: %s, Factory: %s" % (owner_user_id, org_id, factory_id))


# ====================== PHASE 2: CREATE USERS ======================
section("PHASE 2: CREATE ALL FACTORY USERS")

users_to_create = [
    ("Ramesh Kumar", "operator1@factory.com", "operator", "Shift A Operator"),
    ("Suresh Patel", "operator2@factory.com", "operator", "Shift B Operator"),
    ("Amit Singh", "supervisor1@factory.com", "supervisor", "Prod Supervisor"),
    ("Rajesh Gupta", "accountant1@factory.com", "accountant", "Accountant"),
    ("Vikram Sharma", "manager1@factory.com", "manager", "Plant Manager"),
    ("Priya Verma", "store1@factory.com", "supervisor", "Store Keeper"),
]

user_ids = {}
for name, email, role, title in users_to_create:
    resp = client.post("/auth/v2/register", json={
        "name": name,
        "email": email,
        "password": "Test@123456",
        "factory_name": "QA Steel Plant",
        "phone_number": "+919999999990",
    })
    success = resp.status_code in (200, 201)
    log_test("2. Created %s (%s)" % (title, name), success,
             "OK" if success else "Status %d: %s" % (resp.status_code, resp.text[:100]))

    if success:
        data = resp.json().get("data", resp.json())
        uid = data.get("user", data).get("id")
        if uid:
            key = "%s_%s" % (role, name.split()[0].lower())
            user_ids[key] = uid

    uid_key = "%s_%s" % (role, name.split()[0].lower())
    uid = user_ids.get(uid_key)
    if uid and factory_id:
        resp_role = client.put("/settings/users/%s/role" % uid, json={
            "role": role,
            "factory_id": factory_id,
        })
        if resp_role.status_code not in (200, 201):
            log_test("   Role assign %s" % name, False, str(resp_role.text[:200]))

log_test("2.x User Count", len(user_ids) >= 3,
         "Created %d users: %s" % (len(user_ids), list(user_ids.keys())))


# ====================== PHASE 3: INVENTORY ======================
section("PHASE 3: INVENTORY - ITEM MASTER & STOCK")

inventory_items = {}

raw_items = [
    ("HRC-001", "Hot Rolled Coil 2.5mm", "raw_material", 62.0),
    ("HRC-002", "Hot Rolled Coil 3.0mm", "raw_material", 60.0),
    ("CRC-001", "Cold Rolled Coil 1.2mm", "raw_material", 78.0),
    ("SC-001", "Steel Scrap Grade A", "raw_material", 45.0),
]
for code, name, cat, rate in raw_items:
    resp = client.post("/steel/inventory/items", json={
        "item_code": code, "name": name, "category": cat,
        "current_rate_per_kg": rate, "hsn_code": "7208",
        "gst_rate": 18.0,
    })
    success = resp.status_code in (200, 201, 409)
    log_test("3. Create %s" % name, success,
             "OK" if success else resp.text[:100])
    if resp.status_code in (200, 201):
        data = resp.json().get("data", resp.json())
        inventory_items[code] = data.get("id")

fg_items = [
    ("TMT-8MM", "TMT Bar 8mm Fe500D", "finished_goods", 95.0),
    ("TMT-12MM", "TMT Bar 12mm Fe500D", "finished_goods", 93.0),
    ("ANG-50X50", "Angle 50x50x6mm", "finished_goods", 88.0),
    ("CH-100", "Channel 100x50mm", "finished_goods", 85.0),
]
for code, name, cat, rate in fg_items:
    resp = client.post("/steel/inventory/items", json={
        "item_code": code, "name": name, "category": cat,
        "current_rate_per_kg": rate, "hsn_code": "7214",
        "gst_rate": 18.0,
    })
    success = resp.status_code in (200, 201, 409)
    log_test("3. Create %s" % name, success,
             "OK" if success else resp.text[:100])
    if resp.status_code in (200, 201):
        data = resp.json().get("data", resp.json())
        inventory_items[code] = data.get("id")

# Opening stock
for code, qty in [("HRC-001", 25000.0), ("HRC-002", 15000.0),
                   ("CRC-001", 10000.0), ("SC-001", 5000.0)]:
    item_id = inventory_items.get(code)
    if item_id:
        resp = client.post("/steel/inventory/transactions", json={
            "item_id": item_id,
            "transaction_type": "inward",
            "quantity_kg": qty,
            "notes": "Opening stock",
        })
        log_test("3. Stock inward %s (%.0fkg)" % (code, qty),
                 resp.status_code in (200, 201),
                 "OK" if resp.status_code in (200, 201) else resp.text[:100])

# View stock
resp = client.get("/steel/inventory/stock")
log_test("3.x View Stock Levels", resp.status_code == 200,
         "Items: %d" % len(resp.json().get("data", resp.json())) if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 4: PRODUCTION ======================
section("PHASE 4: PRODUCTION - BATCHES & DPR")

hrc_id = inventory_items.get("HRC-001")
tmt_id = inventory_items.get("TMT-8MM")
if hrc_id and tmt_id:
    for i in range(3):
        resp = client.post("/steel/batches", json={
            "production_date": TODAY,
            "input_item_id": hrc_id,
            "output_item_id": tmt_id,
            "input_quantity_kg": 2000.0,
            "expected_output_kg": 1900.0,
            "actual_output_kg": 1880.0 - (i * 50),
            "scrap_qty_kg": 20.0,
            "rejection_qty_kg": 10.0,
            "heat_number": "HT-24%d" % (100 + i),
            "notes": "Production run #%d" % (i + 1),
        })
        log_test("4. Batch #%d: HRC->TMT" % (i + 1),
                 resp.status_code in (200, 201, 409),
                 "OK" if resp.status_code in (200, 201) else resp.text[:100])

    # THEFT batch
    resp = client.post("/steel/batches", json={
        "production_date": TODAY,
        "input_item_id": hrc_id,
        "output_item_id": tmt_id,
        "input_quantity_kg": 2000.0,
        "expected_output_kg": 1900.0,
        "actual_output_kg": 1700.0,
        "scrap_qty_kg": 30.0,
        "rejection_qty_kg": 20.0,
        "heat_number": "HT-24-THEFT",
        "notes": "200kg unaccounted loss - suspected theft",
    })
    log_test("4. THEFT BATCH (200kg loss)", resp.status_code in (200, 201),
             "CRITICAL: 10% loss batch created" if resp.status_code in (200, 201) else resp.text[:100])

# DPR Entries
for i, (shift, downtime) in enumerate([("morning", 10), ("evening", 45), ("night", 20)]):
    resp = client.post("/entries", json={
        "date": TODAY,
        "shift": shift,
        "units_target": 100,
        "units_produced": 95,
        "manpower_present": 18,
        "manpower_absent": 2,
        "downtime_minutes": downtime,
        "downtime_reason": "Rolling mill adjustment",
        "department": "Production",
        "materials_used": "HR Coil",
        "quality_issues": i == 1,
        "quality_details": "Surface marks on 5 bars" if i == 1 else "",
        "rejection_qty": 3 if i == 1 else 0,
        "rework_required": i == 1,
        "scrap_qty_entry": 5,
        "notes": "Shift %s" % shift,
    })
    log_test("4. DPR Entry: %s shift" % shift, resp.status_code in (200, 201, 409),
             "OK" if resp.status_code in (200, 201) else resp.text[:100])

resp = client.get("/entries/today")
log_test("4.x View Today's Entries", resp.status_code == 200,
         "Count: %d" % len(resp.json().get("data", resp.json())) if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 5: ATTENDANCE ======================
section("PHASE 5: ATTENDANCE - PUNCH IN/OUT")

resp = client.post("/attendance/punch", json={"punch_type": "in"})
log_test("5.1 Punch In", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])

resp = client.get("/attendance/me/today")
log_test("5.2 View Today Attendance", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])

resp = client.post("/attendance/punch", json={"punch_type": "out"})
log_test("5.3 Punch Out", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])

resp = client.get("/attendance/live")
log_test("5.4 Live Attendance View", resp.status_code == 200,
         "Live count: %d" % len(resp.json().get("data", resp.json())) if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 6: DISPATCH ======================
section("PHASE 6: DISPATCH - GATE PASS TO DELIVERY")

resp = client.post("/steel/dispatches", json={
    "truck_number": "MH-12-AB-1234",
    "driver_name": "Ravi Yadav",
    "driver_phone": "+919876543210",
    "transporter_name": "FastTrans Logistics",
    "notes": "Dispatch to Mumbai customer",
    "lines": [],
})
success = resp.status_code in (200, 201)
log_test("6.1 Create Dispatch", success, "OK" if success else resp.text[:200])

dispatch_id = None
if success:
    data = resp.json().get("data", resp.json())
    dispatch_id = data.get("id")
    log_test("6.1a Dispatch ID", bool(dispatch_id),
             "ID: %s" % dispatch_id if dispatch_id else "No ID")

if dispatch_id:
    resp = client.post("/steel/dispatches/%s/status" % dispatch_id, json={
        "status": "loaded",
        "gate_pass_photo_url": "https://placehold.co/400x300?text=Gate+Pass",
    })
    log_test("6.2 Pending -> Loaded", resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:200])

    resp = client.post("/steel/dispatches/%s/status" % dispatch_id, json={
        "status": "exited",
        "weighbridge_slip_photo_url": "https://placehold.co/400x300?text=Weighbridge",
    })
    log_test("6.3 Loaded -> Exited", resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:200])

    resp = client.post("/steel/dispatches/%s/status" % dispatch_id, json={
        "status": "delivered",
        "pod_photo_url": "https://placehold.co/400x300?text=POD",
        "receiver_name": "Mr. Sharma (Customer)",
    })
    log_test("6.4 Exited -> Delivered", resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:200])

    resp = client.post("/steel/dispatches/%s/gate-pass/verify" % dispatch_id)
    log_test("6.5 Gate Pass Verify", resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:200])

resp = client.get("/steel/dispatches")
log_test("6.x View All Dispatches", resp.status_code == 200,
         "Found dispatches" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 7: CUSTOMERS ======================
section("PHASE 7: CUSTOMER MANAGEMENT")

resp = client.post("/steel/customers", json={
    "name": "Mumbai Steel Traders",
    "phone": "+919800000001",
    "email": "info@mumbaisteel.com",
    "address": "Andheri East, Mumbai",
    "city": "Mumbai",
    "state": "Maharashtra",
    "gst_number": "27AABCU1234D1ZV",
    "pan_number": "AABCU1234D",
    "credit_limit": 500000,
    "payment_terms_days": 30,
})
log_test("7.1 Create Customer #1", resp.status_code in (200, 201),
         "OK" if resp.status_code in (200, 201) else resp.text[:200])

resp = client.post("/steel/customers", json={
    "name": "Pune Construction Co.",
    "phone": "+919800000002",
    "email": "info@puneconstruction.com",
    "address": "Hinjewadi, Pune",
    "city": "Pune",
    "state": "Maharashtra",
    "gst_number": "27AABCU5678E1ZW",
    "pan_number": "AABCU5678E",
    "credit_limit": 750000,
    "payment_terms_days": 45,
})
log_test("7.2 Create Customer #2", resp.status_code in (200, 201),
         "OK" if resp.status_code in (200, 201) else resp.text[:200])

resp = client.get("/steel/customers")
log_test("7.3 View Customers", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 8: INVOICES & PAYMENTS ======================
section("PHASE 8: SALES INVOICES & PAYMENTS")

tmt_item_id = inventory_items.get("TMT-8MM")
if tmt_item_id:
    resp = client.post("/steel/invoices", json={
        "customer_name": "Mumbai Steel Traders",
        "invoice_date": TODAY,
        "due_date": TODAY,
        "payment_terms_days": 30,
        "lines": [
            {
                "item_id": tmt_item_id,
                "description": "TMT Bar 8mm Fe500D",
                "weight_kg": 5000,
                "rate_per_kg": 95.0,
            },
        ],
        "notes": "Supply for construction project",
    })
    success = resp.status_code in (200, 201)
    log_test("8.1 Create Invoice", success,
             "OK" if success else resp.text[:200])

    if success:
        data = resp.json().get("data", resp.json())
        invoice_id = data.get("id")
        inv_number = data.get("invoice_number", "N/A")
        total = data.get("total_amount", 0)
        log_test("8.1a Invoice Details", True,
                 "#%s: Rs %.2f" % (inv_number, total))

        resp = client.post("/steel/customers/payments", json={
            "customer_name": "Mumbai Steel Traders",
            "payment_date": TODAY,
            "amount": total,
            "payment_mode": "bank_transfer",
            "reference_number": "NEFT-2026-07-001",
            "notes": "Payment for invoice %s" % inv_number,
            "invoice_id": invoice_id,
        })
        log_test("8.2 Record Payment", resp.status_code in (200, 201),
                 "OK" if resp.status_code in (200, 201) else resp.text[:200])

resp = client.get("/steel/invoices")
log_test("8.x View Invoices", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 9: VENDOR BILLS ======================
section("PHASE 9: VENDOR BILLS & PAYMENTS")

resp = client.post("/steel/vendors", json={
    "vendor_code": "V-001",
    "name": "Tata Steel Supply Co.",
    "phone": "+919800000010",
    "email": "sales@tatasteelsupply.com",
    "gst_number": "27AABCT1234D1ZW",
    "pan_number": "AABCT1234D",
    "payment_terms_days": 30,
})
log_test("9.1 Create Vendor", resp.status_code in (200, 201),
         "OK" if resp.status_code in (200, 201) else resp.text[:200])

resp = client.post("/steel/vendor-bills", json={
    "vendor_id": 1,
    "bill_number": "TATA-INV-2026-07-001",
    "bill_date": TODAY,
    "due_date": TODAY,
    "total_amount": 350000,
    "expense_category": "raw_material",
    "notes": "HR Coil supply - July 2026",
})
log_test("9.2 Create Vendor Bill", resp.status_code in (200, 201),
         "OK" if resp.status_code in (200, 201) else resp.text[:200])

resp = client.get("/steel/vendor-bills")
log_test("9.x View Vendor Bills", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 10: AI INTELLIGENCE ======================
section("PHASE 10: AI INTELLIGENCE")

for name, endpoint in [
    ("Inventory Intelligence", "/steel/intelligence/inventory"),
    ("Quality Intelligence", "/steel/intelligence/quality"),
    ("Sales Intelligence", "/steel/intelligence/sales"),
    ("Production Intelligence", "/steel/intelligence/production"),
    ("Scrap Loss Intelligence", "/steel/intelligence/scrap-loss"),
    ("Finance Overview", "/steel/finance/overview"),
    ("Receivables Aging", "/steel/finance/receivables"),
    ("Cash Flow", "/steel/finance/cash-flow"),
]:
    resp = client.get(endpoint)
    log_test("10. %s" % name, resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 11: ANALYTICS ======================
section("PHASE 11: ANALYTICS & REPORTS")

for name, endpoint in [
    ("Weekly Analytics", "/analytics/weekly"),
    ("Monthly Analytics", "/analytics/monthly"),
    ("Manager Dashboard", "/analytics/manager"),
    ("Attendance Report", "/attendance/reports/summary"),
    ("Workforce Overview", "/workforce/overview"),
]:
    resp = client.get(endpoint)
    log_test("11. %s" % name, resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 12: RECONCILIATION ======================
section("PHASE 12: STOCK RECONCILIATION")

if tmt_item_id:
    resp = client.post("/steel/inventory/reconciliations", json={
        "item_id": tmt_item_id,
        "physical_qty_kg": 4850,
        "system_qty_kg": 5000,
        "variance_kg": -150,
        "variance_percent": 3.0,
        "confidence_status": "medium",
        "mismatch_cause": "process_loss",
        "notes": "Monthly physical count",
    })
    log_test("12.1 Create Reconciliation", resp.status_code in (200, 201),
             "OK" if resp.status_code in (200, 201) else resp.text[:200])

    resp = client.get("/steel/inventory/reconciliations")
    log_test("12.2 View Reconciliations", resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 13: APPROVALS ======================
section("PHASE 13: APPROVAL ENGINE & NOTIFICATIONS")

resp = client.get("/approvals/queue/me")
log_test("13.1 My Pending Approvals", resp.status_code == 200,
         "Count: %d" % len(resp.json().get("data", resp.json())) if resp.status_code == 200 else resp.text[:100])

resp = client.get("/notifications")
log_test("13.2 Notifications", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])

resp = client.get("/notifications/unread-count")
log_test("13.3 Unread Count", resp.status_code == 200,
         "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 14: SYSTEM HEALTH ======================
section("PHASE 14: SYSTEM HEALTH")

for name, endpoint in [
    ("API Health", "/health"),
    ("Readiness Check", "/observability/ready"),
    ("AI Health", "/observability/ai/health"),
]:
    resp = client.get(endpoint)
    log_test("14. %s" % name, resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== PHASE 15: PERMISSIONS ======================
section("PHASE 15: PERMISSIONS & CONFIGURATION")

for name, endpoint in [
    ("Permission Manifest", "/permissions"),
    ("Factory Settings", "/settings/factory"),
    ("Factory Profiles", "/settings/factory-profiles"),
]:
    resp = client.get(endpoint)
    log_test("15. %s" % name, resp.status_code == 200,
             "OK" if resp.status_code == 200 else resp.text[:100])


# ====================== SUMMARY ======================
section("TEST SUMMARY")
print("  Total Tests: %d" % (passed + failed))
print("  %s Passed: %d" % (PASS, passed))
print("  %s Failed: %d" % (FAIL, failed))
if (passed + failed) > 0:
    print("  Success Rate: %.1f%%" % (passed / (passed + failed) * 100))

if errors:
    print("\n  FAILURES:")
    for e in errors:
        print("    - %s..." % e[:150])

print("\n  %s" % ("*" * 50))
print("  VERDICT:")
if failed == 0:
    print("  %s ALL SYSTEMS GO - Factory is ready for daily operations!" % PASS)
elif failed < 5:
    print("  %s MINOR ISSUES - Fix %d failures before onboarding" % (WARN, failed))
else:
    print("  %s MAJOR ISSUES - Fix %d failures before onboarding" % (FAIL, failed))
print("  %s" % ("*" * 50))

client.close()
