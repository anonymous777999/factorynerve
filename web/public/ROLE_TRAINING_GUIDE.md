# FactoryNerve — Role Training Guide

## Step-by-step instructions for every person in your factory

---

# TRAINING 1: FACTORY OWNER

**Who:** You (the owner)  
**Time needed:** 5 minutes every morning  
**Goal:** Know what happened in your factory yesterday

---

### Your Morning Routine

**Step 1: Log In**
```
→ Open Chrome on your phone or computer
→ Go to: https://yourfactory.factorynerve.com
→ Enter your email and password
→ Click SIGN IN
```

**Step 2: Check Steel Batches (Production Overview)**
```
→ After login, you land on Steel Batches page
→ LOOK AT THE TABLE:

  Batch ID  |  Item  |  Date  |  Input  |  Output  |  Loss%  |  Severity
  ST-001     TMT Bar  26-Jul   2000kg   1880kg     6%       GREEN 🔵
  ST-002     TMT Bar  26-Jul   2000kg   1700kg     15%      RED 🔴 ← INVESTIGATE

→ RED severity = more than 10% material loss
→ Tap on the RED batch to see details
→ Ask your supervisor: "What happened with this batch?"
```

**Step 3: Check Attendance**
```
→ Click "Attendance" in sidebar (left side)
→ See: Who is on the floor right now
→ See: Who was absent yesterday
→ If someone is missing regularly — talk to supervisor
```

**Step 4: Check Inventory**
```
→ Click "Steel" → "Inventory" in sidebar
→ See stock levels of all materials
→ If anything is LOW (near reorder point) — ask store keeper
```

**Step 5: Approve Pending Items**
```
→ Click "Work Queue" or "Approvals" in sidebar
→ You may have pending entries needing your approval
→ Review them → Click Approve or Reject
```

**Step 6: Download Daily PDF Report**
```
→ Go to: /steel/owner-daily-pdf
→ This opens a ONE-PAGE PDF showing:
   • Today's revenue
   • Production vs target
   • Top losses / theft alerts
   • Pending approvals
→ Download it or print it
```

**Step 7: Ask AI (Optional)**
```
→ Click "AI" in sidebar
→ Type a question like:
   "How much did we produce this month?"
   "Which customer hasn't paid?"
→ AI will answer from your data
```

---

### Owner — Common Questions

| Question | Where to Find Answer |
|----------|---------------------|
| "Kitna production hua kal?" | Steel Batches page → see total output |
| "Kaun absent tha?" | Attendance → Reports → Summary |
| "Kitna stock bacha hai?" | Steel → Inventory |
| "Kis customer ne pay nahi kiya?" | Steel → Financial Intelligence → Receivables |
| "Kya koi theft ho rahi hai?" | Steel Batches → look for RED severity batches |

---

# TRAINING 2: MACHINE OPERATOR

**Who:** Ramesh, Mahesh, Suresh (all shift operators)  
**Time needed:** 5 minutes total per shift  
**Goal:** Record your production and attendance

---

### Task 1: Punch In (Start of Shift) — 10 Seconds

```
→ Go to: Attendance page (click "Attendance" in sidebar)
→ You will see:
     ┌─────────────────────┐
     │                     │
     │    PUNCH IN         │  ← Click this button
     │                     │
     └─────────────────────┘

→ System records: "Ramesh — Morning Shift — 6:00 AM"
→ DONE. ✅
```

**If you forget to punch in:** Don't worry. Tell your supervisor. He can approve a regularization request.

---

### Task 2: Create DPR Entry (During Shift) — 2 Minutes

Once during your shift, record what you produced.

```
→ Click "Entry" in sidebar
→ You will see a FORM. Fill it:

┌─────────────────────────────────────────────┐
│  📅 DATE:       26-Jul-2026  (auto filled)  │
│                                              │
│  ⏰ SHIFT:       [Morning] ▼  ← select yours │
│                                              │
│  🎯 TARGET:     100     ← your shift target  │
│                                              │
│  ✅ PRODUCED:    95      ← what you made     │
│                                              │
│  👥 MANPOWER:                                │
│     Present:    6       ← workers here      │
│     Absent:     1       ← workers missing   │
│                                              │
│  ⏸️ DOWNTIME:   15      ← minutes machine   │
│     Reason: "Rolling adjustment"  ← why     │
│                                              │
│  ❌ QUALITY ISSUES: [No] ▼                   │
│     (If Yes → describe the problem)          │
│                                              │
│  📝 NOTES: (optional)                        │
│                                              │
│  ┌──────────┐                                │
│  │  SUBMIT  │  ← Click this when done       │
│  └──────────┘                                │
└─────────────────────────────────────────────┘
```

