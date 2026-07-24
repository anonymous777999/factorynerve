# FactoryNerve — Factory Management Software

## Implementation Proposal for [Customer Factory Name]

**To:** Mr. Owner  
**From:** FactoryNerve Team  
**Date:** July 2026  
**Subject:** Complete Proposal — Setup, Training, Daily Usage & Pricing

---

# Section 1: What FactoryNerve Solves

Every day at your factory, you face the same problems:

| Problem | How FactoryNerve Fixes It |
|---------|--------------------------|
| You don't know today's production until tomorrow | **DPR entries.** Operators enter shift data directly. You see it in real-time on your dashboard. |
| Attendance is on paper — month-end surprises | **Digital punch in/out.** See who's on the floor right now. Auto-close at shift end. |
| You suspect material theft but can't prove it | **Batch variance tracking.** Every production run shows input vs output. Loss% calculated. Green/yellow/red severity. |
| Invoices take 20-30 minutes each — GST errors | **Weight-based invoicing with auto-GST.** Select customer, enter weight + rate. System calculates CGST, SGST, IGST. |
| Gate passes get lost, dispatches not tracked | **Digital dispatch with state machine.** Pending → Loaded → Exited → Delivered. Gate pass photo, weighbridge slip, POD photo. |
| You don't know who hasn't paid | **Receivables aging.** See all customers, their balances, overdue days. |
| Monthly closing takes 7 days | **Analytics & reports.** Weekly, monthly, trends, manager dashboard. |

---

# Section 2: What the Software Actually Has

## MODULES THAT EXIST RIGHT NOW

| Module | What It Does | Status |
|--------|-------------|--------|
| **DPR (Daily Production Report)** | Shift-wise production recording. Units target, units produced, manpower, downtime, quality issues, defects, scrap. AI summary. | ✅ **Live** |
| **Attendance** | Punch in/out, shift templates, live view, regularization requests, bulk approve, auto-close, reports. | ✅ **Live** |
| **Steel Inventory** | Item master (code, name, category, rate, HSN, GST), stock transactions (append-only ledger), stock levels, reorder points. | ✅ **Live** |
| **Steel Production Batches** | Input→output tracking, loss%, variance%, severity (normal/high/critical), heat number traceability, theft detection. | ✅ **Live** |
| **Steel BOM (Bill of Materials)** | Define input items + quantities per output item. Auto-fill batches from BOM. | ✅ **Live** |
| **Steel Dispatch** | Full lifecycle: Pending → Loaded → Exited → Dispatched → Delivered. Gate pass QR, weighbridge photo, POD photo. Inventory auto-deducted on exit. | ✅ **Live** |
| **Steel Sales Invoices** | Weight-based, customer-linked, GST auto-calculation, payment tracking (unpaid/partial/paid), invoice PDF download. | ✅ **Live** |
| **Steel Customers** | Master with PAN/GST verification, credit limit, payment terms, risk scoring, follow-up tasks. | ✅ **Live** |
| **Steel Vendor Bills** | Vendor master, bill entry, expense categorization, payment status tracking. | ✅ **Live** |
| **Steel Vendor Payments** | Payment recording, allocation to bills. | ✅ **Live** |
| **Steel Stock Reconciliation** | Physical count vs system balance. Variance computation, approval workflow (IP-2), adjustment transaction. | ✅ **Live** |
| **Customer Payments** | Payment recording, allocation to invoices. Auto-updates invoice status. | ✅ **Live** |
| **Cash Accounts** | Multi-account cash ledger, entry recording, balance tracking. | ✅ **Live** |
| **Finance Intelligence** | Overview dashboard, receivables aging, payables aging, cash flow, product profitability, expenses. | ✅ **Live** |
| **Production/Machine Management** | Production lines, machines, downtime events, maintenance tasks, machine analytics, alerts. | ✅ **Live** |
| **AI Intelligence** | NLQ queries, anomaly detection, production suggestions, executive summaries, fraud detection, coil theft detection. | ✅ **Live** |
| **Analytics & Reports** | Weekly/monthly analytics, trends, manager dashboard, PDF export, Excel export, workforce intelligence. | ✅ **Live** |
| **OCR (Document Scanning)** | Upload document → AI extracts data → Verify → Approve. Supports operations & finance domains. Excel export. | ✅ **Live** |
| **Approval Engine (Maker-Checker)** | IP-2 (single stage), IP-3 (two-stage), IP-4 (cross-domain), IP-5 (dual owner). Auto-bypass, TTL expiry, escalation. | ✅ **Live** |
| **Auth & Security** | JWT + cookie auth, MFA (TOTP), Google OAuth, email verification, password reset, role-based access. | ✅ **Live** |
| **Multi-Factory** | Organization → Factory hierarchy. Row-level security. Independent inventory, users, transactions per factory. | ✅ **Live** |
| **Notifications** | In-app notifications, alerts, unread counts. | ✅ **Live** |
| **Owner Daily PDF** | One-page daily summary PDF: revenue, profit, leakage, top anomalies. | ✅ **Live** |
| **Billing & Subscription** | Razorpay integration, plan management, AI/OCR quota tracking. | ✅ **Live** |

