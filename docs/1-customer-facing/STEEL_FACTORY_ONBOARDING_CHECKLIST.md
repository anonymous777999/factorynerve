# 🏭 FactoryNerve — Steel Factory Onboarding Checklist

> **Customer:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> **Start Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> **Go-Live Target:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> **Support Contact:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## ✅ WARNING: Complete in order! Each step depends on the previous one.

---

## 📋 PHASE 0: Prerequisites (Before You Start)

| # | Task | Done? | Notes |
|---|------|-------|-------|
| 0.1 | ☐ You have a **modern web browser** (Chrome 90+ / Edge 90+) | ☐ | |
| 0.2 | ☐ You have a **working email address** for the Owner account | ☐ | Will receive verification email |
| 0.3 | ☐ You have your **company GST/PAN details** ready | ☐ | Needed for invoice setup |
| 0.4 | ☐ You have a **list of employees & their roles** ready | ☐ | See Role Guide below |
| 0.5 | ☐ You have your **inventory item list** (steel products & raw materials) | ☐ | Codes, names, categories |
| 0.6 | ☐ You have **customer & vendor contact details** | ☐ | Name, phone, GSTIN |

---

## 📋 PHASE 1: Day 1 — Account & Factory Setup (~30 min)

### Step 1: Register the Owner Account

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 1.1 | ☐ Go to FactoryNerve login page | Open `https://[your-instance].onrender.com` | ☐ |
| 1.2 | ☐ Click **"Register"** / **"Sign Up"** | | ☐ |
| 1.3 | ☐ Fill in Owner details | Name, Email, Password (min 12 chars) | ☐ |
| 1.4 | ☐ Select role: **OWNER** | This gives full system access | ☐ |
| 1.5 | ☐ Submit registration | You'll get a confirmation | ☐ |
| 1.6 | ☐ **Check your email** for verification link | May be in spam folder | ☐ |
| 1.7 | ☐ Click the verification link | Email is now verified | ☐ |
| 1.8 | ☐ Log in with your credentials | | ☐ |

### Step 2: Create Your Factory

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 2.1 | ☐ Go to **Settings → Factory Profile** | | ☐ |
| 2.2 | ☐ Click **"Create Factory"** | | ☐ |
| 2.3 | ☐ Enter **Factory Name** | e.g. "Steel Fab India Pvt Ltd" | ☐ |
| 2.4 | ☐ Select **Industry Type: "Steel"** | ⚠️ Critical — enables steel modules! | ☐ |
| 2.5 | ☐ Select **Timezone** | e.g. `Asia/Kolkata` (IST) | ☐ |
| 2.6 | ☐ Enter **Factory Code** | e.g. `SFI001` | ☐ |
| 2.7 | ☐ Add **Address & Contact Info** | | ☐ |
| 2.8 | ☐ Click **Save** | ✅ Factory is live! | ☐ |

### Step 3: Set Up Security (Recommended)

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 3.1 | ☐ Go to **Settings → Security** | | ☐ |
| 3.2 | ☐ Click **"Setup MFA"** (Multi-Factor Auth) | | ☐ |
| 3.3 | ☐ Scan QR code with **Google Authenticator** or **Authy** | | ☐ |
| 3.4 | ☐ Enter the OTP to confirm | ✅ MFA active | ☐ |
| 3.5 | ☐ **Change password** from default | Profile → Change Password | ☐ |

---

## 📋 PHASE 2: Day 2 — Team Setup (~45 min)

### Step 4: Set Up Shift Templates

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 4.1 | ☐ Go to **Attendance → Shift Settings** | | ☐ |
| 4.2 | ☐ Verify **default shifts** exist (morning 6-2, evening 2-10, night 10-6) | They auto-create on first visit | ☐ |
| 4.3 | ☐ Adjust **grace minutes** for late tolerance | Default: 10 min | ☐ |
| 4.4 | ☐ Add custom shifts if needed (e.g., General 9-5) | | ☐ |