**⚠️ IMPORTANT RULES:**
- Enter CORRECT numbers. Supervisor will check and approve.
- If you enter wrong numbers, supervisor will REJECT and you must re-enter.
- Don't enter future dates — system blocks it.
- One entry per shift. If you try to enter twice, system says "already exists."

---

### Task 3: Create Production Batch (After Each Run) — 2 Minutes

Every time you complete a production run, create a batch.

```
→ Click "Steel" → "Batches" in sidebar
→ Click "Create Batch" button
→ Fill the form:

┌─────────────────────────────────────────────┐
│  📅 DATE:      26-Jul-2026                  │
│                                              │
│  ⬇️ INPUT ITEM: [HR Coil 2.5mm ▼]           │
│  ⚖️ INPUT QTY:  2000   kg                   │
│                                              │
│  ⬆️ OUTPUT ITEM: [TMT Bar 8mm ▼]            │
│  🎯 EXPECTED:   1900   kg                   │
│  ✅ ACTUAL:     1880   kg                    │
│                                              │
│  🔥 HEAT NO:    HT-24101                    │
│                                              │
│  📝 NOTES: (if any problem, write here)      │
│                                              │
│  ┌──────────┐                                │
│  │  SUBMIT  │                                │
│  └──────────┘                                │
└─────────────────────────────────────────────┘

→ SYSTEM AUTO-CALCULATES:
   • Loss: 120 kg (2000 - 1880)
   • Loss%: 6% (120/2000 × 100)
   • Severity: GREEN (normal, < 3%)
                YELLOW (watch, 3-10%)
                RED (critical, > 10%)
```

**Example — Normal Batch:**
```
Input: 2000kg HR Coil
Output: 1880kg TMT Bar
Loss: 120kg (6%) → GREEN — This is normal process loss
```

**Example — THEFT Batch (RED ALERT):**
```
Input: 2000kg HR Coil
Output: 1700kg TMT Bar
Loss: 300kg (15%) → RED 🔴 — 300kg material missing!
→ Owner will investigate immediately
```

---

### Task 4: Punch Out (End of Shift) — 10 Seconds

```
→ Go to Attendance page
→ Click "PUNCH OUT" button
→ System records: "Ramesh — Worked 8 hours"
→ Go home. ✅
```

---

### Operator — Day Summary

| Time | Task | Where | Duration |
|------|------|-------|----------|
| Start of shift | Punch In | Attendance | 10 sec |
| During shift | DPR Entry | Entry page | 2 min |
| After each run | Create Batch | Steel → Batches | 2 min |
| End of shift | Punch Out | Attendance | 10 sec |

**Total: ~5 minutes per shift**

---

# TRAINING 3: PRODUCTION SUPERVISOR

**Who:** Amit, the shift supervisor  
**Time needed:** 30 minutes spread across the shift  
**Goal:** Approve entries, manage attendance, create dispatches

---

### Task 1: Check Live Attendance (Start of Shift) — 2 Minutes

```
→ Click "Attendance" → "Live" in sidebar
→ You will see:

  ┌─────────────────────────────────────────────┐
  │  LIVE ATTENDANCE — Morning Shift            │
  │                                             │
  │  ✅ ON FLOOR:    15 operators               │
  │  ❌ MISSING:     3 operators                │
  │     - Ramesh (not punched in yet)           │
  │     - Suresh (called in sick)               │
  │     - Mahesh (no information)               │
  │                                             │
  │  → Call missing people to check             │
  └─────────────────────────────────────────────┘
```

---

### Task 2: Approve/Reject DPR Entries (Mid-Shift) — 10 Minutes

```
→ Click "Work Queue" or "Approvals" in sidebar
→ You will see pending entries:

  ┌─────────────────────────────────────────────┐
  │  PENDING YOUR APPROVAL (4 items)            │
  │                                             │
  │  ⏳ Ramesh — Morning — 95 units             │
  │  ⏳ Mahesh — Morning — 88 units             │
  │  ⏳ Suresh — Evening — 102 units            │
  │  ⏳ Priya  — Evening — 78 units ← LOW!     │
  │                                             │
  └─────────────────────────────────────────────┘

→ Click on each entry to review
→ Check: Are the numbers realistic?
→ Decide:
   ✅ APPROVE — if everything is correct
   ❌ REJECT — if numbers are wrong
      (write reason: "Units produced can't be more than target")
```

**⚠️ IMPORTANT: Maker-Checker Rule**
- You CANNOT approve your OWN entry
- Another supervisor or manager must approve your entries
- This prevents fraud

---