## WHAT YOU DO MANUALLY (Not Automated)

| Task | Why | How We Handle It |
|------|-----|-----------------|
| **Create user accounts** | No bulk import from Excel for system users | We create users one by one during setup. For 15 people, takes 30 minutes. |
| **Company logo on invoices** | Invoice PDF has plain text, no logo | Invoice is GST-compliant with all required fields. Logo is cosmetic — not legally required. |
| **E-Way Bill generation** | Not integrated with GST portal | Your team generates e-way bill on GST portal manually. Takes 2 minutes per dispatch. |
| **WhatsApp invoice sharing** | No one-click WhatsApp share | Download invoice PDF, share via WhatsApp manually. One extra tap. |

---

# Section 3: Implementation Plan — 7 Days

## Day 1: We Set Up Your System (Remote, 2 hours)

**We do this for you — you just watch:**

1. **Create your Owner account**
   - Login URL: `https://[yourname].factorynerve.com`
   - Email: you@yourfactory.com
   - Password: (set by you, change on first login)

2. **Set up your factory profile**
   - Factory name, address, GST number
   - Timezone (Asia/Kolkata)
   - Industry type (steel)

3. **Add inventory items** (we type them from your list)
   - Item code, name, category, rate, HSN code, GST rate
   - We can do 20 items in 20 minutes

4. **Add your employees** (we type them)
   - Name, email, role (owner/operator/supervisor/accountant)
   - We create accounts one by one. 15 people = 30 minutes.

5. **Add your customers and vendors** (we type them)
   - Customer name, GST, PAN, credit limit
   - Vendor name, code, GST, PAN

**What you need to give us on Day 1:**
- ✅ Your factory name, address, GST number
- ✅ List of materials you buy/sell (item code, name, rate per kg)
- ✅ List of employees (name, role: operator/supervisor/accountant)
- ✅ List of key customers and suppliers

## Day 2: Training — Factory Owner (1-2 hours)

**We sit with you (video call or in person) and show:**

1. **Dashboard** (`/dashboard`)
   - See today's production, attendance, alerts in one screen
   - Navigate to steel batches, inventory, invoices

2. **Steel Batches** (`/steel/batches`)
   - See all production batches with loss% and severity
   - Click a batch to see details: input, output, heat number, variance
   - Spot theft: red-severity batches = investigate

3. **Steel Overview** (`/steel`)
   - Inventory intelligence, production intelligence
   - Quality intelligence, scrap loss intelligence

4. **Owner Daily PDF** (`/steel/owner-daily-pdf`)
   - One-page PDF with today's key numbers
   - Download or view in browser

5. **AI Intelligence** (`/ai`)
   - Ask questions in plain English (NLQ)
   - See anomaly detection, production suggestions
   - Executive summaries

