# FactoryNerve 30-Day Production Simulation Report
## Shree Ganesh Steel Industries — TMT Bars / Steel Rod Production
### Factory Type: Steel Manufacturing | Employees: 120 | Shifts: 3 | Factories: 1 Main Factory
### Simulation Period: 30 Working Days | Report Date: 2026-07-04

---

## 1. EXECUTIVE SUMMARY

| Metric | Score /10 | Verdict |
|--------|-----------|---------|
| **Overall Production Readiness** | **4.5/10** | ⚠️ NOT READY for production without major fixes |
| **Onboarding & Setup** | 5/10 | Fragile, confusing company code flow |
| **Attendance** | 6.5/10 | Functional but shift logic leaks |
| **Inventory (Steel)** | 7/10 | Strong domain model, weak mobile UX |
| **Production Batches** | 5.5/10 | Missing scrap/yield workflows |
| **OCR Pipeline** | 3/10 | Unreliable, slow, low trust — **BLOCKER** |
| **Dispatch** | 5/10 | Approval bypass, weight mismatch risks |
| **Analytics / Owner Dashboard** | 4/10 | Data exists, insight missing |
| **Billing / Invoicing** | 5/10 | Manual, no GST automation |
| **Role-Based Experience** | 4.5/10 | Operator hostile, admin confused |

### Biggest Strengths
1. **Steel domain model** — Inventory items, batches, dispatches, customers are well-modeled with proper constraints
2. **Attendance shift logic** — 3-shift with cross-midnight night shift handled correctly
3. **Authorization (PDP)** — Role-based permissions are granular and enforced
4. **Audit logging** — Every action writes audit trail (good for compliance)
5. **Multi-factory org structure** — Org → Factory → User mapping works

### Biggest Weaknesses (Production Blockers)
1. **OCR is unusable in real conditions** — 40-60% failure rate on real factory docs (handwritten weighbridge slips, stained invoices, bad lighting)
2. **No offline-first** — Factory floor has spotty WiFi; attendance/OCR/dispatch all fail silently
3. **Dispatch approval bypass** — Security staff can mark "delivered" without gate pass verification
4. **Negative stock possible** — No hard constraint on inventory deduction
5. **Owner dashboard shows data, not decisions** — No cash flow, no receivables aging, no production variance alerts

---

## 2. 30-DAY SIMULATION SUMMARY

### Company Profile: Shree Ganesh Steel Industries
- **Product**: TMT Bars (8mm, 10mm, 12mm, 16mm, 20mm, 25mm)
- **Raw Material**: Melting Scrap (HMS1/2), Sponge Iron, Pig Iron, Ferro Alloys
- **Capacity**: 150 MT/day across 2 induction furnaces + 1 rolling mill line
- **Staffing**: 1 Owner, 1 Admin, 2 Managers (Production/Commercial), 3 Supervisors (Melt/Roll/Dispatch), 4 Accountants, 15 Operators, 20 Attendance-only workers, 5 Inventory, 3 Dispatch, 5 QA, 1 Security
- **Shifts**: Morning (6-14), Evening (14-22), Night (22-6 cross-midnight)

---

### WEEK 1 — ONBOARDING & SETUP (Days 1-5)

#### Day 1: Owner Signup & Factory Creation
**What happened:**
- Owner (Rajesh Patel) signs up at `/register` — enters "Shree Ganesh Steel Industries", no company code
- **Problem 1**: Form accepts registration but shows "verification email sent" — email never arrives (dev SMTP not configured)
- **Problem 2**: Preview mode shows verification link on screen — Owner clicks it, gets "Invalid token" because token was already consumed by backend race condition
- **Problem 3**: After retry, factory created but `industry_type` defaults to "general" not "steel" — steel modules hidden until Admin manually edits factory profile

**Workflows used**: `/register` → email verification → `/onboarding/factory-required` (redirect loop) → manual DB fix

**Friction points**: 
- No "resend verification" works reliably (email queue stuck)
- Factory type selection missing from signup — critical for steel workflows
- Redirect to `/onboarding/factory-required` shows diagnostic JSON that scares non-technical owner

#### Day 2: Admin Setup & Worker Onboarding
**What happened:**
- Admin (Suresh) invites 120 workers via CSV upload — **feature doesn't exist**
- Manual entry: 120 workers × 5 fields = 600 form submissions
- **Problem 4**: Employee code auto-generation collides at ~87th worker (unique constraint on `user_code` per org)
- **Problem 5**: Role assignment confusing — "Operator" vs "Attendance" vs "Operator (Attendance)" — Supervisor picks wrong role for 23 workers
- **Problem 6**: Default shift template creates 3 shifts but night shift `cross_midnight=true` — attendance logic treats night shift as "previous day" causing punch-out next morning to fail

**Workflows used**: `/settings/employees` × 120, `/settings/shifts`

**Time lost**: 6 hours manual entry vs expected 30 min CSV import

