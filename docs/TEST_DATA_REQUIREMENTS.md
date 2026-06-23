# Factory Nerve — Test Data Requirements Document

> **Factory:** Maharashtra Steel Works Pvt. Ltd., MIDC Industrial Area, Kalamboli, Navi Mumbai - 410218  
> **Industry:** Steel Re-rolling & TMT Bar Manufacturing  
> **Data Currency:** Financial Year 2025-26  
> **Base Currency:** INR (₹)  
> **Production Capacity:** 120,000 MT/annum (TMT Bars, Angles, Channels)  

---

## Contents

1. [Role 1: Attendance Officer](#1-attendance-officer)
2. [Role 2: Operator](#2-operator)
3. [Role 3: Supervisor](#3-supervisor)
4. [Role 4: Accountant](#4-accountant)
5. [Role 5: Manager](#5-manager)
6. [Role 6: Admin](#6-admin)
7. [Role 7: Owner](#7-owner)
8. [Cross-Role Data Dependencies Matrix](#8-cross-role-data-dependencies-matrix)
9. [Master Reference Data](#9-master-reference-data)

---

## 1. Attendance Officer

### 1.1 Role Overview

| Attribute | Detail |
|-----------|--------|
| **Role ID** | `attendance` (rank 0) |
| **Also Known As** | Worker, Daily Wager, Labour |
| **Daily Purpose** | Mark own attendance, view own attendance record, submit regularization requests for missed/corrected punches |
| **Modules Accessed** | Attendance only |
| **Permissions** | Self-service punch-in/out, view own record, create regularization requests |
| **Cannot Do** | View team attendance, approve anything, access production/OCR/invoicing/billing/settings |
| **UI Complexity** | Very low — single-task interface, mobile-first |
| **Factory Example** | 85 daily-wage workers + 30 permanent staff on rolling mill shifts |

### 1.2 Test Data Needed

#### Prerequisite Master Data
```
Employee Profiles (Attendance):
┌──────────────┬────────────┬──────────────┬──────────────┬──────────────┐
│ Employee ID  │ Name       │ Shift         │ Department   │ Daily Wage   │
├──────────────┼────────────┼──────────────┼──────────────┼──────────────┤
│ EMP-001      │ Rajesh     │ A (06:00-14: │ Rolling Mill │ ₹650         │
│              │ Patil      │ 00)          │              │              │
│ EMP-002      │ Suresh     │ A (06:00-14: │ Rolling Mill │ ₹650         │
│              │ Kamble     │ 00)          │              │              │
│ EMP-003      │ Dattatray  │ B (14:00-22: │ Furnace      │ ₹700         │
│              │ Gaikwad    │ 00)          │              │              │
│ EMP-004      │ Mahesh     │ B (14:00-22: │ Furnace      │ ₹700         │
│              │ Jadhav     │ 00)          │              │              │
│ EMP-005      │ Santosh    │ C (22:00-06: │ Cooling Bed  │ ₹750         │
│              │ Shinde     │ 00)          │              │              │
│ EMP-006      │ Prakash    │ C (22:00-06: │ Cooling Bed  │ ₹750         │
│              │ Sawant     │ 00)          │              │              │
│ EMP-007      │ Sunil      │ A (06:00-14: │ Warehouse    │ ₹600         │
│              │ More       │ 00)          │              │              │
│ EMP-008      │ Ramesh     │ A (06:00-14: │ Maintenance  │ ₹800         │
│              │ Desai      │ 00)          │              │              │
│ EMP-009      │ Vikas      │ B (14:00-22: │ Dispatch     │ ₹550         │
│              │ Chavan     │ 00)          │              │              │
│ EMP-010      │ Anand      │ A (06:00-14: │ Quality      │ ₹850         │
│              │ Joshi      │ 00)          │              │              │
└──────────────┴────────────┴──────────────┴──────────────┴──────────────┘

Shift Templates:
┌──────────┬──────────────┬────────────┬─────────────┬───────────────┐
│ Shift ID │ Name         │ Start Time │ End Time    │ Grace Minutes │
├──────────┼──────────────┼────────────┼─────────────┼───────────────┤
│ SFT-A    │ Morning      │ 06:00      │ 14:00       │ 15            │
│ SFT-B    │ Afternoon    │ 14:00      │ 22:00       │ 15            │
│ SFT-C    │ Night        │ 22:00      │ 06:00       │ 15            │
└──────────┴──────────────┴────────────┴─────────────┴───────────────┘
```

#### Daily Test Data Per Shift

```
Attendance for 2026-06-22 (Sample Day):
┌──────────────┬──────────┬──────────────┬──────────────┬─────────────┐
│ Employee     │ Shift    │ Punch In     │ Punch Out    │ Status      │
├──────────────┼──────────┼──────────────┼──────────────┼─────────────┤
│ EMP-001      │ A        │ 05:55        │ 14:10        │ Completed   │
│ EMP-002      │ A        │ 06:12        │ 14:05        │ Completed   │
│ EMP-003      │ B        │ 13:50        │ 22:15        │ Completed   │
│ EMP-004      │ B        │ 14:30        │ --           │ Working     │
│ EMP-005      │ C        │ 21:45        │ 06:20        │ Completed   │
│ EMP-006      │ C        │ --           │ --           │ Missed Punch│
│ EMP-007      │ A        │ 06:00        │ 14:00        │ Completed   │
│ EMP-008      │ A        │ 05:50        │ 14:30        │ Completed   │
│ EMP-009      │ B        │ 14:05        │ 22:00        │ Completed   │
│ EMP-010      │ A        │ 08:30        │ 14:00        │ Late (>3)   │
└──────────────┴──────────┴──────────────┴──────────────┴─────────────┘

Late Mark Accumulation (Monthly Threshold: 3 late marks → half-day deduction):
┌──────────────┬─────────────┬───────────────┬────────────────┐
│ Employee     │ Late Marks  │ Half-Days     │ Action Needed  │
│              │ This Month  │ Deducted      │                │
├──────────────┼─────────────┼───────────────┼────────────────┤
│ EMP-001      │ 0           │ 0             │ None           │
│ EMP-002      │ 1           │ 0             │ Warning        │
│ EMP-003      │ 2           │ 0             │ Warning        │
│ EMP-010      │ 4           │ 1             │ Flagged        │
└──────────────┴─────────────┴───────────────┴────────────────┘
```

### 1.3 Daily Task Checklist

| # | Task | Steps | Expected Result | Test Data |
|----|------|-------|-----------------|-----------|
| 1 | Punch In (on time) | Login → Dashboard → Punch In button | Record created with `status=working`, timestamp logged | EMP-001 at 05:55 |
| 2 | Punch In (late) | Same flow after grace period | Record created with late flag, late mark incremented | EMP-010 at 08:30 |
| 3 | Punch Out | Dashboard → Punch Out | Record updated to `status=completed`, duration calculated | EMP-001 at 14:10 |
| 4 | View own attendance | Navigate to attendance section | Shows current month calendar with punch times | EMP-001 viewing history |
| 5 | Submit regularization | Attendance → Regularization → Select missed punch → Submit | `AttendanceRegularization` created with `status=pending` | EMP-006 requesting correction for 2026-06-22 |
| 6 | View personal report | Reports → My Attendance | Downloadable summary of own attendance | EMP-001, current month |

### 1.4 Edge Cases to Test

| Edge Case | Scenario | Expected Behavior | Test Data |
|-----------|----------|-------------------|-----------|
| **Cross-midnight shift** | Night shift (22:00-06:00) punch-out next day | Punch-out works across date boundary, duration = 8h | EMP-005 punch-out at 06:20 next day |
| **Duplicate punch-in** | User clicks Punch In twice within 1 minute | Reject second attempt with "Already punched in" error | EMP-001 rapid double-click |
| **Missing shift assignment** | Employee has no shift template assigned | Block punch with "No shift configured" error | Create EMP-999 with no shift |
| **Back-date punch** | Attempt to punch for yesterday | Reject — punches only allowed for current shift day | API call with past date |
| **Holiday punch** | Sunday/public holiday punch | Allow (overtime marking) with OT flag | EMP-001 on Sunday 2026-06-28 |
| **Regularization limit** | Same employee submits 3 regularization requests in one day | Allow multiple, but supervisor queue shows all | EMP-006 submits 3 corrections |
| **Regularization type** | Missed punch vs timing correction vs status correction | Each type gets correct form validation | EMP-004 timing correction (punch-in 14:30→14:00) |
| **First-ever punch** | Newly created user's first punch | Works normally, creates first attendance record | Fresh EMP-888 created same day |
| **Concurrent punch** | Two employees punch simultaneously | Both succeed, independent records | EMP-001 & EMP-002 at 05:55:00 |
| **Data dependency** | Employee leaves without punching out | Overnight auto-marks as "missed_punch" at midnight | EMP-006 scenario (no punch-out) |

> **🔗 Data Dependency:** Attendance Officer creates the raw data that flows into **Accountant** (payroll calculation) and **Supervisor** (team attendance review queue). Without attendance data, payroll and attendance reports are empty.

---

## 2. Operator

### 2.1 Role Overview

| Attribute | Detail |
|-----------|--------|
| **Role ID** | `operator` (rank 1) |
| **Also Known As** | Machine Operator, Floor Worker, Shift In-charge |
| **Daily Purpose** | Create production batches, log production entries, scan documents via OCR, log truck entry/exit at gate, view stock levels |
| **Modules Accessed** | Dashboard, Work Queue, Production Entry, Attendance (self), OCR Scan, Stock View (limited), Gate Log |
| **Permissions** | Create entries (submitted status), view production batches, view stock levels, create own attendance, log truck movement, scan OCR documents |
| **Cannot Do** | Approve entries, manage dispatch, view invoices/customers/payments, access reports/analytics, manage users/settings |
| **UI Complexity** | Low — action-first, mobile-first, minimal analysis |
| **Factory Example** | 15 operators across 3 shifts, each running 2-3 machines |

### 2.2 Test Data Needed

#### Prerequisite Data (must exist before Operator can work)
```
Factory Configuration:
├── Factory Name: Maharashtra Steel Works - Unit 1
├── Factory ID: FACT-001
├── Production Lines:
│   ├── LINE-01: Rebar Mill #1 (Capacity: 15 MT/hr)
│   ├── LINE-02: Angle Mill #1 (Capacity: 8 MT/hr)
│   ├── LINE-03: Channel Mill #1 (Capacity: 10 MT/hr)
│   ├── LINE-04: Furnace #1 (Capacity: 20 MT/hr)
│   └── LINE-05: Cooling Bed #1 (Capacity: 25 MT/hr)
└── Machines:
    ├── MCH-001: Rebar Stand 1K (Line: Rebar Mill)
    ├── MCH-002: Rebar Stand 1L (Line: Rebar Mill)
    ├── MCH-003: Shear Machine (Line: Rebar Mill)
    ├── MCH-004: Angle Roll Former (Line: Angle Mill)
    ├── MCH-005: Channel Roll Former (Line: Channel Mill)
    ├── MCH-006: Induction Furnace #1 (Line: Furnace)
    └── MCH-007: Cooling Bed Conveyor (Line: Cooling Bed)

Steel Products Catalog:
┌──────────┬──────────────────────┬──────────┬──────────────┐
│ SKU      │ Product Name         │ Grade    │ Rate (₹/kg)  │
├──────────┼──────────────────────┼──────────┼──────────────┤
│ TMT-10   │ 10mm TMT Bar         │ Fe-500D  │ ₹58.50       │
│ TMT-12   │ 12mm TMT Bar         │ Fe-500D  │ ₹57.00       │
│ TMT-16   │ 16mm TMT Bar         │ Fe-550D  │ ₹56.00       │
│ TMT-20   │ 20mm TMT Bar         │ Fe-550D  │ ₹55.50       │
│ ANG-25   │ 25x25x3mm Angle      │ IS:2062  │ ₹62.00       │
│ ANG-40   │ 40x40x5mm Angle      │ IS:2062  │ ₹59.00       │
│ CHN-75   │ 75x40mm Channel      │ IS:808   │ ₹61.00       │
│ CHN-100  │ 100x50mm Channel     │ IS:808   │ ₹60.00       │
│ BILLET   │ 130mm Square Billet  │ 3SP/5SP  │ ₹44.00       │
└──────────┴──────────────────────┴──────────┴──────────────┘

Current Stock Levels (beginning of shift):
┌──────────┬──────────────────────┬──────────┬──────────────┐
│ SKU      │ Product Name         │ Quantity │ Location     │
│          │                      │ (kg)     │              │
├──────────┼──────────────────────┼──────────┼──────────────┤
│ TMT-10   │ 10mm TMT Bar         │ 45,000   │ Yard A       │
│ TMT-12   │ 12mm TMT Bar         │ 62,000   │ Yard A       │
│ TMT-16   │ 16mm TMT Bar         │ 28,000   │ Yard B       │
│ TMT-20   │ 20mm TMT Bar         │ 15,500   │ Yard B       │
│ ANG-25   │ 25mm Angle           │ 12,000   │ Yard C       │
│ ANG-40   │ 40mm Angle           │ 8,200    │ Yard C       │
│ CHN-75   │ 75mm Channel         │ 9,800    │ Yard C       │
│ CHN-100  │ 100mm Channel        │ 6,500    │ Yard D       │
│ BILLET   │ 130mm Billet         │ 120,000  │ Raw Mat Yard │
└──────────┴──────────────────────┴──────────┴──────────────┘
```

#### Daily Production Entry Data

```
Sample Production Batch — Shift A, 2026-06-22:
┌────────────┬──────────┬──────────┬──────────┬──────────────┬──────────────┐
│ Batch ID   │ Product  │ Target   │ Actual   │ Input Raw    │ Downtime     │
│            │          │ (kg)     │ (kg)     │ (kg billets) │ (min)        │
├────────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┤
│ BATCH-001  │ TMT-10   │ 45,000   │ 42,800   │ 44,500       │ 22           │
│ BATCH-002  │ TMT-12   │ 50,000   │ 51,200   │ 53,200       │ 15           │
│ BATCH-003  │ TMT-16   │ 30,000   │ 28,500   │ 29,800       │ 45           │
│ BATCH-004  │ TMT-20   │ 20,000   │ 19,200   │ 20,100       │ 12           │
│ BATCH-005  │ ANG-25   │ 15,000   │ 14,800   │ 15,500       │ 8            │
│ BATCH-006  │ CHN-75   │ 12,000   │ 12,400   │ 12,900       │ 5            │
└────────────┴──────────┴──────────┴──────────┴──────────────┴──────────────┘

Variance Calculations:
┌────────────┬──────────┬──────────┬────────────────────┬──────────┐
│ Batch ID   │ Yield %  │ Variance │ Variance %         │ Severity │
│            │          │ (kg)     │                    │          │
├────────────┼──────────┼──────────┼────────────────────┼──────────┤
│ BATCH-001  │ 96.2%    │ -2,200   │ -4.9%              │ Watch    │
│ BATCH-002  │ 96.2%    │ +1,200   │ +2.4%              │ Normal   │
│ BATCH-003  │ 95.6%    │ -1,500   │ -5.0%              │ Watch    │
│ BATCH-004  │ 95.5%    │ -800     │ -4.0%              │ Watch    │
│ BATCH-005  │ 95.5%    │ -200     │ -1.3%              │ Normal   │
│ BATCH-006  │ 96.1%    │ +400     │ +3.3%              │ Normal   │
└────────────┴────────────┴──────────┴──────────────┴──────────┘

Gate Entry Log (Truck Movements):
┌────────┬────────────┬──────────────┬──────────────┬──────────┬──────────┐
│ Truck  │ Driver     │ Material     │ Gross Weight │ Tare     │ Net      │
│ No.    │ Name       │              │ (kg)         │ Weight   │ (kg)     │
│        │            │              │              │ (kg)     │          │
├────────┼────────────┼──────────────┼──────────────┼──────────┼──────────┤
│ MH-04- │ Iqbal Khan │ Billets      │ 42,500       │ 8,200    │ 34,300   │
│ AB-1234│            │              │              │          │          │
│ MH-04- │ Raju Verma │ TMT-12 (out) │ 36,200       │ 7,800    │ 28,400   │
│ XY-5678│            │              │              │          │          │
│ MH-43- │ Gurpreet   │ Scrap (out)  │ 28,000       │ 6,500    │ 21,500   │
│ PQ-9012│ Singh      │              │              │          │          │
└────────┴────────────┴──────────────┴──────────────┴──────────┴──────────┘
```

### 2.3 Daily Task Checklist

| # | Task | Steps | Expected Result | Test Data |
|----|------|-------|-----------------|-----------|
| 1 | Start shift & punch in | Login → Attendance → Punch In | Working status recorded | Operator at 05:55 |
| 2 | View work queue | Dashboard → Work Queue | Shows pending batches for shift | BATCH-001 through BATCH-006 |
| 3 | Create production entry | Select line → Enter target/actual/raw → Smart Parse → Submit | Entry created with `status=submitted` | BATCH-001: 42,800 kg actual |
| 4 | Log gate entry | Gate → New Entry → Enter truck details | Truck entry logged with pending status | Truck MH-04-AB-1234 in |
| 5 | Log gate exit | Gate → Select truck → Enter out-weight | Exit logged, net weight calculated | Truck MH-04-XY-5678 out |
| 6 | Scan document with OCR | OCR Scan → Upload image → Submit | OCR job created in draft/pending | Challan/invoice photo |
| 7 | View stock levels | Inventory → Stock View | Shows current quantities for all SKUs | All products, real-time |
| 8 | End shift & punch out | Attendance → Punch Out | Completed status, shift duration logged | Operator at 14:00 |

### 2.4 Edge Cases to Test

| Edge Case | Scenario | Expected Behavior | Test Data |
|-----------|----------|-------------------|-----------|
| **Negative stock check** | Operator tries to dispatch more than available stock | Block transaction with "Insufficient stock" error | Dispatch 100,000 kg TMT-10 (only 45,000 available) |
| **Smart parse correction** | AI suggests wrong values from free-text input | Operator can edit before submitting | "45 MT TMT 10" → AI suggests 45,000 kg (correct) |
| **Downtime > shift hours** | Operator enters 500 min downtime (only 480 min shift) | Validate: downtime cannot exceed shift duration | BATCH with 500 min downtime |
| **Zero production entry** | Machine breakdown — no output to record | Allow entry with 0 actual, require reason | BATCH-007: 0 kg, reason="Shear breakdown" |
| **Duplicate truck entry** | Same truck number entered twice within 5 min | Flag as duplicate, block second entry | MH-04-AB-1234 re-entry attempt |
| **Inter-shift handoff** | Shift A Operator creates batch, Shift B Operator continues | Next operator can edit same batch with co-owner tag | BATCH-001 straddling shift A/B |
| **OCR poor quality image** | Blurry/angled photo of a document | OCR returns low confidence, marks for review | Test with 50% blur image |
| **Offline queue** | Network drops during entry creation | Save to local queue, sync when online | Submit entry with connection interrupted |
| **Multiple machines per shift** | Operator runs both Rebar Mill and Furnace | Can create entries for both, independent tracking | MCH-001 and MCH-006 in same shift |
| **No pending queue** | All batches already completed for the day | Show "All batches completed" message | After 6th batch submitted |

> **🔗 Data Dependency:** Operator creates production entries that go to **Supervisor** for approval. Gate entries flow to **Supervisor** (dispatch tracking) and **Accountant** (invoicing). Stock movements update inventory viewed by **Manager** and **Owner**.

---

## 3. Supervisor

### 3.1 Role Overview

| Attribute | Detail |
|-----------|--------|
| **Role ID** | `supervisor` (rank 2) |
| **Also Known As** | Shift Lead, Floor Controller, Production Supervisor |
| **Daily Purpose** | Review & approve/reject operator entries, manage dispatch flow, approve team attendance, review OCR verifications, track stock reconciliation |
| **Modules Accessed** | Approvals, Work Queue, Attendance Review, OCR Verify, Stock Review, Dispatch, Reports (read), Alerts |
| **Permissions** | Approve/reject entries (maker-checker), approve attendance corrections, manage dispatch status updates, review & submit OCR verifications, view team attendance, create inventory transactions |
| **Cannot Do** | Delete records, manage users/settings, access billing/plans, create/edit invoices, override stock figures |
| **UI Complexity** | Medium — queue-first, exception-first, safe decision UI |
| **Factory Example** | 3 shift supervisors, each managing 5-7 operators per shift |

### 3.2 Test Data Needed

#### Prerequisite Data
```
All Operator data from Section 2 MUST exist first.

Pending Approval Queue (as of 2026-06-22 10:00 AM):
┌────────────┬──────────┬──────────┬──────────┬────────────────┬──────────────┐
│ Entry ID   │ Created  │ Product  │ Qty (kg) │ Created By     │ Age (hours)  │
│            │ By       │          │          │                │              │
├────────────┼──────────┼──────────┼──────────┼────────────────┼──────────────┤
│ ENT-001    │ Operator │ TMT-10   │ 42,800   │ Rajesh Patil   │ 2.5          │
│            │ A        │          │          │ (EMP-001)      │              │
│ ENT-002    │ Operator │ TMT-12   │ 51,200   │ Suresh Kamble  │ 2.0          │
│            │ A        │          │          │ (EMP-002)      │              │
│ ENT-003    │ Operator │ TMT-16   │ 28,500   │ Dattatray G.   │ 1.5          │
│            │ B        │          │          │ (EMP-003)      │              │
│ ENT-004    │ Operator │ TMT-20   │ 19,200   │ Ramesh Desai   │ 1.0          │
│            │ A        │          │          │ (EMP-008)      │              │
│ ENT-005    │ Operator │ ANG-25   │ 14,800   │ Anand Joshi    │ 0.5          │
│            │ B        │          │          │ (EMP-010)      │              │
│ ENT-006    │ Operator │ CHN-75   │ 12,400   │ Prakash Sawant │ 0.3          │
│            │ C        │          │          │ (EMP-006)      │              │
└────────────┴──────────┴──────────┴──────────┴────────────────┴──────────────┘

Pending Attendance Regularizations:
┌──────────────┬────────────┬──────────────┬─────────────┬────────────┐
│ Request ID   │ Employee   │ Type         │ Reason      │ Submitted  │
├──────────────┼────────────┼──────────────┼─────────────┼────────────┤
│ REG-001      │ EMP-006    │ Missed Punch │ Doctor's    │ 09:15 AM   │
│              │ Prakash S. │ (22/06)      │ appointment │            │
│ REG-002      │ EMP-004    │ Timing       │ Clock was   │ 09:30 AM   │
│              │ Mahesh J.  │ Correction   │ 30 min slow │            │
│ REG-003      │ EMP-010    │ Status       │ Was present │ 10:00 AM   │
│              │ Anand J.   │ Correction   │ at 06:00    │            │
└──────────────┴────────────┴──────────────┴─────────────┴────────────┘

Pending OCR Verifications:
┌──────────┬──────────────┬──────────────┬──────────┬──────────┐
│ OCR ID   │ Document     │ Confidence   │ Uploaded │ Status   │
│          │ Type         │ (%)          │ By       │          │
├──────────┼──────────────┼──────────────┼──────────┼──────────┤
│ OCR-001  │ Challan      │ 87.5%        │ Rajesh   │ Pending  │
│          │ (Raw Mat.)   │              │ Patil    │          │
│ OCR-002  │ Production   │ 62.3%        │ Suresh   │ Pending  │
│          │ Log Sheet    │              │ Kamble   │ (Low Conf)│
├──────────┼──────────────┼──────────────┼──────────┼──────────┤
│ OCR-003  │ Weight Slip  │ 93.1%        │ Anand    │ Pending  │
│          │ (Dispatch)   │              │ Joshi    │          │
└──────────┴──────────────┴──────────────┴──────────┴──────────┘

Pending Dispatch Status Changes:
┌─────────────┬──────────┬──────────┬──────────┬──────────────┐
│ Dispatch ID │ Truck    │ Product  │ Qty (kg) │ Current      │
│             │          │          │          │ Status       │
├─────────────┼──────────┼──────────┼──────────┼──────────────┤
│ DSP-001     │ MH-04-   │ TMT-12   │ 28,400   │ Loaded       │
│             │ XY-5678  │          │          │ (→ Dispatched)│
│ DSP-002     │ MH-14-   │ TMT-10   │ 14,000   │ Pending      │
│             │ CD-4321  │          │          │ (→ Load)     │
│ DSP-003     │ MH-43-   │ CHN-75   │ 9,800    │ Loaded       │
│             │ EF-8765  │          │          │ (→ Dispatched)│
└─────────────┴──────────┴──────────┴──────────┴──────────────┘

Team Roster (Supervisor's Team):
┌──────────────┬──────────────┬──────────┬──────────────┐
│ Employee     │ Role         │ Shift    │ Today's      │
│              │              │          │ Attendance   │
├──────────────┼──────────────┼──────────┼──────────────┤
│ EMP-001      │ Operator     │ A        │ Present      │
│ EMP-002      │ Operator     │ A        │ Present      │
│ EMP-007      │ Warehouse    │ A        │ Present      │
│ EMP-008      │ Maintenance  │ A        │ Present      │
│ EMP-010      │ Quality      │ A        │ Late         │
└──────────────┴──────────────┴──────────┴──────────────┘
```

### 3.3 Daily Task Checklist

| # | Task | Steps | Expected Result | Test Data |
|----|------|-------|-----------------|-----------|
| 1 | Review approval queue | Approvals → View pending entries | Shows 6 entries with creator, age, details | ENT-001 through ENT-006 |
| 2 | Approve valid entry | Select ENT-001 → Review → Approve | Entry status→approved, audit logged | ENT-001 (TMT-10, 42,800 kg) |
| 3 | Reject with reason | Select ENT-003 → Review → Reject (reason: "Variance >5%, recheck") | Entry status→rejected, reason stored | ENT-003 (TMT-16, -5.0% variance) |
| 4 | Review attendance | Attendance Review → View pending regularizations | Shows 3 requests with reasons | REG-001, REG-002, REG-003 |
| 5 | Approve regularization | REG-001 → Verify → Approve | Regularization approved, attendance record corrected | EMP-006 missed punch corrected |
| 6 | Reject regularization | REG-003 → Verify → Reject (note: "No evidence provided") | Regularization rejected, employee notified | EMP-010 status correction denied |
| 7 | Review OCR verifications | OCR Verify → View pending | Shows 3 documents pending | OCR-001, OCR-002, OCR-003 |
| 8 | Approve/Reject OCR | OCR-001 → Review rows → Approve | OCR status→approved or rejected | OCR-001 (87.5% confidence, approve) |
| 9 | Update dispatch status | Dispatch → DSP-001 → Status→Dispatched | Dispatch moves to dispatched, inventory posted | DSP-001, 28,400 kg TMT-12 |
| 10 | Generate gate pass | Dispatch → Create Gate Pass → Enter details | Gate pass generated for outgoing truck | DSP-002 truck loading |
| 11 | View team live board | Attendance → Live Board | Shows all team members with current status | 5 team members, real-time |
| 12 | Acknowledge alert | Alerts → View → Acknowledge | Alert marked as acknowledged | Stock mismatch alert |

### 3.4 Edge Cases to Test

| Edge Case | Scenario | Expected Behavior | Test Data |
|-----------|----------|-------------------|-----------|
| **Self-approval prevention** | Supervisor tries to approve own production entry | Block with "Cannot approve own entry" error | Supervisor creates entry → tries to approve it |
| **Approval after shift ends** | Entry from previous shift reviewed next day | Allow — no time limit on review | ENT created yesterday, approved today |
| **Re-approve rejected entry** | Already-rejected entry attempted for approval | Block — already in terminal state | ENT-003 after rejection |
| **High-variance auto-flag** | Entry with >10% variance | Auto-flag as critical severity, require manager override | BATCH with 12% variance |
| **Missing rejection reason** | Attempt to reject without providing reason | Block — reason required | Empty rejection note |
| **Dispatch quantity > invoice** | DSP tries to dispatch more than remaining invoice qty | Block with "Exceeds invoice balance" | Invoice 50,000 kg, dispatch attempt 60,000 kg |
| **OCR low confidence review** | OCR-002 with 62.3% confidence | Marked as "Review Required" with yellow banner | OCR-002 (62.3% < 75% threshold) |
| **Duplicate dispatch status** | DSP-001 status updated to "Dispatched" twice | Idempotent — second update ignored | Double-click on status button |
| **Cross-supervisor visibility** | Supervisor A tries to view Supervisor B's team | Block — scoped to own factory line only | Wrong factory context |
| **Attendance record dispute** | Employee challenges attendance correction outcome | Supervisor can view history, re-open for manager review | REG-002 approved, employee disputes |

> **🔗 Data Dependency:** Supervisor approvals unlock data flow to **Accountant** (trusted entries → financial reporting) and **Manager** (approved batches → analytics). Rejected items may escalate to **Manager** for override.

---

## 4. Accountant

### 4.1 Role Overview

| Attribute | Detail |
|-----------|--------|
| **Role ID** | `accountant` (rank 3) |
| **Also Known As** | Finance Officer, Accounts Executive |
| **Daily Purpose** | Manage customer accounts, create invoices, record payments, allocate payments to invoices, review financial OCR, run financial reports |
| **Modules Accessed** | Reports, Steel Customers, Steel Invoices, Payments, Email Summary, Attendance Reports (view only) |
| **Permissions** | Full CRUD on invoices (pre-dispatch), customers, payments; view stock (for reconciliation only); email summary; attendance reports |
| **Cannot Do** | Create/edit production entries, approve floor operations, override credit limits, delete financial records, manage users/settings/billing |
| **UI Complexity** | Medium — reporting-first, clean commercial data, exports and summaries |
| **Factory Example** | 2 accountants, one for receivables and one for payables, each handling ~30 invoices/month |

### 4.2 Test Data Needed

#### Prerequisite Data
```
All Operator and Supervisor data from Sections 2 and 3 MUST exist.
Approved production entries from Supervisor must be available.

Customer Profiles:
┌────────────┬────────────────────┬────────────┬──────────────┬──────────────┐
│ Customer   │ Company Name       │ GSTIN      │ Credit Limit │ Outstanding  │
│ ID         │                    │            │ (₹)          │ (₹)          │
├────────────┼────────────────────┼────────────┼──────────────┼──────────────┤
│ CUST-001   │ Navi Mumbai        │ 27AABCU1234│ ₹50,00,000   │ ₹18,25,000  │
│            │ Construction Ltd   │ M1ZC       │              │              │
│ CUST-002   │ Thane Steel        │ 27AAGFT5678│ ₹35,00,000   │ ₹32,40,000  │
│            │ Traders            │ K1ZC       │              │              │
│ CUST-003   │ Pune Infrastructure│ 27ABXPK9012│ ₹75,00,000   │ ₹0          │
│            │ Projects           │ L1ZC       │              │              │
│ CUST-004   │ Kalyan Fabricators │ 27AYKPM3456│ ₹25,00,000   │ ₹8,50,000   │
│            │                    │ M1ZC       │              │              │
│ CUST-005   │ JNPT Port Logistics│ 27AABCZ7890│ ₹40,00,000   │ ₹38,75,000  │
│            │                    │ P1ZC       │              │ (Over limit) │
└────────────┴────────────────────┴────────────┴──────────────┴──────────────┘

Customer Verification Status:
┌────────────┬──────────┬──────────┬──────────┬──────────────┬──────────┐
│ Customer   │ PAN      │ GST      │ Name     │ Match Score  │ Status   │
│            │ Status   │ Status   │ Match    │ (%)          │          │
├────────────┼──────────┼──────────┼──────────┼──────────────┼──────────┤
│ CUST-001   │ Verified │ Verified │ Match    │ 98%          │ Verified │
│ CUST-002   │ Verified │ Verified │ Match    │ 95%          │ Verified │
│ CUST-003   │ Verified │ Verified │ Match    │ 100%         │ Verified │
│ CUST-004   │ Verified │ Pending  │ Match    │ 85%          │ Pending  │
│ CUST-005   │ Verified │ Verified │ Mismatch │ 62%          │ Mismatch │
└────────────┴────────────┴─────────┴──────────┴──────────────┴──────────┘

Invoice Data (Current Month):
┌──────────┬────────────┬──────────┬──────────┬────────────┬──────────────┐
│ Invoice  │ Customer   │ Product  │ Qty (kg) │ Amount (₹) │ Status       │
│ ID       │            │          │          │            │              │
├──────────┼────────────┼──────────┼──────────┼────────────┼──────────────┤
│ INV-001  │ CUST-001   │ TMT-12   │ 28,400   │ ₹16,18,800 │ Unpaid       │
│ INV-002  │ CUST-002   │ TMT-10   │ 14,000   │ ₹8,19,000  │ Partial      │
│ INV-003  │ CUST-003   │ TMT-16   │ 10,000   │ ₹5,60,000  │ Paid         │
│ INV-004  │ CUST-004   │ ANG-25   │ 8,000    │ ₹4,96,000  │ Unpaid       │
│ INV-005  │ CUST-005   │ CHN-75   │ 12,000   │ ₹7,32,000  │ Unpaid       │
│ INV-006  │ CUST-001   │ TMT-20   │ 15,000   │ ₹8,32,500  │ Unpaid       │
└──────────┴────────────┴──────────┴──────────┴────────────┴──────────────┘

Payment Records:
┌──────────┬────────────┬──────────┬──────────────┬──────────────┬──────────┐
│ Payment  │ Customer   │ Amount   │ Payment      │ Allocated To │ Date     │
│ ID       │            │ (₹)      │ Mode         │              │          │
├──────────┼────────────┼──────────┼──────────────┼──────────────┼──────────┤
│ PAY-001  │ CUST-002   │ ₹5,00,000│ Cheque       │ INV-002      │ 20/06/26 │
│          │            │          │ (#458712)    │ (₹5,00,000)  │          │
│ PAY-002  │ CUST-003   │ ₹5,60,000│ NEFT         │ INV-003      │ 18/06/26 │
│          │            │          │ (ICICI Ref:  │ (₹5,60,000)  │          │
│          │            │          │ NEFT56789)   │              │          │
└──────────┴────────────┴──────────┴──────────────┴──────────────┴──────────┘

Financial Documents Pending OCR Review:
┌──────────┬──────────────┬──────────┬──────────────┐
│ OCR ID   │ Document     │ Uploaded │ Amount (₹)   │
│          │ Type         │ By       │              │
├──────────┼──────────────┼──────────┼──────────────┤
│ OCR-004  │ Invoice Copy │ Account  │ ₹16,18,800   │
│ OCR-005  │ Payment      │ Account  │ ₹5,00,000    │
│          │ Receipt      │ ant      │              │
└──────────┴──────────────┴──────────┴──────────────┘
```

### 4.3 Daily Task Checklist

| # | Task | Steps | Expected Result | Test Data |
|----|------|-------|-----------------|-----------|
| 1 | Create sales invoice | Steel → Invoices → Create → Select customer + product → Enter qty/rate → Submit | Invoice created with `status=unpaid` | INV-007: CUST-001, TMT-12, 20,000 kg, ₹11,40,000 |
| 2 | Record customer payment | Steel → Payments → Record → Select customer → Enter amount → Choose mode | Payment recorded, pending allocation | CUST-004 pays ₹4,96,000 via cheque |
| 3 | Allocate payment to invoice | Select payment → Allocate → Choose invoice → Confirm | Invoice status updates (paid/partial) | PAY-001 partially pays INV-002 |
| 4 | Follow up on overdue | Customers → Select CUST-005 → Create follow-up task | Task created (status=open, priority=high) | CUST-005 overdue ₹38,75,000, credit limit exceeded |
| 5 | Review financial OCR | OCR → Financial Docs → Review OCR-004 | Verify extracted data matches source | OCR-004 invoice £16,18,800 |
| 6 | Approve financial OCR | If correct → Approve | OCR status→approved, trusted_export=true | OCR-004 approval |
| 7 | Check credit limits | Before creating invoice → Check customer credit | Warning if utilization >85%, block if 100% | CUST-005 at 96.9% utilization |
| 8 | Run attendance cost report | Reports → Attendance → Cost Summary | Shows total labour cost by department | Shift A: ₹42,000 for 5 employees |
| 9 | Generate email summary | Email Summary → Configure → Send | Summary with key financials sent | Daily sales, collections, outstanding |
| 10 | Edit pre-dispatch invoice | INV-004 → Edit (qty from 8,000 to 8,500 kg) | Allowed — no dispatch linked yet | INV-004 correction |

### 4.4 Edge Cases to Test

| Edge Case | Scenario | Expected Behavior | Test Data |
|-----------|----------|-------------------|-----------|
| **Post-dispatch invoice edit** | Accountant tries to edit INV-001 (dispatch already linked) | Block — "Invoice locked due to linked dispatch" | INV-001 has DSP-001 linked |
| **Delete invoice attempt** | Accountant tries to delete INV-002 | Block — "Only Admin/Owner can delete invoices" | INV-002 delete attempt |
| **Credit limit exceeded** | New invoice pushes CUST-005 over ₹40,00,000 limit | Warn at 85%, block at 100% with "Credit limit exceeded" | ₹2,00,000 additional invoice |
| **Payment allocation mismatch** | ₹5,00,000 payment allocated to INR invoice, balance remains | Partial payment correctly set, remaining amount = ₹3,19,000 | INV-002 (₹8,19,000) partial pay |
| **Duplicate invoice creation** | Same customer + product + qty created twice within 5 min | Flag as potential duplicate | INV-008 same as INV-006 |
| **Zero-weight invoice** | Invoice created with 0 kg | Block — quantity must be >0 | 0 kg invoice attempt |
| **GST validation failure** | Invalid GSTIN entered for customer | Block creation with "Invalid GST format" | 27AAAAA0000A1Z0 (dummy) |
| **Payment over invoice amount** | Customer pays ₹10,00,000 on ₹7,32,000 invoice | Allow — excess becomes credit note or unallocated | CUST-005 overpayment |
| **Customer status on hold** | Invoice creation for blocked customer | Block — "Customer is blocked, cannot create invoice" | CUST-005 after being blocked by Manager |
| **Bounced cheque handling** | Cheque payment bounces after allocation | Accountant can reverse allocation, mark as unpaid | PAY-001 bounce scenario |

> **🔗 Data Dependency:** Accountant's work flows to **Manager** (financial overview) and **Owner** (P&L, cash position). Payment and invoice data is used by **Admin** for billing reconciliation.

---

## 5. Manager

### 5.1 Role Overview

| Attribute | Detail |
|-----------|--------|
| **Role ID** | `manager` (rank 4) |
| **Also Known As** | Factory Manager, Plant Head, Operations Manager |
| **Daily Purpose** | Oversee all factory operations — bridge production and finance, handle escalations, override within scope, review analytics, manage team |
| **Modules Accessed** | Dashboard, Approvals, Reports, Analytics, Steel Control, Work Queue, Attendance Admin, Settings (limited), Alerts, OCR Verify |
| **Permissions** | Full over production & inventory, approve any entry, override dispatch qty & credit limit, create factories, invite users (lower roles), view all reports & analytics, manage attendance settings |
| **Cannot Do** | Assign Admin/Owner roles, manage billing/subscriptions, delete system records, view audit logs, configure alert rules |
| **UI Complexity** | Medium-high — control-first, report + review balance, cross-workflow visibility |
| **Factory Example** | 1 factory manager per unit, oversees 3 shift supervisors, 15 operators, 85 workers |

### 5.2 Test Data Needed

#### Prerequisite Data
```
ALL data from Sections 1-4 MUST exist.

Escalated Items Pending Manager Action:
┌────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Item ID    │ Type         │ Created By   │ Description  │ Escalation   │
│            │              │              │              │ Reason       │
├────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ ESC-001    │ Production   │ Supervisor   │ BATCH-003:   │ Variance     │
│            │ Variance     │              │ TMT-16, -5%  │ >5%, needs   │
│            │              │              │              │ manager OK   │
│ ESC-002    │ Credit Limit │ Accountant   │ CUST-005     │ Over limit   │
│            │ Override     │              │ ₹38,75,000   │ (96.9%)      │
│            │              │              │ (Limit:      │              │
│            │              │              │ ₹40,00,000)  │              │
│ ESC-003    │ Dispatch     │ Supervisor   │ DSP-003:     │ Qty exceeds  │
│            │ Override     │              │ CHN-75       │ invoice      │
│            │              │              │ 10,500 kg    │ remaining    │
│            │              │              │ (Invoice:    │              │
│            │              │              │ 9,800 kg)    │              │
│ ESC-004    │ Attendance   │ EMP-010      │ Late marks   │ Employee     │
│            │ Dispute      │ (Anand J.)   │ dispute:     │ appeals 4th  │
│            │              │              │ claims clock │ late mark    │
│            │              │              │ was fast     │              │
└────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

Analytics & Dashboard Data (Current Week, 16-22 June 2026):
┌──────────────────┬────────────────────────────────────────────────┐
│ Metric           │ Value                                         │
├──────────────────┼────────────────────────────────────────────────┤
│ Total Production │ 1,68,900 kg (Week)                            │
│ Avg Yield        │ 95.8%                                         │
│ Downtime Total   │ 107 minutes (Week)                            │
│ Top Product      │ TMT-12 (51,200 kg, 30.3% of total)           │
│ Invoices Created │ 6 (₹50,58,300 total value)                    │
│ Payments Recvd   │ 2 (₹10,60,000 total)                          │
│ Outstanding      │ ₹72,28,300 (across 4 customers)               │
│ Stock Value      │ ₹1,82,65,000 (current estimated)              │
│ Attendance %     │ 92% (48 of 52 workers present today)          │
│ Alerts Active    │ 3 (Stock mismatch, Credit over-limit,         │
│                  │    Dispatch variance)                          │
└──────────────────┴────────────────────────────────────────────────┘

Factory Settings (Manager can modify):
┌─────────────────────┬──────────────────────────────┐
│ Setting             │ Current Value                │
├─────────────────────┼──────────────────────────────┤
│ Operating Shifts    │ 3 (A: 06-14, B: 14-22,      │
│                     │    C: 22-06)                 │
│ Overtime Rate       │ 2.0x base wage              │
│ Late Mark Threshold │ 3 per month → half-day       │
│ Quality Check       │ Every batch                  │
│ Interval            │                              │
│ Safety Briefing     │ Required before shift start  │
│ Inventory Alert     │ <5,000 kg triggers reorder   │
│ Threshold           │                              │
└─────────────────────┴──────────────────────────────┘
```

### 5.3 Daily Task Checklist

| # | Task | Steps | Expected Result | Test Data |
|----|------|-------|-----------------|-----------|
| 1 | Review dashboard | Dashboard → View summary cards | See production, attendance, alerts, financial snapshot | All KPIs for today |
| 2 | Handle escalated variance | Approvals → ESC-001 → Review → Approve with comment | Batch variance approved, severity reset | BATCH-003 -5% variance |
| 3 | Override credit limit | Approvals → ESC-002 → Review → Increase limit to ₹45,00,000 → Approve | Customer credit limit updated, audit logged | CUST-005 limit increased |
| 4 | Override dispatch qty | Approvals → ESC-003 → Review → Authorize 10,500 kg | Dispatch quantity override, audit logged | DSP-003 qty override |
| 5 | Resolve attendance dispute | Attendance → ESC-004 → Review → Verify entry logs → Decide | Dispute resolved, entry corrected | EMP-010 late mark reviewed |
| 6 | Review weekly analytics | Analytics → Weekly → View trends | Production trends, top/bottom products | 16-22 June weekly data |
| 7 | Run cross-functional report | Reports → Custom → Select departments → Generate | Combined production + financial report | PDF/Excel export |
| 8 | Approve inventory adjustment | Steel → Reconciliations → Pending → Review → Approve | Stock adjustment posted, audit trail | Stock count variance |
| 9 | Invite new operator | Settings → Users → Invite → Enter details → Assign operator role | Invite sent, user pending activation | New operator for Shift C |
| 10 | Review OCR productivity | OCR → Verify → Filter by supervisor → Check throughput | See each supervisor's review volume & accuracy | Per-supervisor OCR stats |

### 5.4 Edge Cases to Test

| Edge Case | Scenario | Expected Behavior | Test Data |
|-----------|----------|-------------------|-----------|
| **Override without reason** | Manager overrides dispatch qty without providing reason | Block — override reason required | ESC-003 override attempt no reason |
| **Role self-promotion** | Manager tries to upgrade own role to Admin | Block — "Cannot assign Admin role" | Manager self-promotion |
| **Cross-factory override** | Manager of FACT-001 tries to override FACT-002 data | Block — scope limited to own factory | Different factory context |
| **Delete user attempt** | Manager tries to delete an operator account | Block — only Admin/Owner can delete users | User deletion attempt |
| **Billing page access** | Manager navigates to /billing | Block — page hidden, redirect to dashboard | URL navigation attempt |
| **Plan change attempt** | Manager tries to change subscription plan | Block — Owner only | API call to change plan |
| **Weekly summary at month end** | Manager runs 30-day report | All data rolls up correctly, no duplication | Cross-month boundary |
| **Simultaneous override conflict** | Two managers try to override same dispatch | First wins, second blocked with "Already overridden" | Concurrent DSP-003 overrides |
| **Override > 20% variance** | Batch variance exceeds 20% manager override authority | Escalate to Owner automatically | Batch with 22% variance |
| **Factory creation limit** | Manager tries to create 4th factory (plan limit=3) | Block — "Factory limit reached for your plan" | 4th factory creation |

> **🔗 Data Dependency:** Manager's overrides and approvals are final step before data becomes reporting-trusted. Manager escalates to **Admin** for system-level issues and to **Owner** for financial/billing issues.

---

## 6. Admin

### 6.1 Role Overview

| Attribute | Detail |
|-----------|--------|
| **Role ID** | `admin` (rank 5) |
| **Also Known As** | System Administrator, Org Admin |
| **Daily Purpose** | Manage users & roles, configure system settings, manage alert recipients & rules, view audit logs, manage usage reconciliation |
| **Modules Accessed** | Settings (full), Dashboard, Approvals, Reports, Analytics, Users, Audit Logs, Alert Configuration, Billing (view only), System Config |
| **Permissions** | Full user CRUD, role assignment (except Owner), create/edit factories, view audit logs, configure alert rules & recipients, view billing, system configuration override |
| **Cannot Do** | Assign Owner role, modify subscription plan, perform cross-factory Owner actions, final financial authority actions |
| **UI Complexity** | Medium-high — system-first, config and oversight, not worker-like |
| **Factory Example** | 1-2 admins per organization, might handle 100+ users across 3 factories |

### 6.2 Test Data Needed

#### Prerequisite Data
```
ALL data from Sections 1-5 MUST exist.

User Management Data (Org-wide):
┌──────────┬──────────────┬──────────────┬──────────┬──────────────┐
│ User ID  │ Name         │ Role         │ Factory  │ Status       │
│          │              │              │ Access   │              │
├──────────┼──────────────┼──────────────┼──────────┼──────────────┤
│ USR-001  │ Rajesh Patil │ Operator     │ FACT-001 │ Active       │
│ USR-002  │ Suresh K.    │ Operator     │ FACT-001 │ Active       │
│ USR-003  │ Dattatray G. │ Operator     │ FACT-001 │ Active       │
│ USR-004  │ Mahesh J.    │ Operator     │ FACT-001 │ Active       │
│ USR-005  │ Santosh S.   │ Operator     │ FACT-001 │ Active       │
│ USR-006  │ Prakash S.   │ Operator     │ FACT-001 │ Active       │
│ USR-007  │ Sunil More   │ Warehouse    │ FACT-001 │ Active       │
│ USR-008  │ Ramesh D.    │ Maintenance  │ FACT-001 │ Active       │
│ USR-009  │ Vikas C.     │ Dispatch     │ FACT-001 │ Active       │
│ USR-010  │ Anand J.     │ Quality      │ FACT-001 │ Active       │
│ USR-011  │ Vijay M.     │ Supervisor   │ FACT-001 │ Active       │
│ USR-012  │ Amit K.      │ Supervisor   │ FACT-001 │ Active       │
│ USR-013  │ Rohit S.     │ Accountant   │ FACT-001 │ Active       │
│ USR-014  │ Neha P.      │ Accountant   │ FACT-001 │ Active       │
│ USR-015  │ Deepak M.    │ Manager      │ FACT-001 │ Active       │
│ USR-016  │ Siddharth R. │ Admin        │ FACT-001 │ Active       │
│ USR-017  │ Arvind G.    │ Owner        │ FACT-001 │ Active       │
│ USR-018  │ Satish K.    │ Attendance   │ FACT-001 │ Pending Inv  │
└──────────┴──────────────┴──────────────┴──────────┴──────────────┘

Factories Under Management:
┌──────────┬────────────────────┬──────────┬──────────┬──────────────┐
│ Factory  │ Name               │ Location │ Users    │ Status       │
│ ID       │                    │          │          │              │
├──────────┼────────────────────┼──────────┼──────────┼──────────────┤
│ FACT-001 │ Maharashtra Steel  │ Kalamboli│ 17       │ Active       │
│          │ Works - Unit 1     │          │          │              │
│ FACT-002 │ Maharashtra Steel  │ Taloja   │ 0        │ Inactive     │
│          │ Works - Unit 2     │          │          │              │
│ FACT-003 │ Konkan Ispat Pvt   │ Panvel   │ 0        │ Pending      │
│          │ Ltd                │          │          │ Setup        │
└──────────┴────────────────────┴──────────┴──────────┴──────────────┘

Alert Configuration:
┌──────────┬──────────────────────┬──────────┬──────────────┬──────────┐
│ Alert ID │ Rule Name            │ Channel  │ Recipients   │ Enabled │
├──────────┼──────────────────────┼──────────┼──────────────┼──────────┤
│ ALR-001  │ Production_variance  │ WhatsApp │ Supervisor+  │ Yes      │
│          │ >5%                  │ + Email  │ Manager      │          │
│ ALR-002  │ Stock_below_thresho  │ WhatsApp │ Manager+     │ Yes      │
│          │ ld                   │          │ Owner        │          │
│ ALR-003  │ Credit_limit_85%     │ Email    │ Accountant+  │ Yes      │
│          │                      │          │ Manager      │          │
│ ALR-004  │ Attendance_drop_>10% │ WhatsApp │ Supervisor+  │ No       │
│          │                      │          │ Manager      │ (Paused) │
│ ALR-005  │ High_value_dispatch  │ WhatsApp │ Manager+     │ Yes      │
│          │ (>₹5,00,000)         │          │ Owner        │          │
└──────────┴──────────────────────┴──────────┴──────────────┴──────────┘

Alert Recipients:
┌──────────┬──────────────┬──────────────┬──────────────┬──────────┐
│ Recipient│ Name         │ Phone        │ Email        │ Verified │
│ ID       │              │              │              │          │
├──────────┼──────────────┼──────────────┼──────────────┼──────────┤
│ RCP-001  │ Deepak M.    │ +91-98765-   │ deepak@msw.  │ Yes      │
│          │ (Manager)    │ 43210        │ com          │          │
│ RCP-002  │ Amit K.      │ +91-87654-   │ amit@msw.com │ Yes      │
│          │ (Supervisor) │ 32109        │              │          │
│ RCP-003  │ Neha P.      │ +91-76543-   │ neha@msw.com │ Yes      │
│          │ (Accountant) │ 21098        │              │          │
│ RCP-004  │ Arvind G.    │ +91-65432-   │ arvind@msw.  │ Yes      │
│          │ (Owner)      │ 10987        │ com          │          │
│ RCP-005  │ Security     │ +91-88765-   │ gate@msw.com │ Pending  │
│          │ Gate (new)   │ 43219        │              │          │
└──────────┴──────────────┴──────────────┴──────────────┴──────────┘

Usage & Capacity (Current Billing Period):
┌──────────────────┬──────────┬──────────────┬──────────────┐
│ Metric           │ Used     │ Limit        │ % Used       │
├──────────────────┼──────────┼──────────────┼──────────────┤
│ OCR Scans        │ 147      │ 200          │ 73.5%        │
│ WhatsApp Messages│ 382      │ 500          │ 76.4%        │
│ Active Users     │ 17       │ 25           │ 68.0%        │
│ Storage (GB)     │ 4.2      │ 10           │ 42.0%        │
└──────────────────┴──────────┴──────────────┴──────────────┘

Audit Log (Recent Entries):
┌──────────┬──────────────┬──────────────┬──────────────┬────────────────┐
│ Timestamp│ Actor        │ Action       │ Entity       │ Detail         │
├──────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│ 22/06    │ USR-011      │ ENTRY_APPROV │ ENT-001      │ TMT-10,42,800  │
│ 09:30    │ (Supervisor) │ ED           │              │ kg approved    │
│ 22/06    │ USR-013      │ STEEL_INVOIC │ INV-001      │ CUST-001,      │
│ 10:15    │ (Accountant) │ E_CREATED    │              │ ₹16,18,800     │
│ 22/06    │ USR-015      │ CREDIT_LIMIT │ CUST-005     │ ₹40L→₹45L      │
│ 11:00    │ (Manager)    │ _OVERRIDE    │              │ override       │
│ 21/06    │ USR-016      │ USER_INVITED │ USR-018      │ Satish K.,     │
│ 16:45    │ (Admin)      │              │              │ attendance role│
│ 21/06    │ SYSTEM       │ OCR_VERIFIC  │ OCR-001      │ 87.5% conf,    │
│ 08:20    │              │ ATION_SUBMIT │              │ 24 rows        │
└──────────┴──────────────┴──────────────┴──────────────┴────────────────┘
```

### 6.3 Daily Task Checklist

| # | Task | Steps | Expected Result | Test Data |
|----|------|-------|-----------------|-----------|
| 1 | View user list | Settings → Users → List all | Shows 18 users with roles, factories, status | USR-001 through USR-018 |
| 2 | Invite new user | Settings → Users → Invite → Enter name/email/role → Send | Invite email sent, user in pending state | New attendance employee |
| 3 | Change user role | Select USR-008 → Role→ Supervisor (promotion) | Role updated, audit logged | Operator→Supervisor promotion |
| 4 | Deactivate user | Select USR-018 → Deactivate → Confirm | User flagged inactive, cannot login | Inactive user attempt |
| 5 | Configure alert rule | Settings → Alerts → ALR-004 → Enable | Alert activated with recipients | Attendance drop alert |
| 6 | Add alert recipient | Settings → Recipients → Add → Enter phone/email → Verify | New recipient pending verification | RCP-005 (Security Gate) |
| 7 | View audit logs | System → Audit Logs → Filter by date/action | Chronological log with all metadata | Last 7 days of activity |
| 8 | Run usage reconciliation | Settings → Usage → Reconcile → Dry run | Shows OCR + WhatsApp usage vs billed | Period: 1-22 June |
| 9 | View billing summary | Billing → View current plan | Usage, limits, charges, payment history | Read-only access |
| 10 | Create new factory | Settings → Factories → Create → Enter details | FACT-003 created, pending setup | Konkan Ispat, Panvel |

### 6.4 Edge Cases to Test

| Edge Case | Scenario | Expected Behavior | Test Data |
|-----------|----------|-------------------|-----------|
| **Owner role assignment** | Admin tries to assign Owner role to another user | Block — "Only Owner can assign Owner role" | Role assignment dropdown doesn't show Owner |
| **Last admin deletion** | Admin tries to deactivate the only remaining admin | Block — "Cannot remove last admin user" | Only USR-016 left as Admin |
| **Cross-org user edit** | Admin tries to modify user from another org | Block — scope-limited to own org | Wrong org_id in API |
| **Invite to non-existent factory** | Admin creates invite for deleted factory | Block — factory must be active | FACT-999 invite |
| **Email delivery failure** | Invite email bounces | Show warning but user created, retry option | Invalid email bounce |
| **All alerts paused** | Admin disables all alert rules | Alerting pauses, warning shown in alert config | ALR-001 through ALR-005 all disabled |
| **Storage limit reached** | Org exceeds 10GB storage | Warn admin, block new uploads | 10.2 GB used |
| **Usage reconciliation conflict** | Dry run shows 147 used, but billing shows 152 | Flag discrepancy with details for audit | Count mismatch |
| **Plan downgrade view** | Admin views downgrade page | View only — "Contact Owner for plan changes" | Read-only billing |
| **Delete factory with users** | Admin tries to delete FACT-001 (has 17 active users) | Block — "Remove all users first" | Factory with active members |

> **🔗 Data Dependency:** Admin manages the user base that all other roles depend on. Usage reconciliation spans all roles' consumption. Alert configuration affects all alert-related workflows.

---

## 7. Owner

### 7.1 Role Overview

| Attribute | Detail |
|-----------|--------|
| **Role ID** | `owner` (rank 6) |
| **Also Known As** | Business Owner, MD, Proprietor, CEO |
| **Daily Purpose** | See money, risk, exposure at a glance; make strategic decisions; manage billing/subscriptions; final override authority |
| **Modules Accessed** | Premium Dashboard, Control Tower, Reports, AI Insights, Email Summary, Steel Charts, Billing (full), Settings (full), Everything else |
| **Permissions** | Absolute — override any action, change subscription, cross-factory access, manage billing, assign any role (including Admin), daily PDF export, final audit access |
| **Cannot Do** | Nothing in the system is restricted for Owner |
| **UI Complexity** | High-density but only around meaningful business signals — risk-first, money-first, summary-first |
| **Factory Example** | Owner of Maharashtra Steel Works, multiple factories across Maharashtra, not involved in daily operations |

### 7.2 Test Data Needed

#### Prerequisite Data
```
ALL data from Sections 1-6 MUST exist.

Premium Dashboard Data:
┌──────────────────────────────────┬────────────────────────────────┐
│ KPI                              │ Value                          │
├──────────────────────────────────┼────────────────────────────────┤
│ Revenue MTD                      │ ₹1,84,32,500 (22 days)        │
│ Revenue PMTD (Previous Month)    │ ₹1,62,45,800                  │
│ Growth % (Month-on-Month)        │ +13.5%                         │
│ Cost of Production (MTD)         │ ₹1,38,24,375 (75% of revenue) │
│ Gross Margin                     │ 25.0%                          │
│ Net Margin (Est.)                │ 18.2%                          │
│ Receivables Outstanding          │ ₹72,28,300                     │
│ Payables (Raw Material)          │ ₹28,50,000                     │
│ Cash in Bank (Current)           │ ₹45,00,000                     │
│ Working Capital (Est.)           │ ₹88,78,300                     │
└──────────────────────────────────┴────────────────────────────────┘

Risk & Leakage Indicators:
┌──────────────────────────────────┬────────────────────────────────┐
│ Risk Signal                      │ Value                          │
├──────────────────────────────────┼────────────────────────────────┤
│ Stock Mismatch (Weighted Avg)    │ -2,850 kg (est. ₹1,65,300)    │
│ Overdue Invoices >30 days        │ 3 (₹38,75,000 + ₹8,50,000)    │
│ Credit at Risk                   │ ₹47,25,000 (CUST-005 +        │
│                                  │           CUST-004)           │
│ Production Variance >5% (Week)   │ 2 batches (TMT-16, TMT-20)    │
│ Unresolved Attendance Disputes   │ 1 (EMP-010)                   │
│ Alert Failure Rate (Week)        │ 2.3% (3 failed of 130)        │
│ API Cost (AI/OCR, MTD)           │ ₹12,450                       │
│ Subscription Cost (Plans + Packs)│ ₹21,000 (Base: ₹9,000 +       │
│                                  │        Packs: ₹12,000)        │
└──────────────────────────────────┴────────────────────────────────┘

Chart Data (Last 30 Days):
┌──────────┬──────────────┬──────────────┬──────────────┐
│ Date     │ Production   │ Revenue (₹)  │ Downtime     │
│          │ (kg)         │              │ (min)        │
├──────────┼──────────────┼──────────────┼──────────────┤
│ 23-May   │ 52,000       │ 29,64,000    │ 85           │
│ 24-May   │ (Sunday)     │ —            │ —            │
│ 25-May   │ 48,500       │ 27,64,500    │ 42           │
│ 26-May   │ 55,200       │ 31,46,400    │ 18           │
│ 27-May   │ 49,800       │ 28,38,600    │ 65           │
│ 28-May   │ 51,000       │ 29,07,000    │ 55           │
│ 29-May   │ 53,500       │ 30,49,500    │ 22           │
│ ...      │ ...          │ ...          │ ...          │
│ 20-Jun   │ 50,200       │ 28,61,400    │ 35           │
│ 21-Jun   │ 48,900       │ 27,87,300    │ 48           │
│ 22-Jun   │ 51,200       │ 29,18,400    │ 28           │
├──────────┼──────────────┼──────────────┼──────────────┤
│ TOTAL    │ 12,85,300    │ 7,32,62,100  │ 1,072        │
│ (30 day) │              │              │              │
└──────────┴──────────────┴──────────────┴──────────────┘

Billing & Subscription:
┌──────────────────┬────────────────────────────────────────────┐
│ Item             │ Detail                                     │
├──────────────────┼────────────────────────────────────────────┤
│ Current Plan     │ Factory (₹9,000/month)                     │
│ Active Addons    │ OCR Light Pack (₹349, 200 scans)           │
│                  │ WhatsApp Standard Pack (₹999, 500 msgs)    │
│ Total Monthly    │ ₹10,348 + Tax = ₹12,210.64 (GST @18%)     │
│ Billing Cycle    │ 1st of every month                         │
│ Payment Method   │ Razorpay Auto-debit (ICICI Bank)           │
│ Next Billing     │ 01-Jul-2026                                │
│ Last Payment     │ 01-Jun-2026 (₹12,210.64, Successful)      │
└──────────────────┴────────────────────────────────────────────┘

AI Insights Sample:
┌──────────┬────────────────────────────────────────────────┐
│ Insight  │ "Production variance in TMT-16 has been above  │
│          │  the 5% threshold for 3 consecutive batches.   │
│          │  Estimated loss: ₹84,000 this month. Recommend │
│          │  furnace temperature calibration on Line-04."  │
├──────────┼────────────────────────────────────────────────┤
│ Anomaly  │ "CUST-005 (JNPT Port Logistics) credit        │
│          │  utilization at 96.9% with zero payment this   │
│          │  month. Previous payment pattern: 15-day avg." │
├──────────┼────────────────────────────────────────────────┤
│ Alert    │ "3 overdue invoices totalling ₹47,25,000 are   │
│          │  past 30 days. CUST-005 alone accounts for     │
│          │  82% of overdue amount."                       │
└──────────┴────────────────────────────────────────────────┘
```

### 7.3 Daily Task Checklist

| # | Task | Steps | Expected Result | Test Data |
|----|------|-------|-----------------|-----------|
| 1 | Review premium dashboard | Premium Dashboard → View | All KPIs, risk signals, money metrics | Revenue, margin, receivables |
| 2 | Check AI insights | AI Insights → View | Narratives, anomaly detection, recommendations | 3+ insights generated |
| 3 | Review email summary | Email Summary → Preview → Send | Summary with financials, risks, exceptions | Daily business summary |
| 4 | View steel charts | Steel → Charts | Trend lines, top customers, product mix | Last 30 days |
| 5 | Explore drill-down | Click on ₹72,28,300 (receivables) | Drill-down to invoice list with aging | Invoice-level detail |
| 6 | Manage subscription | Billing → Current Plan → Review | See plan, addons, usage, charges | ₹12,210.64 monthly |
| 7 | Change plan (if needed) | Billing → Change Plan → Select → Confirm | Plan upgrade/downgrade queued | Factory→Group upgrade |
| 8 | Purchase WhatsApp pack | Billing → Addons → WhatsApp Heavy → Buy | Pack added, message limit increases | 500→2500 messages |
| 9 | Override blocked action | If admin reports an override-required issue → Approve via control tower | System override logged with reason | Emergency override |
| 10 | Generate daily PDF export | Premium → Export → Daily PDF | Complete PDF with all KPIs, audit-ready | Owner daily report |

### 7.4 Edge Cases to Test

| Edge Case | Scenario | Expected Behavior | Test Data |
|-----------|----------|-------------------|-----------|
| **Last Owner deactivation** | Owner tries to delete own account | Block — "Cannot remove the only Owner account" | Last Owner self-delete |
| **Cross-factory scope** | Owner of FACT-001 views FACT-002 data | Full visibility — cross-factory access | FACT-002 data visible |
| **Override without audit trail** | Owner performs emergency override | Must provide reason, always audit-logged | All override actions |
| **Billing downgrade during usage** | Owner downgrades plan mid-cycle with 73% usage used | Downgrade scheduled for next billing cycle | Pending plan change |
| **Multiple Owner accounts** | Second user assigned Owner role | Both have full Owner authority | Two Owner accounts |
| **Financial export data range** | Owner requests 1-year PDF export | Generate (may be async if large dataset) | FY 2025-26 export |
| **Cancel subscription** | Owner cancels subscription | Scheduled cancellation, data retention period | "Expires on 22-Jul-2026" |
| **Owner as operator** | Owner also performs daily operations (small factory) | Can switch context, but reminders treat as Owner | Dual-use scenario |
| **Zero-revenue month** | No production for a month (maintenance shutdown) | Dashboard shows ₹0 revenue, highlights idle cost | Factory shutdown scenario |
| **Anomaly false positive** | AI flags normal seasonal dip as anomaly | Owner can dismiss with "Expected seasonal" feedback | Anomaly feedback loop |

> **🔗 Data Dependency:** Owner depends on ALL other roles for data — without operators, managers, and accountants producing and approving data, the Owner's dashboard is empty. Owner makes final decisions based on trusted data from the entire chain.

---

## 8. Cross-Role Data Dependencies Matrix

### Data Flow Diagram

```
ATTENDANCE OFFICER ──────► SUPERVISOR ──────► MANAGER ──────► OWNER
      │                      │                    │              │
      │   (attendance raw)   │   (approved att.)  │  (reports)   │  (strategic)
      ▼                      ▼                    ▼              ▼
  [Attendance DB] ──► [Attendance Review] ──► [Cost Reports] ──► [Premium Dashboard]
  
OPERATOR ─────────────► SUPERVISOR ──────────► MANAGER ────────► OWNER
      │                      │                    │              │
      │   (production raw)   │   (approved prod.) │  (analytics) │  (risk)
      ▼                      ▼                    ▼              ▼
  [Production DB] ──► [Approval Queue] ───► [Weekly Reports] ──► [AI Insights]
      │                                                           
      │   (gate/truck log)                                        
      ▼                                                           
  [Dispatch DB] ─────► [Invoice Link] ─────► [AR Report] ──────► [Cash Position]
  
ACCOUNTANT ──────────► MANAGER ─────────────► OWNER
      │                    │                     │
      │   (invoices)       │   (overrides)       │   (billing)
      ▼                    ▼                     ▼
  [Financial DB] ────► [Financial Reports] ──► [Owner Dashboard]
```

### Dependency Table

| Source Role | Produces | Dependent Roles | Consequence If Missing |
|-------------|----------|-----------------|----------------------|
| **Attendance Officer** | Punch records, regularization requests | Supervisor (review queue), Accountant (payroll cost), Manager (attendance reports) | No attendance data → no payroll, no workforce metrics |
| **Operator** | Production entries, gate logs, OCR scans | Supervisor (approval), Accountant (invoicing), Manager (analytics), Owner (dashboard) | No production data → empty dashboard, no invoices, no reports |
| **Supervisor** | Approved entries, attendance reviews, OCR verifications, dispatch status | Manager (trusted data), Accountant (certified production for invoicing), Owner (trusted KPIs) | Unapproved data → reporting shows "pending" items, no trusted metrics |
| **Accountant** | Invoices, payments, allocations, follow-up tasks | Manager (financial view), Owner (cash position, P&L), Admin (billing reconciliation) | No invoices → no revenue tracking, no collections |
| **Manager** | Overrides, approvals, factory settings, team invites | Admin (user management continuity), Owner (trusted operational picture) | No manager → escalations stuck, no operational decisions |
| **Admin** | Users created, roles assigned, alerts configured, system settings | ALL roles (they all depend on being created) | No admin → no new users can be added, alerts unconfigured |
| **Owner** | Subscription/billing decisions, final overrides | ALL roles (platform viability depends on subscription) | No owner → no billing decisions, highest escalations unresolved |

### Precedence Order for Test Data Creation

```
Step 1: Admin creates users with all roles
Step 2: Admin configures factories, shifts, and settings
Step 3: Attendance Officer creates daily attendance records
Step 4: Operator creates production entries and gate logs
Step 5: Supervisor reviews & approves/rejects entries and attendance
Step 6: Accountant creates invoices, records payments based on approved production
Step 7: Manager handles escalations, runs cross-functional reports
Step 8: Owner views premium dashboard, makes strategic decisions

(Data flows downstream — you CANNOT test a role without its upstream data)
```

---

## 9. Master Reference Data

### Factory Profile — Maharashtra Steel Works

| Attribute | Value |
|-----------|-------|
| **Company Name** | Maharashtra Steel Works Pvt. Ltd. |
| **Address** | Plot No. A-42, MIDC Industrial Area, Kalamboli, Navi Mumbai - 410218 |
| **GSTIN** | 27AACCM1234M1ZC |
| **PAN** | AACCM1234M |
| **CIN** | U27100MH2015PTC267890 |
| **Year Established** | 2015 |
| **Products** | TMT Bars (10-32mm), Angles (25-100mm), Channels (75-150mm) |
| **Annual Capacity** | 120,000 MT |
| **Key Equipment** | Rebar Mill, Angle Mill, Channel Mill, Induction Furnace (15T), Cooling Bed, Overhead Cranes |
| **Bank** | ICICI Bank, Kalamboli Branch (Current A/C: 123456789012) |
| **Employees** | 85 daily wage + 30 permanent |
| **Shifts** | 3 (A: 06-14, B: 14-22, C: 22-06) |

### Test Credentials

| Role | Username | Password | Notes |
|------|----------|----------|-------|
| Attendance | `rajesh.patil@test.msw.com` | `Test@123` | EMP-001, Shift A |
| Operator | `suresh.kamble@test.msw.com` | `Test@123` | EMP-002, Rolling Mill |
| Supervisor | `vijay.more@test.msw.com` | `Test@123` | Supervisor Shift A |
| Accountant | `rohit.sharma@test.msw.com` | `Test@123` | Accounts Receivable |
| Manager | `deepak.mhatre@test.msw.com` | `Test@123` | Factory Manager |
| Admin | `siddharth.rao@test.msw.com` | `Test@123` | Org Admin |
| Owner | `arvind.gupta@test.msw.com` | `Test@123` | Business Owner |

### Test Calendar

| Date | Day | Event | Test Implication |
|------|-----|-------|-----------------|
| 2026-06-20 | Sat | Normal working | Standard shift test |
| 2026-06-21 | Sun | Weekly off | Overtime punch test |
| 2026-06-22 | Mon | Normal working | Standard operations test |
| 2026-06-25 | Thu | Month-end closing | Invoice reconciliation |
| 2026-06-28 | Sun | Emergency shift | Overtime production test |
| 2026-06-30 | Tue | Billing cycle end | Quota reset, usage reconciliation |
| 2026-07-01 | Wed | New billing period | Fresh quotas, plan changes |

### Business Transaction Flow (End-to-End Scenario)

```
1. Admin creates user accounts for all roles
2. Operator Rajesh (EMP-001) punches in at 05:55
3. Operator creates production batch: TMT-12, 51,200 kg (ENT-002)
4. Operator logs truck entry: MH-04-XY-5678 in for loading
5. Supervisor Vijay approves ENT-002, dispatches truck
6. Operator logs truck exit: 28,400 kg TMT-12 loaded
7. Manager Deepak reviews weekly analytics: 1,68,900 kg total
8. Accountant Rohit creates invoice INV-002: ₹8,19,000
9. CUST-003 pays ₹5,60,000 → allocated to INV-003
10. Owner Arvind reviews premium dashboard: sees 13.5% MoM growth
11. AI suggests TMT-16 furnace calibration due to 3-batch variance streak
```

---

> **Document Version:** 1.0  
> **Last Updated:** 2026-06-22  
> **Author:** Test Engineering  
> **Review Required:** Product Owner, Lead Developer, QA Lead  
> **Related Files:**
> - `docs/factorynerve_role_permission_matrix.md`
> - `docs/role_security_matrix.md`
> - `docs/ROLE_HIERARCHY_NEEDS_MODEL.md`
> - `docs/WORKFLOW_STATE_MATRIX.md`
> - `docs/BUSINESS_WORKFLOW_AND_RACI_ANALYSIS.md`
> - `docs/DEMO_WALKTHROUGH.md`
> - `backend/authorization/permission_catalog.py`