6. **Mobile Access**
   - Open website on phone — same as desktop
   - Check production, approve entries, see attendance

**By end of Day 2:** You can check your entire factory from your phone in 5 minutes every morning.

## Day 3: Training — Operators (1 hour)

**Your operators learn these THREE things:**

### 1. Attendance Punch (10 seconds)
```
→ Go to /attendance
→ Click "Punch In" when shift starts
→ Click "Punch Out" when shift ends
```
That's it. Done. If they forget to punch out, supervisor can approve a regularization.

### 2. DPR Entry (2 minutes per shift)
```
→ Go to /entry
→ Fill the form:
  - Date (auto-filled)
  - Shift (morning / evening / night)
  - Units target (your production target for the shift)
  - Units produced (what you actually made)
  - Manpower present / absent
  - Downtime minutes (if machine stopped, how long and why)
  - Quality issues (yes/no — if yes, describe)
→ Submit
```
**Before:** 10 minutes on paper, supervisor types it later, you see it next day.  
**After:** 2 minutes on screen, you see it instantly.

### 3. Production Batch (2 minutes per batch)
```
→ Go to /steel/batches → Click "Create Batch"
→ Enter:
  - Production date
  - Input item (e.g., HR Coil)
  - Input quantity (kg)
  - Output item (e.g., TMT Bar)
  - Expected output (kg)
  - Actual output (kg)
  - Heat number (for traceability)
→ System auto-calculates: loss%, variance%, severity
→ Submit
```

**What operators DON'T need to do:**
- ❌ No complex data entry
- ❌ No Excel
- ❌ No paper registers
- ❌ No math — system calculates everything

## Day 4: Training — Supervisor (2 hours)

**What the supervisor learns:**

1. **Approve/Reject DPR Entries**
   - Review operator entries in queue
   - Approve if correct, reject with reason if wrong
   - Maker-checker: cannot approve own entry

2. **Attendance Review**
   - See who's on the floor right now (live view)
   - Approve regularization requests (missed punch)
   - Force-close attendance records

3. **Create Dispatch** (when truck is loaded)
   ```
   → Go to /steel/dispatches → Create
   → Enter: truck number, driver name, phone
   → Add material lines: item, weight
   → Upload gate pass photo
   → Status: loaded
   
   When truck exits:
   → Update status to "exited"
   → Upload weighbridge slip photo
   → System auto-deducts inventory
   
   When delivered:
   → Update status to "delivered"
   → Upload POD photo, enter receiver name
   ```

4. **Verify Gate Pass**
   - Security guard opens dispatch, clicks "Verify Gate Pass"
   - System records verification

5. **Basic Inventory**
   - View stock levels
   - Create inventory items (if needed)

## Day 5: Training — Accountant (2-3 hours)

**What the accountant learns:**

### 1. Create Sales Invoice (30 seconds)
```
→ Go to /steel/invoices → Create
→ Customer: select from list
→ Invoice date, due date
→ Add line items:
  - Item (e.g., TMT Bar 8mm)
  - Weight (kg)
  - Rate per kg
→ System auto-calculates:
    Subtotal: ₹4,75,000
    CGST @9%: ₹42,750
    SGST @9%: ₹42,750
    IGST @18%: ₹85,500 (for inter-state)
    Total: ₹5,60,500
→ Invoice number auto-generated (format: SINV-FACTORY-2026-0001)
→ Invoice PDF auto-generated → download and share
```

**Before:** 20-30 minutes in Excel, manual GST calculation, typing invoice number.  
**After:** 30 seconds. No errors.

### 2. Record Customer Payment (1 minute)
```
→ Go to /steel/customers/payments → Create
→ Customer: select
→ Amount, payment mode (NEFT/cheque/cash/UPI)
→ Reference number
→ Select invoice to allocate payment to
→ Submit → invoice status auto-updates: Unpaid → Partial/Paid
```