### Step 5: Invite Your Team

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 5.1 | ☐ Go to **Settings → Users → Invite** | | ☐ |
| 5.2 | ☐ **Invite your Plant Manager** as **Manager** role | Manager@email.com | ☐ |
| 5.3 | ☐ **Invite your Accountant** as **Accountant** role | Accounts@email.com | ☐ |
| 5.4 | ☐ **Invite Shift Supervisors** as **Supervisor** role | supervisor@email.com | ☐ |
| 5.5 | ☐ **Invite Operators/Workers** as **Operator** role | worker1@email.com, worker2@email.com, ... | ☐ |
| 5.6 | ☐ **Invite HR Staff** as **Attendance** role (if needed) | hr@email.com | ☐ |
| 5.7 | ☐ Ask each person to **check email → accept invite → set password** | | ☐ |

### Step 6: Set Up Employee Profiles

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 6.1 | ☐ Go to **Attendance → Settings → Employees** | | ☐ |
| 6.2 | ☐ For each employee, click **"Edit"** and set: | | ☐ |
| 6.3 | ☐ **Employee Code** | e.g., `SF001`, `SF002` | ☐ |
| 6.4 | ☐ **Department** | Production, Quality, Dispatch, Accounts | ☐ |
| 6.5 | ☐ **Designation** | Plant Manager, Machine Operator, etc. | ☐ |
| 6.6 | ☐ **Default Shift** | Morning/Evening/Night | ☐ |
| 6.7 | ☐ **Reporting Manager** | Who approves their attendance? | ☐ |
| 6.8 | ☐ **Employment Type** | Permanent/Contract/Trainee | ☐ |
| 6.9 | ☐ Click **Save** | Repeat for each employee | ☐ |

### 🔑 Role Permission Quick Reference

| Role | Attendance | Production | Inventory | Invoicing | Dispatch | Customers | AI/Analytics |
|------|-----------|------------|-----------|-----------|----------|-----------|-------------|
| **Owner** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Admin** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Manager** | ✅ Full | ✅ Review | ✅ Manage | ✅ Create | ✅ Create | ✅ View | ✅ View |
| **Supervisor** | ✅ Approve | ✅ Create | ✅ View | ❌ | ✅ Create | ❌ | ✅ View |
| **Accountant** | ❌ | ❌ | ❌ | ✅ Create | ❌ | ✅ Full | ✅ Finance |
| **Operator** | ✅ Self | ✅ Create | ✅ View | ❌ | ❌ | ❌ | ❌ |
| **Attendance** | ✅ Self | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📋 PHASE 3: Day 3 — Master Data Setup (~1 hour)

### Step 7: Define Inventory Items

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 7.1 | ☐ Go to **Steel → Inventory → Items** | | ☐ |
| 7.2 | ☐ Click **"Add Item"** for each product: | | ☐ |
| | **Finished Goods** (what you sell): | | |
| | - `TMT-500` — TMT Bar 16mm (finished, unit: kg) | 📝 | ☐ |
| | - `TMT-400` — TMT Bar 12mm (finished, unit: kg) | 📝 | ☐ |
| | - `ANGLE-50` — Angle 50x50 (finished, unit: kg) | 📝 | ☐ |
| | **Raw Materials** (what you buy): | | |
| | - `BILLET-150` — Steel Billet 150mm (raw, unit: kg) | 📝 | ☐ |
| | - `SCRAP-IMP` — Imported Scrap (raw, unit: kg) | 📝 | ☐ |
| | **Consumables:** | | |
| | - `FERRO-MN` — Ferro Manganese (consumable, unit: kg) | 📝 | ☐ |
| 7.3 | ☐ Set **rate per kg** for each item (cost/price) | | ☐ |
| 7.4 | ☐ Click **Save** for each | ✅ Items ready | ☐ |

### Step 8: Define Bill of Materials (BOM)

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 8.1 | ☐ Go to **Steel → Production → BOM** | | ☐ |
| 8.2 | ☐ Click **"Create BOM"** | | ☐ |
| 8.3 | ☐ Example: **TMT Bar 16mm Production**: | | |
| | - Output: TMT-500, 1000 kg | | ☐ |
| | - Material 1: BILLET-150, 1050 kg | | ☐ |
| | - Material 2: FERRO-MN, 5 kg | | ☐ |
| 8.4 | ☐ Click **Save** | | ☐ |
| 8.5 | ☐ Repeat for each product you manufacture | | ☐ |