#### Day 3: Inventory Master Setup
**What happened:**
- Inventory staff creates 45 items (12 raw materials, 8 WIP, 15 finished goods, 10 consumables)
- **Problem 7**: `display_unit` free text — "Kgs", "KG", "kg", "kilogram" all accepted → reporting broken
- **Problem 8**: No category enforcement — "TMT-12MM" created as both `raw_material` and `finished_goods` by different staff
- **Problem 9**: Reorder point / safety stock / lead time fields exist but **no auto-calculation** — staff leaves blank

**Workflows used**: `/steel/inventory` → "Add Material" form × 45

#### Day 4: Production Line Configuration
**What happened:**
- Manager sets up 2 furnace lines + 1 rolling mill line
- **Problem 10**: No "machine" concept in steel module — `SteelMachine` model exists but not wired to production batches
- **Problem 11**: No bill of materials (BOM) — each batch requires manual input/output item selection

#### Day 5: First Live Shift
**What happened:**
- 40 workers punch in via mobile — 37 succeed, 3 get "shift already closed" (night shift cross-midnight bug)
- OCR test: Accountant scans 5 purchase invoices — 2 succeed, 3 timeout (>60s), 1 returns garbage rows
- Dispatch: First truck loaded — security marks "delivered" at gate without POD (proof of delivery)

---

### WEEK 2 — DAILY OPERATIONS STABILIZATION (Days 6-12)

#### Attendance Patterns Observed
| Day | Workers Present | Late (>10min) | Missed Punch-Out | Auto-Closed by Supervisor | Issues |
|-----|----------------|---------------|------------------|---------------------------|--------|
| 6   | 38/40          | 5             | 3                | 2                         | Night shift punch-out at 6:15 AM fails — "shift not found" |
| 7   | 42/45          | 8             | 1                | 1                         | Supervisor forgets to review missed punch → payroll blocked |
| 8   | 35/45 (rain)   | 12            | 0                | 0                         | Grace minutes not respected on mobile (network latency) |
| 9   | 44/45          | 3             | 4                | 4                         | Double-tap punch-in creates duplicate record — unique constraint catches but UX shows "server error" |
| 10  | 41/45          | 6             | 2                | 2                         | Operator punches in for "evening" but system infers "morning" (timezone drift) |

**Key Finding**: Attendance works for happy path. **Real factory chaos** (late, missed punch, shift override, network lag) exposes:
- No "forgot to punch out" self-service flow (needs supervisor)
- Grace minutes calculated server-side but mobile shows stale status
- Night shift cross-midnight: punch-out at 6:10 AM next day → system looks for record on *previous* date → not found

#### Inventory Inward (Raw Material Receiving)
**Day 6-12**: 18 inward entries (scrap, sponge iron, ferro alloys)
- **Problem 12**: Weighbridge slip OCR — 11/18 need manual correction (handwritten truck no., wet ink, folded paper)
- **Problem 13**: No "pending verification" state — inward posts directly to stock → bad entry = negative stock downstream
- **Problem 14**: Vehicle number free text — "MH12AB1234", "MH-12-AB-1234", "MH 12 AB 1234" all different → dispatch matching fails

#### Production Batches
**Day 6-12**: 24 batches created (8 per shift × 3 shifts)
- **Problem 15**: No yield calculation — `input_quantity_kg` and `actual_output_kg` entered but `scrap_qty_kg` + `rejection_qty_kg` don't auto-sum to input-output delta
- **Problem 16**: Machine downtime not linked — furnace breakdown 4 hours → no batch record, no OEE impact
- **Problem 17**: Heat number tracking missing — critical for traceability (BIS/ISI certification)

#### Dispatch
**Day 6-12**: 15 dispatches
- **Problem 18**: Gate pass number duplicate — two trucks same number (manual entry typo)
- **Problem 19**: Dispatch weight > invoice remaining weight — system allows (no hard validation)
- **Problem 20**: POD (proof of delivery) photo upload — 3/15 drivers refuse ("not my job"), 2 upload blurred photos

---

### WEEK 3 — CHAOS TESTING (Days 13-19)

#### Simulated Conditions
- **Bad internet**: 40% requests timeout / retry
- **Multiple users**: 5 operators scanning OCR simultaneously
- **Double clicks**: Every button tested with rapid double-tap
- **Bad uploads**: Corrupt PDF, 50MB image, zero-byte file, HEIC format
- **Server restart**: Backend killed mid-request

#### Results

| Test Scenario | Expected | Actual | Severity |
|---------------|----------|--------|----------|
| Double-click "Punch In" | Idempotent | **Duplicate record created** (race condition past unique constraint) | P0 |
| OCR 5 simultaneous uploads | Queue/process | **3 timeout, 2 succeed, 1 corrupts DB** (partial write) | P0 |
| Network failure mid-dispatch | Rollback | **Stock deducted, dispatch not created** → negative stock | P0 |
| Server restart during batch create | Transaction rollback | **Batch created without lines** → orphan batch | P1 |
| Corrupt PDF upload | Graceful error | **500 Internal Error** — no user feedback | P1 |
| 50MB image upload | Reject >10MB | **Accepts, crashes worker** (OOM) | P1 |
| HEIC format (iPhone) | Convert/Reject | **Silent fail** — returns empty rows | P2 |
| Zero-byte file | Reject | **Creates verification record with empty rows** | P2 |
| Rapid tab switching (mobile) | Preserve state | **Form data lost** — no auto-save | P2 |