### Task 3: Review Attendance (Mid-Shift) — 5 Minutes

```
→ Click "Attendance" → "Review" in sidebar
→ See who has regularization requests:

  ┌─────────────────────────────────────────────┐
  │  REGULARIZATION REQUESTS                    │
  │                                             │
  │  ⏳ Ramesh — 25-Jul — "Forgot to punch out" │
  │  ⏳ Mahesh — 25-Jul — "Came late due to     │
  │                      train delay"           │
  │                                             │
  └─────────────────────────────────────────────┘

→ Click each → Review reason → Approve or Reject
→ You can also BULK APPROVE if many requests
```

---

### Task 4: Create Dispatch (When Truck Loads) — 5 Minutes

```
→ Click "Steel" → "Dispatches" → "Create"
→ Fill:

┌─────────────────────────────────────────────┐
│  🚛 TRUCK NO:     MH-12-AB-1234             │
│  👤 DRIVER:       Ravi Yadav                │
│  📞 DRIVER PHONE: +919876543210             │
│  🏢 TRANSPORTER:  FastTrans Logistics        │
│                                              │
│  📦 MATERIAL:                                │
│     TMT Bar 8mm — 5000 kg                   │
│     TMT Bar 12mm — 3000 kg                  │
│                                              │
│  📸 GATE PASS PHOTO:  [Upload Photo]        │
│                                              │
│  STATUS:        [Loaded ▼]                   │
│                                              │
│  ┌──────────┐                                │
│  │  CREATE  │                                │
│  └──────────┘                                │
└─────────────────────────────────────────────┘
```

**Then track the dispatch through its lifecycle:**

| Step | When | What To Do |
|------|------|-----------|
| **LOADED** | Truck loaded with material | Upload gate pass photo, set status = loaded |
| **EXITED** | Truck leaves factory | Upload weighbridge slip photo, set status = exited |
| **DELIVERED** | Customer receives | Upload POD photo, enter receiver name, set status = delivered |

**⚠️ IMPORTANT:** When you set status to "exited," the system automatically DEDUCTS the material from your inventory. Make sure the quantities are correct before confirming exit.

---

### Supervisor — Day Summary

| Time | Task | Duration |
|------|------|----------|
| Start of shift | Check live attendance | 2 min |
| Mid-shift | Approve/reject DPR entries | 10 min |
| Mid-shift | Review attendance | 5 min |
| When truck loads | Create dispatch | 5 min |
| When truck exits | Update dispatch status | 2 min |
| End of shift | Handover to next shift | 5 min |

---

# TRAINING 4: ACCOUNTANT

**Who:** Rajesh, the accountant  
**Time needed:** 1-2 hours per day (saves 2-3 days per month vs Excel)  
**Goal:** Invoicing, payments, vendor bills, reports

---

### Task 1: Create Sales Invoice (When Material is Dispatched) — 30 Seconds

```
→ Click "Steel" → "Invoices" → "Create Invoice"
→ Fill the form:

┌─────────────────────────────────────────────┐
│  👤 CUSTOMER:  [Mumbai Steel Traders ▼]     │
│  📅 DATE:      26-Jul-2026                  │
│  📅 DUE DATE:  25-Aug-2026                  │
│  💰 TERMS:     30 days                      │
│                                              │
│  ┌─ LINE ITEMS ───────────────────────────┐ │
│  │ Item: TMT Bar 8mm                      │ │
│  │ Weight: 5000 kg                        │ │
│  │ Rate: ₹95/kg                           │ │
│  │ Total: ₹4,75,000                       │ │
│  │                                         │ │
│  │ Item: TMT Bar 12mm                     │ │
│  │ Weight: 3000 kg                        │ │
│  │ Rate: ₹93/kg                           │ │
│  │ Total: ₹2,79,000                       │ │
│  └──────────────────────────────────────────┘ │
│                                              │
│  SYSTEM AUTO-CALCULATES:                     │
│  ┌────────────────────────────────────────┐  │
│  │ Subtotal:       ₹7,54,000              │  │
│  │ CGST @9%:       ₹67,860                │  │
│  │ SGST @9%:       ₹67,860                │  │
│  │ TOTAL:          ₹8,89,720              │  │
│  │ Invoice No: SINV-QA001-2026-0001       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  📝 NOTES: "Supply for Metro project"        │
│                                              │
│  ┌──────────┐                                │
│  │  CREATE  │  ← One click, invoice ready   │
│  └──────────┘                                │
└─────────────────────────────────────────────┘

→ Invoice is created with GST number
→ Download PDF: Click "Download PDF" button
→ Share with customer via email or WhatsApp
```