### Step 9: Add Customers

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 9.1 | ☐ Go to **Steel → Customers** | | ☐ |
| 9.2 | ☐ Click **"Add Customer"** | | ☐ |
| 9.3 | ☐ Fill in: | | |
| | - **Name** (e.g., ABC Constructions) | 📝 | ☐ |
| | - **Phone** (+919876543210) | 📝 | ☐ |
| | - **GSTIN** (if applicable) | 📝 | ☐ |
| | - **PAN Number** (for KYC) | 📝 | ☐ |
| | - **Credit Limit** (e.g., ₹5,00,000) | 📝 | ☐ |
| | - **Address** | 📝 | ☐ |
| 9.4 | ☐ Click **Save** | | ☐ |
| 9.5 | ☐ Repeat for all existing customers | | ☐ |
| 9.6 | ☐ Upload KYC documents (PAN/GST) for verification | | ☐ |

### Step 10: Add Vendors

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 10.1 | ☐ Go to **Steel → Vendors** | | ☐ |
| 10.2 | ☐ Click **"Add Vendor"** | | ☐ |
| 10.3 | ☐ Fill in vendor details (name, phone, materials supplied) | | ☐ |
| 10.4 | ☐ Click **Save** | | ☐ |
| 10.5 | ☐ Repeat for all suppliers | | ☐ |

### Step 11: Set Up Production Machines & Lines

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 11.1 | ☐ Go to **Steel → Production → Machines** | | ☐ |
| 11.2 | ☐ Click **"Add Machine"** for each: | | |
| | - **Furnace #1** (Melting, capacity: 20 ton) | 📝 | ☐ |
| | - **Caster #1** (Continuous Casting) | 📝 | ☐ |
| | - **Rolling Mill #1** (Rolling, capacity: 15 ton/shift) | 📝 | ☐ |
| 11.3 | ☐ Click **"Add Production Line"** | | |
| | - **Line A** (Furnace → Caster → Rolling Mill) | 📝 | ☐ |
| 11.4 | ☐ Set up **maintenance schedules** for each machine | | ☐ |

---

## 📋 PHASE 4: Day 4-5 — First End-to-End Dry Run (~2 hours)

### Step 12: Test Attendance Flow

| # | Task | Who Does It | Done? |
|---|------|------------|-------|
| 12.1 | ☐ Operator punches **IN** (morning shift) | Operator | ☐ |
| 12.2 | ☐ Operator views their today's attendance | Operator | ☐ |
| 12.3 | ☐ **Late worker** punches IN (verify late mark) | Operator | ☐ |
| 12.4 | ☐ Supervisor views **live attendance board** | Supervisor | ☐ |
| 12.5 | ☐ Operator punches **OUT** (end of shift) | Operator | ☐ |
| 12.6 | ☐ Operator who missed punch submits **regularization request** | Operator | ☐ |
| 12.7 | ☐ Supervisor views **review queue** | Supervisor | ☐ |
| 12.8 | ☐ Supervisor **approves** regularization request | Supervisor | ☐ |
| 12.9 | ☐ Manager views **attendance report** | Manager | ☐ |
| 12.10| ☐ Manager views **attendance summary** | Manager | ☐ |
| | ✅ **Attendance Flow Complete** | | |

### Step 13: Test Production Entry Flow

| # | Task | Who Does It | Done? |
|---|------|------------|-------|
| 13.1 | ☐ Operator creates a **production entry** | Operator | ☐ |
| 13.2 | ☐ Operator includes: date, shift, target, produced, manpower, downtime | Operator | ☐ |
| 13.3 | ☐ Operator views **today's entries** | Operator | ☐ |
| 13.4 | ☐ Supervisor **reviews and approves** the entry | Supervisor | ☐ |
| 13.5 | ☐ Manager views **production analytics** | Manager | ☐ |
| | ✅ **Production Entry Flow Complete** | | |

### Step 14: Test Batch Production Flow

| # | Task | Who Does It | Done? |
|---|------|------------|-------|
| 14.1 | ☐ Supervisor creates a **production batch** | Supervisor | ☐ |
| 14.2 | ☐ Enter: shift, heat number, machine, BOM, input/output weights | Supervisor | ☐ |
| 14.3 | ☐ Verify **yield %** is auto-calculated | Supervisor | ☐ |
| 14.4 | ☐ View **batch history** by heat number | Supervisor | ☐ |
| | ✅ **Batch Production Flow Complete** | | |

### Step 15: Test Inventory Flow

