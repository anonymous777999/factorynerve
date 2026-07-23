# FactoryNerve Enterprise Architecture Report
## Complete Reverse-Engineering of Factory Operations & Software Platform

**Version:** 1.0  
**Date:** July 2026  
**Prepared by:** Senior Manufacturing Business Analyst / ERP Consultant / Industrial Operations Expert / Process Engineer / Enterprise Architect / Factory Digital Transformation Consultant  
**Classification:** CONFIDENTIAL — Internal Engineering Use Only  
**Purpose:** Single Source of Truth for FactoryNerve v2 Rebuild

---

# TABLE OF CONTENTS

| Part | Title | Page |
|------|-------|------|
| 1 | Factory Overview | 3 |
| 2 | Factory Actors | 8 |
| 3 | Business Objects | 18 |
| 4 | Complete Material Journey | 32 |
| 5 | Department Workflows | 45 |
| 6 | Information Flow | 62 |
| 7 | Event Catalog | 70 |
| 8 | State Machines | 78 |
| 9 | Decision Matrix | 85 |
| 10 | Database Ownership | 91 |
| 11 | Cross-Department Dependencies | 96 |
| 12 | Factory Timelines | 101 |
| 13 | Current FactoryNerve Mapping | 108 |
| 14 | Gap Analysis | 118 |
| 15 | Centralized FactoryNerve Architecture | 128 |
| 16 | Future Evolution (5-Year Roadmap) | 138 |

---

# PART 1: FACTORY OVERVIEW

## 1.1 Purpose of the Factory

FactoryNerve is architected for a **mid-to-large scale discrete and process manufacturing facility** specializing in **steel production** (TMT bars, structural steel, coils, angles, channels, beams) with the following characteristics:

- **Industry Vertical:** Steel Manufacturing (Primary Metal Manufacturing — NAICS 331110)
- **Production Model:** Make-to-Stock (MTS) for standard grades + Make-to-Order (MTO) for custom specifications
- **Process Type:** Hybrid — Continuous (melting, casting) + Discrete (rolling, cutting, finishing)
- **Scale:** Multi-line, multi-shift (3×8 or 2×12), 200-500+ workers per factory
- **Geographic Footprint:** Multi-factory organizations (org → factory hierarchy), typically India-based (INR currency, GST compliance, ISI/BIS certification)

**Core Purpose:** Transform raw steel scrap / billets / ingots into finished steel products (TMT bars, structural sections, wire rods) with full traceability from heat number to customer delivery, while maintaining financial control, regulatory compliance, and operational visibility for owner/management.

## 1.2 Factory Hierarchy

```
ORGANIZATION (Multi-tenant SaaS tenant)
│
├── FACTORY 1 — "Main Plant, Raipur" (industry_type: "steel")
│   ├── Production Lines (TMT Bar Line, Angle Line, Channel Line, Beam Line)
│   │   ├── Machines (Furnace, Continuous Caster, Roughing Mill, Finishing Mill, Cooling Bed, Shearing)
│   │   └── Work Centers per Line
│   ├── Warehouses (Raw Material Yard, WIP Storage, Finished Goods Yard, Scrap Yard)
│   ├── Gates (Main Gate, Material Gate, Dispatch Gate)
│   ├── Weighbridges (Entry, Exit, In-process)
│   └── Departments (see 1.3)
│
├── FACTORY 2 — "Branch Plant, Bhilai" (industry_type: "steel")
│   └── ... (same structure)
│
└── FACTORY N — "Service Center / Depot"
    └── Inventory-only operations (no production)
```

**Key Principle:** Each factory is an **independent operational unit** with its own inventory, production, dispatch, customers, vendors, and users. Data isolation is enforced at the `factory_id` level across all tables. Users are bound to factories via `UserFactoryRole` (many-to-many).

## 1.3 Departments

| Department | FactoryNerve Module(s) | Primary Responsibility |
|------------|------------------------|------------------------|
| **Production / Shop Floor** | `entries`, `steel` (batches, lines, machines), `steel_bom` | Execute production plan, record DPR, operate machines, report downtime |
| **Production Planning** | `steel_intelligence`, `analytics` | Create production schedule, assign lines, balance load, manage BOMs |
| **Quality Control (QC)** | `entries` (quality_issues, defect_reasons), `steel_intelligence` (quality) | Incoming inspection, in-process checks, final inspection, rejection/scrap tracking, BIS/ISI compliance |
| **Stores / Inventory** | `steel` (inventory items, transactions, reconciliations) | Receive material, issue to production, manage stock, cycle counts, reorder points |
| **Purchase / Procurement** | `steel_finance` (vendor bills, vendor payments), `steel` (vendor master) | Vendor onboarding, PO creation, GRN, invoice verification, payment processing |
| **Sales & Marketing** | `steel` (customers, invoices, follow-ups), `steel_intelligence` (sales) | Customer acquisition, order management, invoicing, collections, CRM |
| **Dispatch / Logistics** | `steel` (dispatches, gate passes, vehicles), `steel_intelligence` | Vehicle scheduling, gate pass generation, weighbridge coordination, POD collection |
| **Finance & Accounts** | `steel_finance` (cash flow, receivables, payables, expenses), `billing` (subscription) | AR/AP, cash management, GST returns, costing, P&L, audit trail |
| **HR / Workforce** | `attendance`, `workforce_intelligence`, `employee_profile` | Attendance, shifts, overtime, labour cost, workforce analytics |
| **Maintenance** | `steel` (machines, downtime events, maintenance tasks) | Preventive/breakdown maintenance, OEE tracking, spare parts |
| **Security / Gate Control** | `steel` (dispatch entry/exit times, gate pass verification) | Vehicle entry/exit, weighbridge operation, gate pass QR verification |
| **IT / Admin** | `settings`, `auth`, `approvals`, `audit`, `observability` | User management, role assignment, factory config, approval workflows, system health |
| **AI / Intelligence** | `ai`, `analytics`, `steel_intelligence`, `workforce_intelligence` | Anomaly detection, NLQ, executive summaries, predictive insights |

## 1.4 Operational Goals (KPIs by Department)

| Goal Category | Key Metrics | Target (Typical) |
|---------------|-------------|------------------|
| **Production Efficiency** | OEE, Throughput (MT/day), Yield %, Loss % | OEE > 75%, Loss < 3% |
| **Quality** | Rejection Rate, Scrap Rate, BIS Compliance % | Rejection < 2%, Scrap < 1.5% |
| **Inventory** | Stock Turns, Days of Stock, Stock Accuracy % | Turns > 8/yr, Accuracy > 98% |
| **On-Time Delivery** | OTIF %, Dispatch Lead Time | OTIF > 95% |
| **Financial** | Gross Margin %, Receivable Days, Payable Days | Margin > 12%, AR < 45 days |
| **Workforce** | Attendance %, Overtime %, Labour Cost/MT | Attendance > 92%, OT < 15% |
| **Safety/Compliance** | Near-miss reports, Audit findings, GST filing | Zero critical findings |

## 1.5 Production Philosophy

**Lean + Traceability + Financial Control**

1. **Weight-Based Accounting:** Every transaction is in **kilograms** (not pieces). Steel is bought, produced, stored, and sold by weight.
2. **Heat Number Traceability:** Every melt carries a `heat_number` from furnace → caster → rolling → dispatch. Enables BIS/ISI certificate mapping.
3. **Maker-Checker Everywhere:** No single person can create and approve. All critical workflows use **IP-2 through IP-5 approval patterns** (single-stage to dual-owner).
4. **Ledger-Based Inventory:** Stock is derived from **immutable transaction log** (`SteelInventoryTransaction`). No direct stock column — balance = Σ(transactions). Reconciliation creates adjustment entries.
4. **Owner Visibility:** Daily PDF report (`/steel/owner-daily-pdf`) gives owner a one-page snapshot: revenue, profit, leakage, top anomalies.
5. **AI-Augmented, Not AI-Replaced:** AI suggests, detects, summarizes — humans decide. All AI outputs are auditable.