**Before FactoryNerve:** 20-30 minutes in Excel, manual GST calc, typing invoice number, formatting.

**After FactoryNerve:** 30 seconds. GST auto-calculated. No errors.

---

### Task 2: Record Customer Payment (When Money Comes) — 1 Minute

```
→ Click "Steel" → "Customers" → "Record Payment"
→ Fill:

┌─────────────────────────────────────────────┐
│  👤 CUSTOMER:   [Mumbai Steel Traders ▼]   │
│  📅 DATE:       26-Jul-2026                 │
│  💵 AMOUNT:     ₹5,00,000                   │
│  💳 MODE:       [Bank Transfer ▼]           │
│  🔢 REF NO:     NEFT-2026-07-001            │
│                                              │
│  ALLOCATE TO INVOICE:                        │
│  ┌────────────────────────────────────────┐  │
│  │ ☑ INV-001 — ₹8,89,720 (unpaid)        │  │
│  │   Allocated: ₹5,00,000                 │  │
│  │   Remaining: ₹3,89,720 ← still due    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌──────────┐                                │
│  │  RECORD  │                                │
│  └──────────┘                                │
└─────────────────────────────────────────────┘

→ SYSTEM AUTO-UPDATES:
   Invoice INV-001: UNPAID → PARTIAL (₹5L paid, ₹3.89L due)
```

**Status meanings:**
- 🔵 UNPAID = No payment received yet
- 🟡 PARTIAL = Some payment received, balance due
- 🟢 PAID = Fully paid

---

### Task 3: Enter Vendor Bill (When Supplier Bills You) — 1 Minute

```
→ Click "Steel" → "Vendor Bills" → "Create"
→ Fill:

┌─────────────────────────────────────────────┐
│  🏢 VENDOR:     [Tata Steel Supply ▼]      │
│  🔢 BILL NO:    TATA-INV-2026-07-001       │
│  📅 BILL DATE:  26-Jul-2026                 │
│  📅 DUE DATE:   25-Aug-2026                 │
│  💵 AMOUNT:     ₹3,50,000                   │
│  📂 CATEGORY:   [Raw Material ▼]            │
│                                              │
│  📝 NOTES: "HR Coil supply — July"          │
│                                              │
│  ┌──────────┐                                │
│  │  CREATE  │                                │
│  └──────────┘                                │
└─────────────────────────────────────────────┘
```

---

### Task 4: Run Reports (Daily/Weekly/Monthly) — 5 Minutes

**Daily Check — Receivables:**
```
→ Click "Steel" → "Financial Intelligence" → "Receivables"
→ See: Who owes you money, how old is the debt

  ┌─────────────────────────────────────────────┐
  │  RECEIVABLES AGING                          │
  │                                             │
  │  Customer          Total     0-30d  30-60d  │
  │  Mumbai Steel     ₹8.89L    ₹8.89L    —     │
  │  Pune Const.      ₹5.60L      —     ₹5.60L  │← OVERDUE!
  │                                             │
  └─────────────────────────────────────────────┘
```

**Weekly Check — Analytics:**
```
→ Click "Analytics" → "Weekly"
→ See: Production trends, efficiency, quality
```

**Monthly Check — All Reports:**
```
→ Run: Monthly Analytics
→ Run: Cash Flow
→ Run: Workforce Cost Summary
→ Download PDFs and share with owner
```

---

### Accountant — Day Summary