| # | Task | Who Does It | Done? |
|---|------|------------|-------|
| 15.1 | ☐ Manager creates **stock transaction** (stock in) | Manager | ☐ |
| 15.2 | ☐ Verify stock levels updated | Manager | ☐ |
| 15.3 | ☐ Initiate **stock reconciliation** | Manager | ☐ |
| 15.4 | ☐ Enter counted quantities | | ☐ |
| 15.5 | ☐ Auto-bypass if variance < 5% | | ☐ |
| 15.6 | ☐ Admin **approves** reconciliation (if variance > 5%) | Admin | ☐ |
| | ✅ **Inventory Flow Complete** | | |

### Step 16: Test Invoicing & Dispatch Flow

| # | Task | Who Does It | Done? |
|---|------|------------|-------|
| 16.1 | ☐ Accountant/Manager **creates sales invoice** | Accountant | ☐ |
| 16.2 | ☐ Add line items: product, weight, rate | Accountant | ☐ |
| 16.3 | ☐ Verify GST & totals auto-calculated | Accountant | ☐ |
| 16.4 | ☐ Supervisor/Manager **creates dispatch** | Supervisor | ☐ |
| 16.5 | ☐ Enter: truck number, driver, gate pass | Supervisor | ☐ |
| 16.6 | ☐ Gate pass **verified** at security gate | Security | ☐ |
| 16.7 | ☐ Update dispatch status to **"in_transit"** | | ☐ |
| 16.8 | ☐ Record **delivery** confirmation | | ☐ |
| 16.9 | ☐ Accountant records **payment received** | Accountant | ☐ |
| 16.10| ☐ Allocate payment to invoice | Accountant | ☐ |
| | ✅ **Invoice & Dispatch Flow Complete** | | |

### Step 17: Test OCR Document Processing

| # | Task | Who Does It | Done? |
|---|------|------------|-------|
| 17.1 | ☐ Go to **OCR → Upload Document** | Operator | ☐ |
| 17.2 | ☐ Upload a **supplier invoice photo** | Operator | ☐ |
| 17.3 | ☐ AI processes and extracts text | (Auto) | ☐ |
| 17.4 | ☐ Supervisor **verifies** extracted data | Supervisor | ☐ |
| 17.5 | ☐ Make corrections if needed | Supervisor | ☐ |
| 17.6 | ☐ **Approve** the OCR verification | Supervisor | ☐ |
| 17.7 | ☐ **Export** to Excel for records | Supervisor | ☐ |
| | ✅ **OCR Flow Complete** | | |

---

## 📋 PHASE 5: Week 2 — Intelligence & Optimization

### Step 18: Activate AI & Analytics

| # | Task | Who Does It | Done? |
|---|------|------------|-------|
| 18.1 | ☐ View **Production Analytics** (weekly/monthly/trends) | Supervisor+ | ☐ |
| 18.2 | ☐ View **Inventory Intelligence** dashboard | Supervisor+ | ☐ |
| 18.3 | ☐ View **Fraud Intelligence** (anomaly detection) | Supervisor+ | ☐ |
| 18.4 | ☐ View **Workforce Intelligence** (attendance KPIs, overtime) | Supervisor+ | ☐ |
| 18.5 | ☐ View **Quality Intelligence** (scrap rates, defect patterns) | Supervisor+ | ☐ |
| 18.6 | ☐ Try **AI Natural Language Query** — "Show me last 7 days production" | Supervisor+ | ☐ |
| 18.7 | ☐ Generate **AI Executive Summary** | Manager+ | ☐ |
| 18.8 | ☐ Set up **Email Summary Reports** (daily/weekly) | Accountant+ | ☐ |
| 18.9 | ☐ Configure **Alert Recipients** for notifications | Admin+ | ☐ |

### Step 19: Review Approvals & Compliance

| # | Task | Instructions | Done? |
|---|------|-------------|-------|
| 19.1 | ☐ Check the **Approval Queue** for pending items | | ☐ |
| 19.2 | ☐ Understand **auto-bypass** rules (variance < 5% → auto-approved) | | ☐ |
| 19.3 | ☐ Test **IP-3** approval pattern (two-stage: create → supervisor → manager) | | ☐ |
| 19.4 | ☐ Verify **Audit Trail** captures all actions | | ☐ |
| 19.5 | ☐ Review **Permission Settings** for each role | | ☐ |

---