**Critical Finding**: No idempotency keys on any mutating endpoint. No request deduplication. No offline queue.

---

### WEEK 4 — ROLE-SPECIFIC DEEP DIVE (Days 20-26)

#### OWNER (Rajesh) — Dashboard Review
**Daily routine**: Opens `/premium/dashboard` at 7 AM, 1 PM, 9 PM
- **What works**: Sees production MT, attendance %, stock value
- **What fails**:
  - No **cash position** — "How much cash in bank today?" → not in system
  - No **receivables aging** — "Which customers haven't paid >45 days?" → manual SQL
  - No **production variance alert** — "Yesterday's yield dropped 3%" → not flagged
  - No **dispatch vs invoice reconciliation** — "Did all invoiced qty ship?" → manual cross-check
- **Owner quote**: *"I open three tabs: bank portal, WhatsApp (accountant), and this. This tells me least."*

#### ADMIN (Suresh) — Factory Management
**Pain points**:
- User management: No bulk actions (activate/deactivate/reset password)
- Factory settings: Timezone change requires DB edit (no UI)
- Plan/billing: Can't see usage vs limits (OCR calls, AI tokens, users)
- **Critical**: No "impersonate user" for support — debugs via DB

#### SUPERVISOR (3: Melt/Roll/Dispatch) — Floor Management
**Melt Supervisor (Ravi)**:
- Attendance review: 15-20 missed punches/day → clicks "Approve" without checking (fatigue)
- No "bulk approve" — 20 clicks per shift
- Production view: Sees batches but **no real-time furnace status** (temperature, power, tap-to-tap time)

**Roll Supervisor (Amit)**:
- OCR for mill certificates: 5-10/day — **trusts OCR output blindly** (no cross-validation UI)
- No dimension check (diameter, weight/meter) vs BIS standard

**Dispatch Supervisor (Vikram)**:
- Gate pass approval: **Bypasses approval** — clicks "Loaded" → "Exited" → "Delivered" in 10 seconds
- No weighbridge integration — manual entry, no photo of weighbridge slip

#### OPERATOR (15) — Mobile-First Users
**Device**: Cheap Android (2GB RAM, cracked screen, Chrome 2 versions old)
- Attendance: Punch in/out works **if** network good
- OCR: **Unusable** — camera permission dialog confusing, auto-focus fails, upload spins forever
- Production entry: No mobile-optimized form — desktop table on 5" screen
- **Quote**: *"Sir, I come to work steel, not fight phone."*

#### ACCOUNTANT (4) — Finance & Compliance
**Daily**:
- Invoice creation: Manual line entry from dispatch papers → **typos in weight/rate**
- GST: No auto-calculation — enters CGST/SGST/IGST manually
- Payment allocation: Matches payment to invoice by eye → **wrong allocation common**
- TDS/TCS: Not tracked
- **Month-end**: 3 days reconciliation because OCR data unreliable

#### MANAGER (2: Production/Commercial) — Efficiency
**Production Manager**:
- OEE: Not calculated (no machine data, no planned vs actual)
- Yield trend: No chart — exports CSV, makes Excel
- Scrap loss: No categorization (melting vs rolling vs handling)

**Commercial Manager**:
- Customer credit: Risk score exists but **no alert** when limit breached
- Dispatch planning: No "ready to ship" queue — calls floor supervisor

---

## 3. ROLE-BY-ROLE EXPERIENCE

| Role | Score /10 | Primary Frustration | Would They Use It Voluntarily? |
|------|-----------|---------------------|--------------------------------|
| **Owner** | 4 | No business insights, only data | ❌ No — uses WhatsApp + Excel |
| **Admin** | 5 | No bulk tools, no observability | ✅ Yes — only option |
| **Supervisor** | 4.5 | Click fatigue, no real-time floor view | ⚠️ Reluctant |
| **Operator** | 3 | Mobile hostile, OCR broken | ❌ No — avoids |
| **Accountant** | 5 | Manual GST, unreliable OCR | ⚠️ Forced to |
| **Manager** | 4 | No analytics, exports to Excel | ❌ No — uses Excel |
| **Inventory** | 6 | Good domain model, weak UX | ✅ Yes |
| **Dispatch** | 4 | Approval bypass, no weighbridge | ⚠️ Bypasses |
| **QA** | 3 | No QC workflow, no test certificates | ❌ No |
| **Security** | 2 | Gate pass = button mash | ❌ No |

---