### 3. Manage Customers
```
→ Create new customer: name, phone, GST, PAN, credit limit
→ System validates GST/PAN format automatically
→ View customer list, search by name
→ Create follow-up tasks for collections
```

### 4. Vendor Bills (Accounts Payable)
```
→ Create vendor: name, code, GST, PAN, payment terms
→ Create vendor bill: bill number, date, amount, expense category
→ Track status: unpaid → partial → paid
```

### 5. View Financial Reports
```
→ Finance Overview: revenue, expenses, profit snapshot
→ Receivables Aging: who owes you, how old
→ Payables Aging: who you owe, how old
→ Cash Flow: money in vs money out
→ Product Profitability: which product gives best margin
```

### 6. Analytics
```
→ Weekly Analytics: trend comparison
→ Monthly Analytics: month-over-month
→ Manager Dashboard: KPIs for review
→ Workforce Overview: attendance %, labour cost
```

## Day 6: Go-Live Day (We Support You Full Day)

**We are on call/video the entire first day:**
- 6:00 AM — Operators punch in for morning shift
- 8:00 AM — First DPR entries created, first batch recorded
- 10:00 AM — Supervisor approves entries
- 12:00 PM — Accountant creates first invoice
- 2:00 PM — First dispatch tracked
- 4:00 PM — Review first day's data with you

**We fix any issues immediately.** Nothing is left for "later."

## Day 7: Review & Next Week Plan (1 hour)

- Review the first full week of data
- Show you:
  - How many entries were created
  - Attendance rate for the week
  - Batch variance summary
  - Any alerts triggered
- Answer all questions
- Set up any custom reports you need

---

# Section 4: How Each Person Uses the System Daily

## Owner (You) — 5 Minutes Every Morning

```
7:00 AM — Open phone, go to /dashboard
    See:
    ⏰ TODAY'S ATTENDANCE: 42 present, 3 absent
    🏭 YESTERDAY'S PRODUCTION: 85 tons (92% of target)
    ⚠️ ALERTS: 1 high-variance batch (watch this)
    💰 PENDING APPROVALS: 3 entries waiting

7:05 AM — Check Steel Batches
    → Batch ST-001: 2000kg in, 1700kg out = 15% loss (CRITICAL)
    → Tap to investigate, call supervisor

7:07 AM — Check /steel/owner-daily-pdf
    → One-page PDF: today's revenue, top issues, leakage

7:10 AM — Approve/Reject pending entries in Approvals

7:15 AM — Done.
```

## Operator (Ramesh) — During Shift

```
6:00 AM — Punch In (one click)
    System records: Ramesh, Morning, 6:00 AM

8:00 AM — Create DPR Entry (2 minutes)
    → Shift: Morning
    → Units target: 50 tons
    → Units produced: 48 tons
    → Manpower: 6 present, 1 absent
    → Downtime: 15 min (adjustment)
    → Quality: No issues
    → Submit

10:00 AM — Create Production Batch (2 minutes)
    → Input: HR Coil — 2000 kg
    → Output: TMT Bar — 1880 kg
    → System shows: 6% loss (normal)
    → Submit

2:00 PM — Punch Out (one click)
    System records: Worked 8 hours
```

## Supervisor (Amit) — During Shift

```
6:30 AM — Check Live Attendance (who's missing?)
9:00 AM — Review & approve/reject pending entries
12:00 PM — Create Dispatch when truck loads
2:00 PM — Update dispatch to "exited"
4:00 PM — Check inventory levels
6:00 PM — Handover to next shift (system has all records)
```

## Accountant (Rajesh) — During Day

```
9:00 AM — Check receivables (who hasn't paid)
10:00 AM — Create invoice for today's dispatch
12:00 PM — Record payment received
3:00 PM — Enter vendor bill
4:00 PM — Run reports, share with owner
```

## Store Keeper (Priya) — During Day

```
8:00 AM — Check stock levels
10:00 AM — Record inward (material received)
2:00 PM — Record outward (material issued to production)
4:00 PM — Physical count → reconcile if needed
```