## 📋 PHASE 6: Go-Live Checklist

### 🔴 Critical — Must Do Before Going Live

| # | Task | Done? |
|---|------|-------|
| G.1 | ☐ **Email verification** complete for all users | ☐ |
| G.2 | ☐ **Factory industry type** set to "steel" (cannot change later) | ☐ |
| G.3 | ☐ **Shift templates** configured for all shifts | ☐ |
| G.4 | ☐ **All employees** have profiles with default shifts | ☐ |
| G.5 | ☐ **All inventory items** defined with correct categories | ☐ |
| G.6 | ☐ **All customers** added with GST/PAN | ☐ |
| G.7 | ☐ **All vendors** added | ☐ |
| G.8 | ☐ **BOMs** defined for all products | ☐ |
| G.9 | ☐ **Machines & production lines** configured | ☐ |
| G.10 | ☐ **Payment gateway** (Razorpay) configured for billing | ☐ |
| G.11 | ☐ **MFA** enabled on Owner & Admin accounts | ☐ |

### 🟡 Important — Recommended Before Go-Live

| # | Task | Done? |
|---|------|-------|
| G.12 | ☐ **Dry run complete** — created test dispatch end-to-end | ☐ |
| G.13 | ☐ **Dry run complete** — created test invoice end-to-end | ☐ |
| G.14 | ☐ **Dry run complete** — attendance punch/review/approve cycle | ☐ |
| G.15 | ☐ **Team trained** on their roles | ☐ |
| G.16 | ☐ **Alert recipients** configured (who gets notified) | ☐ |
| G.17 | ☐ **Subscription plan** selected and activated | ☐ |

### 🟢 Nice to Have — Post Go-Live

| # | Task | Done? |
|---|------|-------|
| G.18 | ☐ **Fraud intelligence** reviewed for first week | ☐ |
| G.19 | ☐ **OCR templates** created for recurring documents | ☐ |
| G.20 | ☐ **Email summaries** configured for daily ops reports | ☐ |
| G.21 | ☐ **Labour cost rates** configured in Workforce settings | ☐ |
| G.22 | ☐ **Reorder points** calculated for inventory items | ☐ |

---

## 📞 Common Issues & Quick Fixes

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Can't log in | Password < 12 chars | Use a longer password |
| Email not received | Wrong SMTP key | Contact support to check Resend API key |
| 403 Forbidden | Wrong role for action | Check Permissions Reference table above |
| Factory not showing | Industry type not "steel" | Contact support |
| Dispatch/create 403 | Need Manager+ (before fix) | Update to latest version |
| Attendance punch fails | No active factory selected | Select factory in settings |
| OCR fails | Document too blurry | Ensure good lighting & focus |
| Payment fails | Razorpay not configured | Check billing settings |

---

## 📊 Day-in-the-Life Quick Schedule

| Time | Task | Role |
|------|------|------|
| **6:00 AM** | Workers punch IN (morning shift) | 👷 Operators |
| **7:00 AM** | Create production entries for shift | 👷 Operators |
| **8:00 AM** | Record batch production / heat numbers | 👷 Supervisor |
| **9:00 AM** | Review & approve yesterday's pending tasks | 👔 Supervisor |
| **10:00 AM** | Upload supplier invoices for OCR | 👷 Data Entry |
| **11:00 AM** | Create sales invoices for orders | 🧾 Accountant/Manager |
| **12:00 PM** | View live attendance board | 👔 Supervisor |
| **2:00 PM** | Shift change — workers punch OUT/IN | 👷 Operators |
| **3:00 PM** | Create dispatches for confirmed orders | 👔 Supervisor |
| **4:00 PM** | Process customer payments received | 🧾 Accountant |
| **5:00 PM** | Gate pass verification for outgoing trucks | 🔒 Security |
| **6:00 PM** | End-of-day analytics review | 👔 Manager |
| **Weekly** | Generate AI executive summary | 📊 Manager |
| **Monthly** | Stock reconciliation & audit | 📋 Admin |

---

> 📌 **Pro Tip:** Start with just **one shift** and **one production line** for the first few days. Once your team is comfortable, expand to all shifts and full production.
>
> 📌 **Need help?** Contact support with your factory ID ready. Screenshots of any errors speed up troubleshooting.

---

*Document version: 1.0 — Generated for FactoryNerve (DPR.ai)*