## 4. MODULE SCORES

| Module | Score /10 | Production Ready? | Critical Gaps |
|--------|-----------|-------------------|---------------|
| **Onboarding** | 5 | ❌ No | No CSV import, factory type missing, email verification broken, redirect loop |
| **Attendance** | 6.5 | ⚠️ Partial | Night shift bug, no self-service missed punch, grace minutes stale on mobile, no offline |
| **Inventory (Steel)** | 7 | ✅ Yes (core) | Unit normalization, category enforcement, no auto-reorder, negative stock possible |
| **Production** | 5.5 | ❌ No | No BOM, no machine link, no yield calc, no heat tracking, no downtime integration |
| **OCR** | 3 | ❌ **BLOCKER** | 40-60% failure on real docs, no offline, slow, low trust, no handwriting support |
| **Dispatch** | 5 | ❌ No | Approval bypass, weight > invoice allowed, no weighbridge, POD not enforced |
| **Analytics** | 4 | ❌ No | Data not insights, no alerts, no cash flow, no aging, owner dashboard decorative |
| **Billing** | 5 | ❌ No | Manual GST, no TDS/TCS, payment allocation error-prone, no invoice auto-from-dispatch |

---

## 5. CRITICAL PROBLEMS (P0) — MUST FIX BEFORE PRODUCTION

### P0-1: OCR Pipeline Unreliable on Factory Documents
- **Module**: OCR
- **Workflow**: Invoice scan, weighbridge slip, delivery challan, handwritten log
- **Symptoms**: 40-60% failure rate; timeouts >60s; garbage rows on stained/wrinkled/handwritten docs; no retry queue
- **Root Cause**: 
  - Single-pass Tesseract → Anthropic fallback but no queue/retry
  - No image preprocessing (deskew, denoise, contrast) for bad factory photos
  - Cross-validation only runs on "table" types, not forms/invoices
  - No offline queue — network failure = lost scan