---

# Section 5: What Is NOT In the Software

We believe in being honest. Here's what FactoryNerve does NOT do (yet):

| Feature | Not Available Because | Workaround |
|---------|----------------------|------------|
| **Generate E-Way Bill automatically** | GST portal API integration not built | Your team generates e-way bill on GST portal (2 min/dispatch) |
| **Company logo on invoice PDF** | Plain text invoice only | Invoice is GST-legal without logo. We can add this feature if you need it. |
| **Bulk import users from Excel** | Users created one by one | Takes 30 minutes for 15 users. We do it during setup. |
| **WhatsApp invoice sharing (one click)** | Download PDF, share manually | One extra tap |
| **Purchase Orders (formal PO workflow)** | POs managed via phone/email | Create vendor bill when material arrives |
| **Sales Orders (quotation→order pipeline)** | Invoice serves as order + invoice | Works for small factories |
| **P&L / Balance Sheet** | No double-entry accounting | Your CA uses Tally for this. FactoryNerve gives raw data. |
| **MRP (Material Requirements Planning)** | Manual planning works for small factories | You plan in your head/Excel |
| **Mobile App (iOS/Android)** | Website works on phone browser | Same functionality, no app store needed |

---

# Section 6: Pricing

| Plan | Price | Who It's For | What's Included |
|------|-------|-------------|-----------------|
| **Starter** | ₹10,000/month | Factories with < 50 employees | Attendance + DPR + Basic Inventory |
| **Growth** | **₹20,000/month** | **Factories with 50-200 employees** | **EVERYTHING:** Attendance, DPR, Steel (Inventory, Batches, Dispatch, Invoices, Customers, Vendors, Payments, Reconciliation, BOM, Machines), AI Intelligence, OCR, Analytics, Reports, Approvals, Multi-factory support |
| **Enterprise** | ₹35,000/month | 3+ factories or 200+ employees | All features, priority support, custom integrations |

**What's included in the price:**
- ✅ All software features
- ✅ 7-day setup and training
- ✅ Phone + WhatsApp support (9 AM - 6 PM, Mon-Sat)
- ✅ Data backup and security
- ✅ Free updates

**What's NOT included:**
- ❌ Internet connection (you arrange)
- ❌ Computers/phones for staff (you arrange)
- ❌ GST filing service (your CA files — we give you the data)
- ❌ E-Way Bill generation (manual on GST portal)

---

# Section 7: Next Steps

**If you say yes today:**

| Day | What Happens |
|-----|-------------|
| **Today** | You share: factory details, employee list, item list, customer list |
| **Tomorrow** | We set up your system (Day 1) |
| **Day 2** | Owner training |
| **Day 3** | Operator training |
| **Day 4** | Supervisor training |
| **Day 5** | Accountant training |
| **Day 6** | **GO-LIVE** — we support you all day |
| **Day 7** | Week 1 review |
| **Day 30** | First invoice — you decide |

**No lock-in. Month-to-month. Cancel anytime.**

---

## Honest Final Word

Mr. Owner, FactoryNerve is not a magic solution. It's a practical tool that replaces paper registers and Excel sheets. It gives you:

1. **Real-time visibility** — know what's happening TODAY, not tomorrow
2. **Theft detection** — batch variance tells you when material is missing
3. **Time savings** — your accountant saves 2-3 days per month
4. **Better control** — digital gate passes, tracked dispatches, recorded payments

The software works. We've tested it. The features listed in this proposal are REAL — they exist right now.

The price is ₹20,000/month. For a factory that loses ₹50,000-1,00,000/month in leakage, inefficiency, and manual work — this pays for itself in the first week.

**Want to start?** Share your factory details. We'll have you live in 7 days.

---

**FactoryNerve**  
*Your Factory, In Your Pocket.*

---

*This proposal contains ONLY features that exist in the current software as of July 2026. No features have been exaggerated or promised for future delivery.*