## 1.6 High-Level Workflow (Factory View)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         STEEL FACTORY END-TO-END VALUE STREAM                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

  SUPPLIER                                          CUSTOMER
     │                                                │
     ▼                                                │
  ┌─────────┐    PURCHASE ORDER    ┌─────────┐        │
  │ VENDOR  │ ───────────────────▶ │ PURCHASE │        │
  │ MASTER  │                      │  DEPT   │        │
  └─────────┘                      └────┬────┘        │
                                        │              │
                                        ▼              │
  ┌─────────────────────────────────────────────────┐  │
  │              MATERIAL ARRIVAL AT GATE            │  │
  │  Security → Gate Entry → Weighbridge → Unload    │  │
  │  → QC Inspection → GRN → Inventory Receipt       │  │
  └────────────────────────┬─────────────────────────┘  │
                           │                             │
                           ▼                             │
  ┌─────────────────────────────────────────────────┐  │
  │              PRODUCTION PLANNING                 │  │
  │  Sales Orders → Production Schedule → Line       │  │
  │  Assignment → BOM Explosion → Material Issue     │  │
  └────────────────────────┬─────────────────────────┘  │
                           │                             │
                           ▼                             │
  ┌─────────────────────────────────────────────────┐  │
  │              SHOP FLOOR EXECUTION                │  │
  │  Operator Punch-in → DPR Entry (per shift)       │  │
  │  → Batch Recording (Input→Output, Loss, Heat#)   │  │
  │  → Machine Logging (Downtime, OEE)               │  │
  │  → QC Sampling → Rejection/Scrap Recording       │  │
  └────────────────────────┬─────────────────────────┘  │
                           │                             │
                           ▼                             │
  ┌─────────────────────────────────────────────────┐  │
  │              FINISHED GOODS HANDLING             │  │
  │  Batch Completion → Stock Update (Ledger)        │  │
  │  → Yard Storage → Reconciliation (Cycle Count)   │  │
  └────────────────────────┬─────────────────────────┘  │
                           │                             │
                           ▼                             │
  ┌─────────────────────────────────────────────────┐  │
  │              SALES & DISPATCH                    │  │
  │  Customer Order → Invoice → Dispatch Plan        │  │
  │  → Gate Pass + QR → Vehicle Loading              │  │
  │  → Weighbridge Exit → POD → Inventory Relief     │  │
  └────────────────────────┬─────────────────────────┘  │
                           │                             │
                           ▼                             ▼
  ┌─────────────────────────────────────────────────┐
  │              FINANCIAL CLOSE                     │
  │  Payment Collection → Allocation → Reconciliation│
  │  Vendor Payment → GST Filing → Costing → P&L     │
  └─────────────────────────────────────────────────┘
```

---

# PART 2: FACTORY ACTORS

Every human and system role that interacts with FactoryNerve. For each: Responsibilities, Information Created/Consumed, Systems Used, Interactions, Decisions, KPIs, Pain Points, Authority Level.

> **Note:** Roles map to `UserRole` enum: `ATTENDANCE` (0), `OPERATOR` (1), `SUPERVISOR` (2), `ACCOUNTANT` (2), `MANAGER` (3), `ADMIN` (4), `OWNER` (5). Higher role inherits lower permissions.

---

## 2.1 Security Guard / Gate Keeper

| Aspect | Detail |
|--------|--------|
| **Role Level** | Not a system user (physical role). May have `ATTENDANCE` role for gate app access. |
| **Responsibilities** | Vehicle entry/exit logging, gate pass verification, weighbridge coordination, driver/document check |
| **Information Created** | Vehicle entry timestamp, gate pass photo, driver ID verification, weighbridge slip (paper/photo) |
| **Information Consumed** | Expected vehicle list (from dispatch), gate pass QR code, authorized vehicle/driver list |
| **Systems Used** | Mobile gate app (planned), weighbridge display, FactoryNerve `/steel/dispatches/{id}/gate-pass/verify` |
| **Interacts With** | Driver, Dispatch Supervisor, Weighbridge Operator |
| **Decisions Made** | Allow/deny entry, flag mismatched gate pass, report unauthorized vehicle |
| **KPIs** | Gate throughput (vehicles/hr), gate pass verification accuracy, queue time |
| **Pain Points** | Manual paper gate passes, illegible handwriting, no real-time dispatch visibility, weighbridge integration gaps |
| **Authority** | Physical access control only; no financial/production authority |

---

## 2.2 Watchman (Night Shift Security)

| Aspect | Detail |
|--------|--------|
| **Role Level** | Non-system role |
| **Responsibilities** | Perimeter security, night material movement logging, emergency response |
| **Information Created** | Night entry/exit log (manual register), incident reports |
| **Information Consumed** | Authorized night movement list |
| **Systems Used** | None currently (paper register) |
| **Interacts With** | Night shift supervisor, driver |
| **Decisions** | Allow emergency material movement |
| **Pain Points** | No digital trail, handover gaps between shifts |

---

## 2.3 Reception / Front Desk

| Aspect | Detail |
|--------|--------|
| **Role Level** | `ATTENDANCE` or `OPERATOR` |
| **Responsibilities** | Visitor management, courier/document receipt, internal call routing |
| **Information Created** | Visitor log, incoming document register |
| **Information Consumed** | Employee directory, expected visitors |
| **Systems Used** | Basic web portal (planned) |
| **Pain Points** | Disconnected from factory operations |

---

## 2.4 Planning Officer / Production Planner

| Aspect | Detail |
|--------|--------|
| **Role Level** | `SUPERVISOR` or `MANAGER` |
| **Responsibilities** | Translate sales orders into production schedule, assign batches to lines, manage BOMs, calculate material requirements, monitor WIP |
| **Information Created** | Production schedule, line assignments, BOM versions, material issue plans |
| **Information Consumed** | Sales orders (confirmed), inventory stock (real-time), machine capacity, manpower availability, open dispatch commitments |
| **Systems Used** | `/steel/production/lines`, `/steel/bom`, `/steel/intelligence/production`, `/steel/batches/auto-fill` |
| **Interacts With** | Production Manager, Line Supervisors, Store Keeper, Sales |
| **Decisions Made** | Which line runs what grade, when to changeover, priority between orders, overtime authorization |
| **KPIs** | Schedule adherence %, line utilization %, changeover time, WIP days |
| **Pain Points** | No finite scheduling engine, manual BOM explosion, no capacity constraint solver, last-minute sales changes |
| **Authority** | Can create/modify batches, assign lines, approve BOMs (IP-2) |

---

## 2.5 Purchase Officer / Procurement Executive

| Aspect | Detail |
|--------|--------|
| **Role Level** | `SUPERVISOR` or `MANAGER` |
| **Responsibilities** | Vendor onboarding, PO creation, GRN processing, invoice verification, payment follow-up |
| **Information Created** | Purchase orders, vendor master data, GRN, vendor bill entries, payment requests |
| **Information Consumed** | Reorder alerts (auto-calculated), inventory levels, vendor performance, approved vendor list |
| **Systems Used** | `/steel/vendors`, `/steel/vendor-bills`, `/steel/vendor-payments`, `/steel/finance/payables` |
| **Interacts With** | Vendors, Store Keeper, Accounts, Quality (for incoming inspection) |
| **Decisions Made** | Vendor selection, price negotiation, payment terms, hold/release vendor |
| **KPIs** | PO cycle time, invoice accuracy %, vendor OTIF, cost savings %, payment terms adherence |
| **Pain Points** | No automated PO generation from reorder points, manual 3-way match (PO-GRN-Invoice), vendor portal missing |
| **Authority** | Create vendor (IP-2), approve vendor bill (IP-2), release payment (IP-2, amount-based bypass) |

---

## 2.6 Machine Operator / Shop Floor Worker

| Aspect | Detail |
|--------|--------|
| **Role Level** | `OPERATOR` |
| **Responsibilities** | Operate assigned machine/line, record production per shift (DPR), report downtime, log quality issues, perform minor maintenance |
| **Information Created** | **Entry (DPR)**: date, shift, units_target, units_produced, manpower_present/absent, downtime_minutes, downtime_reason, materials_used, quality_issues, rejection_qty, defect_reason, rework_required, scrap_qty, notes. **Batch**: input_item, output_item, input_qty, expected/actual_output, heat_number, loss%, variance. **Downtime Events**: machine, start/end, reason, category. |
| **Information Consumed** | Shift target, BOM/spec for current grade, previous shift handover notes, machine status |
| **Systems Used** | `/entries` (DPR form), `/entries/smart` (WhatsApp/text → AI parse), `/steel/batches` (batch recording), mobile app (planned) |
| **Interacts With** | Supervisor (shift handover), QC Inspector, Maintenance (breakdown), Store Keeper (material issue) |
| **Decisions Made** | Machine parameter adjustments within spec, when to call maintenance, scrap vs rework classification |
| **KPIs** | Production vs target %, loss % per batch, downtime hours, quality rejection rate, attendance |
| **Pain Points** | Manual data entry on paper then re-entry, no real-time machine data (PLC/SCADA gap), shift handover loss, smart input accuracy varies |
| **Authority** | Create entry (own), create batch (own), request regularization (attendance) |

---

## 2.7 Supervisor / Shift In-Charge

| Aspect | Detail |
|--------|--------|
| **Role Level** | `SUPERVISOR` |
| **Responsibilities** | Shift management, approve operator entries, approve/reject attendance, monitor line performance, coordinate material issue, escalate breakdowns |
| **Information Created** | Entry approvals/rejections, attendance approvals, shift handover notes, line performance comments |
| **Information Consumed** | All operator entries (team), attendance live view, machine downtime alerts, material shortage alerts |
| **Systems Used** | `/entries` (approve/reject), `/attendance/review`, `/attendance/live`, `/steel/intelligence/production`, `/analytics/manager` |
| **Interacts With** | Operators (team), Planning Officer, Maintenance Lead, Store Keeper, QC |
| **Decisions Made** | Approve/reject DPR entries, approve/reject attendance regularization, authorize overtime, line stop/restart, material substitution approval |
| **KPIs** | Team production efficiency, approval turnaround time, attendance accuracy, escalation response time |
| **Pain Points** | Approval bottleneck (single approver), no delegation, limited visibility into other shifts |
| **Authority** | IP-2 approval for: entry approve/delete, attendance review, inventory reconciliation, dispatch status, customer verification, batch variance, factory create, user invite/deactivate |

---

## 2.8 Store Keeper / Inventory Controller

| Aspect | Detail |
|--------|--------|
| **Role Level** | `SUPERVISOR` or `MANAGER` |
| **Responsibilities** | Material receipt (GRN), issue to production, stock maintenance, cycle counts, reconciliation, reorder initiation, scrap/segregation |
| **Information Created** | Inventory transactions (inward, issue, adjustment), reconciliation records, stock adjustment notes, scrap receipt |
| **Information Consumed** | Production issue requests, GRN from purchase, dispatch load lists, reorder alerts, current stock balances |
| **Systems Used** | `/steel/inventory/items`, `/steel/inventory/stock`, `/steel/inventory/transactions`, `/steel/inventory/reconciliations`, `/steel/inventory/reorder-points/calculate` |
| **Interacts With** | Purchase Officer (GRN), Operators (issue), Dispatch (load verification), QC (rejected material), Accounts (valuation) |
| **Decisions Made** | Accept/reject incoming material, issue quantity vs request, reconciliation approval (IP-2), scrap categorization, bin location assignment |
| **KPIs** | Stock accuracy %, reconciliation variance %, stockout incidents, inventory turns, carrying cost |
| **Pain Points** | No barcode/RFID, manual weighment entry, yard location tracking missing, no putaway optimization |
| **Authority** | Create inventory item (IP-2), create transaction (IP-2 conditional), create/approve reconciliation (IP-2), manage reorder points |

---

## 2.9 Inventory Manager

| Aspect | Detail |
|--------|--------|
| **Role Level** | `MANAGER` |
| **Responsibilities** | Inventory policy, ABC classification, safety stock setting, valuation, audit coordination, obsolescence management |
| **Information Created** | Inventory policies, category definitions, valuation methods, write-off approvals |
| **Information Consumed** | All inventory intelligence dashboards, aging reports, turnover analysis |
| **Systems Used** | `/steel/intelligence/inventory`, `/steel/inventory/reorder-points/calculate`, `/reports` |
| **Interacts With** | Store Keeper, Purchase, Finance, Production Planning |
| **Decisions** | Write-off approval, policy changes, inter-factory transfer, valuation method |
| **Authority** | Higher-value reconciliation approval, inventory policy, cost center allocation |

---

## 2.10 Quality Inspector / QC Officer

| Aspect | Detail |
|--------|--------|
| **Role Level** | `SUPERVISOR` or `MANAGER` |
| **Responsibilities** | Incoming inspection, in-process checks, final inspection, lab coordination, BIS/ISI compliance, rejection/scrap authorization, customer complaint investigation |
| **Information Created** | Inspection reports, test certificates (chemical/mechanical), rejection notes, scrap authorization, NCR (non-conformance reports) |
| **Information Consumed** | Batch records (heat number, grade), material specs, customer requirements, previous rejection trends |
| **Systems Used** | `/entries` (quality_issues, defect_reason_id), `/steel/batches` (rejection_qty, scrap_qty), `/steel/intelligence/quality`, `/entries/defect-reasons` |
| **Interacts With** | Operators (sampling), Store Keeper (quarantine), Production Planning (grade changes), Sales (customer complaints) |
| **Decisions** | Accept/Reject incoming lot, accept/reject batch, authorize scrap vs rework, approve test certificate, initiate NCR |
| **KPIs** | Inspection coverage %, first-pass yield, customer complaint rate, lab turnaround time, BIS audit compliance |
| **Pain Points** | No mobile inspection app, paper-based checklists, lab results manual entry, no statistical process control (SPC) |
| **Authority** | Defect reason master management (IP-2), quality hold release |

---

## 2.11 Marketing / Sales Executive

| Aspect | Detail |
|--------|--------|
| **Role Level** | `SUPERVISOR` or `MANAGER` |
| **Responsibilities** | Customer acquisition, quotation, order negotiation, relationship management, market intelligence |
| **Information Created** | Customer inquiries, quotations, visit reports, competitor pricing, demand forecasts |
| **Information Consumed** | Customer master, credit status, stock availability, production schedule, dispatch status |
| **Systems Used** | `/steel/customers`, `/steel/customers/{id}/tasks` (follow-ups), `/steel/intelligence/sales`, `/steel/inventory/stock` |
| **Interacts With** | Customers, Sales Manager, Production Planning, Dispatch, Accounts |
| **Decisions** | Quote price, payment terms, delivery commitment, priority allocation |
| **KPIs** | New customers, conversion rate, sales volume, revenue growth, customer retention |
| **Pain Points** | No CRM pipeline, quotation versioning missing, stock visibility delayed, no mobile app for field visits |
| **Authority** | Create customer (no approval), create follow-up tasks, view customer financials |

---

## 2.12 Sales Manager / Commercial Head

| Aspect | Detail |
|--------|--------|
| **Role Level** | `MANAGER` or `ADMIN` |
| **Responsibilities** | Sales strategy, target setting, credit approval, invoice approval, dispute resolution, key account management |
| **Information Created** | Sales targets, credit limit approvals, invoice approvals (pre-dispatch), dispute resolutions |
| **Information Consumed** | Sales pipeline, receivables aging, customer risk scores, dispatch bottlenecks |
| **Systems Used** | `/steel/invoices` (edit pre-dispatch IP-2, post-dispatch IP-3), `/steel/finance/receivables`, `/steel/customers/{id}/verification/review` |
| **Interacts With** | Sales team, Finance, Production Planning, Dispatch, Owner |
| **Decisions** | Credit limit overrides, payment terms exception, invoice void (IP-4), dispatch priority |
| **KPIs** | Revenue vs target, collection efficiency, bad debt %, customer satisfaction |
| **Authority** | IP-3 for post-dispatch invoice edit, IP-4 for invoice void, credit limit approval |

---

## 2.13 Accountant / Finance Executive

| Aspect | Detail |
|--------|--------|
| **Role Level** | `ACCOUNTANT` (dedicated role) or `MANAGER` |
| **Responsibilities** | AR/AP processing, payment recording/allocation, GST return prep, TDS, expense booking, bank reconciliation, MIS preparation |
| **Information Created** | Customer payments, payment allocations, vendor payments, expense entries, journal entries (planned), GST summaries |
| **Information Consumed** | Invoices (sales/purchase), dispatch confirmations, bank statements, tax registers |
| **Systems Used** | `/steel/customers/payments` (IP-2 bypass <₹50k), `/steel/vendor-payments`, `/steel/finance/*`, `/steel/expenses`, `/reports` |
| **Interacts With** | Sales (collections), Purchase (vendor payments), Dispatch (POD verification), Bank, Auditor |
| **Decisions** | Payment allocation across invoices, expense categorization, TDS applicability, GST input credit claim |
| **KPIs** | Days sales outstanding (DSO), days payable outstanding (DPO), GST filing accuracy, audit adjustments |
| **Pain Points** | Manual payment allocation, no bank integration, TDS automation missing, expense approval workflow basic |
| **Authority** | IP-2 for payment create (bypass <₹50k), IP-3 for payment reallocate, IP-4 for payment reverse |

---

## 2.14 Admin / IT Administrator

| Aspect | Detail |
|--------|--------|
| **Role Level** | `ADMIN` |
| **Responsibilities** | User lifecycle, role assignment, factory configuration, approval workflow config, system monitoring, backup, integration management |
| **Information Created** | User accounts, role assignments, factory settings, workflow templates, audit log reviews |
| **Information Consumed** | System health, usage metrics, error logs, security alerts |
| **Systems Used** | `/settings/users`, `/settings/factories`, `/settings/factory`, `/approvals/queue`, `/observability/*`, `/admin/*` |
| **Interacts With** | All department heads, platform support |
| **Decisions** | Role assignments (IP-4), factory creation (IP-2), plan upgrades, feature flags, data retention |
| **KPIs** | System uptime, user onboarding time, security incidents, license utilization |
| **Authority** | Full org/factory scope, platform-level permissions |

---

## 2.15 Owner / Managing Director / CEO

| Aspect | Detail |
|--------|--------|
| **Role Level** | `OWNER` |
| **Responsibilities** | Strategic direction, financial health, key decisions, exception approvals, investor/board reporting |
| **Information Created** | Strategic directives, capital expenditure approvals, policy decisions |
| **Information Consumed** | **Owner Daily PDF** (`/steel/owner-daily-pdf`), `/steel/intelligence/owner/dashboard`, `/ai/executive-summary`, `/analytics/manager`, `/premium/dashboard` |
| **Systems Used** | Mobile/web dashboard, daily PDF via email/WhatsApp, executive summaries |
| **Interacts With** | All department heads (via reviews), board, bankers, auditors |
| **Decisions** | Capital expenditure, new factory, major vendor/customer disputes, plan downgrades (IP-5), billing changes (IP-5) |
| **KPIs** | ROCE, net profit margin, cash flow, market share, safety incidents |
| **Pain Points** | Data trust issues, delayed reports, no predictive alerts, manual consolidation across factories |
| **Authority** | Ultimate — IP-5 dual approval for billing changes, can override any IP-2/IP-3/IP-4 |

---

## 2.16 Transport Coordinator / Dispatch In-Charge

| Aspect | Detail |
|--------|--------|
| **Role Level** | `SUPERVISOR` or `MANAGER` |
| **Responsibilities** | Vehicle scheduling, transporter coordination, gate pass generation, load optimization, POD follow-up |
| **Information Created** | Dispatch records, gate passes, vehicle assignments, delivery confirmations |
| **Information Consumed** | Sales invoices (ready to dispatch), vehicle availability, transporter rates, customer delivery schedules |
| **Systems Used** | `/steel/dispatches` (create IP-2, update status), `/steel/dispatches/{id}/gate-pass/verify`, `/steel/intelligence/dispatch` (planned) |
| **Interacts With** | Sales (invoice readiness), Security (gate), Weighbridge, Transporters, Customer receiving |
| **Decisions** | Vehicle selection, load sequencing, transporter assignment, dispatch hold/release |
| **KPIs** | Dispatch OTIF %, vehicle turnaround time, gate pass accuracy, POD collection rate |
| **Pain Points** | No transporter portal, manual vehicle tracking, weighbridge queue, POD chasing |
| **Authority** | Create dispatch (IP-2 bypass ≤5MT), update status (exit/delivery requires supervisor) |

---

## 2.17 Driver / Transporter

| Aspect | Detail |
|--------|--------|
| **Role Level** | External (no system access) |
| **Responsibilities** | Vehicle arrival, loading supervision, transit, delivery, POD collection |
| **Information Created** | Weighbridge slips (paper), POD (signed copy), delivery photos |
| **Information Consumed** | Gate pass (QR), dispatch instructions, route, contact person |
| **Systems Used** | None (receives gate pass PDF/WhatsApp) |
| **Pain Points** | No mobile app for POD upload, gate queue uncertainty, no real-time tracking |

---

## 2.18 Customer (External)

| Aspect | Detail |
|--------|--------|
| **Role Level** | External |
| **Responsibilities** | Place orders, receive delivery, make payment, raise complaints |
| **Information Created** | Purchase orders, payment advice, complaints, quality feedback |
| **Information Consumed** | Invoices, dispatch intimation, test certificates, account statements |
| **Systems Used** | Email, WhatsApp, shared portal (planned `/ocr/shared/{token}`) |
| **Pain Points** | No self-service portal, delayed test certificates, invoice disputes |

---

## 2.19 Supplier / Vendor (External)

| Aspect | Detail |
|--------|--------|
| **Role Level** | External |
| **Responsibilities** | Supply material per PO, submit invoices, collect payment |
| **Information Created** | Invoices, delivery challans, test certificates, payment reminders |
| **Information Consumed** | POs, GRN status, payment status |
| **Pain Points** | No vendor portal, payment status opaque, PO changes not communicated |

---

## 2.20 System Actors (Non-Human)

| Actor | Description |
|-------|-------------|
| **AI Engine** (`ai_engine.py`, `ai_router.py`) | Generates summaries, anomalies, suggestions, NLQ answers, executive summaries. Consumes: entries, batches, invoices, dispatches, attendance. Produces: AI insights, cached responses. |
| **OCR Pipeline** (`ocr_document_pipeline.py`) | Extracts structured data from invoices, challans, weighbridge slips, test certificates. Consumes: uploaded images/PDFs. Produces: verification records. |
| **Approval Engine** (`approval_service.py`) | Enforces maker-checker. Consumes: initiation requests. Produces: approval instances, callbacks. |
| **Cron Schedulers** (`cron.py`, `background_jobs.py`) | Daily maintenance, reorder calculation, auto-close attendance, approval expiry, email queue, audit archival. |
| **WhatsApp Bot** (`whatsapp_webhook.py`, `whatsapp_sender.py`) | Sends alerts, receives punch/regularization via WhatsApp. |
| **Email Processor** (`email_queue_processor.py`) | Sends transactional emails (invoices, approvals, reports). |

---

# PART 3: BUSINESS OBJECTS

Complete entity catalog with purpose, owner, lifecycle, relationships, fields, and business rules.

---

## 3.1 Core Master Data

### 3.1.1 Organization (`organizations`)
| Property | Detail |
|----------|--------|
| **Purpose** | Multi-tenant root. Billing, plan, subscription boundary. |
| **Owner** | Platform Admin / Owner |
| **Lifecycle** | Created at signup → Active → Suspended (billing) → Deleted (GDPR) |
| **Key Fields** | `org_id` (PK, UUID), `name`, `plan` (free/pilot/growth/pro/enterprise), `subscription_status`, `razorpay_customer_id`, `created_at` |
| **Relationships** | 1:N Factories, Users, Subscriptions, Invoices, AuditLogs |
| **Business Rules** | Single active subscription per org. Plan determines feature gates. |

### 3.1.2 Factory (`factories`)
| Property | Detail |
|----------|--------|
| **Purpose** | Operational unit. All transactional data scoped to factory. |
| **Owner** | Admin / Owner (IP-2 to create) |
| **Lifecycle** | Created → Active → Inactive (soft delete) |
| **Key Fields** | `factory_id` (PK, UUID), `org_id` (FK), `name`, `location`, `timezone`, `industry_type` (steel/general/chemical), `workflow_template_key`, `factory_code`, `is_active` |
| **Relationships** | N:1 Org, 1:N ProductionLines, Machines, InventoryItems, Customers, Vendors, Dispatches, Batches, Entries, Users (via UserFactoryRole) |
| **Business Rules** | Industry type locks module access (steel → steel module). Factory code auto-generated for document prefixes. Timezone used for shift calculations. |

### 3.1.3 User (`users`)
| Property | Detail |
|----------|--------|
| **Purpose** | Human actor. Authentication, authorization, audit attribution. |
| **Owner** | Admin (invite IP-2), Self (profile) |
| **Lifecycle** | Invited → Email verified → Active → Deactivated (IP-2) → Reactivated (IP-2) |
| **Key Fields** | `id` (PK), `org_id`, `user_code` (per-org sequential), `name`, `email` (unique), `password_hash`, `role` (enum), `role_revision` (cache busting), `factory_name`, `factory_code`, `phone`, `phone_e164`, `phone_verification_status`, `mfa_enabled`, `mfa_secret_encrypted`, `is_platform_admin`, `is_active`, `is_email_verified`, `last_login`, `created_at` |
| **Relationships** | N:1 Org, N:M Factories (UserFactoryRole), 1:N Entries, AttendanceRecords, AuditLogs, ApprovalInstances (actor/subject) |
| **Business Rules** | Role hierarchy enforced in PDP. `role_revision` incremented on role change. MFA required for sensitive permissions. Self-approval blocked in approval engine. |

### 3.1.4 UserFactoryRole (`user_factory_roles`)
| Property | Detail |
|--------|--------|
| **Purpose** | Many-to-many binding of user to factory with role context. |
| **Owner** | Admin (IP-2 to assign) |
| **Key Fields** | `user_id`, `factory_id`, `org_id`, `role` (can override org-level role per factory), `created_at` |
| **Business Rules** | User must have at least one active factory role to access factory-scoped data. PDP checks this for FACTORY-scoped permissions. |

### 3.1.5 EmployeeProfile (`employee_profiles`)
| Property | Detail |
|--------|--------|
| **Purpose** | HR master data for workforce analytics. Separate from auth User. |
| **Owner** | HR / Manager (attendance.profile.manage) |
| **Key Fields** | `user_id` (FK), `org_id`, `factory_id`, `employee_code`, `department`, `designation`, `employment_type` (permanent/contract/trainee), `reporting_manager_id`, `default_shift`, `joining_date`, `is_active` |
| **Relationships** | 1:1 User, N:1 Factory, Self-ref Reporting Manager |
| **Business Rules** | One profile per user per factory. Used for workforce cost rates, shift defaults, org chart. |

### 3.1.6 ShiftTemplate (`shift_templates`)
| Property | Detail |
|--------|--------|
| **Purpose** | Define shift timings, grace, overtime rules per factory. |
| **Owner** | Manager (attendance.shift_template.manage) |
| **Key Fields** | `shift_name`, `start_time`, `end_time`, `grace_minutes`, `overtime_after_minutes`, `cross_midnight`, `is_default`, `is_active` |
| **Business Rules** | Three default shifts (morning/evening/night) auto-created. Cross-midnight shifts handled in punch logic. Grace period applies to late calculation. |

---

## 3.2 Steel Production Master Data

### 3.2.1 SteelInventoryItem (`steel_inventory_items`)
| Property | Detail |
|--------|--------|
| **Purpose** | Master catalog of every material: raw (scrap, billet, sponge iron), WIP (bloom, billet), finished (TMT 8mm, Angle 50x50). |
| **Owner** | Inventory Manager (IP-2 to create) |
| **Lifecycle** | Created → Active → Inactive (soft delete) |
| **Key Fields** | `id`, `org_id`, `factory_id`, `item_code` (unique per factory), `name`, `category` (raw_material/wip/finished_goods), `base_unit` (kg), `display_unit` (kg/ton), `current_rate_per_kg`, `hsn_code`, `gst_rate`, `reorder_point_kg`, `safety_stock_kg`, `coil_weight_kg`, `lead_time_days`, `is_active`, `version` (optimistic lock), `created_by_user_id` |
| **Relationships** | 1:N InventoryTransactions, ProductionBatches (input/output), SalesInvoiceLines, DispatchLines, StockReconciliations |
| **Business Rules** | Category must be one of three. Rate used for valuation. Reorder point auto-calculated from consumption (cron). Coil weight for coil-based items. Version increments on update (optimistic locking). |

### 3.2.2 SteelProductionLine (`steel_production_lines`)
| Property | Detail |
|--------|--------|
| **Purpose** | Logical grouping of machines for a product family (e.g., "TMT Bar Line", "Structural Line"). |
| **Owner** | Production Manager |
| **Key Fields** | `id`, `org_id`, `factory_id`, `name`, `code`, `description`, `is_active` |
| **Relationships** | 1:N Machines, ProductionBatches (line_id) |

### 3.2.3 SteelMachine (`steel_machines`)
| Property | Detail |
|--------|--------|
| **Purpose** | Individual equipment asset. Tracks utilization, downtime, maintenance. |
| **Owner** | Maintenance Manager |
| **Key Fields** | `id`, `org_id`, `factory_id`, `line_id` (FK, nullable), `machine_code` (unique per factory), `name`, `machine_type`, `description`, `rated_capacity_per_hour`, `planned_runtime_minutes`, `operating_runtime_minutes`, `is_active` |
| **Relationships** | N:1 Line, 1:N DowntimeEvents, MaintenanceTasks, ProductionBatches (machine_id) |
| **Business Rules** | OEE = (Operating/Planned) × Performance × Quality. Downtime events reduce operating time. |

### 3.2.4 SteelBOM (`steel_boms`) — from steel_bom.py router
| Property | Detail |
|--------|--------|
| **Purpose** | Bill of Materials: input items + quantities → output item. Used for auto-fill batches and costing. |
| **Owner** | Production Planning / Manager |
| **Key Fields** | `output_item_id`, `input_item_ids[]` with `quantity_kg` each, `wastage_percent`, `is_active` |
| **Business Rules** | One active BOM per output item. Input quantities sum to ~100% + wastage. Used in `/steel/production/batches/auto-fill`. |

---

## 3.3 Production Transactional Objects

### 3.3.1 Entry / DPR (`entries`) — General Manufacturing
| Property | Detail |
|--------|--------|
| **Purpose** | Daily Production Report per operator per shift. Core shop floor data capture. |
| **Owner** | Operator (create), Supervisor (approve) |
| **Lifecycle** | `submitted` → `approved` \| `rejected` (IP-2). Soft delete via `is_active`. |
| **Key Fields** | `id`, `user_id`, `org_id`, `factory_id`, `date`, `shift` (morning/evening/night), `units_target`, `units_produced`, `manpower_present`, `manpower_absent`, `downtime_minutes`, `downtime_reason`, `department`, `materials_used`, `quality_issues` (bool), `quality_details`, `rejection_qty`, `defect_reason_id`, `defect_reason_details`, `rework_required`, `scrap_qty_entry`, `notes`, `ai_summary`, `status`, `is_active`, `client_request_id` (idempotency) |
| **Relationships** | N:1 User, Factory. 1:N DefectReason (lookup). |
| **Business Rules** | Unique per user+factory+date+shift (enforced by client_request_id). Date cannot be future. Units target > 0. Downtime ≥ 0. Rejection ≤ units_produced. Approval required (Supervisor+). AI summary auto-queued. |

### 3.3.2 SteelProductionBatch (`steel_production_batches`) — Steel-Specific
| Property | Detail |
|--------|--------|
| **Purpose** | Weight-based production record: Input material → Output material with loss, variance, heat traceability. |
| **Owner** | Operator (create), Manager (variance approve IP-2) |
| **Lifecycle** | `recorded` → `variance_approved` (if variance > threshold) → `closed` |
| **Key Fields** | `id`, `org_id`, `factory_id`, `batch_code` (unique, format `ST-{FACTORY}-{YEAR}-{SEQ}`), `production_date`, `input_item_id`, `output_item_id`, `operator_user_id`, `input_quantity_kg`, `expected_output_kg`, `actual_output_kg`, `loss_kg`, `loss_percent`, `variance_kg`, `variance_percent`, `variance_value_inr`, `severity` (normal/watch/high/critical), `status`, `rejection_qty_kg`, `scrap_qty_kg`, `line_id`, `machine_id`, `heat_number` (traceability), `notes`, `created_at`, `updated_at` |
| **Derived Fields** | `loss_kg = input - actual_output`, `loss_percent = loss/input`, `variance = actual - expected`, `variance_value = variance_kg × output_rate`. Severity: normal≤1%, watch≤3%, high≤5%, critical>5%. |
| **Relationships** | N:1 Input/Output Items, Operator, Line, Machine. 1:N DispatchLines (via batch_id on invoice line). |
| **Business Rules** | Batch code generated in transaction with FOR UPDATE lock. Heat number enables BIS traceability. Variance approval required if >5% (IP-2 conditional bypass ≤5%). Coil weight tracking for theft detection. |

### 3.3.3 SteelMachineDowntimeEvent (`steel_machine_downtime_events`)
| Property | Detail |
|--------|--------|
| **Purpose** | Unplanned/Planned machine stoppage recording. Feeds OEE. |
| **Owner** | Operator (log), Supervisor (categorize) |
| **Key Fields** | `machine_id`, `start_time`, `end_time`, `duration_minutes`, `reason`, `category` (breakdown/setup/changeover/idle), `shift`, `production_date` |
| **Business Rules** | Overlapping events on same machine prevented. Duration feeds `operating_runtime_minutes` calculation. |

### 3.3.4 SteelMaintenanceTask (`steel_maintenance_tasks`)
| Property | Detail |
|--------|--------|
| **Purpose** | Preventive/breakdown maintenance work orders. |
| **Owner** | Maintenance Team |
| **Key Fields** | `machine_id`, `task_type` (preventive/breakdown), `description`, `scheduled_date`, `completed_date`, `assigned_to_user_id`, `status` (open/in_progress/done), `cost_inr`, `spare_parts_used` |

---

## 3.4 Inventory & Stock

### 3.4.1 SteelInventoryTransaction (`steel_inventory_transactions`) — **The Source of Truth**
| Property | Detail |
|--------|--------|
| **Purpose** | Immutable ledger of every stock movement. **Stock balance = Σ(quantity_kg) per item.** No separate stock column. |
| **Owner** | System (auto-posted) / Store Keeper (manual adjustment IP-2) |
| **Lifecycle** | Append-only. Never updated. Corrections via new `adjustment` transaction. |
| **Key Fields** | `id`, `org_id`, `factory_id`, `item_id`, `transaction_type` (inward/adjustment/dispatch_out/production_issue/production_output), `quantity_kg` (signed: +inward, -outward), `reference_type` (steel_dispatch/steel_reconciliation/steel_batch/manual_entry), `reference_id`, `notes`, `created_by_user_id`, `created_at` |
| **Transaction Types & Sign Convention** |
| | `inward` | + | Purchase receipt, supplier return |
| | `production_output` | + | Batch completion |
| | `dispatch_out` | - | Customer dispatch |
| | `production_issue` | - | Material issued to production |
| | `adjustment` | ± | Reconciliation correction, write-off |
| **Relationships** | N:1 Item, Factory. Reference polymorphic. |
| **Business Rules** | **Pessimistic lock** on item during transaction creation (prevents negative stock race). Projected balance checked before commit. Reference_type + reference_id provides audit trail to source document. |

### 3.4.2 SteelStockReconciliation (`steel_stock_reconciliations`)
| Property | Detail |
|--------|--------|
| **Purpose** | Physical count vs system balance. Maker-checker approval (IP-2). Approved → creates adjustment transaction. |
| **Owner** | Store Keeper (count), Manager (approve) |
| **Lifecycle** | `pending` → `approved` \| `rejected` (IP-2, self-approval blocked) |
| **Key Fields** | `item_id`, `physical_qty_kg`, `system_qty_kg` (snapshot at count), `variance_kg`, `variance_percent`, `confidence_status` (green/yellow/red), `status`, `notes`, `mismatch_cause` (counting_error/process_loss/theft_or_leakage/wrong_entry/delayed_dispatch_update/other), `counted_by_user_id`, `submitted_by_user_id`, `approved_by_user_id`, `rejected_by_user_id`, `approver_notes`, `rejection_reason`, `counted_at`, `approved_at`, `rejected_at` |
| **Confidence Logic** | Green: variance ≤1% & count ≤7 days ago. Yellow: variance ≤3% & ≤14 days. Red: otherwise or negative balance. |
| **Business Rules** | Variance > tolerance requires mismatch_cause. Approver ≠ Counter. Auto-escalation after 48h TTL. |

---

## 3.5 Sales & Dispatch

### 3.5.1 SteelCustomer (`steel_customers`)
| Property | Detail |
|--------|--------|
| **Purpose** | Customer master with credit control, verification, and lifecycle tracking. |
| **Owner** | Sales/Finance (IP-2 for create/edit) |
| **Lifecycle** | `draft` → `active` → `on_hold` \| `blocked` (status). Verification: `draft` → `format_valid` → `pending_review` → `verified` \| `mismatch` \| `rejected`. |
| **Key Fields** | `id`, `org_id`, `factory_id`, `customer_code` (auto CUST-{ID}), `name`, `phone`, `email`, `address`, `city`, `state`, `tax_id`, `gst_number`, `pan_number`, `company_type`, `contact_person`, `designation`, `credit_limit`, `payment_terms_days`, `status`, `verification_status`, `pan_status`, `gst_status`, `verification_source`, `official_legal_name`, `official_trade_name`, `official_state`, `name_match_status`, `state_match_status`, `match_score`, `mismatch_reason`, `pan_document_path`, `gst_document_path`, `verified_at`, `verified_by_user_id`, `is_active` |
| **Verification Logic** | PAN format check (20pts), GST format check (20pts), PAN↔GST match (20pts), PAN doc (10pts), GST doc (10pts), name match (10pts), state match (10pts). Score ≥70 → verified. |
| **Risk Scoring** | `risk_score = overdue_days×2 + credit_used% + late_payments×5`. Level: low<30, medium<70, high≥70. |
| **Relationships** | 1:N SalesInvoices, CustomerPayments, FollowUpTasks, Dispatches (via invoice) |

### 3.5.2 SteelSalesInvoice (`steel_sales_invoices`)
| Property | Detail |
|--------|--------|
| **Purpose** | Weight-based sales invoice. Header + lines (item, batch, weight, rate). GST auto-calculated. |
| **Owner** | Sales/Finance |
| **Lifecycle** | `unpaid` → `partial` → `paid` (auto-updated on payment allocation). `voided` (IP-4). |
| **Key Fields** | `id`, `org_id`, `factory_id`, `customer_id`, `invoice_number` (unique, `SINV-{FACTORY}-{YEAR}-{SEQ}`), `invoice_date`, `due_date`, `customer_name`, `status`, `currency`, `payment_terms_days`, `total_weight_kg`, `subtotal_amount`, `taxable_amount`, `gst_total`, `total_amount`, `notes`, `created_by_user_id` |
| **Lines** (`steel_sales_invoice_lines`): `invoice_id`, `item_id`, `batch_id` (nullable), `description`, `weight_kg`, `rate_per_kg`, `line_total` |
| **Business Rules** | Rate > 0 for finished goods. Line total ≤ 10M. Invoice total ≤ 99,999,999,999.99. Post-dispatch edit requires IP-3 (two-stage). Void requires IP-4 (cross-domain). |

### 3.5.3 SteelDispatch (`steel_dispatches`)
| Property | Detail |
|--------|--------|
| **Purpose** | Physical shipment: gate pass, vehicle, driver, weighbridge, inventory relief. |
| **Owner** | Dispatch In-Charge (create IP-2), Supervisor (exit/delivery) |
| **Lifecycle** | State Machine: `pending` → `loaded` → `exited` → `dispatched` → `delivered` (terminal) \| `cancelled` (terminal) |
| **Key Fields** | `id`, `org_id`, `factory_id`, `invoice_id`, `dispatch_number`, `gate_pass_number` (unique), `gate_pass_qr_url`, `gate_pass_verified_at`, `dispatch_date`, `truck_number`, `transporter_name`, `vehicle_type`, `truck_capacity_kg`, `driver_name`, `driver_phone`, `driver_license_number`, `entry_time`, `exit_time`, `status`, `total_weight_kg`, `notes`, `receiver_name`, `pod_notes`, `inventory_posted_at`, `delivered_at`, `delivered_by_user_id`, `client_request_id` |
| **Lines** (`steel_dispatch_lines`): `dispatch_id`, `invoice_line_id`, `item_id`, `batch_id`, `weight_kg` |
| **State Transitions & Guards** |
| | `pending` → `loaded` | Gate pass photo required | Any authorized |
| | `loaded` → `exited` | Weighbridge slip photo | Supervisor |
| | `exited` → `dispatched` | — | Any authorized |
| | `dispatched` → `delivered` | POD photo + receiver name | Supervisor |
| | Any → `cancelled` | — | Any authorized |
| **Business Rules** | Auto-bypass approval if total_weight ≤ 5000kg (IP-2 conditional). QR code on gate pass for verification. Inventory posted on first status reaching `exited`/`dispatched`/`delivered` (idempotent with FOR UPDATE lock). |

### 3.5.4 SteelCustomerPayment (`steel_customer_payments`) + Allocation
| Property | Detail |
|--------|--------|
| **Purpose** | Customer payment receipt with multi-invoice allocation. |
| **Owner** | Finance (IP-2 bypass <₹50k, not backdated) |
| **Key Fields** | `customer_id`, `invoice_id` (nullable), `payment_date`, `amount`, `payment_mode` (bank_transfer/cash/cheque/upi), `reference_number`, `notes` |
| **Allocations** (`steel_customer_payment_allocations`): `payment_id`, `invoice_id`, `allocated_amount` |
| **Business Rules** | Allocation sum ≤ payment amount. Auto-updates invoice status (unpaid/partial/paid). Reallocate = IP-3. Reverse = IP-4. |

### 3.5.5 SteelCustomerFollowUpTask (`steel_customer_follow_up_tasks`)
| Property | Detail |
|--------|--------|
| **Purpose** | CRM-lite: collection follow-ups, visit reminders. |
| **Owner** | Sales |
| **Key Fields** | `customer_id`, `invoice_id` (optional), `title`, `note`, `priority` (low/medium/high/critical), `status` (open/in_progress/done/cancelled), `due_date`, `assigned_to_user_id` |

---

## 3.6 Purchase & Accounts Payable

### 3.6.1 SteelVendor (`steel_vendors`)
| Property | Detail |
|--------|--------|
| **Purpose** | Vendor master for AP. |
| **Owner** | Purchase |
| **Key Fields** | `id`, `org_id`, `factory_id`, `vendor_code`, `name`, `phone`, `email`, `address`, `city`, `state`, `gst_number`, `pan_number`, `contact_person`, `payment_terms_days`, `credit_limit`, `status`, `notes` |

### 3.6.2 SteelVendorBill (`steel_vendor_bills`) — Purchase Invoice
| Property | Detail |
|--------|--------|
| **Purpose** | Incoming vendor invoice (GRN-matched or service). |
| **Owner** | Purchase/Finance |
| **Key Fields** | `vendor_id`, `bill_number`, `bill_date`, `due_date`, `status` (unpaid/partial/paid), `expense_category` (raw_material/default), `subtotal_amount`, `tax_amount`, `total_amount` |
| **Lines** (`steel_vendor_bill_lines`): `bill_id`, `item_id`, `description`, `quantity_kg`, `rate_per_kg`, `amount` |

### 3.6.3 SteelVendorPayment / Allocation
| Property | Detail |
|--------|--------|
| **Purpose** | Vendor payment with bill-level allocation. Mirrors customer payment structure. |
| **Owner** | Finance |

### 3.6.4 SteelExpense (`steel_expenses`)
| Property | Detail |
|--------|--------|
| **Purpose** | Operating expenses (non-trade). |
| **Owner** | Finance |
| **Key Fields** | `expense_category`, `amount`, `expense_date`, `vendor_id` (nullable), `payment_mode`, `reference_number`, `status` (draft/submitted/approved/paid) |

---

## 3.7 Finance & Cash

### 3.7.1 SteelCashAccount (`steel_cash_accounts`)
| Property | Detail |
|--------|--------|
| **Purpose** | Cash/bank account master per factory. |
| **Owner** | Finance |
| **Key Fields** | `account_name`, `account_type` (cash/bank/upi), `bank_name`, `account_number`, `ifsc`, `upi_id`, `opening_balance`, `is_active` |

### 3.7.2 SteelCashLedgerEntry (`steel_cash_ledger_entries`)
| Property | Detail |
|--------|--------|
| **Purpose** | Cash book: every inflow/outflow. |
| **Owner** | Finance |
| **Key Fields** | `account_id`, `entry_date`, `entry_type` (receipt/payment/transfer), `amount`, `reference_type`, `reference_id`, `party_name`, `narration`, `balance_after` |

---

## 3.8 Attendance & Workforce

### 3.8.1 AttendanceRecord (`attendance_records`)
| Property | Detail |
|--------|--------|
| **Purpose** | Daily punch in/out with shift compliance, overtime, late calculation. |
| **Owner** | Employee (self-punch), Supervisor (review/force-close) |
| **Lifecycle** | Auto: `working` → `completed` (on punch-out). Manual: `missed_punch`, `half_day`, `absent`. Review: `auto` → `reviewed` → `approved`/`rejected`. Regularization requests create `AttendanceRegularization`. |
| **Key Fields** | `user_id`, `org_id`, `factory_id`, `attendance_date`, `shift`, `shift_template_id`, `shift_start_utc`, `shift_end_utc`, `cross_midnight`, `status`, `review_status`, `source` (self_service/kiosk/manual/biometric), `punch_in_at`, `punch_out_at`, `worked_minutes`, `late_minutes`, `overtime_minutes`, `approved_by_user_id`, `approved_at` |
| **Business Rules** | Unique per user+factory+date+shift. Late = punch_in > shift_start + grace. OT = worked > overtime_after_minutes. Cross-midnight night shift handled via previous day search. Auto-close cron marks missing punch-out as `missed_punch` after shift_end + 2hr grace. |

### 3.8.2 AttendanceRegularization (`attendance_regularizations`)
| Property | Detail |
|--------|--------|
| **Purpose** | Employee request to correct attendance (missed punch, timing, status, shift). |
| **Owner** | Employee (request), Supervisor (approve IP-2) |
| **Key Fields** | `attendance_record_id`, `request_type` (missed_punch/timing_correction/status_correction/shift_correction), `requested_in_at`, `requested_out_at`, `reason`, `status` (pending/approved/rejected), `reviewer_note`, `reviewed_by_user_id`, `reviewed_at` |

### 3.8.3 WorkforceCostRate (`workforce_cost_rates`)
| Property | Detail |
|--------|--------|
| **Purpose** | Labour cost rates for costing: per user/role/department, with overtime multiplier. |
| **Owner** | Finance/HR (workforce.cost.manage) |
| **Key Fields** | `factory_id`, `user_id` (nullable), `role` (nullable), `department` (nullable), `effective_from`, `effective_to`, `regular_hourly_rate_inr`, `overtime_multiplier` (default 1.5), `is_active` |

---

## 3.9 Quality & Defects

### 3.9.1 DefectReason (`defect_reason`)
| Property | Detail |
|--------|--------|
| **Purpose** | Standardized rejection reason catalog. |
| **Owner** | Quality / Admin (factory.master_data.manage) |
| **Key Fields** | `id`, `factory_id`, `code`, `name`, `description`, `category` (surface/dimensional/chemical/mechanical), `is_active` |

---

## 3.10 OCR & Documents

### 3.10.1 OCRVerification (`ocr_verification`) — from models
| Property | Detail |
|--------|--------|
| **Purpose** | Document processing result: extracted fields, confidence, human verification. |
| **Owner** | OCR Operator (submit), Supervisor (approve IP-2) |
| **Key Fields** | `document_type` (invoice/challan/test_cert/weighbridge), `source_image_url`, `extracted_data` (JSON), `confidence_score`, `status` (pending/approved/rejected), `verified_by_user_id`, `verified_at` |

---

## 3.11 System & Governance

### 3.11.1 ApprovalInstance (`approval_instances`)
| Property | Detail |
|--------|--------|
| **Purpose** | Persistent maker-checker workflow state. Replaces in-memory dict. |
| **Owner** | Approval Service |
| **Key Fields** | `instance_id` (UUID), `workflow_key`, `action_key`, `resource_type`, `resource_id`, `org_id`, `factory_id`, `actor_user_id`, `subject_user_id`, `status` (pending_l1/pending_l2/approved/rejected/escalated/abandoned/no_approval_required/completed), `approval_stage` (L1/L2), `requested_change` (JSON), `attributes` (JSON for thresholds), `l1_approved_by_user_id`, `approved_by_user_id`, `rejected_by_user_id`, `rejection_reason`, `expires_at`, `completed_at`, `created_at` |
| **Patterns** | IP-2 (single), IP-3 (sequential L1→L2, different people), IP-4 (cross-domain: Admin/Owner), IP-5 (Owner only) |

### 3.11.2 AuditLog (`audit_logs`)
| Property | Detail |
|--------|--------|
| **Purpose** | Immutable audit trail for all sensitive actions. |
| **Owner** | System (auto) |
| **Key Fields** | `user_id`, `org_id`, `factory_id`, `action`, `details`, `ip_address`, `user_agent`, `timestamp` |

### 3.11.3 Notification (`notifications`)
| Property | Detail |
|--------|--------|
| **Purpose** | In-app notification center. |
| **Key Fields** | `user_id`, `org_id`, `factory_id`, `title`, `message`, `type`, `reference_type`, `reference_id`, `is_read`, `read_at`, `created_at` |

### 3.11.4 Alert / OpsAlertEvent (`ops_alert_events`, `admin_alert_recipients`)
| Property | Detail |
|--------|--------|
| **Purpose** | Operational anomaly alerts (production, inventory, attendance, fraud). |
| **Key Fields** | `alert_type`, `severity`, `factory_id`, `payload` (JSON), `acknowledged`, `acknowledged_by`, `acknowledged_at` |

---

## 3.12 Entity Relationship Summary (Textual ER)

```
Organization (1) ──────< Factory (N)
Factory (1) ──────< ProductionLine (N)
ProductionLine (1) ──────< Machine (N)
Factory (1) ──────< InventoryItem (N)
InventoryItem (1) ──────< InventoryTransaction (N)
Factory (1) ──────< ProductionBatch (N)
ProductionBatch N:1 InputItem, OutputItem
ProductionBatch (1) ──────< DispatchLine (via InvoiceLine.batch_id)
Factory (1) ──────< Customer (N)
Customer (1) ──────< SalesInvoice (N)
SalesInvoice (1) ──────< SalesInvoiceLine (N)
SalesInvoiceLine (1) ──────< DispatchLine (N)
Dispatch (1) ──────< DispatchLine (N)
Customer (1) ──────< CustomerPayment (N)
CustomerPayment (1) ──────< PaymentAllocation (N)
Factory (1) ──────< Vendor (N)
Vendor (1) ──────< VendorBill (N)
VendorBill (1) ──────< VendorBillLine (N)
Factory (1) ──────< User (via UserFactoryRole N:M)
User (1) ──────< Entry (N)
User (1) ──────< AttendanceRecord (N)
User (1) ──────< ProductionBatch (operator)
Machine (1) ──────< DowntimeEvent (N)
Machine (1) ──────< MaintenanceTask (N)
InventoryItem (1) ──────< StockReconciliation (N)
ApprovalInstance N:1 User (actor), User (subject)
```

---

# PART 4: COMPLETE MATERIAL JOURNEY

**Track ONE coil of TMT Bar (Grade Fe500D, 16mm) from gate entry to customer delivery.**

> **Assumption:** Factory uses 3-shift operation. Material: Billets (raw) → Rolling → TMT Bar (finished). Heat number traceability maintained.

---

## Step-by-Step Journey

### 4.1 MATERIAL ARRIVAL AT FACTORY GATE

| Sub-Step | Actor | Action | Input | Output | Records Created | Records Updated | Business Rules | Approvals | Notifications | Documents | Errors/Exceptions | Next Step |
|----------|-------|--------|-------|--------|-----------------|-----------------|----------------|-----------|---------------|-----------|-------------------|-----------|
| **4.1.1 Vehicle Entry** | Security Guard | Verify gate pass, driver ID, vehicle number | Gate pass (paper/QR), driver license, vehicle reg | Entry allowed/denied | Gate entry log (paper) | — | Gate pass must match expected dispatch/inward schedule | — | — | Gate pass, driver ID | Mismatch → deny entry, alert purchase | 4.1.2 |
| **4.1.2 Weighbridge Entry** | Weighbridge Operator | Record gross weight (vehicle + material) | Vehicle on weighbridge | Gross weight (kg) | Weighbridge slip (paper/photo) | — | Gross ≤ truck capacity + 10% tolerance | — | Purchase officer alerted | Weighbridge slip | Overweight → hold for investigation | 4.1.3 |
| **4.1.3 Vehicle Unloading** | Store Keeper / Labor | Unload material to designated yard bay | Gross weight | Material in yard | Yard receipt note (manual) | — | Bay assignment per material grade | — | — | Unloading challan | Shortage vs slip → note discrepancy | 4.1.4 |
| **4.1.4 QC Incoming Inspection** | QC Inspector | Visual + dimensional + test cert verification | Material, vendor test certificate | Accept / Reject / Conditional Accept | Inspection report, NCR if reject | — | Heat number on test cert must match material marking. ISI/BIS cert required for structural grades. | — | Purchase, Store Keeper | Test certificate, Inspection report | Reject → quarantine, vendor notification, debit note | 4.1.5 |
| **4.1.5 GRN & Inventory Receipt** | Store Keeper | Create GRN, post inventory inward | Accepted quantity (weighed per bundle/coil) | Stock increase | `SteelInventoryTransaction` (type=inward, +qty), GRN document | `SteelInventoryItem` balance (derived) | Quantity ≤ PO qty + 2% tolerance. Rate from PO or last purchase rate. | — | Purchase, Finance | GRN, Weighbridge slip copy | Qty mismatch >2% → approval required (IP-2) | **4.2** |

---

### 4.2 PLANNING & MATERIAL ISSUE TO PRODUCTION

| Sub-Step | Actor | Action | Input | Output | Records Created | Records Updated | Business Rules | Approvals | Notifications | Documents | Errors/Exceptions | Next Step |
|----------|-------|--------|-------|--------|-----------------|-----------------|----------------|-----------|---------------|-----------|-------------------|-----------|
| **4.2.1 Sales Order Review** | Planning Officer | Review confirmed sales orders, allocate to production lines | Sales invoices (confirmed), stock on hand | Production schedule | Schedule (mental/spreadsheet) | — | Priority: urgent > standard. Grade compatibility per line. | — | Line supervisors | Production plan | Capacity full → overtime/outsource decision | 4.2.2 |
| **4.2.2 BOM Explosion** | Planning Officer | Explode BOM for target output grade/quantity | BOM (input items + ratios), target output kg | Material requirement list | — | — | Wastage % added. Coil weight considered for coil items. | — | Store Keeper | Material Issue Note (MIN) | Item not in stock → trigger reorder | 4.2.3 |
| **4.2.3 Material Issue to Line** | Store Keeper | Issue raw material (billets) to production line | MIN, physical material | Material at line | `SteelInventoryTransaction` (type=production_issue, -qty) | Item balance (derived) | FIFO by heat number if traceability required. Issue ≤ available stock (pessimistic lock). | — | Operator, Planning | MIN, Gate pass (internal) | Insufficient stock → partial issue, escalate | **4.3** |

---

### 4.3 SHOP FLOOR PRODUCTION (PER SHIFT)

| Sub-Step | Actor | Action | Input | Output | Records Created | Records Updated | Business Rules | Approvals | Notifications | Documents | Errors/Exceptions | Next Step |
|----------|-------|--------|-------|--------|-----------------|-----------------|----------------|-----------|---------------|-----------|-------------------|-----------|
| **4.3.1 Shift Start / Punch In** | Operator | Punch in via mobile/kiosk | Shift template | Attendance record | `AttendanceRecord` (punch_in_at) | — | Must be within grace minutes of shift start | — | Supervisor (live view) | — | Late → late_minutes recorded | 4.3.2 |
| **4.3.2 DPR Entry (Per Shift)** | Operator | Fill Entry form: target, produced, manpower, downtime, quality | Shift production data | DPR record | `Entry` (status=submitted) | — | Unique per user+date+shift. Date not future. | — | Supervisor (approval queue) | — | Duplicate → 409 error | 4.3.3 |
| **4.3.3 Batch Recording** | Operator | Record batch: input item, output item, input kg, expected/actual output, heat# | Weighbridge readings, coil counts | Batch record | `SteelProductionBatch` (status=recorded) | Input/Output item balances (via transactions auto-posted later) | Batch code auto-generated (FOR UPDATE lock). Heat# mandatory for traceability. Loss% auto-calc. Severity auto-set. | Variance approval if >5% (IP-2) | Planning, QC | Batch sheet | Variance >5% → holds batch for approval | 4.3.4 |
| **4.3.4 Machine Logging** | Operator | Log downtime events on machine | Breakdown/changeover/idle | Downtime record | `SteelMachineDowntimeEvent` | Machine operating_runtime_minutes | Overlapping events blocked. Category required. | — | Maintenance (alerts) | — | — | 4.3.5 |
| **4.3.5 QC Sampling** | QC Inspector | Sample test: dimensions, weight/meter, tensile, bend, chemical | Finished coils/bars | Test results | Inspection log (paper/planned digital) | Batch rejection_qty/scrap_qty if fail | Sampling plan per heat/lot. Fail → rejection/scrap entry. | — | Operator, Planning | Test certificate (internal) | Critical fail → line stop, NCR | 4.3.6 |
| **4.3.6 Shift End / Punch Out** | Operator | Punch out, handover notes | End of shift | Attendance completed | `AttendanceRecord` (punch_out_at, worked_minutes, OT) | — | OT calculated. Cross-midnight night shift handled. | — | Supervisor | Handover notes | Missed punch → regularization request | **Next Shift / 4.4** |

---

### 4.4 FINISHED GOODS HANDLING & YARD STORAGE

| Sub-Step | Actor | Action | Input | Output | Records Created | Records Updated | Business Rules | Approvals | Notifications | Documents | Errors/Exceptions | Next Step |
|----------|-------|--------|-------|--------|-----------------|-----------------|----------------|-----------|---------------|-----------|-------------------|-----------|
| **4.4.1 Batch Completion** | Operator/Supervisor | Confirm batch done, update status | Batch record | Batch closed | `SteelProductionBatch` (status=variance_approved/closed) | — | Variance approved if needed | IP-2 if variance >5% | Planning, Dispatch | — | Unapproved variance → cannot dispatch | 4.4.2 |
| **4.4.2 Inventory Post (Production Output)** | System (callback) | Auto-post inventory transaction on batch approval | Batch actual_output_kg | Stock increase | `SteelInventoryTransaction` (type=production_output, +qty, ref=steel_batch) | Output item balance | Triggered by approval callback. Pessimistic lock on item. | — | Store Keeper, Finance | — | Negative balance race prevented by lock | 4.4.3 |
| **4.4.3 Yard Storage** | Store Keeper / Yard Crew | Stack coils/bars in designated bay, record location | Physical material | Material in yard | Yard location log (paper/planned digital) | — | Bay per grade/size. Coil stacking limits. | — | Dispatch | Yard receipt | Misplacement → reconciliation variance | 4.4.4 |
| **4.4.4 Cycle Count / Reconciliation** | Store Keeper (periodic) | Physical count vs system | Count sheets | Reconciliation record | `SteelStockReconciliation` (status=pending) | — | Variance >0.1% requires cause. Auto-approve if ≤5% (IP-2 conditional). | IP-2 (approver ≠ counter) | Manager, Finance | Count sheet, Variance report | Negative balance → red confidence, immediate investigation | **4.5** |

---

### 4.5 SALES ORDER TO DISPATCH

| Sub-Step | Actor | Action | Input | Output | Records Created | Records Updated | Business Rules | Approvals | Notifications | Documents | Errors/Exceptions | Next Step |
|----------|-------|--------|-------|--------|-----------------|-----------------|----------------|-----------|---------------|-----------|-------------------|-----------|
| **4.5.1 Customer Order / Inquiry** | Sales | Receive PO, create inquiry | Customer PO | Inquiry/Quotation | — | — | Check credit limit, stock availability | — | Customer | Quotation | Credit blocked → hold | 4.5.2 |
| **4.5.2 Sales Invoice Creation** | Sales/Finance | Create invoice from confirmed order | Order, stock allocation | Invoice | `SteelSalesInvoice` + lines (item, batch, weight, rate) | Customer credit exposure | Rate > 0. Batch allocation optional but recommended for traceability. GST auto-calc. | — | Customer, Dispatch | Invoice (PDF) | Stock short → partial invoice, backorder | 4.5.3 |
| **4.5.3 Dispatch Planning** | Dispatch In-Charge | Schedule vehicle, assign transporter | Invoice (ready), vehicle availability | Dispatch plan | — | — | Weight ≤ truck capacity. Heat# matching if customer requires. | — | Transporter, Security | Dispatch schedule | No vehicle → delay, inform customer | 4.5.4 |
| **4.5.4 Dispatch Creation** | Dispatch In-Charge | Create dispatch record, generate gate pass QR | Invoice, vehicle, driver details | Dispatch record | `SteelDispatch` (status=pending), `SteelDispatchLines` | — | Gate pass number unique. QR code generated. Auto-bypass approval if ≤5000kg. | IP-2 conditional | Security, Transporter, Customer | Gate pass (PDF+QR), Dispatch note | Weight > capacity → warning, not block | 4.5.5 |
| **4.5.5 Vehicle Entry & Loading** | Security, Loader | Verify gate pass QR, load material, weigh loaded vehicle | Gate pass, material | Loaded vehicle | Weighbridge slip (loaded weight) | Dispatch status → `loaded` | Gate pass photo required for `pending`→`loaded`. | — | Dispatch, Customer | Gate pass, Weighbridge slip | Weight mismatch >2% → hold | 4.5.6 |
| **4.5.6 Gate Exit** | Security, Weighbridge | Verify exit, record exit weight, time | Loaded vehicle | Exit confirmed | Dispatch status → `exited`, `exit_time`, `gate_pass_verified_at` | — | Weighbridge slip photo required. Supervisor approves exit. | Supervisor (IP-2) | Dispatch, Customer | Weighbridge slip (exit) | Exit weight ≠ entry weight ± tolerance → investigate | 4.5.7 |
| **4.5.7 In Transit / Delivered** | Driver, Customer | Transport, unload, sign POD | — | Delivery confirmed | Dispatch status → `delivered`, `delivered_at`, `receiver_name`, `pod_notes`, `pod_photo_url` | — | POD photo + receiver name mandatory for `exited`→`delivered` or `dispatched`→`delivered`. | Supervisor (IP-2) | Customer, Finance, Sales | POD (signed), Delivery challan | POD not received → escalate after 48h | 4.5.8 |
| **4.5.8 Inventory Relief** | System (callback) | Post dispatch_out transactions on first exit/delivered status | Dispatch lines | Stock decrease | `SteelInventoryTransaction` (type=dispatch_out, -qty per line, ref=steel_dispatch) | Item balances (derived) | Idempotent: FOR UPDATE on dispatch, check `inventory_posted_at` null. | — | Finance, Store Keeper | — | Double-post prevented by lock | **4.6** |

---

### 4.6 FINANCIAL CLOSE

| Sub-Step | Actor | Action | Input | Output | Records Created | Records Updated | Business Rules | Approvals | Notifications | Documents | Errors/Exceptions | Next Step |
|----------|-------|--------|-------|--------|-----------------|-----------------|----------------|-----------|---------------|-----------|-------------------|-----------|
| **4.6.1 Payment Collection** | Finance/Sales | Record customer payment, allocate to invoices | Payment advice, bank credit | Payment recorded | `SteelCustomerPayment` + `Allocations` | Invoice status (unpaid/partial/paid), Customer outstanding | Allocation sum ≤ payment. Auto-bypass approval if <₹50k & not backdated. | IP-2 conditional | Customer, Sales | Receipt, Allocation statement | Over-allocation → error. Wrong invoice → reallocate (IP-3). | 4.6.2 |
| **4.6.2 Vendor Payment** | Finance | Pay vendor bills per terms | Vendor bills due, cash flow | Vendor payment | `SteelVendorPayment` + allocations | Vendor bill status, Cash ledger | — | IP-2 | Vendor | Payment advice | — | 4.6.3 |
| **4.6.3 GST Return Filing** | Finance | Generate GSTR-1/3B from invoice/bill data | All B2B/B2C invoices, vendor bills | GST return | — | — | HSN, GSTIN validation on master data. | — | Govt portal | GSTR JSON | Mismatch → amendment return | 4.6.4 |
| **4.6.4 Costing & P&L** | Finance | Calculate product cost, margin | Batch variance_value, realization metrics | Cost sheets | — | — | Uses `build_steel_realization_metrics` (dispatch revenue - batch cost). | — | Owner, Management | Monthly P&L | — | **CYCLE COMPLETE** |

---

## 4.7 Summary of Material Journey Artifacts

| Stage | Primary Document | Digital Record | Owner System |
|-------|------------------|----------------|--------------|
| Gate Entry | Gate Pass, Weighbridge Slip | — (paper) | Security |
| GRN | GRN Note | `SteelInventoryTransaction` (inward) | Stores |
| Production Issue | Material Issue Note | `SteelInventoryTransaction` (production_issue) | Stores |
| Shift Production | DPR Form | `Entry` | Shop Floor |
| Batch | Batch Sheet | `SteelProductionBatch` | Shop Floor |
| QC | Test Certificate | — (planned: OCR) | Quality |
| Yard | Yard Receipt | — (planned) | Stores |
| Reconciliation | Count Sheet | `SteelStockReconciliation` | Stores |
| Invoice | Tax Invoice | `SteelSalesInvoice` | Sales/Finance |
| Dispatch | Gate Pass + QR, Dispatch Note | `SteelDispatch` | Dispatch |
| Exit | Weighbridge Slip | `SteelDispatch` (exit_time) | Security |
| Delivery | POD | `SteelDispatch` (delivered_at, pod_photo) | Dispatch |
| Payment | Receipt | `SteelCustomerPayment` | Finance |
| GST | GSTR-1/3B | — | Finance |

---

# PART 5: DEPARTMENT WORKFLOWS

Each workflow: **Trigger → Process → Decision Points → Output → Failure Cases → Recovery**

---

## 5.1 PRODUCTION (Shop Floor + Planning)

### 5.1.1 DPR Entry Workflow (General Manufacturing)
| Phase | Detail |
|-------|--------|
| **Trigger** | Operator opens `/entries` form at shift start/end |
| **Process** | 1. Select date (default today), shift (morning/evening/night)<br>2. Enter: units_target, units_produced, manpower_present/absent, downtime_min, downtime_reason, department, materials_used, quality_issues (toggle), quality_details, rejection_qty, defect_reason_id, defect_details, rework_required, scrap_qty_entry, notes<br>3. Submit → creates `Entry` with `status=submitted`, `client_request_id` for idempotency |
| **Decision Points** | - Date future? → Reject<br>- Duplicate user+date+shift? → 409 Conflict<br>- Units target ≤ 0? → Reject<br>- Rejection > produced? → Reject |
| **Output** | Entry record, AI summary job queued, audit log `ENTRY_CREATED` |
| **Failure Cases** | DB error → payload saved to `failed_payloads` for retry<br>AI timeout → entry saved, summary marked degraded |
| **Recovery** | Retry endpoint, manual re-entry, admin can approve rejected entries |

### 5.1.2 DPR Approval Workflow (Maker-Checker)
| Phase | Detail |
|-------|--------|
| **Trigger** | Supervisor opens `/approvals/queue/me` → sees pending entries |
| **Process** | 1. Review entry data, AI summary<br>2. Click Approve/Reject with reason<br>3. Calls `/entries/{id}/approve` or `/reject` → `initiate_approval` with workflow `production.entry.approve` (IP-2)<br>4. If bypass (no threshold), auto-complete. Else creates `ApprovalInstance` status `pending_l1`<br>5. Different approver (not creator) calls `/approvals/{instance_id}/advance` with `approve` → status `approved`, callback `_on_entry_completed` sets `Entry.status=approved` |
| **Decision Points** | - Self-approval? → Denied<br>- Variance high? → Escalate to Manager<br>- Reject reason mandatory |
| **Output** | Entry status `approved`/`rejected`, audit log, notification to operator |
| **Failure Cases** | Approver unavailable → TTL 72h → auto-escalate (configured)<br>Callback error → transaction rollback, instance stays pending |
| **Recovery** | Admin can force-complete via `/approvals/{id}/advance` with MFA |

### 5.1.3 Steel Batch Recording Workflow
| Phase | Detail |
|-------|--------|
| **Trigger** | Operator completes a heat/cast/roll cycle |
| **Process** | 1. POST `/steel/batches` with: batch_code (optional, else auto), production_date, input_item_id, output_item_id, input_qty_kg, expected_output_kg, actual_output_kg, scrap_qty_kg, rejection_qty_kg, line_id, machine_id, heat_number, notes<br>2. Service calculates: loss_kg, loss_percent, variance_kg, variance_percent, variance_value_inr (using item rates), severity<br>3. Batch code generated with `FOR UPDATE` lock (prevents duplicates)<br>4. Status = `recorded` |
| **Decision Points** | - Variance > 5%? → Requires variance approval (IP-2)<br>- Heat number duplicate? → Warning (traceability risk)<br>- Coil weight variance > threshold? → Theft alert (coil_theft_service) |
| **Output** | Batch record, anomaly score computed, added to owner dashboard |
| **Failure Cases** | Concurrent batch code generation → DB unique constraint retry<br>Negative projected stock → 400 error |
| **Recovery** | Re-enter with correct data, void incorrect batch (supervisor) |

### 5.1.4 Batch Variance Approval
| Phase | Detail |
|-------|--------|
| **Trigger** | Batch recorded with severity `high` or `critical` (variance > 5%) |
| **Process** | 1. Manager views `/steel/batches` filtered by severity<br>2. Calls `/steel/batches/{id}/variance` with `approve`/`reject` + reason<br>3. `initiate_approval` workflow `production.batch.variance.approve` (IP-2, conditional bypass if variance ≤5%)<br>4. On approval: callback `_on_generic_completed` (logs only), batch status updated |
| **Decision Points** | - Root cause identified? (process loss vs theft vs measurement)<br>- Cost impact acceptable? |
| **Output** | Batch variance approved/rejected, audit trail |
| **Failure Cases** | No approver → auto-escalate after 72h |
| **Recovery** | Re-open batch, adjust actual_output, re-submit |

### 5.1.5 Production Planning (Manual + Auto-Fill)
| Phase | Detail |
|-------|--------|
| **Trigger** | Planning officer reviews sales orders + stock |
| **Process** | 1. `/steel/production/batches/auto-fill` — uses active BOMs to pre-fill batch input/output for target grades<br>2. Manual line assignment via `/steel/production/lines`<br>3. Machine assignment per batch |
| **Decision Points** | - Line capacity vs demand<br>- Changeover minimization (grade sequencing)<br>- Machine availability (downtime calendar) |
| **Output** | Batch queue for operators |
| **Gap** | No finite scheduler, no what-if simulation |

---

## 5.2 INVENTORY (Stores)

### 5.2.1 Inventory Item Master Management
| Phase | Detail |
|-------|--------|
| **Trigger** | New grade/size introduced, or vendor change |
| **Process** | POST `/steel/inventory/items` with item_code, name, category (raw_material/wip/finished_goods), display_unit, current_rate_per_kg, hsn_code, gst_rate, reorder_point_kg, safety_stock_kg, coil_weight_kg, lead_time_days |
| **Decision Points** | - Category valid? (enum)<br>- Item code unique per factory?<br>- HSN/GST valid for category? |
| **Output** | Item active, available for transactions |
| **Approval** | IP-2 conditional (workflow `inventory.item.manage`) |

### 5.2.2 Stock Transaction (Manual Adjustment)
| Phase | Detail |
|-------|--------|
| **Trigger** | Store keeper records physical movement not covered by auto-post (e.g., inter-yard transfer, sample issue) |
| **Process** | POST `/steel/inventory/transactions` with item_id, transaction_type (inward/adjustment/dispatch_out/production_issue/production_output), quantity_kg, direction (increase/decrease for adjustment), notes |
| **Decision Points** | - Projected balance negative? → Block (pessimistic lock on item)<br>- High value (>5000kg)? → IP-2 approval required |
| **Output** | Transaction record, audit log |
| **Failure Cases** | Concurrent transactions → serialized by `FOR UPDATE` lock |

### 5.2.3 Stock Reconciliation (Cycle Count)
| Phase | Detail |
|-------|--------|
| **Trigger** | Scheduled (daily/weekly) or variance alert |
| **Process** | 1. Store keeper counts physical qty<br>2. POST `/steel/inventory/reconciliations` with item_id, physical_qty_kg, notes, mismatch_cause<br>3. System reads current system balance (ledger sum)<br>4. Calculates variance_kg, variance_percent, confidence_status<br>5. Creates reconciliation `status=pending` (G4 fix: no auto-approve for admin/owner)<br>6. Approver (≠ counter) reviews → `/approve` or `/reject` with IP-2 workflow<br>7. On approve: if variance ≠ 0, creates `adjustment` transaction |
| **Decision Points** | - Variance > tolerance (0.001kg)? → mismatch_cause mandatory<br>- Confidence red? → escalate to manager<br>- Self-approval? → blocked |
| **Output** | Approved reconciliation, adjustment transaction, updated confidence |
| **Failure Cases** | Approver rejects → reconciliation status `rejected`, no adjustment |
| **Recovery** | Re-count, new reconciliation |

### 5.2.4 Reorder Point Calculation (Cron)
| Phase | Detail |
|-------|--------|
| **Trigger** | Daily cron `/cron/calculate-reorder-points` |
| **Process** | For each active item: sum `dispatch_out` + `production_issue` last 90 days → avg_daily → reorder_point = avg_daily × lead_time_days × 1.5 (safety_factor). Updates `reorder_point_kg` if changed. |
| **Decision Points** | - Zero consumption history → skip (preserve manual value)<br>- Lead time not set → default 7 days |
| **Output** | Updated reorder points, summary {updated, total} |

---

## 5.3 PURCHASE / PROCUREMENT

### 5.3.1 Vendor Onboarding
| Phase | Detail |
|-------|--------|
| **Trigger** | New material source needed |
| **Process** | POST `/steel/vendors` with master data (name, GST, PAN, address, contact, payment_terms, credit_limit) |
| **Decision Points** | - GST/PAN format validation<br>- Duplicate name check per factory |
| **Output** | Vendor active, available for bills |

### 5.3.2 Vendor Bill Processing
| Phase | Detail |
|-------|--------|
| **Trigger** | Vendor invoice received (post-GRN or service) |
| **Process** | POST `/steel/vendor-bills` with vendor_id, bill_number, bill_date, due_date, expense_category, lines (item_id, description, qty_kg, rate, amount). GST auto-calc from item HSN. |
| **Decision Points** | - 3-way match: PO qty/rate vs GRN vs Bill<br>- Bill duplicate? (unique per factory+bill_number) |
| **Output** | Bill `status=unpaid`, AP liability |
| **Approval** | Not explicitly modeled (gap) — assumes finance reviews before payment |

### 5.3.3 Vendor Payment
| Phase | Detail |
|-------|--------|
| **Trigger** | Bill due date approaching |
| **Process** | POST `/steel/vendor-payments` with vendor_id, bill_id (optional), payment_date, amount, payment_mode, reference_number, allocations (bill_id, amount). Creates cash ledger entry. |
| **Decision Points** | - Cash account balance sufficient?<br>- TDS deduction applicable? |
| **Output** | Payment record, bill status updated |

---

## 5.4 SALES & MARKETING

### 5.4.1 Customer Onboarding & Verification
| Phase | Detail |
|-------|--------|
| **Trigger** | New customer inquiry |
| **Process** | 1. POST `/steel/customers` with master data + GST/PAN<br>2. System runs verification: PAN format (20pts), GST format (20pts), PAN↔GST match (20pts), docs uploaded (10+10), name fuzzy match (10), state match (10)<br>3. Score ≥70 → `verification_status=verified`, else `pending_review`/`mismatch`<br>4. Admin reviews via `/steel/customers/{id}/verification/review` (IP-2) |
| **Decision Points** | - Fake GSTIN? → mismatch<br>- Name mismatch >30%? → manual review<br>- Doc missing? → format_valid only |
| **Output** | Verified customer, credit limit active, risk score calculated |
| **Failure Cases** | Verification rejected → customer `blocked`, sales blocked |

### 5.4.2 Sales Invoice Creation
| Phase | Detail |
|-------|--------|
| **Trigger** | Confirmed customer order |
| **Process** | POST `/steel/invoices` with customer_id (or name), invoice_date, due_date, payment_terms, lines (item_id, batch_id optional, weight_kg, rate_per_kg). Invoice number auto-generated. GST calculated per line (item HSN + GST rate). |
| **Decision Points** | - Rate > 0 for finished goods<br>- Weight ≤ available stock (soft check)<br>- Customer credit limit check (warning only) |
| **Output** | Invoice `status=unpaid`, credit exposure updated |

### 5.4.3 Invoice Edit / Void
| Phase | Detail |
|-------|--------|
| **Pre-Dispatch Edit** | PUT `/steel/invoices/{id}` — IP-2 approval (workflow `invoice.record.edit_pre_dispatch`) |
| **Post-Dispatch Edit** | PUT `/steel/invoices/{id}/post-dispatch` — IP-3 (two-stage, different people) |
| **Void** | POST `/steel/invoices/{id}/void` — IP-4 (cross-domain: Admin/Owner) |

### 5.4.4 Customer Payment & Follow-up
| Phase | Detail |
|-------|--------|
| **Payment Recording** | POST `/steel/customers/payments` with customer_id, invoice_id (optional), amount, mode, reference, allocations. Auto-bypass if <₹50k & not backdated (IP-2). |
| **Reallocate** | POST `/steel/payments/{id}/reallocate` — IP-3 (two-stage) |
| **Reverse** | POST `/steel/payments/{id}/reverse` — IP-4 |
| **Follow-up Tasks** | POST `/steel/customers/{id}/tasks` — CRM-lite for collection reminders |

---

## 5.5 DISPATCH / LOGISTICS

### 5.5.1 Dispatch Creation
| Phase | Detail |
|-------|--------|
| **Trigger** | Invoice ready, vehicle available |
| **Process** | POST `/steel/dispatches` with invoice_id, dispatch_date, truck_number, driver details, lines (invoice_line_id, weight_kg). Auto-generates dispatch_number, gate_pass_number, QR code. |
| **Decision Points** | - Weight > truck capacity? → Warning only<br>- Duplicate truck same day? → Warning<br>- Weight ≤ 5000kg? → Auto-bypass approval |
| **Output** | Dispatch `status=pending`, gate pass PDF+QR |

### 5.5.2 Dispatch Status Progression (State Machine)
| Phase | Detail |
|-------|--------|
| **Loaded** | POST `/steel/dispatches/{id}/status` with `status=loaded`, `gate_pass_photo_url`. Guard: photo mandatory. |
| **Exited** | POST with `status=exited`, `weighbridge_slip_photo_url`. Guard: Supervisor role, photo mandatory. Triggers inventory post (dispatch_out transactions). |
| **Delivered** | POST with `status=delivered`, `pod_photo_url`, `receiver_name`. Guard: Supervisor, POD mandatory. |
| **Cancelled** | Any stage → `cancelled`. If inventory posted, reversal needed (manual). |

### 5.5.3 Gate Pass Verification
| Phase | Detail |
|-------|--------|
| **Trigger** | Security scans QR at gate |
| **Process** | GET `/steel/dispatches/{id}/gate-pass/verify` → returns dispatch details for visual match |
| **Output** | Verified timestamp recorded |

---

## 5.6 QUALITY CONTROL

### 5.6.1 Incoming Inspection (Gap — Manual)
| Phase | Detail |
|-------|--------|
| **Current** | Paper-based. QC inspector writes report. No digital workflow in FactoryNerve. |
| **Needed** | Digital checklists, photo evidence, auto-link to GRN, NCR workflow |

### 5.6.2 In-Process / Final Inspection (Via DPR + Batch)
| Phase | Detail |
|-------|--------|
| **DPR Quality Fields** | `quality_issues` (bool), `quality_details`, `rejection_qty`, `defect_reason_id`, `rework_required`, `scrap_qty_entry` |
| **Batch Quality Fields** | `rejection_qty_kg`, `scrap_qty_kg` |
| **Defect Reason Master** | `/entries/defect-reasons` — managed by Quality (IP-2) |
| **Intelligence** | `/steel/intelligence/quality` — scrap/loss trends, operator/machine/line/process breakdown |

### 5.6.3 Customer Complaint / NCR (Gap)
| Phase | Detail |
|-------|--------|
| **Current** | Not modeled. Follow-up tasks used as workaround. |
| **Needed** | NCR entity, root cause analysis (8D), CAPA tracking, customer portal |

---

## 5.7 STORES (See Inventory — 5.2)

---

## 5.8 ATTENDANCE & WORKFORCE

### 5.8.1 Punch In/Out (Self-Service)
| Phase | Detail |
|-------|--------|
| **Trigger** | Employee opens `/attendance/me/today` or mobile app |
| **Process** | POST `/attendance/punch` with `action=in|out`, optional `shift`, `note`. System infers shift from templates or explicit. Creates/updates `AttendanceRecord`. Calculates `worked_minutes`, `late_minutes` (vs shift_start + grace), `overtime_minutes` (vs overtime_after). |
| **Decision Points** | - Already punched in? → Allow punch out only<br>- Cross-midnight night shift? → Search previous day open record<br>- Missed punch-out? → Auto-close cron marks `missed_punch` after shift_end + 2hr |
| **Output** | Attendance record, live view updated |

### 5.8.2 Attendance Review & Regularization
| Phase | Detail |
|-------|--------|
| **Trigger** | Supervisor opens `/attendance/review` for date/factory |
| **Process** | 1. View live/pending records with `review_status=auto`<br>2. For each: Approve (sets `review_status=approved`, `approved_by`, `approved_at`), Force-close (missing punch-out), Reject (with reason) — IP-2 workflow `attendance.review.approve`/`reject`<br>3. Employee can submit `/attendance/me/regularizations` for missed punch, timing correction, status correction, shift correction → creates `AttendanceRegularization` (pending)<br>4. Supervisor reviews regularization queue → approve/reject |
| **Decision Points** | - Regularization type valid?<br>- Evidence sufficient? (note mandatory)<br>- Self-approval blocked |
| **Output** | Corrected attendance, payroll-ready data |

### 5.8.3 Workforce Intelligence
| Phase | Detail |
|-------|--------|
| **Trigger** | Manager/Owner views `/workforce/overview`, `/workforce/workers`, `/workforce/costs/summary` |
| **Process** | Aggregates attendance + entry + cost rates → KPIs: attendance %, overtime hrs, late hrs, labor cost/MT, productivity score |
| **Output** | Dashboards, ranked worker lists, shift comparison, cost summary |

---

## 5.9 OCR & DOCUMENT PROCESSING

### 5.9.1 OCR Upload & Verification
| Phase | Detail |
|-------|--------|
| **Trigger** | User uploads document (invoice, challan, test cert, weighbridge slip) via `/ocr/processing` |
| **Process** | 1. Pipeline: preprocess → layout analysis → structural grouping → cell extraction → normalization → validation → confidence scoring<br>2. Creates `OCRVerification` record with extracted JSON, confidence, status `pending`<br>3. Human verifier reviews via `/ocr/verifications` → edits cells if needed → submits for approval<br>4. Approver (Supervisor+) → IP-2 workflow `ocr.verification.approve`/`reject`<br>5. On approve: downstream callback creates invoice/batch/transaction from extracted data |
| **Decision Points** | - Confidence < threshold? → Flag for human review<br>- Critical field missing? → Reject<br>- Domain-specific rules (GSTIN format, weight numeric) |
| **Output** | Structured data, audit trail, source image linked |

---

## 5.10 REPORTING & ANALYTICS

### 5.10.1 Operational Reports
| Report | Endpoint | Source | Frequency |
|--------|----------|--------|-----------|
| Weekly Analytics | `/analytics/weekly` | Entries | On-demand |
| Monthly Analytics | `/analytics/monthly` | Entries | On-demand |
| Trends | `/analytics/trends` | Entries | On-demand |
| Manager Dashboard | `/analytics/manager` | Entries + Attendance | On-demand |
| Attendance Summary | `/attendance/reports/summary` | AttendanceRecord | On-demand |
| Steel Overview | `/steel/overview` | All steel tables | Real-time |
| Owner Daily PDF | `/steel/owner-daily-pdf` | All steel + realization | Daily (scheduled) |
| Executive PDF | `/premium/executive-pdf` | AI summary | On-demand |

### 5.10.2 AI-Powered Intelligence
| Feature | Endpoint | Description |
|---------|----------|-------------|
| AI Suggestions | `/ai/suggestions` | Next shift DPR values based on history |
| AI Anomalies | `/ai/anomalies` | Statistical outliers in production |
| NLQ | `/ai/query` | Natural language → structured answer + action items |
| Executive Summary | `/ai/executive-summary` | LLM-generated narrative report |
| Fraud Intelligence | `/steel/intelligence/fraud` | Coil theft, dispatch mismatch, inventory leakage |

---

## 5.11 ADMIN & SETTINGS

### 5.11.1 User Invitation & Role Assignment
| Phase | Detail |
|-------|--------|
| **Invite User** | POST `/settings/users/invite` — IP-2 workflow `user.invite` → callback creates user + sends email |
| **Assign Role** | PUT `/settings/users/{id}/role` — IP-4 (cross-domain: Admin/Owner only) |
| **Assign Factory** | PUT `/settings/users/{id}/factory-access` — IP-2 |
| **Deactivate** | DELETE `/settings/users/{id}` — IP-2 → callback sets `is_active=False`, revokes sessions |
| **Reactivate** | POST `/auth/users/{id}/reactivate` — IP-2 |

### 5.11.2 Factory Management
| Phase | Detail |
|-------|--------|
| **Create Factory** | POST `/settings/factories` — IP-2, sets industry_type, workflow_template |
| **Factory Settings** | GET/PUT `/settings/factory` — timezone, template, feature flags |

---

## 5.12 APPROVAL ENGINE (Cross-Cutting)

| Workflow Key | Pattern | Auto-Bypass Condition | TTL | Auto-Action on Expiry |
|--------------|---------|----------------------|-----|----------------------|
| `production.entry.approve` | IP-2 | — | 72h | Escalate |
| `production.entry.delete` | IP-2 | — | 72h | Escalate |
| `attendance.review.approve` | IP-2 | — | 72h | Escalate |
| `attendance.review.reject` | IP-2 | — | 72h | Escalate |
| `ocr.verification.approve` | IP-2 | — | 72h | Escalate |
| `ocr.verification.reject` | IP-2 | — | 72h | Escalate |
| `inventory.reconciliation.approve` | IP-2 | variance_percent ≤ 5% | 48h | Escalate |
| `inventory.reconciliation.reject` | IP-2 | variance_percent ≤ 5% | 48h | Escalate |
| `dispatch.status.update` | IP-2 | NOT cancellation | 24h | Escalate |
| `dispatch.record.create` | IP-2 | total_weight_kg ≤ 5000 | 24h | Escalate |
| `dispatch.record.cancel` | IP-2 | — | 24h | Escalate |
| `customer.verification.review` | IP-2 | — | 72h | — |
| `customer.status.update` | IP-2 | — | 72h | — |
| `invoice.record.edit_pre_dispatch` | IP-2 | — | 72h | — |
| `invoice.record.edit_post_dispatch` | IP-3 | — | 48h | — |
| `invoice.record.void` | IP-4 | — | 72h | — |
| `payment.record.create` | IP-2 | amount ≤ ₹50k AND not backdated | 72h | — |
| `payment.record.reallocate` | IP-3 | — | 72h | — |
| `payment.record.reverse` | IP-4 | — | 72h | — |
| `production.batch.variance.approve` | IP-2 | variance_percent ≤ 5% | 72h | — |
| `factory.create` | IP-2 | — | 72h | — |
| `user.invite` | IP-2 | — | 72h | — |
| `user.role.assign` | IP-4 | — | 72h | — |
| `user.membership.assign` | IP-2 | — | 72h | — |
| `user.deactivate` | IP-2 | — | 72h | — |
| `user.reactivate` | IP-2 | — | 72h | — |
| `billing.plan.downgrade` | IP-5 | — | 72h | Auto-reject |
| `billing.plan.change` | IP-5 | — | 72h | Auto-reject |

---

## 5.13 CRON & BACKGROUND JOBS

| Job | Schedule | Purpose |
|-----|----------|---------|
| Daily Maintenance | 02:00 | Cleanup, stats refresh |
| Process Email Queue | Every 5 min | Send queued emails |
| Daily Summary | 06:00 | Generate & email daily reports |
| Auto-Close Attendance | 23:59 | Mark missing punch-outs |
| Calculate Reorder Points | 03:00 | Update inventory reorder points |
| Approval Expiry Sweep | Hourly | Escalate/abandon expired approvals |
| Feedback Anomaly Detection | Daily | Detect spam/abuse in feedback |
| Audit Archival | Weekly | Archive old audit logs |

---

## 5.14 FAILURE SIMULATION & DEV TOOLS (Non-Production)

| Endpoint | Purpose |
|----------|---------|
| `/dev/failures` | View registered failure modes |
| `/dev/failures/{mode}/enable` | Inject failure (DB error, timeout, etc.) |
| `/dev/status` | System health snapshot |

---

# PART 6: INFORMATION FLOW

**Track DATA events from operator action to AI consumption.**

---

## 6.1 Core Information Flow Patterns

### 6.1.1 Operator DPR Entry → Full Analytics Chain
```
Operator submits Entry (POST /entries)
    ↓
Database: entries table INSERT
    ↓
AuditLog: ENTRY_CREATED (async, same txn)
    ↓
Cache Invalidation: org:{org_id}:analytics:* keys deleted
    ↓
Background Job: AI Summary queued (parse_unstructured_input or generate_entry_summary)
    ↓
AI Engine: Calls LLM → returns structured summary + confidence
    ↓
Entry updated: ai_summary, summary_job_id
    ↓
Analytics Cache Rebuild (next request):
  - /analytics/weekly: aggregates entries by date → units, performance%, attendance%
  - /analytics/manager: shift summaries, supervisor rollups
  - /ai/anomalies: statistical outlier detection on units_produced, downtime, rejection
  - /ai/suggestions: next-shift prediction from recent patterns
    ↓
Owner Dashboard (/steel/owner-daily-pdf):
  - Pulls latest entries, batches, invoices, dispatches
  - Computes realization metrics (dispatch revenue - batch cost)
  - Renders PDF with anomaly highlights
    ↓
AI Executive Summary (/ai/executive-summary):
  - Feeds aggregated KPIs to LLM → narrative report
```

### 6.1.2 Steel Batch → Inventory → Dispatch → Finance
```
Operator creates SteelProductionBatch (POST /steel/batches)
    ↓
DB: steel_production_batches INSERT
    ↓
Service: calculate loss%, variance%, variance_value_inr, severity, anomaly_score
    ↓
If variance > 5%: ApprovalInstance created (IP-2)
    ↓
On Variance Approval (callback):
  - SteelInventoryTransaction INSERT (type=production_output, +actual_output_kg)
  - Item balance derived: Σ(transactions) for output_item
    ↓
Inventory Stock API (/steel/inventory/stock):
  - Reads all transactions for factory
  - Groups by item_id → SUM(quantity_kg)
  - Joins latest reconciliation for confidence
    ↓
Dispatch Created (POST /steel/dispatches):
  - Links to invoice lines (which may link to batch_id)
  - Gate pass QR generated
    ↓
Dispatch Status → Exited/Delivered (callback _on_dispatch_status_completed):
  - SteelInventoryTransaction INSERT (type=dispatch_out, -weight_kg per line)
  - Inventory posted flag set (idempotent with FOR UPDATE)
    ↓
SteelCustomerPayment (POST /steel/customers/payments):
  - Allocation to invoices
  - Invoice status auto-update (unpaid/partial/paid)
  - Customer outstanding, risk_score recalculated
    ↓
Realization Metrics (build_steel_realization_metrics):
  - Dispatch revenue (Σ dispatch_line.weight × invoice_line.rate)
  - Dispatch cost (batch_cost_per_kg × weight)
  - Profit = revenue - cost
  - Outstanding = invoiced - dispatched
    ↓
Owner Dashboard & AI: consumes realization metrics
```

### 6.1.3 Attendance → Workforce Cost → Owner View
```
Employee Punch In/Out (POST /attendance/punch)
    ↓
AttendanceRecord INSERT/UPDATE (worked_minutes, late_minutes, overtime_minutes)
    ↓
WorkforceCostRate lookup (user-specific > role > department > factory default)
    ↓
Cost Calculation (background / on-demand):
  - Regular cost = (worked - overtime) / 60 × regular_rate
  - OT cost = overtime / 60 × regular_rate × 1.5
    ↓
/workforce/overview:
  - Aggregates by factory, date range
  - Total worked hrs, OT hrs, late hrs, cost INR
    ↓
/workforce/workers:
  - Per-worker ranking by worked hrs, OT, cost
    ↓
Owner Dashboard: Labor cost included in daily P&L
```

### 6.1.4 OCR → Structured Data → Transaction
```
Upload Document (POST /ocr/processing)
    ↓
OCR Pipeline (async):
  - Preprocess → Layout → Group → Extract → Normalize → Validate → Confidence
    ↓
OCRVerification record: extracted_data (JSON), confidence, status=pending
    ↓
Human Verification (PUT /ocr/verifications/{id}):
  - Edits cells, overrides values
    ↓
Approval (POST /ocr/verifications/{id}/approve) — IP-2
    ↓
Callback (_on_generic_completed or domain-specific):
  - If invoice: creates SteelSalesInvoice + lines
  - If challan: creates InventoryTransaction (inward)
  - If test cert: links to batch heat_number
    ↓
Downstream consumers see structured data instantly
```

### 6.1.5 AI NLQ → Multi-Domain Data Fusion
```
User asks: "Why was profit low last week?" (POST /ai/query)
    ↓
NLQ Router (ai_router.py):
  - Classifies domain: FINANCE + PRODUCTION (multi-domain fusion)
  - Checks permissions per domain (PDP)
    ↓
Executes parallel queries:
  - Steel realization metrics (dispatch profit)
  - Production batch variance (loss value)
  - Scrap loss intelligence (scrap cost by machine/operator)
  - Workforce cost (labor cost)
    ↓
LLM Synthesis:
  - Receives structured data points from all domains
  - Generates answer + action_items + health_score
    ↓
Response: structured_query (domains, filters), answer, data_points, action_items
```

---

## 6.2 Information Flow Matrix (Event → Consumers)

| Event (Source) | Primary Consumers | Secondary Consumers | Latency Requirement |
|----------------|-------------------|---------------------|---------------------|
| Entry Created | Analytics cache, AI Summary job, Approval queue | Supervisor notification, Audit log | <1s (sync), <30s (AI) |
| Entry Approved | Analytics cache invalidation, Operator notification | — | <1s |
| Batch Recorded | Inventory intelligence, Anomaly detection, Owner dashboard | Planning (WIP), QC (if rejection) | <1s |
| Batch Variance Approved | Inventory (production_output txn), Costing, Realization | — | <1s (callback) |
| Inventory Transaction | Stock API, Reconciliation, Reorder calc | Owner dashboard, AI anomalies | <1s |
| Reconciliation Approved | Adjustment transaction, Confidence status | Finance (valuation), Manager | <1s |
| Invoice Created | Customer credit, Dispatch planning, Receivables aging | Sales follow-up, AI finance | <1s |
| Dispatch Status Exit | Inventory (dispatch_out), Gate pass verify | Transporter, Customer | <1s (sync) |
| Payment Recorded | Invoice status, Customer outstanding, Risk score | Cash flow, Vendor payment planning | <1s |
| Attendance Punch | Live view, Workforce cost, Payroll | Supervisor alert (late), Auto-close cron | <1s |
| Attendance Approved | Payroll export, Worker ranking | — | <1s |
| OCR Verified | Downstream document (invoice/batch/txn) | Audit, Vendor/Customer portal | <5s (async pipeline) |
| Alert Generated | Recipients (email/WhatsApp/in-app), Ops dashboard | Owner (critical only) | <10s |
| Approval Instance Created | Approver queue (in-app), Email/WhatsApp | Escalation scheduler | <1s |
| Approval Advanced | Resource status update, Callback execution | Audit, Notification | <1s |

---

# PART 7: EVENT CATALOG

**Every discrete event in the factory with creator, data changes, consumers, business impact.**

| Event Name | Creator | Data Changes | Consumers | Modules Reacting | Business Impact |
|------------|---------|--------------|-----------|------------------|-----------------|
| **Material Arrival Events** |
| `VEHICLE_GATE_ENTRY` | Security Guard | Gate log entry (paper) | Purchase, Stores | — | Physical receipt starts liability |
| `WEIGHBRIDGE_GROSS_WEIGHT` | Weighbridge Op | Weighbridge slip (paper/photo) | Stores, Purchase | — | Basis for GRN qty |
| `MATERIAL_UNLOADED` | Store Keeper | Yard receipt note | Stores | — | Material in factory custody |
| `QC_INCOMING_INSPECTION` | QC Inspector | Inspection report, NCR if reject | Stores, Purchase, Vendor | — | Accept/Reject decision |
| `GRN_POSTED` | Store Keeper | `SteelInventoryTransaction` (inward, +qty), GRN doc | Stores, Purchase, Finance | Inventory, Reorder calc | Stock liability recognized, AP triggered |
| **Production Events** |
| `OPERATOR_PUNCH_IN` | Operator | `AttendanceRecord` (punch_in_at) | Attendance Live, Supervisor | Workforce Intelligence | Shift start confirmed |
| `OPERATOR_PUNCH_OUT` | Operator | `AttendanceRecord` (punch_out_at, worked, late, OT) | Attendance Live, Payroll | Workforce Intelligence, Costing | Shift end, labor cost finalized |
| `DPR_ENTRY_SUBMITTED` | Operator | `Entry` (status=submitted) | Approval Queue, Analytics Cache | Analytics, AI Suggestions, Anomalies | Production recorded, awaiting approval |
| `DPR_ENTRY_APPROVED` | Supervisor | `Entry` (status=approved), AuditLog | Analytics, Operator | Analytics, AI | Production confirmed for reporting |
| `DPR_ENTRY_REJECTED` | Supervisor | `Entry` (status=rejected), AuditLog | Operator | — | Rework required |
| `STEEL_BATCH_RECORDED` | Operator | `SteelProductionBatch` (status=recorded), anomaly_score | Inventory Intelligence, Owner Dashboard, Fraud Detection | Steel Intelligence, Coil Theft | Production output captured, variance flagged |
| `BATCH_VARIANCE_APPROVED` | Manager | `SteelProductionBatch` (status=variance_approved), `SteelInventoryTransaction` (production_output) | Inventory, Costing, Realization | Inventory, Steel Finance | Finished goods stock recognized, cost locked |
| `MACHINE_DOWNTIME_LOGGED` | Operator | `SteelMachineDowntimeEvent` | Machine Analytics, Maintenance Alerts | Steel Machine Intelligence, OEE | OEE calculation, maintenance trigger |
| `MAINTENANCE_TASK_COMPLETED` | Maintenance | `SteelMaintenanceTask` (status=done) | Machine Analytics | — | MTTR, availability |
| **Inventory Events** |
| `STOCK_TRANSACTION_POSTED` | System/Store Keeper | `SteelInventoryTransaction` (any type) | Stock API, Reconciliation, Reorder | Inventory, Steel Intelligence | Stock position changed |
| `RECONCILIATION_SUBMITTED` | Store Keeper | `SteelStockReconciliation` (pending) | Approval Queue, Manager | Approvals | Variance detected, awaiting review |
| `RECONCILIATION_APPROVED` | Manager | `SteelStockReconciliation` (approved), `SteelInventoryTransaction` (adjustment) | Stock API, Confidence, Finance | Inventory, Approvals | Physical=System, valuation corrected |
| `RECONCILIATION_REJECTED` | Manager | `SteelStockReconciliation` (rejected) | Store Keeper | — | Re-count required |
| `REORDER_POINT_UPDATED` | Cron | `SteelInventoryItem.reorder_point_kg` | Purchase Alerts | Inventory Intelligence | Auto-procurement trigger |
| **Sales & Dispatch Events** |
| `CUSTOMER_CREATED` | Sales | `SteelCustomer` (draft/verified) | Sales, Finance | Customer Verification | New revenue source |
| `CUSTOMER_VERIFIED` | Admin | `SteelCustomer` (verified, credit_limit active) | Sales, Finance | — | Credit sales enabled |
| `SALES_INVOICE_CREATED` | Sales/Finance | `SteelSalesInvoice` + lines, Customer credit exposure | Dispatch, Receivables, AI Finance | Steel Finance, Analytics | Revenue recognized, dispatch triggered |
| `INVOICE_EDITED_PRE_DISPATCH` | Sales/Finance | `SteelSalesInvoice` (updated), ApprovalInstance | Approval Queue | Approvals | Correction before goods move |
| `INVOICE_EDITED_POST_DISPATCH` | Sales/Finance | `SteelSalesInvoice` (updated), ApprovalInstance (IP-3) | Approval Queue (L1→L2) | Approvals, Audit | Post-facto change controlled |
| `INVOICE_VOIDED` | Admin/Owner | `SteelSalesInvoice` (status=voided), ApprovalInstance (IP-4) | Receivables, Customer | Approvals, Audit | Revenue reversed, stock released |
| `DISPATCH_CREATED` | Dispatch | `SteelDispatch` (pending), Gate Pass QR | Security, Transporter, Inventory (reserved) | Dispatch, Steel Intelligence | Goods committed to customer |
| `DISPATCH_LOADED` | Dispatch/Security | `SteelDispatch` (status=loaded, gate_pass_photo) | Security, Transporter | Dispatch | Vehicle loaded, gate pass validated |
| `DISPATCH_EXITED` | Security/Supervisor | `SteelDispatch` (exited, exit_time, weighbridge_photo), `SteelInventoryTransaction` (dispatch_out) | Inventory, Customer, Transporter | Inventory, Dispatch, Steel Finance | Stock relieved, ownership transferred |
| `DISPATCH_DELIVERED` | Supervisor | `SteelDispatch` (delivered, POD photo, receiver) | Customer, Finance, Sales | Dispatch, Steel Finance | Revenue realizable, POD for payment |
| `DISPATCH_CANCELLED` | Dispatch | `SteelDispatch` (cancelled), Inventory reversal if posted | Inventory, Customer | Dispatch, Inventory | Order cancelled, stock returned |
| `CUSTOMER_PAYMENT_RECEIVED` | Finance | `SteelCustomerPayment` + allocations, Invoice status, Customer risk_score | Receivables, Cash Flow, AI Finance | Steel Finance, Approvals (if >₹50k) | Cash collected, credit freed |
| `PAYMENT_REALLOCATED` | Finance | Allocation changes, Invoice status | Receivables | Approvals (IP-3) | Correction applied |
| `PAYMENT_REVERSED` | Admin/Owner | Payment reversed, Invoice status reverted | Receivables, Cash Flow | Approvals (IP-4) | Error corrected |
| **Purchase & Finance Events** |
| `VENDOR_BILL_RECEIVED` | Purchase | `SteelVendorBill` + lines | AP Aging, Cash Flow | Steel Finance | Liability recognized |
| `VENDOR_PAYMENT_MADE` | Finance | `SteelVendorPayment` + allocations, Cash ledger | Vendor, Cash Flow | Steel Finance | Liability settled |
| `EXPENSE_RECORDED` | Finance | `SteelExpense` | P&L, Cost Centers | Steel Finance | Cost captured |
| `CASH_LEDGER_ENTRY` | Finance | `SteelCashLedgerEntry` | Bank Reconciliation, Cash Position | Steel Finance | Cash tracked |
| **Attendance Events** |
| `REGULARIZATION_REQUESTED` | Employee | `AttendanceRegularization` (pending) | Review Queue | Approvals | Exception handling |
| `REGULARIZATION_APPROVED` | Supervisor | `AttendanceRegularization` (approved), `AttendanceRecord` corrected | Payroll, Workforce | Approvals | Attendance corrected |
| `ATTENDANCE_AUTO_CLOSED` | Cron | `AttendanceRecord` (status=missed_punch/half_day/absent) | Payroll, Workforce | Cron | Shift closed without punch-out |
| **OCR Events** |
| `DOCUMENT_UPLOADED` | User | `OCRVerification` (pending), source image stored | OCR Pipeline | OCR | Processing started |
| `OCR_EXTRACTION_COMPLETE` | Pipeline | `OCRVerification` (extracted_data, confidence) | Verification Queue | OCR | Human review needed |
| `OCR_VERIFICATION_APPROVED` | Supervisor | `OCRVerification` (approved), downstream callback | Invoice/Batch/Txn creation | Approvals, Domain modules | Structured data entered |
| **Approval Events** |
| `APPROVAL_INITIATED` | Any (via service) | `ApprovalInstance` (pending_l1) | Approver Queue, Notifications | Approvals | Workflow started |
| `APPROVAL_ADVANCED_L1` | L1 Approver | `ApprovalInstance` (pending_l2 or approved) | L2 Approver or Callback | Approvals | First gate passed |
| `APPROVAL_ADVANCED_L2` | L2 Approver | `ApprovalInstance` (approved), Callback fired | Resource Owner | Approvals, Domain | Workflow complete, action executed |
| `APPROVAL_REJECTED` | Any Approver | `ApprovalInstance` (rejected), Callback fired | Requester | Approvals | Workflow denied |
| `APPROVAL_EXPIRED` | Cron | `ApprovalInstance` (escalated/abandoned/rejected) | Requester, Escalation Target | Approvals, Cron | SLA breach handled |
| `APPROVAL_BYPASS` | System (conditional) | `ApprovalInstance` (no_approval_required), AuditLog (APPROVAL_BYPASS) | Requester, Audit | Approvals | Low-risk action auto-approved |
| **AI Events** |
| `AI_SUMMARY_GENERATED` | AI Engine | `Entry.ai_summary` updated | Analytics, Owner PDF | AI | Narrative available |
| `AI_ANOMALY_DETECTED` | AI Engine | Anomaly items in response | Owner Dashboard, Alerts | AI, Steel Intelligence | Attention flagged |
| `AI_NLQ_ANSWERED` | AI Router | Structured answer + action items | User, Audit | AI | Decision support delivered |
| `EXECUTIVE_SUMMARY_GENERATED` | AI Engine | PDF/JSON report | Owner, Management | AI, Premium | Strategic view |

---

# PART 8: STATE MACHINES

---

## 8.1 Material / Inventory Item (SteelInventoryItem + Transactions)

```
CREATED (item master)
    │
    ▼
RECEIVED (first inward transaction)
    │
    ├──► IN_STOCK (balance > 0)
    │       │
    │       ├── ISSUED_TO_PRODUCTION (production_issue txn) ──► IN_STOCK (reduced)
    │       │
    │       ├── DISPATCHED (dispatch_out txn) ──► IN_STOCK (reduced)
    │       │
    │       ├── ADJUSTED_UP (adjustment +) ──► IN_STOCK (increased)
    │       │
    │       ├── ADJUSTED_DOWN (adjustment -) ──► IN_STOCK (decreased)
    │       │
    │       └── RECONCILED (reconciliation approved) ──► IN_STOCK (corrected)
    │
    ├──► ZERO_STOCK (balance = 0)
    │       │
    │       └── RECEIVED AGAIN ──► IN_STOCK
    │
    ├──► NEGATIVE_STOCK (balance < 0) — **ILLEGAL STATE** (blocked by pessimistic lock)
    │       │
    │       └── EMERGENCY_ADJUSTMENT ──► ZERO_STOCK / IN_STOCK
    │
    └──► INACTIVE (is_active=False)
            │
            └── (no further transactions allowed)
```

**Confidence Status (orthogonal):**
```
GREEN (variance ≤1%, count ≤7 days ago)
    │
    ├──► YELLOW (variance ≤3%, count ≤14 days) ──► RED (variance >3% OR count >14 days OR negative balance)
    │
    └──► RED (direct from GREEN if variance >3% or negative)
```

---

## 8.2 Steel Production Batch

```
RECORDED (operator submits)
    │
    ├── variance_percent ≤ 5% ──► VARIANCE_AUTO_APPROVED (IP-2 bypass)
    │       │
    │       ▼
    │   PRODUCTION_OUTPUT_POSTED (inventory txn created)
    │       │
    │       ▼
    │   CLOSED
    │
    └── variance_percent > 5% ──► VARIANCE_PENDING_APPROVAL
            │
            ├── APPROVED (Manager IP-2) ──► VARIANCE_APPROVED ──► PRODUCTION_OUTPUT_POSTED ──► CLOSED
            │
            └── REJECTED (Manager) ──► VARIANCE_REJECTED
                    │
                    ▼
            OPERATOR_REWORK (adjust actual_output, re-submit) ──► RECORDED (loop)
```

---

## 8.3 Steel Dispatch (Gate Pass Lifecycle)

```
PENDING (created, gate pass generated)
    │
    ├── LOADED (gate_pass_photo uploaded)
    │       │
    │       ▼
    │   EXITED (weighbridge_slip_photo, Supervisor) ──► INVENTORY_POSTED (dispatch_out txns)
    │       │
    │       ├── DISPATCHED (transit)
    │       │       │
    │       │       ▼
    │       │   DELIVERED (POD photo + receiver_name, Supervisor) ──► CLOSED
    │       │
    │       └── CANCELLED (from EXITED) ──► INVENTORY_REVERSAL (manual) ──► CLOSED
    │
    └── CANCELLED (from PENDING/LOADED) ──► CLOSED (no inventory impact)
```

**Terminal States:** `DELIVERED`, `CANCELLED`

---

## 8.4 Sales Invoice

```
DRAFT (created, not yet saved — UI state)
    │
    ▼
UNPAID (saved, status=unpaid)
    │
    ├── PARTIAL (payment allocated, 0 < paid < total)
    │       │
    │       ▼
    │   PAID (paid ≥ total) ──► CLOSED
    │
    ├── VOIDED (IP-4 approval) ──► VOIDED (terminal)
    │       │
    │       ▼
    │   STOCK_RELEASED (if dispatched, reversal needed)
    │
    └── EDITED_PRE_DISPATCH (IP-2) ──► UNPAID (updated)
    └── EDITED_POST_DISPATCH (IP-3) ──► UNPAID (updated, audit heavy)
```

---

## 8.5 Customer (SteelCustomer)

```
DRAFT (created, verification pending)
    │
    ├── FORMAT_VALID (PAN/GST format ok)
    │       │
    │       ▼
    │   PENDING_REVIEW (docs uploaded, awaiting admin)
    │       │
    │       ├── VERIFIED (Admin approve) ──► ACTIVE (credit_limit enforced)
    │       │       │
    │       │       ├── ON_HOLD (credit exceeded / dispute)
    │       │       │       │
    │       │       │       └── ACTIVE (resolved)
    │       │       │
    │       │       └── BLOCKED (chronic default / fraud)
    │       │               │
    │       │               └── (terminal — requires Owner reactivation)
    │       │
    │       └── REJECTED (Admin reject) ──► DRAFT (rework) or BLOCKED
    │
    └── MISMATCH (PAN/GST mismatch) ──► PENDING_REVIEW (manual override)
```

---

## 8.6 Attendance Record

```
OPEN (punch_in recorded, punch_out null)
    │
    ├── COMPLETED (punch_out recorded) ──► REVIEWED (supervisor approves) ──► APPROVED
    │       │
    │       └── FORCE_CLOSED (supervisor, no punch_out) ──► MISSED_PUNCH / HALF_DAY / ABSENT
    │
    ├── MISSED_PUNCH (auto-close cron, no punch_out)
    │       │
    │       ▼
    │   REGULARIZATION_REQUESTED (employee)
    │       │
    │       ├── APPROVED (supervisor) ──► CORRECTED (status=working/completed)
    │       │
    │       └── REJECTED ──► MISSED_PUNCH (stands)
    │
    ├── HALF_DAY (worked < 4 hrs)
    │
    └── ABSENT (no punch_in, auto-close or manual)
```

**Review Status (orthogonal):** `auto` → `reviewed` → `approved` | `rejected`

---

## 8.7 Approval Instance

```
PENDING_L1 (created)
    │
    ├── APPROVED_L1 (IP-2) ──►
    │       ├── (IP-2 terminal) ──► APPROVED ──► COMPLETED (callback fired)
    │       │
    │       └── (IP-3/IP-4/IP-5) ──► PENDING_L2
    │               │
    │               ├── APPROVED_L2 (different user) ──► APPROVED ──► COMPLETED
    │               │
    │               └── REJECTED_L2 ──► REJECTED ──► COMPLETED
    │
    ├── REJECTED_L1 ──► REJECTED ──► COMPLETED
    │
    ├── EXPIRED (Cron)
    │       │
    │       ├── AUTO_ESCALATE workflows ──► PENDING_L2 / ESCALATED
    │       │
    │       ├── AUTO_REJECT workflows ──► REJECTED ──► COMPLETED
    │       │
    │       └── Others ──► ABANDONED ──► COMPLETED
    │
    └── NO_APPROVAL_REQUIRED (IP-2 bypass) ──► COMPLETED (callback fired)
```

---

## 8.8 Vendor Bill

```
DRAFT → UNPAID → PARTIAL → PAID
                │
                └── DISPUTED (quality/qty) → RESOLVED → PAID
```

---

## 8.9 Customer Payment

```
CREATED → ALLOCATED (to invoices) → POSTED
    │
    ├── REALLOCATED (IP-3) → ALLOCATED (new)
    │
    └── REVERSED (IP-4) → VOIDED
```

---

## 8.10 OCR Verification

```
UPLOADED → PROCESSING → EXTRACTED (pending_review)
    │
    ├── APPROVED (Supervisor) ──► VERIFIED → CALLBACK_FIRED → DOWNSTREAM_CREATED
    │
    └── REJECTED ──► REJECTED → REWORK (re-upload)
```

---

# PART 9: DECISION MATRIX

**Every business decision, who makes it, on what basis.**

| Decision | Who Decides | Based On (Data/Rules) | System Support | Approval Pattern |
|----------|-------------|----------------------|----------------|------------------|
| **PRODUCTION** |
| Which line produces which grade today? | Planning Officer | Sales order priority, line capability, changeover time, machine availability | `/steel/production/lines`, `/steel/batches/auto-fill` | — |
| When to changeover line? | Planning + Line Supervisor | Grade sequence optimization, urgent order insertion | Manual (gap: no scheduler) | — |
| Accept batch variance? | Manager (IP-2) | Variance %, variance value INR, severity, heat number, operator history, coil weight anomaly | `/steel/batches/{id}/variance`, anomaly_score, coil_theft_service | IP-2 conditional (≤5% auto) |
| Scrap vs Rework? | QC Inspector + Operator | Defect type (dimension/surface/chemical), customer spec, cost of rework vs scrap value | `defect_reason`, batch rejection_qty/scrap_qty | — |
| Overtime authorization? | Supervisor | Order backlog, machine capacity, labor cost budget | Attendance OT tracking, workforce cost | — |
| **INVENTORY** |
| Accept incoming material? | QC Inspector | Test certificate (chemical/mech), visual inspection, heat number match, ISI/BIS cert | GRN workflow, QC checks | — |
| Initiate reconciliation? | Store Keeper | Schedule, variance alert, audit requirement | `/steel/inventory/reconciliations` | IP-2 (approve) |
| Approve reconciliation variance? | Manager (≠ counter) | Variance %, mismatch cause, confidence status, value impact | Reconciliation detail, confidence logic | IP-2 |
| Set reorder point? | System (Cron) / Manager override | 90-day avg consumption × lead_time × 1.5 safety factor | `/cron/calculate-reorder-points` | — |
| Write-off dead stock? | Inventory Manager + Finance | No transactions 90+ days, value < threshold, Owner approval if >₹1L | Dead stock report, valuation | IP-4 (Owner) |
| **SALES & DISPATCH** |
| Set customer credit limit? | Sales Manager / Finance | Payment history, financials, risk score, verification status | Customer verification, risk scoring | — |
| Approve invoice edit pre-dispatch? | Supervisor (IP-2) | Reason, amount change, customer impact | Invoice edit workflow | IP-2 |
| Approve invoice edit post-dispatch? | Manager L1 → Manager L2 (IP-3) | Reason, financial impact, audit trail | Invoice edit post-dispatch workflow | IP-3 (two-stage) |
| Void invoice? | Admin/Owner (IP-4) | Reason (return/cancel/error), stock reversal, GST impact | Invoice void workflow | IP-4 |
| Create dispatch? | Dispatch In-Charge | Invoice ready, vehicle available, weight ≤ capacity | Dispatch create workflow | IP-2 conditional (≤5MT auto) |
| Authorize gate exit? | Supervisor | Weighbridge slip match, gate pass photo verified | Dispatch status update | IP-2 (Supervisor required) |
| Confirm delivery? | Supervisor | POD photo, receiver name, customer sign-off | Dispatch status update | IP-2 (Supervisor required) |
| **FINANCE** |
| Record customer payment? | Finance (IP-2 bypass <₹50k) | Bank advice, invoice allocation, mode, reference | Payment create workflow | IP-2 conditional |
| Reallocate payment? | Finance (IP-3) | Correct invoice, customer confirmation | Payment reallocate workflow | IP-3 |
| Reverse payment? | Admin/Owner (IP-4) | Error proof, auditor trail | Payment reverse workflow | IP-4 |
| Approve vendor payment? | Finance | Bill matched (3-way), due date, cash position | Vendor bill, cash ledger | — |
| Set labor rates? | Finance/HR (workforce.cost.manage) | Market rate, skill grade, overtime policy | WorkforceCostRate table | — |
| **ADMIN & SECURITY** |
| Assign user role? | Admin/Owner (IP-4) | Business need, segregation of duties | User role assign workflow | IP-4 |
| Create factory? | Admin (IP-2) | Business expansion, industry type | Factory create workflow | IP-2 |
| Downgrade plan? | Owner only (IP-5) | Cost saving, feature usage, board approval | Billing downgrade workflow | IP-5 (dual Owner) |
| **QUALITY** |
| Add defect reason? | Quality Manager (factory.master_data.manage) | Defect categorization, Pareto analysis | DefectReason master | — |
| Approve OCR verification? | Supervisor (IP-2) | Confidence score, field accuracy, domain rules | OCR verification workflow | IP-2 |

---

# PART 10: DATABASE OWNERSHIP

**Every critical field has exactly ONE owner — the system/actor that can write it. All others read-only.**

| Table | Field | Owner (Writer) | Readers | Enforcement |
|-------|-------|----------------|---------|-------------|
| `steel_inventory_items` | `current_rate_per_kg` | Finance (manual) / System (purchase rate update) | All | UI: Manager+ edit only |
| `steel_inventory_items` | `reorder_point_kg` | System (Cron) / Manager (override) | Purchase, Stores | Cron job writes; UI editable by Manager+ |
| `steel_inventory_items` | `safety_stock_kg` | System (Cron) / Manager | Stores | Cron job writes |
| `steel_inventory_transactions` | `quantity_kg` | **Immutable after insert** — System (auto-post) / Store Keeper (manual adj) | All | No UPDATE allowed; corrections via new `adjustment` txn |
| `steel_inventory_transactions` | `reference_type`, `reference_id` | System (callback) / Creator (manual) | Audit, Traceability | Set at insert only |
| `steel_production_batches` | `actual_output_kg` | Operator (create) | Planning, QC, Finance, Inventory | Immutable after variance approval |
| `steel_production_batches` | `variance_value_inr` | System (calculated from rates) | Finance, Owner | Calculated field, not directly editable |
| `steel_production_batches` | `severity` | System (auto from variance%) | All | Derived, not editable |
| `steel_production_batches` | `heat_number` | Operator (create) | QC, Traceability, Dispatch | Required for finished goods; immutable |
| `steel_dispatches` | `gate_pass_number` | System (auto-generated) | Security, Customer, Finance | Unique, immutable |
| `steel_dispatches` | `status` | Dispatch In-Charge (loaded), Supervisor (exited/delivered), Any (cancelled) | All | State machine enforced in API |
| `steel_dispatches` | `inventory_posted_at` | **System only** (callback on first exit/delivered) | Finance, Audit | Idempotent guard: FOR UPDATE + null check |
| `steel_dispatches` | `delivered_at`, `delivered_by_user_id` | Supervisor (on delivered) | Customer, Finance | Only on `exited`→`delivered` or `dispatched`→`delivered` |
| `steel_sales_invoices` | `status` (unpaid/partial/paid) | **System only** (payment allocation callback) | Sales, Finance | Auto-updated; no direct edit |
| `steel_sales_invoices` | `total_amount`, `taxable_amount`, `gst_total` | System (calculated from lines) | All | Recalculated on line change |
| `steel_customers` | `verification_status` | System (auto-eval) / Admin (review) | Sales, Finance | Auto-eval on create/update; Admin overrides |
| `steel_customers` | `credit_limit` | Sales Manager / Finance | Sales, Dispatch | Manager+ edit only |
| `steel_customers` | `risk_score`, `risk_level` | System (recalculated on payment/invoice) | Sales, Finance | Derived, read-only |
| `steel_customer_payments` | `amount` | Finance (create) | Customer, Sales | Immutable after allocation |
| `steel_customer_payment_allocations` | `allocated_amount` | Finance (create/reallocate) | Invoice status, Customer | Reallocate = IP-3; Reverse = IP-4 |
| `attendance_records` | `punch_in_at`, `punch_out_at` | Employee (self) / Supervisor (force-close) | Payroll, Workforce | Self-service; Supervisor override logged |
| `attendance_records` | `worked_minutes`, `late_minutes`, `overtime_minutes` | **System only** (calculated on punch/approve) | Payroll, Workforce | Derived from timestamps + shift template |
| `attendance_records` | `review_status` | Supervisor (approve/reject) | Payroll, Employee | `auto` → `reviewed` → `approved`/`rejected` |
| `approval_instances` | `status`, `approval_stage` | **Approval Service only** | Requester, Approver, Audit | State machine; no direct writes |
| `approval_instances` | `l1_approved_by_user_id`, `approved_by_user_id` | Approval Service (on advance) | Audit | Different user enforced for L1≠L2 |
| `ocr_verification` | `extracted_data` | OCR Pipeline (initial) / Verifier (edits) | Downstream callbacks | Verifier edits tracked; approval locks |
| `steel_stock_reconciliations` | `physical_qty_kg` | Store Keeper (count) | Manager, Finance | Set at submit; immutable |
| `steel_stock_reconciliations` | `system_qty_kg` | **System only** (snapshot at submit) | All | Auto-captured |
| `steel_stock_reconciliations` | `status` | Manager (approve/reject) | Store Keeper, Finance | `pending` → `approved`/`rejected` |
| `steel_machines` | `operating_runtime_minutes` | System (downtime event completion) | Maintenance, OEE | Derived from downtime events |
| `workforce_cost_rates` | `regular_hourly_rate_inr` | Finance/HR | Workforce costing | Admin/Manager edit |
| `audit_logs` | *all fields* | **System only** (auto on sensitive actions) | Admin, Auditor, Owner | Immutable, append-only |
| `notifications` | `is_read`, `read_at` | Recipient (user) | User | Self only |
| `ops_alert_events` | `acknowledged`, `acknowledged_by`, `acknowledged_at` | Recipient (Admin/Manager) | Owner, Audit | Self only |

**Key Principle:** *Derived/calculated fields are owned by the System (service layer). Transactional fields are owned by the initiating Actor. Approval-gated fields are owned by the Approver. No field has multiple writers.*

---

# PART 11: CROSS-DEPARTMENT DEPENDENCIES

**Business operational dependencies (not software).**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    PURCHASE     │────▶│     STORES      │────▶│   PRODUCTION    │
│  (Vendor Bills) │     │  (GRN, Stock)   │     │  (Material Issue)│
└─────────────────┘     └─────────────────┘     └────────┬────────┘
        │                        │                        │
        │                        │                        ▼
        │                        │              ┌─────────────────┐
        │                        │              │      QC         │
        │                        │              │ (Inspect, Pass) │
        │                        │              └────────┬────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    FINANCE      │◀───│   DISPATCH      │◀───│  PRODUCTION     │
│  (AP Payment)   │     │ (Gate Pass,     │     │ (Batch Done,    │
│                 │     │  Weighbridge)   │     │  Stock Update)  │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │    CUSTOMER     │
         │              │  (Delivery,     │
         │              │   Payment)      │
         │              └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│           FINANCE (AR/AP)               │
│  (Payment Collection, GST, P&L)         │
└─────────────────────────────────────────┘
```

### Detailed Dependency Matrix

| From Department | To Department | Dependency | Trigger | Frequency | Failure Impact |
|-----------------|---------------|------------|---------|-----------|----------------|
| Purchase | Stores | GRN → Inventory Inward | Material arrival | Daily | Stock not updated, AP mismatch |
| Stores | Production | Material Issue → Production | Batch start | Per batch | Line stop, schedule delay |
| Production | Stores | Batch Completion → Stock Inward | Batch recorded + variance approved | Per batch | Finished goods not in stock, dispatch blocked |
| Production | QC | Batch Rejection/Scrap → NCR | QC sampling fail | Per batch | Quality issues undiscovered, customer complaints |
| QC | Stores | Rejected Material → Quarantine/Return | QC decision | Per rejection | Mixed stock, dispatch risk |
| Production | Dispatch | Finished Goods Ready → Dispatch Plan | Batch closed + invoice created | Daily | Dispatch delay, OTIF miss |
| Dispatch | Stores | Gate Exit → Stock Outward | Dispatch exited | Per dispatch | Stock inflated, double-sell risk |
| Dispatch | Finance | POD → Revenue Recognition | Delivery confirmed | Per dispatch | Revenue deferred, cash flow gap |
| Sales | Finance | Invoice → Receivable | Invoice created | Per order | AR aging wrong, credit limit wrong |
| Finance | Sales | Payment → Credit Release | Payment allocated | Per payment | Customer blocked incorrectly |
| Finance | Purchase | Vendor Payment → Vendor Relation | Bill due | Per bill | Supply disruption, credit terms lost |
| Attendance | Production | Manpower Present → Shift Target | Shift start | Per shift | Target unrealistic, efficiency skewed |
| Attendance | Finance | Worked Hours → Labor Cost | Payroll period | Monthly | Costing wrong, P&L wrong |
| Maintenance | Production | Machine Down → Schedule Adjust | Breakdown logged | Real-time | Unplanned downtime, OEE drop |
| Planning | All | Schedule → Resource Allocation | Daily/Weekly | Daily | Chaos, conflicts, overtime |

---

# PART 12: FACTORY TIMELINES

**Chronological event sequences for key entities.**

---

## 12.1 Material Timeline (Single Heat of Billets)

```
Day -7  : Purchase Order issued to Vendor (SteelVendorBill created)
Day -1  : Vendor dispatches, ASN received (planned)
Day 0   : 06:00 Vehicle arrives at gate → Security entry log
Day 0   : 06:15 Weighbridge gross weight recorded
Day 0   : 06:30 Unloading to Raw Material Yard Bay RM-12
Day 0   : 07:00 QC Incoming Inspection (visual, test cert verify)
Day 0   : 08:00 GRN Posted → SteelInventoryTransaction (inward, +50,000 kg)
Day 0   : 08:30 Heat Number H-20260723-001 recorded in item master
Day 1   : 06:00 Planning assigns Heat H-20260723-001 to TMT Line for Grade Fe500D 16mm
Day 1   : 06:30 Store Keeper issues 48,000 kg to Line (production_issue txn)
Day 1   : 07:00-15:00 Morning Shift: Rolling, 3 batches recorded
        Batch B-001: Input 16,000 kg → Output 15,520 kg (Loss 3%, Variance -1.2%)
        Batch B-002: Input 16,000 kg → Output 15,480 kg (Loss 3.25%, Variance -1.5%)
        Batch B-003: Input 16,000 kg → Output 15,600 kg (Loss 2.5%, Variance +0.8%)
Day 1   : 15:30 Variance approvals (B-001, B-002 auto; B-003 approved)
Day 1   : 15:31 Inventory Transactions posted (production_output, +46,600 kg total)
Day 2   : 06:00 Yard storage: Coils stacked in FG Yard Bay FG-07
Day 3   : 10:00 Sales Invoice SINV-001 created for Customer CUST-0045 (20,000 kg from B-001, B-002)
Day 3   : 14:00 Dispatch SDISP-001 created, Gate Pass GP-20260723-001, QR generated
Day 3   : 16:00 Vehicle loaded, gate pass photo uploaded → status LOADED
Day 3   : 17:30 Weighbridge exit, slip photo → status EXITED → dispatch_out txns posted (-20,000 kg)
Day 4   : 10:00 Customer receives, POD signed → status DELIVERED
Day 5   : 11:00 Customer payment received → Payment allocated to SINV-001 → status PAID
Day 30  : Month-end: GST Return filed, Costing run, P&L generated
```

---

## 12.2 Customer Order Timeline

```
T-30d : Inquiry received → Quotation sent
T-14d : Customer PO received → Credit check (verified, limit OK)
T-10d : Sales Order confirmed → Invoice SINV-001 created (unpaid)
T-7d  : Production scheduled → Batches recorded
T-3d  : Batches variance approved → Stock available
T-2d  : Dispatch planned → Vehicle assigned
T-1d  : Gate pass generated, QR shared with transporter
T-0   : Dispatch created (pending) → Loaded → Exited (stock relieved)
T+1d  : Delivered → POD collected
T+15d : Payment due date
T+14d : Payment received → Allocated → Invoice PAID
T+30d : GST Return includes this invoice
```

---

## 12.3 Production Batch Timeline (Single Batch)

```
T-0h  : Operator starts batch recording (input weighed, heat# noted)
T-0h  : Batch created in system (status=recorded, severity calculated)
T+0h  : Rolling begins → Machine downtime events logged real-time
T+2h  : QC sampling #1 → Dimensions OK
T+4h  : Rolling complete → Output weighed, coils counted
T+4h  : Batch updated: actual_output, loss%, variance%, severity
T+4h  : If variance ≤5% → Auto-approved → production_output txn posted
T+4h  : If variance >5% → Manager reviews → Approve/Reject
T+5h  : On approval → production_output txn posted → Stock updated
T+6h  : Coils moved to yard → Location recorded
T+24h : Reconciliation (if scheduled) → Confidence GREEN
T+7d  : Dispatch from this batch → dispatch_out txns
T+30d : Costing finalization → variance_value_inr locked
```

---

## 12.4 Vehicle/Dispatch Timeline

```
T-2h  : Dispatch created, gate pass QR sent to driver WhatsApp
T-1h  : Vehicle arrives at Loading Bay
T-0h  : Security scans QR → Verifies truck/driver match
T+0h  : Loading begins → Gate pass photo uploaded → status LOADED
T+1h  : Loading complete → Vehicle to Weighbridge
T+1.5h: Weighbridge exit weight → Slip photo → Supervisor approves → status EXITED
T+1.5h: System posts dispatch_out transactions (inventory relieved)
T+2h  : Vehicle departs factory → In transit
T+4h  : Vehicle arrives at customer → Unloading
T+5h  : Customer signs POD → Driver uploads photo → Supervisor confirms → status DELIVERED
T+5h  : Dispatch fully closed → Invoice status auto-update if fully dispatched
```

---

## 12.5 Employee Shift Timeline

```
05:50 : Employee arrives → Opens app → Punch In (shift=morning)
05:55 : System records punch_in_at, calculates late_minutes (0)
06:00 : Shift starts → Operator begins DPR entry
10:00 : Mid-shift → Operator logs downtime event (machine breakdown)
13:50 : Shift ending → Operator completes DPR entry → Submits
14:00 : Punch Out → System records punch_out_at, calculates worked=480min, OT=0
14:05 : Supervisor reviews attendance → Approves → review_status=approved
14:10 : If missed punch-out → Auto-close cron at 16:00 marks missed_punch
Next Day: Employee submits regularization → Supervisor approves → Corrected
```

---

## 12.6 Machine Timeline

```
06:00 : Shift start → Machine planned_runtime = 480 min
08:00 : Breakdown → Downtime event started (category=breakdown)
09:30 : Repair complete → Downtime event ended (duration=90 min)
10:00 : Changeover → Downtime event (category=changeover, 30 min)
14:00 : Shift end → operating_runtime = 480 - 90 - 30 = 360 min
        OEE Availability = 360/480 = 75%
        Performance = (actual output / ideal rate) / operating_time
        Quality = (good output / total output)
        OEE = Availability × Performance × Quality
Next Day: Maintenance reviews → Creates preventive task for same machine
```

---

## 12.7 Invoice/Payment Timeline

```
Day 0    : Invoice SINV-001 created (unpaid, total ₹50L)
Day 1    : Dispatch SDISP-001 for 50% → Invoice still unpaid
Day 3    : Dispatch SDISP-002 for 50% → Invoice still unpaid
Day 15   : Customer pays ₹30L → Payment allocated → Invoice PARTIAL
Day 20   : Customer pays ₹20L → Payment allocated → Invoice PAID
Day 30   : GST Return includes SINV-001
Day 45   : Receivables aging shows 0 days overdue
```

---

# PART 13: CURRENT FACTORYNERVE MAPPING

**Analysis of current implementation vs business requirements.**

---

## 13.1 Module-to-Workflow Mapping

| Current Module | Business Workflow Covered | Business Objects | Owner | Problems | Missing Logic | Duplicate Logic | Disconnected Logic | Improvement Opportunities |
|----------------|---------------------------|------------------|-------|----------|---------------|-----------------|-------------------|---------------------------|
| **entries** (DPR) | Shift production recording, approval | Entry, DefectReason | Operator → Supervisor | No machine auto-link, no material consumption link | Auto-populate from batch/machine | — | Entry↔Batch disconnected | Link Entry to Batch + Machine; auto-calc from PLC |
| **steel** (batches) | Steel production recording, variance | SteelProductionBatch, SteelMachine, SteelProductionLine | Operator → Manager | Coil theft detection separate, no SPC | Statistical process control (SPC) | Variance calc in service + router | Batch↔Entry disconnected | Unified production record (Entry + Batch) |
| **steel** (inventory) | Stock ledger, reconciliation, reorder | SteelInventoryItem, SteelInventoryTransaction, SteelStockReconciliation | Store Keeper → Manager | No barcode/RFID, no bin location, no multi-warehouse | Bin/location tracking, putaway optimization | Stock balance calc in service + router | Reconciliation↔Transaction tight | Mobile cycle count, RFID integration |
| **steel** (dispatch) | Gate pass, vehicle, delivery, inventory relief | SteelDispatch, SteelDispatchLine | Dispatch → Supervisor | No transporter portal, no route optimization | Transporter self-service, GPS tracking | Status machine in router + service | Dispatch↔Invoice tight but rigid | Multi-drop dispatch, return handling |
| **steel** (customers) | Customer master, verification, follow-up | SteelCustomer, SteelCustomerFollowUpTask, SteelCustomerPayment | Sales → Finance | No CRM pipeline, no quote management | Quote→Order→Invoice flow | Verification logic in router + service | Customer↔Invoice↔Payment↔Dispatch chain | Full CRM module, customer portal |
| **steel_finance** | AP/AR, cash, expenses, costing | SteelVendorBill, SteelVendorPayment, SteelExpense, SteelCashLedger | Finance | No bank integration, no TDS auto, no budget vs actual | Bank reconciliation, budgeting, TDS | Costing in steel_service + steel_finance | Finance↔Dispatch↔Inventory linked via callbacks | ERP-grade finance, multi-currency |
| **attendance** | Punch, review, regularization, workforce | AttendanceRecord, AttendanceRegularization, ShiftTemplate, EmployeeProfile | Employee → Supervisor | No biometric integration, no geo-fence | Biometric/geo-fence, shift swap | Live view + report duplicate queries | Attendance↔Workforce cost tight | Mobile app, facial recognition |
| **workforce_intelligence** | Labor cost, productivity, shift comparison | Derived from Attendance + Entry + WorkforceCostRate | Manager → Owner | No skill matrix, no training tracking | Skill matrix, training, succession planning | Cost calc in service + router | Workforce↔Attendance↔Entry linked | HRIS integration |
| **ocr** | Document extraction, verification | OCRVerification | Operator → Supervisor | No mobile capture, limited doc types | Mobile capture, more templates (PO, LC) | Pipeline stages duplicated across services | OCR→Downstream (invoice/batch) via callbacks | AI-powered classification, auto-routing |
| **ai** | Suggestions, anomalies, NLQ, exec summary | Entry, Batch, Invoice, Dispatch, Attendance | All (role-gated) | No feedback loop, no model versioning | RLHF feedback, A/B testing, custom models | Anomaly detection in ai + steel_intelligence | AI↔All modules via service calls | Continuous learning, explainable AI |
| **approvals** | Maker-checker engine | ApprovalInstance | All (via service) | No delegation, no parallel IP-4, no SLA dashboard | Delegation, parallel approval, SLA dashboard | Pattern logic in service + catalog | Approvals↔All workflows via initiation | Visual workflow designer, audit UI |
| **analytics** | Weekly/monthly/trends/manager | Entry, Attendance | Manager → Owner | No ad-hoc builder, no export scheduling | Ad-hoc report builder, scheduled exports | Aggregation logic duplicated | Analytics↔Entry↔Attendance | Self-service BI, embedded analytics |
| **reports** | PDF/Excel export, weekly/monthly | Entry, Batch, Invoice, Dispatch | All | Template hardcoded, no customization | Template designer, multi-format | PDF generation in reports + steel router | Reports↔All modules | Report marketplace, white-label |
| **billing** | Plan, subscription, Razorpay | Invoice, Subscription, PaymentOrder | Owner → Platform | No usage-based billing, no trial automation | Usage-based, trial automation, dunning | Quota check in plans + feature_limits | Billing↔All features via plan gates | Marketplace, partner billing |

---

## 13.2 Critical Problems Identified

| # | Problem | Severity | Root Cause | Affected Modules |
|---|---------|----------|------------|------------------|
| 1 | **No bin/location tracking in inventory** | HIGH | SteelInventoryItem has no location field; yard management manual | Inventory, Dispatch, Reconciliation |
| 2 | **Entry and Batch are disconnected** | HIGH | General DPR (Entry) vs Steel Batch separate; no auto-link | Production, Analytics, QC |
| 3 | **No transporter/driver mobile app** | MEDIUM | Gate pass QR only; no POD upload, no tracking | Dispatch, Customer |
| 4 | **No biometric/geo-fence attendance** | MEDIUM | Self-service punch only; buddy punch risk | Attendance, Payroll |
| 5 | **Invoice edit post-dispatch requires IP-3 but no UI distinction** | MEDIUM | Same endpoint different workflow; confusion | Sales, Finance |
| 6 | **Coil theft detection is separate service not integrated in batch flow** | MEDIUM | coil_theft_service called separately; not in batch approval | Production, Inventory |
| 7 | **No purchase order entity** | HIGH | Vendor bill created directly; no 3-way match (PO-GRN-Bill) | Purchase, Finance, Stores |
| 8 | **No quality inspection workflow (incoming/in-process/final)** | HIGH | QC fields only in Entry/Batch; no standalone inspection | Quality, Stores, Production |
| 9 | **No budget vs actual for finance** | MEDIUM | Expenses recorded but no budget comparison | Finance |
| 10 | **No multi-warehouse / inter-factory transfer** | MEDIUM | Single factory inventory; no transfer logic | Inventory, Multi-factory orgs |
| 11 | **AI has no feedback loop for model improvement** | LOW | Anomalies/suggestions generated but no user feedback captured | AI, All |
| 12 | **Approval engine has no delegation or escalation UI** | MEDIUM | TTL auto-escalate only; no manual delegation | Approvals, All |
| 13 | **No document versioning for invoices/dispatches** | MEDIUM | Edit overwrites; audit log only | Sales, Dispatch, Finance |
| 14 | **Shift template cross-midnight handling complex and buggy** | MEDIUM | Night shift punch logic searches previous day; edge cases | Attendance |
| 15 | **No customer self-service portal** | LOW | All customer interaction via email/WhatsApp | Sales, Finance, Dispatch |

---

## 13.3 Missing Business Logic (Not Implemented)

| Business Requirement | Current State | Gap |
|---------------------|---------------|-----|
| Purchase Order → GRN → Bill 3-way match | Direct Vendor Bill | No PO entity, no match logic |
| Bin/Location management | None | Yard bay, rack, stack tracking |
| Inter-factory stock transfer | None | Multi-factory orgs need transfer orders |
| Customer credit hold auto-release on payment | Manual | Auto-release when outstanding < limit |
| Dispatch return / rejection handling | Cancel only | Return to stock, quality check, credit note |
| Batch genealogy (parent→child for re-roll) | Heat number only | Full genealogy tree |
| Machine preventive maintenance scheduling | Manual tasks only | Calendar-based PM, spare parts BOM |
| Labor skill matrix & certification tracking | None | Operator skills, training expiry |
| GST E-invoice / IRN generation | Manual | Auto-generate IRN on invoice approval |
| TDS auto-deduction on vendor payment | Manual | Calculate, deduct, deposit, Form 16A |
| Bank reconciliation | Manual | Auto-match cash ledger to bank statement |
| Budget vs Actual (capex/opex) | None | Annual budget, monthly variance |
| Sales forecast → Production plan | Manual | Demand planning integration |
| Vendor performance scorecard | None | OTIF, quality, lead time tracking |
| Customer 360° view | Fragmented | Unified timeline: orders, invoices, dispatches, payments, complaints |

---

# PART 14: GAP ANALYSIS

---

## 14.1 Missing Workflows

| Workflow | Business Need | Current Workaround | Priority |
|----------|---------------|-------------------|----------|
| Purchase Order Creation & Approval | Commit spend before vendor ships | Email/verbal PO | HIGH |
| 3-Way Match (PO-GRN-Bill) | Prevent overbilling, qty mismatch | Manual in Finance | HIGH |
| Incoming Quality Inspection Workflow | Formal accept/reject at gate | Paper QC report | HIGH |
| In-Process Quality Sampling Plan | Statistical sampling per heat/lot | Ad-hoc in DPR | MEDIUM |
| Final Inspection & Test Certificate Generation | Customer requirement, BIS compliance | Manual cert creation | HIGH |
| Non-Conformance Report (NCR) + CAPA | Root cause, preventive action | Follow-up tasks (inadequate) | HIGH |
| Inter-Factory Stock Transfer | Multi-plant optimization | Manual adjust + communicate | MEDIUM |
| Dispatch Return / Customer Rejection | Handle returns, quality issues | Cancel dispatch (loses history) | HIGH |
| Customer Credit Hold Auto-Management | Real-time credit control | Manual status change | MEDIUM |
| Vendor Portal (PO acknowledgment, invoice upload, payment status) | Reduce AP workload | Email | MEDIUM |
| Customer Portal (order status, invoices, POD, payments) | Self-service, reduce queries | Email/WhatsApp | MEDIUM |
| Mobile App for Operators (DPR, Batch, Punch, QC) | Shop floor digitization | Web on mobile browser | HIGH |
| Mobile App for Supervisors (Approvals, Live View) | Management on the go | Web | MEDIUM |
| Mobile App for Drivers (Gate Pass, POD Upload) | Dispatch visibility | Paper/WhatsApp | HIGH |
| Preventive Maintenance Scheduler | Reduce breakdowns | Reactive only | MEDIUM |
| Spare Parts Inventory & Reorder | Maintenance readiness | Ad-hoc purchase | MEDIUM |
| Skill Matrix & Training Compliance | Workforce qualification | None | LOW |
| Sales Forecast → Production Plan | Demand-driven production | Manual planning | MEDIUM |
| Finite Scheduling (Capacity constrained) | Optimize line utilization | Infinite capacity assumption | LOW |
| Budget vs Actual (Project/Department) | Financial control | None | MEDIUM |
| Bank Reconciliation Automation | Reduce finance manual work | Manual | MEDIUM |
| GST E-Invoice / IRN Auto-Generation | Compliance | Manual | HIGH (India) |
| TDS Auto-Calculation & Filing | Compliance | Manual | HIGH (India) |
| Document Versioning (Invoice, Dispatch, PO) | Audit trail, dispute resolution | Audit log only | MEDIUM |

---

## 14.2 Missing Entities

| Entity | Purpose | Dependencies |
|--------|---------|--------------|
| `PurchaseOrder` | Commitment to vendor before shipment | Vendor, InventoryItem, Approval |
| `PurchaseOrderLine` | PO line details | PO, Item, Qty, Rate, Delivery Date |
| `GoodsReceiptNote` | Formal receipt document (separate from transaction) | PO, Inward Transaction, QC |
| `QualityInspection` | Incoming/In-process/Final inspection record | GRN, Batch, Spec, Result |
| `NonConformanceReport` | Defect investigation, root cause, CAPA | Inspection, Batch, Customer Complaint |
| `CorrectiveAction` | CAPA tracking | NCR, Owner, Due Date, Effectiveness |
| `StockTransfer` | Inter-factory/warehouse transfer | Source/Dest Factory, Items, Approval |
| `DispatchReturn` | Customer return handling | Dispatch, Reason, Disposition |
| `CreditNote` | Financial adjustment for returns | Invoice, Return, Approval |
| `BankAccount` / `BankStatement` | Bank reconciliation | CashAccount, Transactions |
| `Budget` / `BudgetLine` | Annual/monthly budget vs actual | Department, Project, Account |
| `Skill` / `EmployeeSkill` | Operator qualification matrix | EmployeeProfile, Training |
| `TrainingRecord` | Training completion, expiry | Employee, Skill, Trainer |
| `MachineSparePart` | Spare parts BOM for machines | Machine, Vendor, Reorder Point |
| `MaintenanceSchedule` | Preventive maintenance calendar | Machine, Task, Frequency, Assignee |
| `SalesQuotation` | Pre-order pricing negotiation | Customer, Items, Validity, Approval |
| `SalesOrder` | Confirmed order before invoice | Quotation, Customer, Credit Check |
| `CustomerComplaint` | Post-delivery quality issue | Customer, Dispatch, Batch, NCR link |
| `DocumentVersion` | Versioned documents (invoice, dispatch, PO) | Base Document, Version, Editor, Timestamp |

---

## 14.3 Missing Events

| Event | Should Be Emitted By | Consumers |
|-------|---------------------|-----------|
| `PURCHASE_ORDER_CREATED` | Purchase module | Vendor portal, Finance (commitment), Stores (expected) |
| `PO_ACKNOWLEDGED_BY_VENDOR` | Vendor portal | Purchase (lead time confirm) |
| `GRN_QC_STARTED` | QC at gate | Purchase (tracking), Stores (hold) |
| `GRN_QC_COMPLETED` | QC | Stores (release/quarantine), Purchase (vendor score) |
| `THREE_WAY_MATCH_PASSED` / `FAILED` | Finance (auto) | Purchase (pay/hold), Vendor (payment date) |
| `STOCK_TRANSFER_INITIATED` | Stores | Dest factory (prepare), Finance (valuation) |
| `STOCK_TRANSFER_RECEIVED` | Dest Stores | Source factory (close), Finance |
| `DISPATCH_RETURN_RECEIVED` | Stores | Sales (credit note), QC (inspect), Finance |
| `CUSTOMER_CREDIT_HOLD_TRIGGERED` | System (auto) | Sales (block), Dispatch (hold), Finance |
| `CUSTOMER_CREDIT_HOLD_RELEASED` | System (auto on payment) | Sales, Dispatch, Finance |
| `MACHINE_PM_DUE` | Maintenance scheduler | Maintenance, Production (plan downtime) |
| `MACHINE_BREAKDOWN` | Operator/SCADA | Maintenance (urgent), Production (reschedule) |
| `OPERATOR_SKILL_EXPIRY` | HR scheduler | Production (assign qualified), HR |
| `BUDGET_VARIANCE_EXCEEDED` | Finance (monthly) | Dept Head, Owner |
| `GST_IRN_GENERATED` | Invoice approval | Finance (compliance), Customer |
| `TDS_DEDUCTED` | Vendor payment | Finance (deposit), Vendor (Form 16A) |

---

## 14.4 Missing Approvals

| Workflow | Current | Needed | Pattern |
|----------|---------|--------|---------|
| Purchase Order Approval | None | Commitment control | IP-2 (Manager), IP-3 (>₹10L) |
| GRN Quantity Variance Approval | None | Qty > PO +2% | IP-2 |
| Quality Inspection Override (accept despite fail) | None | Risk acceptance | IP-3 (Quality + Production) |
| Inter-Factory Transfer | None | Asset movement | IP-2 (both factory managers) |
| Dispatch Return Acceptance | None | Quality + Commercial | IP-2 |
| Credit Note Issuance | None | Financial impact | IP-2 (Finance), IP-3 (>₹50k) |
| Budget Reallocation | None | Financial control | IP-3 (Dept Head + Finance) |
| Machine PM Schedule Change | None | Production impact | IP-2 |
| Operator Skill Waiver | None | Safety/Quality risk | IP-3 (Production + Quality) |
| Vendor Bank Account Change | None | Fraud prevention | IP-4 (Finance + Owner) |

---

## 14.5 Missing Audit Trails

| Area | Current Gap |
|------|-------------|
| Invoice line-level changes | Only header audit; line edits not individually tracked |
| Dispatch line weight changes | Not audited |
| Customer credit limit changes | Audited but no before/after values in detail |
| Reorder point manual override | Not separately audited (only item update) |
| Machine parameter changes (rated capacity) | Not audited |
| Shift template changes | Not audited |
| Approval workflow config changes | Not audited |
| AI model version / prompt changes | Not audited |
| Data export / bulk download | Not tracked |

---

## 14.6 Missing Reports

| Report | Business Need |
|--------|---------------|
| Purchase Order Aging (open POs) | Procurement tracking |
| GRN vs PO Variance Report | Receiving accuracy |
| Vendor Performance Scorecard | Vendor management |
| Quality Inspection Summary (incoming/in-process/final) | Quality KPIs |
| NCR / CAPA Tracker | Quality improvement |
| Stock Aging (by heat/batch) | Dead stock identification |
| Inter-Factory Transfer Register | Multi-plant reconciliation |
| Dispatch Return Analysis | Customer quality feedback |
| Customer Complaint Trend | Product quality |
| Machine PM Compliance | Maintenance effectiveness |
| Spare Parts Consumption | Inventory optimization |
| Labor Skill Gap Analysis | Training planning |
| Budget vs Actual (Monthly/Quarterly) | Financial control |
| Cash Flow Forecast (Rolling 13-week) | Treasury |
| GST Reconciliation (GSTR-1 vs Books) | Compliance |
| TDS Reconciliation | Compliance |
| Bank Reconciliation Statement | Audit |
| Document Version History | Dispute resolution |

---

## 14.7 Missing Dashboards

| Dashboard | Audience | Key Widgets |
|-----------|----------|-------------|
| Procurement Dashboard | Purchase Manager | PO aging, GRN pending, vendor scorecards, 3-way match status |
| Quality Dashboard | Quality Manager | Inspection pass/fail, NCR open, CAPA overdue, PPM trends |
| Maintenance Dashboard | Maintenance Manager | PM compliance, MTTR/MTBF, breakdown Pareto, spare stock |
| Dispatch/Logistics Dashboard | Dispatch Manager | Vehicle utilization, gate queue, POD pending, OTIF |
| Customer 360 Dashboard | Sales Manager | Orders, invoices, payments, complaints, credit, visits |
| Vendor 360 Dashboard | Purchase Manager | POs, bills, payments, performance, disputes |
| Financial Control Dashboard | CFO/Finance Head | Cash position, AR/AP aging, budget variance, GST/TDS status |
| Owner/CEO Dashboard | Owner | P&L, cash, top risks, anomalies, strategic KPIs |

---

## 14.8 Missing Automation

| Process | Current | Automated Target |
|---------|---------|------------------|
| Reorder point calculation | Daily cron (✓) | ✓ Already done |
| Safety stock calculation | Daily cron (✓) | ✓ Already done |
| Invoice status from payments | Callback (✓) | ✓ Already done |
| Dispatch inventory relief | Callback (✓) | ✓ Already done |
| Attendance auto-close | Cron (✓) | ✓ Already done |
| Approval expiry/escalation | Cron (✓) | ✓ Already done |
| **Purchase Order → GRN matching** | Manual | Auto-match on GRN |
| **3-way match (PO-GRN-Bill)** | Manual | Auto on bill receipt |
| **Customer credit hold/release** | Manual | Auto on payment/invoice |
| **GST IRN generation** | Manual | Auto on invoice approval |
| **TDS calculation** | Manual | Auto on vendor payment |
| **Bank reconciliation** | Manual | Auto-match rules |
| **Dispatch return → Credit note** | Manual | Auto on return receipt |
| **Machine PM scheduling** | Manual | Calendar-based auto-create |
| **Operator shift assignment** | Manual | Skill-based auto-assign |
| **Sales forecast → Production plan** | Manual | ML-based suggestion |
| **Anomaly → Alert → Ticket** | Partial | Full workflow |
| **Document classification (OCR)** | Partial | Auto-route by type |

---

## 14.9 Missing AI Opportunities

| Opportunity | Description | Data Source | Value |
|-------------|-------------|-------------|-------|
| **Demand Forecasting** | Predict customer orders per grade/size | Sales history, seasonality, macro | Production planning accuracy |
| **Predictive Maintenance** | Predict machine failure before breakdown | Downtime events, vibration (IoT), age | Reduce unplanned downtime 30% |
| **Optimal Batch Sizing** | Minimize changeover + maximize yield | Batch history, setup times, order book | Reduce changeover time 20% |
| **Dynamic Reorder Points** | ML-based considering lead time variability | PO history, vendor performance, seasonality | Reduce stockouts + inventory |
| **Coil Theft Pattern Detection** | Identify systematic theft vs random loss | Batch coil weight variance, operator, shift | Loss prevention |
| **Customer Churn Prediction** | Identify at-risk customers | Order frequency, payment behavior, complaints | Retention revenue |
| **Vendor Risk Scoring** | Predict delivery/quality issues | PO history, GRN variance, financial health | Supply chain resilience |
| **Cash Flow Forecasting** | 13-week rolling forecast | AR/AP, recurring, seasonality | Treasury optimization |
| **Energy Consumption Optimization** | Correlate production with energy data | Machine power meters, batches | Cost reduction 5-10% |
| **Quality Predictive Alerts** | Predict rejection before it happens | In-process parameters, machine state | First-pass yield improvement |
| **Natural Language Report Generation** | "Give me last month's scrap by machine" | All modules | Self-service analytics |
| **Automated Root Cause Analysis** | "Why was profit low?" → structured drill-down | Multi-domain fusion | Faster decision making |

---

## 14.10 Missing Integrations

| Integration | Purpose | Priority |
|-------------|---------|----------|
| **Weighbridge PLC/SCADA** | Auto-capture gross/tare/net weights | HIGH |
| **Machine PLC/SCADA (OPC-UA/MTConnect)** | Real-time production, downtime, quality | HIGH |
| **Biometric/Access Control** | Attendance punch verification | HIGH |
| **Bank API (ICICI/HDFC/Axis)** | Auto bank reconciliation, payment initiation | HIGH |
| **GST Suvidha Provider (GSP)** | E-invoice IRN, GSTR filing | HIGH (India) |
| **TDS/TCS Portal (TRACES)** | Auto TDS deposit, Form 16A | HIGH (India) |
| **E-Way Bill Portal** | Auto generate e-way bill on dispatch | HIGH (India) |
| **Transporter TMS** | Vehicle tracking, POD digital | MEDIUM |
| **Customer ERP/EDI** | Auto PO ingest, invoice send, ASN | MEDIUM |
| **Vendor Portal** | PO ack, invoice upload, payment status | MEDIUM |
| **IoT Sensors (Temp/Humidity/Vibration)** | Machine health, material condition | LOW |
| **Video Analytics (Gate/Yard)** | Vehicle detection, coil counting | LOW |
| **Document Management (SharePoint/S3)** | Centralized document store | MEDIUM |
| **Identity Provider (Azure AD/Okta)** | SSO, SCIM provisioning | MEDIUM |
| **Messaging (WhatsApp Business API / Twilio)** | Alerts, approvals, punch notifications | HIGH |

---

# PART 15: CENTRALIZED FACTORYNERVE ARCHITECTURE

**Ideal architecture for FactoryNerve v2 — Business Object Centric.**

---

## 15.1 Architectural Principles

1. **Business Objects First** — Every entity is a first-class citizen with defined lifecycle, ownership, and relationships. Not tables hidden behind modules.
2. **Workflow Engine as Orchestrator** — All business processes expressed as executable workflows (BPMN-like), not scattered across routers.
3. **Central Database (PostgreSQL)** — Single source of truth. No microservice databases. Schema-per-module for isolation.
4. **Event Bus (Kafka/Redis Streams)** — Every state change publishes domain event. Enables real-time analytics, AI, integrations.
5. **Role-Based Access Control (ABAC + ReBAC)** — Permissions derived from business context (factory, org, role, resource ownership).
6. **Audit by Default** — Every mutation logged with actor, context, before/after. Immutable append-only store.
7. **Notifications as First-Class** — In-app, Email, WhatsApp, Push — unified preference engine.
8. **Dashboards as Materialized Views** — Pre-computed, refreshed on events, not on-demand queries.
9. **AI as Co-Pilot, Not Black Box** — Every AI output traceable to data, explainable, feedback-capturable.
10. **Offline-First Mobile** — Local SQLite + sync engine for shop floor resilience.

---

## 15.2 Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │  Web App    │ │ Mobile App  │ │ Driver App  │ │ Partner     │            │
│  │  (React)    │ │ (Flutter)   │ │ (PWA)       │ │ Portal      │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
└─────────│───────────────│───────────────│───────────────│────────────────────┘
          │               │               │               │
          ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (GraphQL + REST)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Query API   │ │ Mutation API│ │ Subscription│ │ Webhooks    │            │
│  │ (GraphQL)   │ │ (REST)      │ │ (WebSocket) │ │ (Inbound)   │            │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW ENGINE LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    STATE MACHINE ORCHESTRATOR                        │    │
│  │  • Business Object Lifecycle Management                             │    │
│  │  • Approval Workflows (IP-2 through IP-5)                          │    │
│  │  • Cross-Object Processes (Order→Invoice→Dispatch→Payment)         │    │
│  │  • SLA/Escalation Timers                                            │    │
│  │  • Compensation/Saga for Rollbacks                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOMAIN SERVICES LAYER                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Production│ │Inventory │ │ Sales &  │ │ Finance  │ │ Workforce│          │
│  │ Service  │ │ Service  │ │ Dispatch │ │ Service  │ │ Service  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Purchase  │ │ Quality  │ │Maintenance│ │ AI/ML    │ │ Document │          │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │ Service  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT BUS (Kafka / Redis Streams)                    │
│  Topics: business-object.events, workflow.events, audit.events,             │
│          integration.events, ai.events, notification.events                 │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  READ MODELS     │  │  ANALYTICS       │  │  INTEGRATIONS    │
│  (Materialized   │  │  (ClickHouse/    │  │  (Kafka Connect, │
│   Views in PG)   │  │   Druid)         │  │   Webhooks)      │
│                  │  │                  │  │                  │
│ • Stock Balance  │  │ • OLAP Cubes     │  │ • Weighbridge    │
│ • Customer 360   │  │ • Time-Series    │  │ • Bank API       │
│ • Machine OEE    │  │ • Ad-hoc SQL     │  │ • GST/GSP        │
│ • Worker Score   │  │ • ML Features    │  │ • Transporter    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CENTRAL DATABASE (PostgreSQL)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SCHEMAS: core, production, inventory, sales, finance, workforce,   │    │
│  │           quality, maintenance, purchase, ai, audit, workflow       │    │
│  │                                                                     │    │
│  │  TABLES: Business Objects (master + transactional)                  │    │
│  │          Workflow Instances                                         │    │
│  │          Audit Log (append-only, partitioned)                       │    │
│  │          Outbox Table (for reliable event publishing)               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 15.3 Business Object Registry (Core)

| Business Object | Schema | Lifecycle States | Key Events | Ownership |
|----------------|--------|------------------|------------|-----------|
| `Organization` | `core` | Active/Suspended/Deleted | `org.created`, `org.plan_changed` | Platform |
| `Factory` | `core` | Active/Inactive | `factory.created`, `factory.settings_changed` | Admin |
| `User` | `core` | Invited/Active/Deactivated | `user.invited`, `user.activated`, `user.role_changed` | Admin |
| `EmployeeProfile` | `workforce` | Active/Inactive | `profile.created`, `profile.updated` | HR |
| `ShiftTemplate` | `workforce` | Active/Inactive | `shift.created`, `shift.updated` | HR |
| `InventoryItem` | `inventory` | Draft/Active/Inactive | `item.created`, `item.rate_changed`, `item.reorder_updated` | Inventory Mgr |
| `InventoryTransaction` | `inventory` | **Immutable** (append-only) | `txn.posted` | System |
| `StockReconciliation` | `inventory` | Pending/Approved/Rejected | `recon.submitted`, `recon.approved`, `recon.rejected` | Store Keeper → Manager |
| `ProductionBatch` | `production` | Recorded/VariancePending/Approved/Closed | `batch.recorded`, `batch.variance_approved`, `batch.closed` | Operator → Manager |
| `Machine` | `production` | Active/Maintenance/Retired | `machine.created`, `machine.downtime`, `machine.maintenance` | Maintenance |
| `MachineDowntimeEvent` | `production` | Open/Closed | `downtime.started`, `downtime.ended` | Operator |
| `SalesInvoice` | `sales` | Draft/Unpaid/Partial/Paid/Voided | `invoice.created`, `invoice.paid`, `invoice.voided` | Finance |
| `Dispatch` | `sales` | Pending/Loaded/Exited/Dispatched/Delivered/Cancelled | `dispatch.created`, `dispatch.loaded`, `dispatch.exited`, `dispatch.delivered` | Dispatch → Supervisor |
| `Customer` | `sales` | Draft/Verified/Active/OnHold/Blocked | `customer.created`, `customer.verified`, `customer.status_changed` | Sales → Admin |
| `CustomerPayment` | `finance` | Created/Allocated/Reallocated/Reversed | `payment.created`, `payment.allocated`, `payment.reversed` | Finance |
| `Vendor` | `purchase` | Active/Inactive | `vendor.created`, `vendor.updated` | Purchase |
| `PurchaseOrder` | `purchase` | Draft/Approved/PartiallyReceived/Completed/Cancelled | `po.created`, `po.approved`, `po.received`, `po.completed` | Purchase → Manager |
| `GoodsReceiptNote` | `purchase` | Draft/QC_Pending/Accepted/Rejected | `grn.created`, `grn.qc_started`, `grn.accepted` | Stores → QC |
| `QualityInspection` | `quality` | Scheduled/InProgress/Passed/Failed/NCR_Raised | `inspection.started`, `inspection.completed`, `ncr.raised` | QC |
| `NonConformanceReport` | `quality` | Open/Investigating/CAPA_Defined/CAPA_Implemented/Closed | `ncr.raised`, `ncr.capa_defined`, `ncr.closed` | Quality |
| `AttendanceRecord` | `workforce` | Open/Completed/MissedPunch/HalfDay/Absent | `attendance.punched_in`, `attendance.punched_out`, `attendance.approved` | Employee → Supervisor |
| `WorkforceCostRate` | `finance` | Active/Expired | `rate.created`, `rate.updated` | Finance |
| `ApprovalInstance` | `workflow` | PendingL1/PendingL2/Approved/Rejected/Escalated/Abandoned | `approval.initiated`, `approval.advanced`, `approval.completed` | System |
| `AuditLog` | `audit` | **Immutable** | `audit.recorded` | System |
| `Document` | `documents` | Uploaded/Processing/Verified/Archived | `doc.uploaded`, `doc.verified`, `doc.archived` | System |

---

## 15.4 Event-Driven Data Flow (Example: Dispatch → Inventory → Finance)

```
1. Dispatch Created (API)
   └─> Workflow Engine: validate, generate gate_pass, emit dispatch.created
   
2. dispatch.created (Event Bus)
   ├─> Inventory Service: reserve stock (soft allocation)
   ├─> Notification Service: send gate pass to driver (WhatsApp)
   ├─> Analytics: update dispatch pipeline dashboard
   └─> AI: update demand forecast features
   
3. Dispatch Exited (Supervisor action)
   └─> Workflow Engine: validate weighbridge, emit dispatch.exited
   
4. dispatch.exited (Event Bus)
   ├─> Inventory Service: POST inventory txns (dispatch_out) — **hard relief**
   ├─> Finance Service: update realization metrics (revenue recognized)
   ├─> Customer Service: update delivery ETA, send notification
   ├─> Analytics: update OTIF, inventory turnover
   └─> AI: anomaly detection (weight mismatch, delay)
   
5. Dispatch Delivered (Supervisor + POD)
   └─> Workflow Engine: validate POD, emit dispatch.delivered
   
6. dispatch.delivered (Event Bus)
   ├─> Finance Service: trigger invoice status check (auto-paid if fully dispatched)
   ├─> Customer Service: close follow-up tasks, update risk score
   ├─> Analytics: update DSO, delivery performance
   └─> AI: customer behavior modeling
```

---

## 15.5 API Design (GraphQL-First)

```graphql
# Business Object Queries
type InventoryItem {
  id: ID!
  code: String!
  name: String!
  category: InventoryCategory!
  currentStock: StockBalance!  # Materialized view
  reorderPoint: Float
  safetyStock: Float
  confidence: ConfidenceStatus!
  transactions(after: DateTime, before: DateTime): [InventoryTransaction!]!
  reconciliations(status: ReconciliationStatus): [StockReconciliation!]!
  batches(asOutput: Boolean): [ProductionBatch!]!
}

type StockBalance {
  quantityKg: Float!
  quantityTon: Float!
  valueInr: Float
  lastUpdated: DateTime!
  confidence: ConfidenceStatus!
}

# Mutations as Workflow Commands
type Mutation {
  # Inventory
  createInventoryItem(input: CreateInventoryItemInput!): WorkflowResult!
  postInventoryTransaction(input: PostTransactionInput!): WorkflowResult!
  submitReconciliation(input: SubmitReconciliationInput!): WorkflowResult!
  approveReconciliation(id: ID!, input: ApproveReconciliationInput!): WorkflowResult!
  
  # Production
  recordBatch(input: RecordBatchInput!): WorkflowResult!
  approveBatchVariance(id: ID!, input: ApproveVarianceInput!): WorkflowResult!
  
  # Sales & Dispatch
  createInvoice(input: CreateInvoiceInput!): WorkflowResult!
  createDispatch(input: CreateDispatchInput!): WorkflowResult!
  advanceDispatchStatus(id: ID!, status: DispatchStatus!, evidence: EvidenceInput!): WorkflowResult!
  
  # Finance
  recordPayment(input: RecordPaymentInput!): WorkflowResult!
  reallocatePayment(id: ID!, allocations: [AllocationInput!]!): WorkflowResult!
  
  # Approvals (Generic)
  advanceApproval(instanceId: ID!, action: ApprovalAction!, reason: String): WorkflowResult!
}

# Workflow Result captures async nature
type WorkflowResult {
  success: Boolean!
  workflowId: ID
  currentState: String
  requiresApproval: Boolean
  approvalInstanceId: ID
  message: String
}
```

---

## 15.6 Security & Access Control (ABAC + ReBAC)

```python
# Policy as Code (OPA/Rego style)
package factorynerve.authz

# Resource attributes
resource_factory_id(r) = r.factory_id
resource_org_id(r) = r.org_id
resource_owner_id(r) = r.created_by_user_id

# Actor attributes
actor_factory_ids(u) = factories where u has UserFactoryRole
actor_org_id(u) = u.org_id
actor_role(u) = u.role
actor_is_owner(u) = u.role == "owner"

# Permission rules
allow(actor, action, resource) {
  # Factory-scoped: actor must have role in that factory
  permission_rule(action, required_role)
  actor_factory_ids(actor) contains resource_factory_id(resource)
  actor_role(actor) >= required_role
}

allow(actor, "approval.advance", instance) {
  # Approver must not be requester (maker-checker)
  instance.requester != actor.id
  # For IP-3: L1 approver != L2 approver
  not instance.l1_approver == actor.id or instance.stage == "L1"
  # For IP-4: Admin or Owner only
  not instance.pattern == "IP-4" or actor_is_owner(actor) or actor_role(actor) == "admin"
  # For IP-5: Owner only
  not instance.pattern == "IP-5" or actor_is_owner(actor)
}
```

---

## 15.7 Observability Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Metrics** | Prometheus + Grafana | RED metrics (Rate, Errors, Duration) per service, business KPIs |
| **Logs** | Loki + Grafana | Structured JSON logs, correlation IDs, audit trail search |
| **Traces** | Tempo/Jaeger | Distributed tracing across API→Workflow→DB→Event Bus |
| **Alerting** | Alertmanager + PagerDuty | SLA breaches, error rates, business anomalies (zero dispatch for 4h) |
| **Profiling** | Pyroscope | Continuous profiling for performance bottlenecks |
| **Synthetic Monitoring** | Grafana k6 | API health, critical user journeys (punch, batch, dispatch) |

---

# PART 16: FUTURE EVOLUTION (5-YEAR ROADMAP)

---

## 16.1 Year 1: Foundation & Digitization (v2.0 - v2.4)

| Quarter | Theme | Key Deliverables |
|---------|-------|------------------|
| Q1 | **Core Platform Stabilization** | Migrate to Business Object architecture, Event Bus, Workflow Engine v1, GraphQL API, PostgreSQL schema refactor |
| Q2 | **Shop Floor Digitization** | Mobile App (Operator: DPR, Batch, QC, Punch), Mobile App (Supervisor: Approvals, Live View), Offline sync, Barcode scanning for inventory |
| Q3 | **Procurement & Quality Closure** | Purchase Order module, 3-way match automation, Incoming QC workflow, NCR/CAPA, Test certificate generation |
| Q4 | **Dispatch & Logistics Modernization** | Driver PWA (Gate Pass scan, POD upload, GPS tracking), Transporter Portal, Multi-drop dispatch, Return handling, E-way bill integration |

**Success Metrics:** 90% mobile adoption on shop floor, <2min DPR entry time, zero paper gate passes, 100% 3-way match automation.

---

## 16.2 Year 2: Intelligence & Automation (v3.0 - v3.4)

| Quarter | Theme | Key Deliverables |
|---------|-------|------------------|
| Q1 | **Predictive Analytics Engine** | Demand forecasting (ML), Predictive maintenance (downtime patterns), Dynamic reorder points (lead time ML), Coil theft pattern detection |
| Q2 | **Financial Automation** | Bank reconciliation (auto-match), GST e-invoice/IRN auto-generation, TDS auto-calculation & filing, Cash flow forecasting (13-week rolling) |
| Q3 | **Advanced Scheduling** | Finite capacity scheduler (CP-SAT), What-if simulation, Changeover optimization, Skill-based operator assignment |
| Q4 | **Self-Service Portals** | Customer Portal (orders, invoices, POD, payments, complaints), Vendor Portal (PO ack, invoice upload, payment status), Admin self-service (user mgmt, roles, factories) |

**Success Metrics:** 30% reduction in unplanned downtime, 20% inventory reduction, 50% finance manual work automated, 80% customer/vendor portal adoption.

---

## 16.3 Year 3: Digital Twin & IoT Integration (v4.0 - v4.4)

| Quarter | Theme | Key Deliverables |
|---------|-------|------------------|
| Q1 | **Machine Connectivity** | OPC-UA/MTConnect gateway, Real-time machine data ingestion (speed, temp, vibration, power), Digital twin models per machine/line |
| Q2 | **Real-Time Quality & Yield** | In-process parameter monitoring, SPC auto-alerts, Predictive quality (reject before it happens), First-pass yield optimization |
| Q3 | **Energy & Sustainability** | Energy monitoring per machine/batch, Carbon footprint tracking, Energy cost optimization (load shifting), ESG reporting |
| Q4 | **Yard & Logistics IoT** | RFID/GPS coil tracking in yard, Automated gate (ANPR + weighbridge integration), Drone yard inventory (monthly), Smart rack sensors |

**Success Metrics:** Real-time OEE visibility, <1% rejection rate, 10% energy cost reduction, zero lost coils in yard.

---

## 16.4 Year 4: AI-Native Operations (v5.0 - v5.4)

| Quarter | Theme | Key Deliverables |
|---------|-------|------------------|
| Q1 | **Generative AI Co-Pilot** | NLQ for all domains ("Why was margin low?"), Auto-generated shift reports, Automated root cause analysis, Executive summary auto-generation |
| Q2 | **Autonomous Decision Agents** | Auto-approval for low-risk workflows (configurable), Auto-reorder with vendor negotiation, Auto-schedule optimization, Auto-dispatch planning |
| Q3 | **Continuous Learning Loop** | Human feedback on AI suggestions (RLHF), Model retraining pipeline, A/B testing framework, Explainable AI for all predictions |
| Q4 | **Cross-Factory Intelligence** | Multi-factory benchmarking, Capacity sharing optimization, Group-level procurement, Consolidated owner dashboard |

**Success Metrics:** 50% of routine approvals autonomous, 90% NLQ accuracy, AI suggestions accepted >70%, group-level optimization savings >5%.

---

## 16.5 Year 5: Ecosystem & Platform (v6.0+)

| Theme | Deliverables |
|-------|--------------|
| **Platform Marketplace** | Third-party apps (specialized QC, advanced scheduling, niche analytics), Partner revenue share |
| **Industry Templates** | Chemical, Cement, Textile, Automotive — pre-configured workflows, objects, reports |
| **Global Compliance Engine** | Multi-country GST/VAT, Localization, Regulatory reporting packs |
| **Advanced Simulation** | Digital twin what-if (new line, new product, demand shock), Monte Carlo risk analysis |
| **Decentralized Identity** | Verifiable credentials for vendor/customer onboarding, Blockchain-based material traceability (optional) |

---

## 16.6 Technology Evolution Track

| Layer | Current (v1) | Year 1-2 (v2-v3) | Year 3-4 (v4-v5) | Year 5+ (v6) |
|-------|--------------|-------------------|-------------------|--------------|
| **API** | REST | GraphQL + REST | GraphQL Federation | GraphQL + gRPC |
| **Event Bus** | In-memory callbacks | Redis Streams | Kafka (Confluent) | Kafka + Schema Registry |
| **Database** | PostgreSQL (single) | PostgreSQL (partitioned) | PostgreSQL + ClickHouse (OLAP) | PostgreSQL + ClickHouse + TimescaleDB |
| **Cache** | Redis (simple) | Redis Cluster | Redis Cluster + CDN | Multi-tier (L1/L2/CDN) |
| **Auth** | JWT + Roles | OPA/ABAC + ReBAC | OPA + Verifiable Credentials | Decentralized Identity |
| **Mobile** | Web only | Flutter (Offline-first) | Flutter + AR/VR assist | Native + Wearables |
| **AI** | External API calls | Fine-tuned models + RAG | Custom trained + Agents | Foundation model + Distillation |
| **Deployment** | Single VM / Render | Kubernetes (EKS/GKE) | Multi-region K8s + Edge | Hybrid Cloud + On-prem Edge |
| **Observability** | Basic logs/metrics | Full stack (Logs/Metrics/Traces) | AI-powered anomaly detection | Self-healing + Predictive scaling |

---

## 16.7 Investment Priorities (Ranked)

| Priority | Investment Area | Est. Effort | ROI Horizon | Strategic Value |
|----------|-----------------|-------------|-------------|-----------------|
| 1 | **Mobile Shop Floor Apps** | 6 months | 6 months | Eliminates paper, real-time data, operator adoption |
| 2 | **Purchase Order + 3-Way Match** | 4 months | 3 months | Stops overbilling, improves vendor discipline |
| 3 | **Event Bus + Workflow Engine** | 8 months | 12 months | Enables all future automation, scalability |
| 4 | **Driver/Transporter PWA** | 3 months | 2 months | Dispatch visibility, POD automation, customer satisfaction |
| 5 | **Predictive Maintenance** | 6 months | 9 months | 30% downtime reduction, high ROI |
| 6 | **Customer/Vendor Portals** | 5 months | 6 months | Self-service, reduces support 40% |
| 7 | **GST/TDS/Bank Automation** | 4 months | Immediate | Compliance risk elimination, finance efficiency |
| 8 | **Digital Twin (Machine IoT)** | 12 months | 18 months | Foundation for Year 3-4 innovation |
| 9 | **Generative AI Co-Pilot** | 6 months | 9 months | Democratizes analytics, reduces decision latency |
| 10 | **Multi-Factory Optimization** | 8 months | 12 months | Group-level scale advantages |

---

## 16.8 Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Shop floor resistance to mobile apps** | HIGH | HIGH | Co-design with operators, offline-first, gradual rollout, champion users |
| **Data migration from v1 schema** | HIGH | HIGH | Parallel run 3 months, reconciliation reports, rollback plan |
| **Event bus reliability** | MEDIUM | HIGH | Outbox pattern, idempotent consumers, dead letter queues, replay capability |
| **AI hallucination in critical decisions** | MEDIUM | HIGH | Human-in-the-loop for all financial/safety decisions, confidence thresholds, audit trail |
| **Integration vendor lock-in** | LOW | MEDIUM | Open standards (OPC-UA, MQTT, REST), adapter pattern, multi-vendor eval |
| **Scalability at 50+ factories** | MEDIUM | HIGH | Partitioned schema, read replicas, async processing, load testing from Day 1 |
| **Regulatory change (GST, Labor codes)** | HIGH | MEDIUM | Configurable rule engine, plugin architecture for compliance modules |
| **Talent retention (engineering)** | MEDIUM | HIGH | Clear architecture ownership, tech debt budget, learning culture |

---

---

# APPENDICES

## Appendix A: Glossary of Terms

| Term | Definition |
|------|------------|
| **DPR** | Daily Production Report — shift-level production entry |
| **GRN** | Goods Receipt Note — formal document for material receipt |
| **BOM** | Bill of Materials — input items + quantities for an output |
| **Heat Number** | Unique identifier for a melt, traceable from furnace to finished product |
| **OTIF** | On-Time In-Full — delivery performance metric |
| **OEE** | Overall Equipment Effectiveness = Availability × Performance × Quality |
| **MTTR/MTBF** | Mean Time To Repair / Mean Time Between Failures |
| **IRN** | Invoice Reference Number (GST e-invoice) |
| **E-Way Bill** | Electronic waybill for inter-state goods movement (India) |
| **TDS/TCS** | Tax Deducted/Collected at Source (India) |
| **NCR** | Non-Conformance Report — quality deviation documentation |
| **CAPA** | Corrective and Preventive Action |
| **SPC** | Statistical Process Control |
| **RLHF** | Reinforcement Learning from Human Feedback |
| **RAG** | Retrieval-Augmented Generation |

---

## Appendix B: Key Configuration Constants

```python
# Approval Thresholds
HIGH_VALUE_THRESHOLD_KG = 5000.0
HIGH_VARIANCE_THRESHOLD_PERCENT = 5.0
PAYMENT_AUTO_APPROVE_LIMIT_INR = 50000.0

# Reconciliation
STALE_RECONCILIATION_DAYS = 14
MISMATCH_TOLERANCE_KG = 0.001
AUTO_APPROVE_VARIANCE_PERCENT = 5.0

# Inventory
LOW_STOCK_COVERAGE_DAYS = 14
DEAD_STOCK_DAYS = 90
REORDER_LOOKBACK_DAYS = 90
REORDER_SAFETY_FACTOR = 1.5

# Attendance
CROSS_MIDNIGHT_GRACE_HOURS = 2
AUTO_CLOSE_GRACE_HOURS = 2

# Approval TTL (hours)
WORKFLOW_TTL_HOURS = {
    "inventory.reconciliation.approve": 48,
    "dispatch.status.update": 24,
    "dispatch.record.create": 24,
    "billing.plan.downgrade": 72,  # auto-reject
}

# AI Cache TTL (seconds)
AI_CACHE_TTL = 900
NLQ_CACHE_TTL_BY_DOMAIN = {
    "theft_fraud": 30,
    "alerts": 30,
    "attendance": 300,
    "finance": 900,
}
```

---

## Appendix C: File-to-Module Map (Current v1)

| Module | Primary Files |
|--------|---------------|
| **Core/Database** | `backend/database.py`, `backend/models/*.py`, `alembic/` |
| **Auth** | `backend/routers/auth*.py`, `backend/models/user.py`, `backend/security.py` |
| **Entries (DPR)** | `backend/routers/entries.py`, `backend/models/entry.py` |
| **Attendance** | `backend/routers/attendance.py`, `backend/models/attendance_*.py`, `backend/services/workforce_intelligence.py` |
| **Steel (Inventory, Batch, Dispatch, Customer, Invoice, Payment)** | `backend/routers/steel.py`, `backend/models/steel_*.py`, `backend/services/steel_service.py` |
| **Steel Intelligence** | `backend/routers/steel_intelligence.py`, `backend/services/steel_*_intelligence.py` |
| **Steel Finance** | `backend/routers/steel_finance.py`, `backend/services/steel_finance.py` |
| **OCR** | `backend/routers/ocr/`, `backend/services/ocr_*.py` |
| **AI** | `backend/routers/ai.py`, `backend/ai_engine.py`, `backend/services/ai_router.py` |
| **Analytics** | `backend/routers/analytics.py`, `backend/routers/reports.py` |
| **Approvals** | `backend/services/approval_service.py`, `backend/routers/approvals.py`, `backend/services/approval_callbacks.py` |
| **Authorization** | `backend/authorization/pdp.py`, `backend/authorization/permission_catalog.py` |
| **Background Jobs** | `backend/services/background_jobs.py`, `backend/routers/cron.py` |
| **Billing** | `backend/routers/billing.py`, `backend/services/billing_manager.py` |
| **Notifications** | `backend/services/notification_service.py`, `backend/services/email_queue_processor.py`, `backend/services/whatsapp_sender.py` |
| **Settings/Admin** | `backend/routers/settings.py`, `backend/routers/admin_*.py` |

---

**END OF REPORT**

---

*This document represents a complete reverse-engineering of FactoryNerve as of July 2026. It is intended as the single source of truth for the FactoryNerve v2 rewrite. All assumptions are marked. Business logic is derived from actual code inspection, not generic ERP templates.*