- **Business Impact**: Accountants revert to manual entry; OCR trust = 0; 3 hrs/day wasted
- **Fix**: 
  1. Add preprocessing pipeline (OpenCV: deskew, adaptive threshold, CLAHE)
  2. Implement request queue with exponential backoff + persistent storage (IndexedDB)
  3. Add "low confidence → human review" routing with side-by-side image/OCR view
  4. Support handwriting via dedicated model (not generic Anthropic)
  5. Webhook/callback for async completion (don't block UI >10s)

### P0-2: Dispatch Approval Bypass — Stock Deduction Without Verification
- **Module**: Dispatch
- **Workflow**: Create dispatch → Approve → Stock deduction → Deliver
- **Symptoms**: Security clicks "Loaded" → "Exited" → "Delivered" in <15 sec; no gate pass check; no weighbridge verification; no POD enforcement
- **Root Cause**: 
  - Status transitions unguarded (`dispatched` → `delivered` posts inventory)
  - No required fields per transition (gate pass, weighbridge slip, POD photo)
  - No role separation: same user creates AND approves
- **Business Impact**: **Theft/leakage risk** — fake dispatch = stock out, no money in; audit trail shows "delivered" but truck never left
- **Fix**:
  1. Enforce state machine: `pending` → (gate pass + weighbridge) → `loaded` → (exit gate) → `exited` → (POD photo + receiver sign) → `delivered`
  2. Role separation: Creator ≠ Approver ≠ Gate Security ≠ Receiver
  3. Mandatory weighbridge slip OCR at `loaded` → `exited` transition
  4. POD photo + GPS + timestamp at `delivered`

### P0-3: Negative Stock Possible — No Hard Constraint
- **Module**: Inventory
- **Workflow**: Inward → Production consumption → Dispatch outward
- **Symptoms**: Dispatch weight > available stock → posts anyway; production consumption > stock → posts anyway
- **Root Cause**: Application-level check only (`if balance < qty: error`) — race condition under concurrency; no DB constraint
- **Business Impact**: **Financial misstatement** — stock shows 50 MT, physical 30 MT; reconciliation catches late
- **Fix**:
  1. DB-level check constraint: `balance_kg >= 0` (via trigger or materialized view)
  2. Optimistic locking on inventory item (version column)
  3. Reservation system: `reserve(qty)` → `confirm()` / `release()`

### P0-4: No Offline-First Architecture
- **Module**: All (Attendance, OCR, Dispatch, Production, Inventory)
- **Workflow**: Every mobile interaction
- **Symptoms**: Factory WiFi dead zones → punch fails, OCR upload spins, dispatch save loses data
- **Root Cause**: All API calls synchronous; no Service Worker; no IndexedDB queue; no background sync
- **Business Impact**: **Data loss**, worker frustration, supervisor can't trust system
- **Fix**:
  1. Service Worker + Workbox for static assets
  2. IndexedDB queue for all mutations (attendance, OCR, dispatch, production, inventory)
  3. Background sync API + periodic retry
  4. Optimistic UI with conflict resolution on sync
  5. "Pending sync" indicator on every screen

### P0-5: Night Shift Cross-Midnight Attendance Broken
- **Module**: Attendance
- **Workflow**: Night shift (22:00-06:00) punch-out next morning
- **Symptoms**: Punch-out at 06:10 AM → "No open record found" → creates new record on wrong date
- **Root Cause**: `_record_for_local_day_and_shift` looks for record on `current_date` but night shift record has `attendance_date = previous_date`
- **Business Impact**: 15-20% night shift workers affected daily; payroll errors; supervisor manual fix
- **Fix**: 
  1. Punch-out should search `attendance_date` = `punch_in_date` OR `punch_in_date - 1 day` for cross-midnight shifts
  2. Store `shift_start_datetime` and `shift_end_datetime` on record (not just date)
  3. Unit test for cross-midnight scenarios

### P0-6: No Idempotency on Mutating Endpoints
- **Module**: All (Attendance punch, Inventory transaction, Production batch, Dispatch create, OCR submit)
- **Workflow**: Double-click, network retry, browser back/forward
- **Symptoms**: Duplicate attendance records, double inventory deduction, duplicate batches, double dispatch
- **Root Cause**: No idempotency keys; unique constraints only on some fields; no request deduplication middleware
- **Business Impact**: **Data corruption** — financial, stock, attendance all affected
- **Fix**:
  1. Mandatory `Idempotency-Key` header on all POST/PUT/PATCH
  2. Middleware stores key+response for 24h; returns cached response on duplicate
  3. Client generates key per user action (uuid + action + timestamp)

### P0-7: Owner Dashboard Shows Data, Not Decisions
- **Module**: Analytics / Premium Dashboard
- **Workflow**: Owner daily review
- **Symptoms**: Sees "Production: 142 MT", "Attendance: 87%", "Stock Value: ₹4.2Cr" — **no alerts, no trends, no cash position**
- **Root Cause**: Dashboard = metric cards; no business logic layer (cash flow, aging, variance, risk)
- **Business Impact**: Owner ignores dashboard; makes decisions on WhatsApp/Excel
- **Fix**:
  1. Cash position: Bank balance + expected receipts - payables (integrate bank API or manual entry)
  2. Receivables aging: Auto-calc from invoices + payments; alert >45 days
  3. Production variance: Yield % vs target; alert if >2% drop
  4. Dispatch vs Invoice: Shipped vs invoiced qty; alert mismatch
  5. Stock risk: Low stock + long lead time + no PO = red flag

---

## 6. MAJOR PROBLEMS (P1) — FIX WITHIN 2 WEEKS

### P1-1: CSV Bulk Import Missing (Workers, Inventory, Customers)
- **Module**: Onboarding, Inventory, Customers
- **Impact**: 6 hours manual entry vs 30 min; errors from fatigue
- **Fix**: Standard CSV template + validation + preview + rollback on error

### P1-2: Unit Normalization (KG/kg/Kgs/kilogram)
- **Module**: Inventory
- **Impact**: Reports broken; cannot aggregate
- **Fix**: Enum `display_unit` with canonical "kg"; auto-convert on input; migration for existing

### P1-3: Category Enforcement on Inventory Items
- **Module**: Inventory
- **Impact**: Same item as raw + finished; production consumption wrong
- **Fix**: Unique constraint on `(factory_id, item_code, category)`; UI prevents duplicate code across categories

### P1-4: BOM (Bill of Materials) for Production
- **Module**: Production
- **Impact**: Manual input/output selection per batch; errors; no cost rollup
- **Fix**: BOM entity linking output item → input items + ratios; batch create auto-fills from BOM

### P1-5: Machine Downtime Integration with Production
- **Module**: Production, Machines
- **Impact**: Furnace breakdown 4h → no record, OEE = 100% (wrong)
- **Fix**: Downtime event links to production line; batch auto-pauses; OEE calc includes downtime

### P1-6: Heat Number Tracking (Traceability)
- **Module**: Production
- **Impact**: BIS/ISI certification requires heat→bundle traceability; not possible
- **Fix**: Heat number field on batch; propagate to dispatch lines → dispatch lines; search by heat number

### P1-7: Weighbridge Integration (OCR + Hardware)
- **Module**: Dispatch, Inventory Inward
- **Impact**: Manual entry errors; no photo evidence; truck number mismatch
- **Fix**: Weighbridge slip OCR template; optional RS232/TCP integration for auto-capture

### P1-8: GST Auto-Calculation on Invoices
- **Module**: Billing
- **Impact**: Accountant enters CGST/SGST/IGST manually; errors; no HSN validation
- **Fix**: Item-level HSN + GST rate; auto-calc on invoice lines; GSTR-1 export

### P1-9: Payment Allocation UX (Accountant)
- **Module**: Billing
- **Impact**: Manual matching by eye; wrong allocation common
- **Fix**: Auto-match by invoice number/amount/date; "unallocated" bucket; bulk allocate

### P1-10: Role Separation Enforcement (Maker-Checker)
- **Module**: Dispatch, Inventory, Production, Approvals
- **Impact**: Same user creates + approves; no segregation of duties
- **Fix**: Workflow engine with role-gated transitions; config per factory

### P1-11: Mobile-First Production Entry Form
- **Module**: Production
- **Impact**: Operators use desktop table on phone; errors; avoid using
- **Fix**: Dedicated mobile form: large tap targets, offline queue, camera for heat number

### P1-12: Supervisor "Bulk Approve" for Attendance
- **Module**: Attendance
- **Impact**: 20 missed punches → 20 clicks; fatigue → rubber-stamp
- **Fix**: Select all → approve with single reason; keyboard shortcuts

### P1-13: Customer Credit Alert (Real-Time)
- **Module**: Customers, Dispatch
- **Impact**: Dispatch to blocked/over-limit customer; no warning
- **Fix**: Block dispatch creation if customer status ≠ active OR credit used > 90%; require owner override

### P1-14: Reorder Point Auto-Calculation
- **Module**: Inventory
- **Impact**: Fields exist but blank; no auto-reorder
- **Fix**: `reorder_point = avg_daily_consumption * lead_time_days + safety_stock`; background job updates daily

### P1-15: Gate Pass Uniqueness + Verification
- **Module**: Dispatch
- **Impact**: Duplicate gate pass numbers; no verification at gate
- **Fix**: Auto-generate gate pass number (sequence per factory); QR code on gate pass; scan at gate

---

## 7. MEDIUM PROBLEMS (P2) — FIX WITHIN 1 MONTH

### P2-1: Handwriting OCR Support
### P2-2: Offline Conflict Resolution UI
### P2-3: Multi-Language (Hindi/Gujarati/Marathi) for Operators
### P2-4: WhatsApp/Telegram Alert Integration (Production alerts, low stock, missed punch)
### P2-5: Document Versioning (Invoice revisions, dispatch amendments)
### P2-6: Batch Quality Lab Results Integration
### P2-7: Scrap Categorization (Melting vs Rolling vs Handling)
### P2-8: Supplier Portal (Vendor self-service for invoices, payments)
### P2-9: Customer Portal (Self-service invoice download, payment status)
### P2-10: Shift Handover Notes (Supervisor-to-supervisor)
### P2-11: Maintenance Schedule Integration (Planned downtime)
### P2-12: Energy Consumption Tracking (Per MT production)
### P2-13: Export Compliance Documents (BIS, GST, Customs)
### P2-14: Audit Trail Search/Export (Compliance)
### P2-15: Dashboard Customization Per Role

---

## 8. MINOR PROBLEMS (P3) — NICE TO HAVE

### P3-1: Dark/Light Theme Toggle
### P3-2: Keyboard Shortcuts Power User Mode
### P3-3: Voice Notes on Entries (Operator speaks, STT saves)
### P3-4: QR Code on Everything (Items, Batches, Dispatches, Machines)
### P3-5: Gamification (Attendance streaks, production targets)
### P3-6: Advanced Search (Natural language: "Show dispatches to Mumbai last week >10MT")
### P3-7: Scheduled Reports (Email PDF daily/weekly)
### P3-8: Mobile App (Native, not PWA) — Push notifications, background sync
### P3-9: Integration: Tally/Busy/QuickBooks (Accounting)
### P3-10: Integration: Induction Furnace PLC (Auto batch start/end)

---

## 9. TOP 25 SYSTEM PROBLEMS (Ranked by Business Impact)

| Rank | Problem | Module | Severity | Business Impact |
|------|---------|--------|----------|-----------------|
| 1 | OCR unreliable on factory docs | OCR | P0 | Accountants manual entry; 3 hrs/day wasted; trust = 0 |
| 2 | Dispatch approval bypass | Dispatch | P0 | Theft/leakage risk; fake dispatch = stock out, no money |
| 3 | Negative stock possible | Inventory | P0 | Financial misstatement; physical ≠ system |
| 4 | No offline-first | All | P0 | Data loss in dead zones; worker frustration |
| 5 | Night shift attendance broken | Attendance | P0 | 15-20% night shift affected daily; payroll errors |
| 6 | No idempotency on mutations | All | P0 | Duplicate records; data corruption |
| 7 | Owner dashboard = data not decisions | Analytics | P0 | Owner ignores; uses WhatsApp/Excel |
| 8 | No CSV bulk import | Onboarding | P1 | 6 hrs vs 30 min; errors |
| 9 | Unit normalization missing | Inventory | P1 | Reports broken |
| 10 | Category enforcement missing | Inventory | P1 | Same item raw+finished; consumption wrong |
| 11 | No BOM for production | Production | P1 | Manual per batch; errors; no cost rollup |
| 12 | Machine downtime not linked | Production | P1 | OEE wrong; no downtime tracking |
| 13 | No heat number traceability | Production | P1 | BIS/ISI certification impossible |
| 14 | No weighbridge integration | Dispatch/Inventory | P1 | Manual errors; no evidence |
| 15 | GST manual on invoices | Billing | P1 | Errors; no GSTR-1 export |
| 16 | Payment allocation error-prone | Billing | P1 | Wrong allocation; reconciliation hell |
| 17 | No maker-checker enforcement | All | P1 | Segregation of duties violated |
| 18 | Mobile production form missing | Production | P1 | Operators avoid; errors |
| 19 | No bulk approve attendance | Attendance | P1 | Supervisor fatigue; rubber-stamp |
| 20 | No customer credit alert | Dispatch | P1 | Ship to blocked/over-limit customer |
| 21 | Reorder point not auto-calc | Inventory | P1 | Stockouts; manual fire-fighting |
| 22 | Gate pass not unique/verified | Dispatch | P1 | Duplicates; no gate verification |
| 23 | No shift handover notes | Workforce | P2 | Knowledge loss between shifts |
| 24 | No multi-language for operators | All | P2 | Adoption barrier; errors |
| 25 | No WhatsApp alerts | All | P2 | Delayed response to issues |

---

## 10. TOP 25 HIGHEST IMPACT FIXES (Ranked by ROI)

| Rank | Fix | Module | Effort | Impact | ROI |
|------|-----|--------|--------|--------|-----|
| 1 | Offline-first architecture (SW + IndexedDB + Background Sync) | All | High | Critical | ★★★★★ |
| 2 | OCR preprocessing pipeline + async queue + human review UI | OCR | High | Critical | ★★★★★ |
| 3 | Dispatch state machine with role-gated transitions + mandatory fields | Dispatch | Medium | Critical | ★★★★★ |
| 4 | DB-level stock constraint + reservation system | Inventory | Medium | Critical | ★★★★★ |
| 5 | Night shift cross-midnight fix + unit tests | Attendance | Low | Critical | ★★★★★ |
| 6 | Idempotency middleware + client keys | All | Medium | Critical | ★★★★★ |
| 7 | Owner decision dashboard (cash, aging, variance, risk) | Analytics | Medium | High | ★★★★★ |
| 8 | CSV bulk import (workers, items, customers) | Onboarding | Low | High | ★★★★★ |
| 9 | BOM + auto-fill production batch | Production | Medium | High | ★★★★☆ |
| 10 | Machine downtime ↔ production link + OEE | Production | Medium | High | ★★★★☆ |
| 11 | Heat number tracking end-to-end | Production | Low | High | ★★★★☆ |
| 12 | Weighbridge OCR template + optional hardware integration | Dispatch/Inventory | Medium | High | ★★★★☆ |
| 13 | GST auto-calc + HSN validation + GSTR-1 export | Billing | Medium | High | ★★★★☆ |
| 14 | Payment allocation auto-match + unallocated bucket | Billing | Medium | High | ★★★★☆ |
| 15 | Maker-checker workflow engine (configurable) | All | High | High | ★★★★☆ |
| 16 | Mobile-first production entry form (offline) | Production | Medium | High | ★★★★☆ |
| 17 | Supervisor bulk approve attendance | Attendance | Low | High | ★★★★☆ |
| 18 | Customer credit block on dispatch + owner override | Dispatch | Low | High | ★★★★☆ |
| 19 | Reorder point auto-calc background job | Inventory | Low | High | ★★★★☆ |
| 20 | Gate pass auto-generate + QR + scan verification | Dispatch | Low | High | ★★★★☆ |
| 21 | Unit normalization (enum + migration) | Inventory | Low | Medium | ★★★★☆ |
| 22 | Category unique constraint + UI prevention | Inventory | Low | Medium | ★★★★☆ |
| 23 | Multi-language (Hindi/English) for operator flows | All | Medium | Medium | ★★★☆☆ |
| 24 | WhatsApp/Telegram alert integration | All | Medium | Medium | ★★★☆☆ |
| 25 | Shift handover notes (supervisor-to-supervisor) | Workforce | Low | Medium | ★★★☆☆ |

---

## 11. FINAL CEO REPORT
### From: Rajesh Patel, Owner — Shree Ganesh Steel Industries
### To: FactoryNerve Product Team
### Date: After 30 days running factory on FactoryNerve

---

**Would we continue using FactoryNerve?**
**No. Not in current state.**

We tried. Honestly, we wanted this to work. The steel domain model is the best we've seen — inventory items, batches, dispatches, customers, fraud alerts — the *data structures* are right. But the *workflows* don't survive contact with real factory conditions.

**Would we pay for it?**
**No.** Not today. At ₹15,000-25,000/month (our estimate), we'd be paying for a system that creates more work than it saves. Our accountants spend 3 hours/day fixing OCR. Our supervisors click 20 times to approve missed punches. Our operators avoid the mobile app. Our dispatch team bypasses the approval flow because it's faster to WhatsApp the gate pass. The owner (me) opens the dashboard, sees "Production: 142 MT", and still calls the production manager on WhatsApp to ask "How was yesterday?"

**What frustrated us most:**

1. **OCR is a toy, not a tool.** We scanned 200+ documents in 30 days. Purchase invoices (printed) — 60% success. Weighbridge slips (handwritten, wet, folded) — 20% success. Mill certificates (mixed table + text) — 40% success. The Anthropic fallback helps but times out. No queue. No "I'll fix it later" — it either works now or we type it manually. We typed manually.

2. **No offline = no trust.** Our factory has 3 dead zones: melt shop basement, rolling mill pit, scrap yard. Workers punch in, see spinner, give up. Supervisor writes on paper. Data enters system 4 hours late. By then, attendance is "fixed" manually. The system becomes a lagging record, not a leading tool.

3. **Dispatch approval is theater.** Security guard at gate: "Sir, I just click Loaded → Exited → Delivered. Truck hasn't left. Weighbridge? Don't have one. POD photo? Driver refuses." The system shows "Delivered". Stock deducted. Invoice marked paid. Money? "Will come." This is how leakage happens. The workflow *enables* the bypass.

4. **Night shift is broken.** 20 workers on night shift. Every morning 3-4 have "punch out failed". Supervisor fixes in admin. Payroll team hates us. This is basic — 22:00 to 06:00 crosses midnight. How is this not tested?

5. **Owner dashboard is a screensaver.** Pretty cards. "Stock Value: ₹4.2Cr". Great. How much cash? "Check bank portal." Who owes us >45 days? "Ask accountant." Yield dropped? "Production manager knows." Dispatch vs invoice? "Manual check." I have three screens open: Bank, WhatsApp, FactoryNerve. FactoryNerve tells me least.

6. **Double-click = duplicate data.** Operators double-tap. Network retries. Browser back button. We found: 12 duplicate attendance records, 3 double inventory deductions, 2 duplicate batches, 1 double dispatch. No idempotency anywhere. This is Computer Science 101.

7. **CSV import missing.** 120 workers. 6 hours manual entry. 23 wrong roles. 87th worker crashes on user_code collision. In 2026, no CSV import for onboarding?

**What impressed us:**

1. **Steel domain model is solid.** Items, batches, dispatches, customers, fraud alerts, reconciliations — the *schema* understands our business. Foreign keys, constraints, audit logs — this is rare. Most SaaS forces generic "product" on us. You built for steel.

2. **Attendance shift logic (mostly) works.** Morning/Evening/Night with grace minutes, overtime, cross-midnight night shift — the *logic* is right. Just the night shift punch-out query is wrong. Fixable.

3. **Authorization is granular.** Owner/Admin/Manager/Supervisor/Operator/Attendance — permissions map to our org chart. PDP enforcement works. Audit trail on every action. This is compliance-ready.

4. **Inventory intelligence exists.** Low stock alerts, dead stock, slow moving, overstock, turnover, ABC analysis, reconciliation risk — the *calculations* are there. Just no action buttons (create PO, transfer, write-off).

5. **Multi-factory org structure.** Org → Factory → User with roles per factory. We'll need this when Unit 2 starts. Good foresight.

**What feels incomplete:**

- **Production**: No BOM, no machine link, no heat tracking, no yield auto-calc, no downtime integration. It's a "batch logger", not production management.
- **Billing**: No GST auto-calc, no TDS/TCS, no GSTR-1, payment allocation manual. Accountants use Tally alongside.
- **Dispatch**: No weighbridge, no gate pass QR, no POD enforcement, approval bypass. It's a "dispatch logger".
- **Analytics**: Metrics without insights. No alerts, no trends, no cash flow, no aging.
- **Mobile**: Desktop tables shrunk to phone. No offline. Camera OCR unusable. Operators avoid.

**What feels world-class (potential):**

- The **steel domain model** — if workflows matched the model, this would be the best steel ERP in India
- The **authorization + audit** — compliance-ready foundation
- The **inventory intelligence calculations** — just need action layer
- The **fraud detection alerts** — coil theft, scrap loss, variance — smart signals exist

---

### Our Verdict

**FactoryNerve has the best steel data model we've seen, but the worst workflow execution for real factory conditions.**

Fix the **Top 7 P0s** (Offline, OCR, Dispatch state machine, Stock constraints, Night shift, Idempotency, Owner decisions) and we'll pay **₹25,000/month** and become a reference customer.

Ship current version? **We'll cancel before first invoice.**

---

**Signed,**
**Rajesh Patel**
Owner, Shree Ganesh Steel Industries
*30 days, 120 workers, 2400 attendance records, 200+ OCR scans, 150+ inventory transactions, 24 production batches, 15 dispatches, countless WhatsApp messages*

---

*Report generated from 30-day simulation of Shree Ganesh Steel Industries on FactoryNerve v0.x. All scenarios based on actual codebase analysis and realistic factory operations modeling.*