| Time | Task | Duration |
|------|------|----------|
| Morning | Check receivables (who hasn't paid) | 5 min |
| When dispatch happens | Create invoice | 30 sec |
| When payment comes | Record and allocate payment | 1 min |
| When supplier bill comes | Enter vendor bill | 1 min |
| End of day | Run reports | 5 min |
| Month end | Monthly reports + GST summary | 30 min |

**Before:** 7 days of Excel hell at month end  
**After:** 30 minutes of clicking buttons

---

# TRAINING 5: STORE KEEPER

**Who:** Priya, the store keeper  
**Time needed:** 30 minutes spread across the day  
**Goal:** Keep inventory accurate

---

### Task 1: Check Stock Levels (Morning) — 5 Minutes

```
→ Click "Steel" → "Inventory" in sidebar
→ See all items and their stock levels:

  ┌─────────────────────────────────────────────┐
  │  LIVE STOCK TRUST BOARD                     │
  │                                             │
  │  Item          Balance    Reorder   Status  │
  │  HR Coil 2.5mm  25,000kg   5,000kg  ✅ OK  │
  │  HR Coil 3.0mm  15,000kg   5,000kg  ✅ OK  │
  │  TMT Bar 8mm     5,000kg   3,000kg  🟡 LOW │
  │  TMT Bar 12mm    2,000kg   3,000kg  🔴 LOW!│← ORDER NOW
  │                                             │
  └─────────────────────────────────────────────┘

→ If any item is LOW → inform purchase / owner
```

---

### Task 2: Record Inward Material (When Material Arrives) — 2 Minutes

```
Truck arrives with material → Weight bridge gives weight → You record:

→ Click "Steel" → "Inventory" → "New Transaction"
→ Select "INWARD"
→ Fill:

┌─────────────────────────────────────────────┐
│  📦 ITEM:        [HR Coil 2.5mm ▼]          │
│  ⚖️ QUANTITY:    10,000   kg                │
│  📂 TYPE:        [Inward ▼]                 │
│  📝 NOTES:       "Purchase from Tata Steel"  │
│                                              │
│  ┌──────────┐                                │
│  │  CREATE  │  ← Stock +10,000kg            │
│  └──────────┘                                │
└─────────────────────────────────────────────┘

→ Stock balance auto-updates
```

---

### Task 3: Record Outward Material (When Issued to Production) — 2 Minutes

```
Production requests material → You issue:

→ Click "Steel" → "Inventory" → "New Transaction"
→ Select "OUTWARD"
→ Fill:

┌─────────────────────────────────────────────┐
│  📦 ITEM:        [HR Coil 2.5mm ▼]          │
│  ⚖️ QUANTITY:    2,000   kg                 │
│  📂 TYPE:        [Outward ▼]                │
│  📝 NOTES:       "Issued to Production —     │
│                   Batch ST-005"              │
│                                              │
│  ┌──────────┐                                │
│  │  CREATE  │  ← Stock -2,000kg             │
│  └──────────┘                                │
└─────────────────────────────────────────────┘
```

---

### Task 4: Physical Count & Reconciliation (Weekly/Monthly) — 15 Minutes

```
→ Physically count what's in the warehouse
→ Compare with system

→ If there's a difference:
   Click "Steel" → "Reconciliations" → "Create"

┌─────────────────────────────────────────────┐
│  📦 ITEM:        [TMT Bar 8mm ▼]            │
│  🔢 SYSTEM SAYS:  5,000 kg                  │
│  👆 YOU COUNTED:  4,850 kg                  │
│  📉 VARIANCE:     -150 kg (3% loss)          │
│                                              │
│  REASON FOR DIFFERENCE:                      │
│  ▼ [Process Loss]                            │
│    Counting Error                            │
│    Process Loss                              │
│    Theft / Leakage                           │
│    Wrong Entry                               │
│    Delayed Dispatch Update                   │
│    Other                                     │
│                                              │
│  ┌──────────┐                                │
│  │  SUBMIT  │  → Manager approves            │
│  └──────────┘     → System adjusts stock     │
└─────────────────────────────────────────────┘
```

**⚠️ IMPORTANT:** If variance is more than 5%, the system requires MANAGER APPROVAL before adjusting stock. This prevents unauthorized changes.

---

### Store Keeper — Day Summary

| Time | Task | Duration |
|------|------|----------|
| Morning | Check stock levels | 5 min |
| When material arrives | Record inward transaction | 2 min |
| When production requests | Record outward transaction | 2 min |
| Weekly/Monthly | Physical count + reconciliation | 15 min |

---

# TRAINING 6: SECURITY GUARD (Optional)

**Who:** Gate security  
**Time needed:** 2 minutes per vehicle  
**Goal:** Verify gate passes

---

### Task: Verify Gate Pass (When Truck Exits)

```
→ Driver presents gate pass
→ Click "Steel" → "Dispatches"
→ Search for the dispatch number
→ Open the dispatch
→ Click "Verify Gate Pass"
→ System records: "Gate pass verified by Security at 2:30 PM"
→ Allow truck to exit
```

---

# QUICK REFERENCE — Every Task in 2 Lines

| Role | Tasks | Daily Time |
|------|-------|-----------|
| **Owner** | Check batches → Check attendance → Check inventory → Approve → Download PDF | 5 min |
| **Operator** | Punch In → DPR Entry → Create Batch → Punch Out | 5 min |
| **Supervisor** | Live attendance → Approve entries → Review attendance → Create dispatch | 30 min |
| **Accountant** | Create invoice → Record payment → Enter vendor bill → Run reports | 1-2 hrs |
| **Store Keeper** | Check stock → Record inward → Record outward → Reconcile | 30 min |
| **Security** | Verify gate pass when truck exits | 2 min/vehicle |

---

*End of Training Guide*

**FactoryNerve** — *Your Factory, In Your Pocket.*
