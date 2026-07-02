# WORKFLOW STATE MATRIX — DPR.ai

> **Single Source of Truth for all workflow states, transitions, permissions, and approval controls.**
>
> Target authorization model: `Role + Permission + Scope + Workflow State + Maker-Checker + Audit`
>
> This document defines every valid state, every allowed transition, the permission/maker-checker/scope rules for each transition, and each workflow's approval pattern.
>
> **Last Updated:** 2026-06-16

---

## Table of Contents

1. [Conventions & Legend](#1-conventions--legend)
2. [DPR Production Entries](#2-dpr-production-entries)
3. [Attendance Records](#3-attendance-records)
4. [Attendance Regularizations](#4-attendance-regularizations)
5. [OCR Verifications](#5-ocr-verifications)
6. [Steel Dispatches](#6-steel-dispatches)
7. [Steel Sales Invoices](#7-steel-sales-invoices)
8. [Steel Stock Reconciliations](#8-steel-stock-reconciliations)
9. [Steel Production Batches](#9-steel-production-batches)
10. [Steel Customers](#10-steel-customers)
11. [Steel Customer Follow-Up Tasks](#11-steel-customer-follow-up-tasks)
12. [Subscriptions](#12-subscriptions)
13. [Payment Orders](#13-payment-orders)
14. [Billing Invoices](#14-billing-invoices)
15. [Email Queue](#15-email-queue)
16. [Intelligence Requests](#16-intelligence-requests)
17. [Feedback](#17-feedback)
18. [Ops Alert Events](#18-ops-alert-events)
19. [Webhook Events](#19-webhook-events)
20. [Steel Inventory Transactions](#20-steel-inventory-transactions)
21. [Universal Approval State Machine](#21-universal-approval-state-machine)
22. [Transition Permission Matrix](#22-transition-permission-matrix)
23. [Cross-Cutting Rules & Enforcement](#23-cross-cutting-rules--enforcement)

---

## 1. Conventions & Legend

### State Fields

Each workflow has one or more status fields. The state matrix documents:
- **Primary status**: the main workflow state
- **Sub-status**: a secondary dimension (e.g., review_status, delivery_status)
- **Timestamp fields**: temporal markers that record when state transitions occurred

### Transition Notation

Each row in a transition table documents:

| Column | Meaning |
|--------|---------|
| **From** | Source state(s) |
| **To** | Target state |
| **Trigger** | What initiates the transition (API endpoint, system event, webhook) |
| **Permission** | Target-state permission key required for the transition |
| **Scope** | Required access scope |
| **Maker-Checker** | Whether maker-checker controls apply (`MC: Y/N`, pattern reference) |
| **SoD** | Separation of duties constraint (self-approval prevention, role conflict) |
| **Audit Event** | Action string for the audit log |

### Permission Keys

Permissions follow the `<domain>.<resource>.<action>[.<qualifier>]` naming convention defined in the Authorization Foundation Engineering Spec.

### Approval Patterns (AP)

Referenced from the Approval Platform design:

| Pattern | Description |
|---------|-------------|
| **AP-0** | No approval — direct state change |
| **AP-1** | Single approval — any supervisor+ can approve/reject |
| **AP-2** | Maker-checker — creator cannot approve own work |
| **AP-3** | Multi-level — requires L1 + L2 approval |
| **AP-4** | Independent review — requires third-party reviewer |
| **AP-5** | Critical dual control — requires 2 independent approvers + audit |

### Status Values by Type Convention

| Type | Convention | Example |
|------|------------|---------|
| `str` with default | String column with database default | `"submitted"`, `"working"` |
| `Enum` | Python Enum class | `FeedbackStatus.OPEN` |
| `Literal` | TypeScript/Python Literal type | `SteelDispatchStatus = Literal["pending", "loaded", ...]` |

---

## 2. DPR Production Entries

**Model:** `Entry`
**Status Field:** `status: str = "submitted"`
**Sub-status:** None
**Allowed values (router constant):** `ALLOWED_ENTRY_STATUSES = {"submitted", "approved", "rejected"}`

### State Diagram

```
                  ┌───────────┐
                  │ submitted │
                  └─────┬─────┘
                   ┌────┴────┐
                   │         │
              ┌────▼──┐  ┌───▼────┐
              │approved│  │rejected│
              └────────┘  └────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `submitted` | `POST /entries` (create_entry) | `dpr.entry.create` | FACTORY | N | — | `ENTRY_CREATED` |
| `submitted` | `approved` | `POST /entries/{id}/approve` | `dpr.entry.approve` | FACTORY | **Y (AP-2)** | `assert_not_self_approval` | `ENTRY_APPROVED` |
| `submitted` | `rejected` | `POST /entries/{id}/reject` | `dpr.entry.reject` | FACTORY | **Y (AP-2)** | `assert_not_self_approval` | `ENTRY_REJECTED` |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Self-approval prevention** | `assert_not_self_approval(entry.user_id, current_user.id)` — the creator cannot approve/reject their own entry |
| **Edit locks** | Operator can only edit same-day entries (`entry.date != date.today()` blocks edit); entries lock after supervisor review (`_is_entry_reviewed` check) |
| **Soft delete** | Entry is not deleted; `is_active = False` — requires MANAGER role |
| **Accountant restriction** | Accountant role cannot create, view, or edit entries |
| **Attendance restriction** | Attendance role cannot access entries |

### Approval Pattern

**AP-2** (Maker-Checker): The operator (or user) creates the entry as `submitted`. A supervisor/manager/admin/owner with the `dpr.entry.approve` or `dpr.entry.reject` permission reviews and approves/rejects. Self-approval is enforced at the application level via `assert_not_self_approval`.

---

## 3. Attendance Records

**Model:** `AttendanceRecord`
**Status field:** `status: str = "working"`
**Review status field:** `review_status: str = "auto"`
**Allowed statuses (router constant):** `ATTENDANCE_REVIEW_FINAL_STATUSES = ("working", "completed", "half_day", "absent")`

### State Diagram (Primary Status)

```
    ┌──────────┐
    │  working │◄────── Punch In
    └─────┬────┘
          │
    ┌─────▼──────┐
    │ completed  │◄────── Punch Out (auto)
    └─────┬──────┘
          │
     ┌────┴────┐
     │         │
┌────▼──┐ ┌───▼────┐
│half_day│ │ absent │
└────────┘ └────────┘
```

### State Diagram (Review Status)

```
    ┌─────┐
    │ auto│ ──────► ┌──────────────┐
    └─────┘         │pending_review│─── Regularization Created
                     └──────┬───────┘
                      ┌─────┴─────┐
                      │           │
                 ┌────▼──┐  ┌────▼────┐
                 │approved│  │rejected │
                 └────────┘  └─────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `working` | `POST /attendance/punch` (action=in) | `attendance.punch.create` | FACTORY | N | — | `ATTENDANCE_PUNCHED_IN` |
| `working` | `completed` | `POST /attendance/punch` (action=out) | `attendance.punch.create` | FACTORY | N | — | `ATTENDANCE_PUNCHED_OUT` |
| `working`\|`completed` | `working`\|`completed`\|`half_day`\|`absent` | `POST /attendance/review/{id}/approve` | `attendance.review.approve` | FACTORY | **Y (AP-2)** | `assert_not_self_approval` | `ATTENDANCE_REVIEW_APPROVED` |
| `working`\|`completed` | `working`\|`completed` | `POST /attendance/review/{id}/reject` | `attendance.review.reject` | FACTORY | **Y (AP-2)** | `assert_not_self_approval` | `ATTENDANCE_REVIEW_REJECTED` |
| *(any)* | `missed_punch` | Auto (punch_out_at=null, date < today) | — | — | N | — | — |
| *(any)* | `not_punched` | Auto (no record exists for today) | — | — | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Self-approval prevention** | `assert_not_self_approval(record.user_id, current_user.id)` |
| **Open record enforcement** | Cannot punch out without a prior punch-in |
| **Cross-midnight support** | Night shift punch-out can span to the next day |
| **Review status propagation** | Creating a regularization sets `review_status = "pending_review"` |
| **Late mark deduction rules** | >3 late marks in a month → half-day deduction (frontend warning) |

### Approval Pattern

**AP-2** (Maker-Checker) for review decisions: The employee punches in/out (maker). A supervisor/manager/admin/owner reviews and approves/rejects (checker). Self-approval enforced.

---

## 4. Attendance Regularizations

**Model:** `AttendanceRegularization`
**Status field:** `status: str = "pending"`
**Allowed request types:** `"missed_punch", "timing_correction", "status_correction", "shift_correction"`

### State Diagram

```
    ┌─────────┐
    │ pending │
    └────┬────┘
     ┌───┴───┐
     │       │
┌────▼──┐ ┌──▼─────┐
│approved│ │rejected│
└────────┘ └────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `pending` | `POST /attendance/me/regularizations` | `attendance.regularization.create` | SELF | N | — | `ATTENDANCE_REGULARIZATION_CREATED` |
| `pending` | `approved` | `POST /attendance/review/{id}/approve` | `attendance.regularization.approve` | FACTORY | **Y (AP-2)** | `assert_not_self_approval` | `ATTENDANCE_REVIEW_APPROVED` |
| `pending` | `rejected` | `POST /attendance/review/{id}/reject` | `attendance.regularization.reject` | FACTORY | **Y (AP-2)** | `assert_not_self_approval` | `ATTENDANCE_REVIEW_REJECTED` |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Duplicate prevention** | Only one pending regularization per attendance record allowed |
| **Scope binding** | Regularization is linked to a specific AttendanceRecord |
| **Self-approval prevention** | Enforced via the parent attendance record's review mechanism |

### Approval Pattern

**AP-2** (Maker-Checker): Employee requests (maker), supervisor approves/rejects (checker).

---

## 5. OCR Verifications

**Model:** `OcrVerification`
**Status field:** `status: str = "draft"`
**Allowed statuses (router constant):** `_ALLOWED_VERIFICATION_STATUSES = {"draft", "pending", "approved", "rejected"}`
**Timestamp fields:** `submitted_at`, `approved_at`, `rejected_at`

### State Diagram

```
    ┌───────┐
    │ draft │
    └───┬───┘
        │  submit_verification()
   ┌────▼────┐
   │ pending │
   └────┬────┘
    ┌───┴───┐
    │       │
┌───▼───┐ ┌─▼──────┐
│approved│ │rejected│
└────────┘ └────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `draft` | `POST /ocr/verifications` (with status=draft) | `ocr.verification.create` | FACTORY | N | — | `OCR_VERIFICATION_CREATED` |
| `draft` | `pending` | `POST /ocr/verifications/{id}/submit` | `ocr.verification.submit` | FACTORY | N | — | `OCR_VERIFICATION_SUBMITTED` |
| `pending` | `approved` | `POST /ocr/verifications/{id}/approve` | `ocr.verification.approve` | FACTORY | **Y (AP-2)** | Reviewer ≠ Creator | `OCR_VERIFICATION_APPROVED` |
| `pending` | `rejected` | `POST /ocr/verifications/{id}/reject` | `ocr.verification.reject` | FACTORY | **Y (AP-2)** | Reviewer ≠ Creator | `OCR_VERIFICATION_REJECTED` |
| `approved`\|`rejected` | `draft` | `PUT /ocr/verifications/{id}` (update payload) | `ocr.verification.update` | FACTORY | N | — | `OCR_VERIFICATION_UPDATED` |
| `draft`\|`pending` | `draft` | `PUT /ocr/verifications/{id}` (update payload) | `ocr.verification.update` | FACTORY | N | — | `OCR_VERIFICATION_UPDATED` |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Submit guard** | Cannot submit a draft with no OCR rows — `_verification_row_count` check |
| **Rejection reason** | Rejection requires `rejection_reason` |
| **Export trust** | Only `approved` verifications are marked as `trusted_export = True` |
| **Review required** | When `avg_confidence < LOW_CONFIDENCE_THRESHOLD`, verification is marked review-required |

### Approval Pattern

**AP-2** (Maker-Checker): The OCR system (or user) creates a `draft` and submits to `pending`. A different user (checker) approves or rejects. No explicit `assert_not_self_approval` call in the router, but the architecture requires it — this is a gap.

---

## 6. Steel Dispatches

**Model:** `SteelDispatch`
**Status field:** `status: str = "dispatched"`
**Status Literal:** `SteelDispatchStatus = Literal["pending", "loaded", "exited", "dispatched", "delivered", "cancelled"]`
**Inventory posting field:** `inventory_posted_at: datetime | None`
**Delivery field:** `delivered_at: datetime | None`

### State Diagram

```
    ┌─────────┐
    │ pending │
    └────┬────┘
         │  load
    ┌────▼────┐
    │ loaded  │
    └────┬────┘
         │  exit gate
    ┌────▼────┐
    │ exited  │ ────► Inventory posted (auto)
    └────┬────┘
         │  dispatch confirmed
    ┌────▼───────┐
    │ dispatched │
    └────┬───────┘
         │  delivery confirmed
    ┌────▼─────────┐
    │  delivered   │
    └──────┬───────┘
           │
      ┌────▼────┐
      │cancelled│ (from any state)
      └─────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | any initial | `POST /steel/dispatches` (create_dispatch) | `steel.dispatch.create` | FACTORY | N | — | `STEEL_DISPATCH_CREATED` |
| `pending`\|`loaded`\|`exited`\|`dispatched` | any valid* | `POST /steel/dispatches/{id}/status` (update_dispatch_status) | `steel.dispatch.update_status` | FACTORY | **Y (AP-2)** | — | `STEEL_DISPATCH_STATUS_UPDATED` |
| any | `cancelled` | `POST /steel/dispatches/{id}/status` (status=cancelled) | `steel.dispatch.cancel` | FACTORY | **Y (AP-2)** | — | `STEEL_DISPATCH_STATUS_UPDATED` |
| `pending`\|`loaded` | `exited` | Auto via status update | `steel.dispatch.update_status` | FACTORY | N | — | `STEEL_DISPATCH_STATUS_UPDATED` |
| `exited`\|`dispatched`\|`delivered` | *(inventory posted)* | Auto when status ≥ `exited` | — | — | N | — | — |

*\* `_normalize_dispatch_status()` validates from the allowed set `{"pending", "loaded", "exited", "dispatched", "delivered", "cancelled"}`. When `allow_cancelled=False`, `cancelled` is excluded.*

### Inventory Posting Rules

| Status | Inventory Impact |
|--------|-----------------|
| `pending` | No inventory posting |
| `loaded` | No inventory posting |
| `exited` | **Posts inventory** — calls `_create_dispatch_inventory_movements()` |
| `dispatched` | **Posts inventory** (if not already posted) |
| `delivered` | **Posts inventory** (if not already posted) |
| `cancelled` | No inventory posting (reverse logic not implemented — **gap**) |

`_dispatch_status_posts_inventory()` returns `True` for `exited`, `dispatched`, `delivered`.

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Inventory posting** | Stocks are debited on dispatch (status ≥ `exited`); idempotent via `inventory_posted_at` check |
| **Invoice state dependency** | Dispatch requires a valid invoice (`_get_invoice_or_404`) |
| **Driver tracking** | `delivered_by_user_id`, `delivered_at` tracked on delivery |
| **Cancellation** | No inventory reversal on cancel — **gap** (stocks are not credited back) |

### Approval Pattern

**AP-2** (Maker-Checker) recommended for the status update endpoint: Currently no maker-checker enforcement — anyone with access can update dispatch status. This is a **gap** for financial-significant transitions like `delivered` and `cancelled`. Multi-level (AP-3) may be needed for high-value dispatches.

---

## 7. Steel Sales Invoices

**Model:** `SteelSalesInvoice`
**Status field:** `status: str = "unpaid"`
**Allowed statuses:** `"unpaid"`, `"paid"`, `"partial"`

### State Diagram

```
    ┌────────┐
    │ unpaid │
    └───┬────┘
        │ payment received (partial)
   ┌────▼─────┐
   │  partial │
   └────┬─────┘
        │ payment received (full)
   ┌────▼────┐
   │  paid   │
   └─────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `unpaid` | `POST /steel/invoices` (create_invoice) | `steel.invoice.create` | FACTORY | N | — | `STEEL_INVOICE_CREATED` |
| `unpaid` | `paid` | Payment received in full | `steel.invoice.mark_paid` | FACTORY | **Y (AP-2)** | — | `STEEL_INVOICE_STATUS_UPDATED` |
| `unpaid` | `partial` | Partial payment received | `steel.payment.create` | FACTORY | N | — | `STEEL_PAYMENT_CREATED` |
| `partial` | `paid` | Remaining payment received | `steel.invoice.mark_paid` | FACTORY | **Y (AP-2)** | — | `STEEL_INVOICE_STATUS_UPDATED` |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Status auto-computation** | `_refresh_invoice_payment_statuses()` recalculates status after any payment/allocation change |
| **Payment threshold** | `paid_amount + 0.005 >= total_amount` → `paid`; `paid_amount <= 0.005` → `unpaid`; else `partial` |
| **Invoice-dispatch dependency** | Invoice must exist before dispatch can reference it |

### Approval Pattern

**AP-1** (Single approval) for invoice creation — currently no maker-checker on invoice creation beyond role check. AP-2 recommended because invoice creation is a financial-significant operation impacting GST/compliance.

---

## 8. Steel Stock Reconciliations

**Model:** `SteelStockReconciliation`
**Status field:** `status: str = "pending"`
**Allowed statuses (router constant from query param validation):** `"pending"`, `"approved"`, `"rejected"`
**Confidence status field:** `confidence_status: str` (auto-computed: green/yellow/red)

### State Diagram

```
    ┌─────────┐
    │ pending │
    └────┬────┘
     ┌───┴───┐
     │       │
┌────▼──┐ ┌──▼─────┐
│approved│ │rejected│
└────────┘ └────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `pending`\|`approved` | `POST /steel/inventory/reconciliations` (create) | `steel.reconciliation.create` | FACTORY | **Y (AP-2)** | Owner auto-approval gap | `STEEL_STOCK_RECONCILIATION_SUBMITTED` / `_APPROVED` |
| `pending` | `approved` | `POST /steel/inventory/reconciliations/{id}/approve` | `steel.reconciliation.approve` | FACTORY | **Y (AP-2)** | Count ≠ Approve | `STEEL_STOCK_RECONCILIATION_APPROVED` |
| `pending` | `rejected` | `POST /steel/inventory/reconciliations/{id}/reject` | `steel.reconciliation.reject` | FACTORY | **Y (AP-2)** | Count ≠ Reject | `STEEL_STOCK_RECONCILIATION_REJECTED` |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Auto-approval gap** | If `is_admin_or_owner(current_user)`, reconciliation is auto-approved — **violates maker-checker** |
| **Mismatch cause** | Required when variance > 0.001 kg |
| **Approval guard** | `Only pending reconciliations can be approved/rejected` |
| **Inventory adjustment** | On approval, a `adjustment` inventory transaction is created for the variance |
| **Counted vs. approved separation** | `counted_by_user_id` ≠ `approved_by_user_id` in the model, but not currently enforced at the code level — **gap** |

### Approval Pattern

**AP-2** (Maker-Checker): The person who counts stock (maker) creates a `pending` reconciliation. A different person (checker, ADMIN/OWNER role) approves or rejects. The auto-approval for admin/owner is a **critical gap** that bypasses maker-checker.

---

## 9. Steel Production Batches

**Model:** `SteelProductionBatch`
**Status field:** `status: str = "recorded"`
**Severity field:** `severity: str = "normal"` (values: normal, watch, high, critical — auto-computed from variance)

### State Diagram

```
    ┌──────────┐
    │ recorded │ (single state — no transitions)
    └──────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `recorded` | `POST /steel/batches` | `steel.batch.create` | FACTORY | N | — | `STEEL_BATCH_CREATED` |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Single state** | Batches are recorded once and never transition — no edit/approve/reject endpoints exist |
| **Severity auto-computation** | `severity_from_variance()` computes severity from `variance_percent` |
| **Inventory linkage** | Production creates `production_issue` and `production_output` inventory transactions |
| **Financial redaction** | Financial fields are redacted for non-OWNER users |

### Approval Pattern

**AP-0** (No approval): Batches are recorded once and immediately affect inventory. No maker-checker. This is acceptable because batches are real-time production records. However, high-severity or critical-severity batches **should** trigger an alert/review workflow — this is a **gap**.

---

## 10. Steel Customers

**Model:** `SteelCustomer`
**Primary status field:** `status: str = "active"`
**Allowed statuses (Literal):** `SteelCustomerStatus = Literal["active", "on_hold", "blocked"]`
**Verification status field:** `verification_status: str = "draft"`
**Verification Literal:** `SteelCustomerVerificationStatus = Literal["draft", "format_valid", "pending_review", "verified", "mismatch", "rejected", "expired"]`
**Sub-status fields:** `pan_status`, `gst_status`, `name_match_status`, `state_match_status`, `match_score`

### State Diagram — Primary Status

```
    ┌────────┐
    │ active │
    └───┬────┘
     ┌──┴───┐
     │      │
┌────▼──┐ ┌─▼──────┐
│on_hold│ │blocked │
└───────┘ └────────┘
```

### State Diagram — Verification Status

```
    ┌───────┐
    │ draft │
    └───┬───┘
        │  PAN/GST entered
   ┌────▼────────┐
   │format_valid │
   └────┬────────┘
        │  documents uploaded
   ┌────▼───────┐
   │pending_rev.│
   └────┬───────┘
    ┌───┴───┐
    │       │
┌───▼────┐ ┌▼───────┐    ┌─────────┐
│verified│ │mismatch│───►│expired  │
└────────┘ └───┬────┘    └─────────┘
               │
          ┌────▼────┐
          │rejected │
          └─────────┘
```

### Transition Table — Primary Status

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `active` | `POST /steel/customers` | `steel.customer.create` | FACTORY | N | — | `STEEL_CUSTOMER_CREATED` |
| `active` | `on_hold` | `PUT /steel/customers/{id}` (status=on_hold) | `steel.customer.update_status` | FACTORY | **Y (AP-2)** | — | `STEEL_CUSTOMER_STATUS_UPDATED` |
| `active`\|`on_hold` | `blocked` | `PUT /steel/customers/{id}` (status=blocked) | `steel.customer.block` | FACTORY | **Y (AP-2)** | — | `STEEL_CUSTOMER_BLOCKED` |
| `on_hold`\|`blocked` | `active` | `PUT /steel/customers/{id}` (status=active) | `steel.customer.update_status` | FACTORY | **Y (AP-2)** | — | `STEEL_CUSTOMER_STATUS_UPDATED` |

### Transition Table — Verification Status

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(any)* | `draft` | Auto-computed by `_evaluate_customer_verification()` | `steel.customer.verify` | FACTORY | N | — | — |
| *(any)* | `format_valid` | Auto — PAN/GST format check passes | — | — | N | — | — |
| *(any)* | `pending_review` | Auto — documents uploaded or official data available | — | — | N | — | — |
| *(any)* | `verified` | `POST /steel/customers/{id}/verification/review` (decision=approve) | `steel.customer.verify.approve` | FACTORY | **Y (AP-2)** | Reviewer ≠ Creator | `STEEL_CUSTOMER_VERIFIED` |
| *(any)* | `mismatch` | Auto — name/state mismatch detected | — | — | N | — | `STEEL_CUSTOMER_VERIFICATION_MISMATCH` |
| *(any)* | `rejected` | `POST /steel/customers/{id}/verification/review` (decision=reject) | `steel.customer.verify.reject` | FACTORY | **Y (AP-2)** | Reviewer ≠ Creator | `STEEL_CUSTOMER_VERIFICATION_REJECTED` |
| *(any)* | `expired` | Auto — time-based expiry of verification documents | — | — | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Verification score computation** | `_evaluate_customer_verification()` computes pan_status, gst_status, name_match_status, state_match_status, match_score |
| **Mismatch review guard** | Cannot approve verification with unresolved name/state mismatches |
| **Document retention** | PAN/GST documents stored in `STEEL_VERIFICATION_DOC_DIR`; deletion on re-upload |
| **Risk alerts** | On-hold/blocked/mismatch/rejected customers generate critical alerts in lifecycle summary |
| **Credit limit overuse warning** | Warns at ≥85% credit utilization; alerts at 100% |
| **Active-only scope** | Deactivated customers are hidden from most queries |

### Approval Pattern

**AP-2** (Maker-Checker) for customer verification: The customer data enters verification stages automatically (maker = system). A person with `steel.customer.verify.approve` permission reviews and verifies (checker). The `_evaluate_customer_verification()` auto-computation runs on every save but final status is set by the reviewer.

---

## 11. Steel Customer Follow-Up Tasks

**Model:** `SteelCustomerFollowUpTask`
**Status field:** `status: str = "open"`
**Status Literal:** `SteelFollowUpTaskStatus = Literal["open", "in_progress", "done", "cancelled"]`
**Priority field:** `priority: str = "medium"`  (low, medium, high, critical)

### State Diagram

```
    ┌──────┐
    │ open │
    └──┬───┘
       │
  ┌────▼───────┐
  │ in_progress│
  └────┬───────┘
   ┌───┴────┐
   │        │
┌──▼──┐ ┌───▼──────┐
│ done│ │cancelled │
└─────┘ └──────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `open` | `POST /steel/customers/{id}/follow-up-tasks` | `steel.customer.follow_up.create` | FACTORY | N | — | — |
| `open` | `in_progress` | `PUT /steel/customers/{id}/follow-up-tasks/{task_id}/status` | `steel.customer.follow_up.update_status` | FACTORY | N | — | — |
| `open`\|`in_progress` | `done` | `PUT .../status` (status=done) | `steel.customer.follow_up.complete` | FACTORY | N | — | — |
| `open`\|`in_progress` | `cancelled` | `PUT .../status` (status=cancelled) | `steel.customer.follow_up.cancel` | FACTORY | N | — | — |
| `done` | *(terminal)* | — | — | — | — | — | — |
| `cancelled` | *(terminal)* | — | — | — | — | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **No maker-checker** | Follow-up tasks are lightweight operational items — no approval needed |
| **Due date tracking** | `due_date` field for scheduling; open tasks shown in customer lifecycle alerts |
| **Assignment** | `assigned_to_user_id` for ownership |

### Approval Pattern

**AP-0** (No approval): Tasks are self-service operational items. Status changes are direct.

---

## 12. Subscriptions

**Model:** `Subscription`
**Status field:** `status: str = "trialing"`
**Allowed statuses:** `"trialing"`, `"active"`, `"stale"`, `"cancelled"`, `"expired"`
**Partial index (current SQL schema):** `uq_subscriptions_active_org_id` WHERE `status = 'active'`

### State Diagram

```
    ┌──────────┐
    │ trialing │
    └────┬─────┘
         │  trial ends / payment received
    ┌────▼──────┐
    │  active   │
    └────┬──────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐    ┌─────────┐
│cancelled│ │ expired │    │  stale  │
└─────────┘ └─────────┘    └─────────┘
    (scheduled)  (grace period expired)  (mid-cycle cancel)
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `trialing` | `POST /auth/register` (auto) | — | SELF | N | — | `ACCOUNT_CREATED` |
| `trialing` | `active` | Webhook `payment.captured` / `order.paid` / manual sync | — | ORG | N | — | `PLAN_UPGRADED` |
| `active` | `cancelled` | `POST /billing/downgrade` (scheduled) | `billing.subscription.cancel` | ORG | **Y (AP-1)** | — | `SUBSCRIPTION_CANCELLED` |
| `active` | `stale` | Auto (mid-cycle payment failure) | — | — | N | — | — |
| `active`\|`trialing` | `expired` | Auto (grace period expired) | — | — | N | — | — |
| `cancelled` | `active` | Admin override / re-activation | `billing.subscription.reactivate` | ORG | **Y (AP-1)** | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Unique active subscription** | Partial unique index `uq_subscriptions_active_org_id` ensures only one active subscription per org |
| **Grace period** | `grace_period_end_at` — 3 days after failed payment before expiry |
| **Pending plan** | `pending_plan` / `pending_plan_effective_at` for scheduled downgrades |
| **Trial period** | `TRIAL_DAYS` env var (default 7) |

### Approval Pattern

**AP-1** (Single approval): Downgrade/cancellation requires OWNER role. Payment handling is event-driven via webhooks (no manual approval for upgrades).

---

## 13. Payment Orders

**Model:** `PaymentOrder`
**Status field:** `status: str = "pending"`
**Router constants:** `REUSABLE_ORDER_STATUSES = {"created", "attempted", "authorized"}`, `PAID_ORDER_STATUSES = {"paid", "captured"}`, `RETRYABLE_ORDER_STATUSES = {"failed", "cancelled", "expired"}`

### State Diagram

```
    ┌─────────┐
    │ pending │
    └────┬────┘
         │ Razorpay order created
    ┌────▼─────┐
    │ created  │◄──── Reusable
    └────┬─────┘
         │ payment attempted
    ┌────▼────────┐
    │ attempted   │◄──── Reusable
    └────┬────────┘
         │ payment authorized
    ┌────▼─────────┐
    │ authorized   │◄──── Reusable
    └────┬─────────┘
         │ payment captured
    ┌────▼────┐
    │  paid   │──── Terminal
    └────┬────┘
         │
    ┌────▼──────┐
    │ captured  │──── Terminal (synonym for paid)
    └───────────┘

    Non-reusable terminal states (from any above except paid):
    ┌─────────┐
    │ failed  │
    ├─────────┤
    │cancelled│
    ├─────────┤
    │ expired │
    └─────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `pending` | Order initiated | — | ORG | N | — | — |
| `pending` | `created` | Razorpay order created | `billing.order.create` | ORG | N | — | `BILLING_ORDER_CREATED` |
| `created` | `attempted` | User attempts payment | — | ORG | N | — | — |
| `attempted` | `authorized` | Payment authorized | — | ORG | N | — | — |
| `authorized` | `paid` | Webhook `payment.captured` | — | ORG | N | — | `BILLING_ORDER_PAID` |
| `authorized` | `captured` | Webhook `order.paid` | — | ORG | N | — | — |
| `created`\|`attempted`\|`authorized` | `failed` | Webhook `payment.failed` | — | ORG | N | — | `BILLING_ORDER_FAILED` |
| `created`\|`attempted`\|`authorized` | `cancelled` | User cancels / timeout | — | ORG | N | — | — |
| `created`\|`attempted`\|`authorized` | `expired` | Order timeout | — | ORG | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Idempotency** | `idempotency_key` prevents duplicate orders |
| **Reusability** | Only `created`, `attempted`, `authorized` can be reused for retry |
| **Paid prevention** | If `status in PAID_ORDER_STATUSES`, new order is blocked — user must refresh billing |
| **Retry seed** | Failed/cancelled/expired orders generate a new idempotency key using `{raw_seed}:{existing_status}:{timestamp}` |

### Approval Pattern

**AP-0** (No approval): Payment orders are purely event-driven through the Razorpay webhook. The order creation requires OWNER role but is not a maker-checker flow.

---

## 14. Billing Invoices

**Model:** `Invoice` (billing invoices, not steel sales invoices)
**Status field:** `status: str = "pending"`
**Allowed statuses:** `"pending"`, `"paid"`

### State Diagram

```
    ┌─────────┐
    │ pending │
    └────┬────┘
         │ payment captured
    ┌────▼────┐
    │  paid   │
    └─────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `pending` | Invoice created (`record_invoice()`) | — | ORG | N | — | — |
| `pending` | `paid` | Webhook / manual sync | — | ORG | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Provider invoice dedup** | `provider_invoice_id` unique index prevents duplicate invoices |
| **Auto-payment** | Status set to `paid` automatically when webhook confirms payment |

### Approval Pattern

**AP-0** (No approval): Invoices are records of payment events, not approval workflows.

---

## 15. Email Queue

**Model:** `EmailQueue`
**Status field:** `status: str = "pending"`
**Attempts field:** `attempts: int = 0`
**Retry field:** `next_retry_at: datetime | None`

### State Diagram

```
    ┌─────────┐
    │ pending │
    └────┬────┘
         │ send attempt
    ┌────▼────┐
    │ sending │ (implied — not stored)
    └────┬────┘
     ┌───┴───┐
     │       │
┌────▼──┐ ┌─▼──────┐
│ sent   │ │failed  │
└────────┘ └───┬────┘
               │ retry
          ┌────▼────┐
          │ pending │ (re-queued)
          └─────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `pending` | Email queued | — | ORG | N | — | — |
| `pending` | `sending` | Background worker picks up | — | — | N | — | — |
| `sending` | `sent` | Send success | — | — | N | — | `EMAIL_SENT` |
| `sending` | `failed` | Send failure | — | — | N | — | `EMAIL_FAILED` |
| `failed` | `pending` | Retry scheduled | — | — | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Max attempts** | Based on `attempts` field (not hardcoded in model — set in background job) |
| **Retry backoff** | `next_retry_at` field for scheduling retries |

### Approval Pattern

**AP-0** (No approval): Email delivery is a background system process.

---

## 16. Intelligence Requests

**Model:** `IntelligenceRequest`
**Status field:** `status: str = "queued"`

### State Diagram

```
    ┌─────────┐
    │ queued  │
    └────┬────┘
         │ worker picks up
    ┌────▼────────┐
    │ processing  │ (implied — not stored as enum but `pipeline_state` updates)
    └────┬────────┘
     ┌───┴───┐
     │       │
┌────▼──┐ ┌─▼──────┐
│completed│ │ failed │
└─────────┘ └────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `queued` | `POST /intelligence/requests` | `intelligence.request.create` | FACTORY | N | — | — |
| `queued` | `completed` | Background worker finishes | — | — | N | — | — |
| `queued` | `failed` | Worker error | — | — | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Cache deduplication** | `document_hash` and `cache_key` used for result reuse |
| **Document-level tracking** | `source_file_path` and `size_bytes` provide provenance |

### Approval Pattern

**AP-0** (No approval): Intelligence requests are async processing jobs managed by background workers.

---

## 17. Feedback

**Model:** `Feedback`
**Status field:** `status: FeedbackStatus` (Enum)
**FeedbackStatus values:** `OPEN = "open"`, `TRIAGED = "triaged"`, `RESOLVED = "resolved"`

### State Diagram

```
    ┌──────┐
    │ open │
    └──┬───┘
       │ admin triages
  ┌────▼──────┐
  │  triaged  │
  └────┬──────┘
       │ issue resolved
  ┌────▼────────┐
  │  resolved   │
  └─────────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `open` | `POST /feedback` | `feedback.create` | ORG | N | — | — |
| `open` | `triaged` | `PATCH /feedback/{id}` (admin) | `feedback.triage` | ORG | N | — | `FEEDBACK_TRIAGED` |
| `open`\|`triaged` | `resolved` | `PATCH /feedback/{id}` (admin resolves) | `feedback.resolve` | ORG | **Y (AP-2)** | Resolver ≠ Creator | `FEEDBACK_RESOLVED` |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **No re-open** | No endpoint to reopen resolved feedback — **gap** |
| **Deduplication** | `dedupe_hash` and `client_request_id` prevent duplicates |
| **Reporter access** | Users can view their own feedback via `/feedback/mine/updates` |

### Approval Pattern

**AP-1** (Single approval): A feedback admin triages and resolves items. No maker-checker required for triage, but resolution should ideally be reviewed.

---

## 18. Ops Alert Events

**Model:** `OpsAlertEvent`
**Primary status field:** `status: str = "queued"`
**Delivery status field:** `delivery_status: str = "queued"`
**Additional status fields:** `escalation_level: int = 0`, `attempt_count: int = 0`

### State Diagram — Primary Status

```
    ┌─────────┐
    │ queued  │
    └────┬────┘
         │ worker dispatches
    ┌────▼───────────┐
    │  dispatched    │
    └────┬───────────┘
         │ provider responds
    ┌────▼────┐
    │delivered│
    └─────────┘
```

### State Diagram — Delivery Status

```
    ┌─────────┐
    │ queued  │
    └────┬────┘
         │ sent to provider
    ┌────▼────┐
    │  sent   │
    └────┬────┘
     ┌───┴───┐
     │       │
┌────▼──┐ ┌─▼──────┐
│delivered│ │ failed │
└─────────┘ └────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `queued` | Alert created by system | — | ORG | N | — | — |
| `queued` | `dispatched` | Worker picks up alert | — | — | N | — | — |
| `dispatched` | `delivered` | Provider delivery confirmation | — | — | N | — | — |
| `dispatched` | `failed` | Provider error / timeout | — | — | N | — | `ALERT_DELIVERY_FAILED` |
| `failed` | `queued` | Retry scheduled | — | — | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Deduplication** | `ref_id + recipient_phone` unique constraint prevents duplicate alerts |
| **Escalation** | `escalation_level` increments on failures; configurable per alert type |
| **Suppression** | `suppressed_reason` allows alert suppression |
| **Provider tracking** | `provider_message_id`, `provider_error_code`, `provider_error_title` |

### Approval Pattern

**AP-0** (No approval): Alert delivery is a system process with automated escalation.

---

## 19. Webhook Events

**Model:** `WebhookEvent`
**Status field:** `status: str = "processed"`

### State Diagram

```
    ┌───────────┐
    │ processed │ (single state — record of receipt)
    └───────────┘
```

### Transition Table

| From | To | Trigger | Permission | Scope | MC | SoD | Audit Event |
|------|----|---------|------------|-------|----|-----|-------------|
| *(new)* | `processed` | Webhook received and stored | — | ORG | N | — | — |

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Deduplication** | `provider + event_id` unique constraint prevents duplicate processing |
| **Idempotency** | Duplicate webhooks return `{"status": "ok", "idempotent": True}` |

### Approval Pattern

**AP-0** (No approval): Webhook events are immutable system records.

---

## 20. Steel Inventory Transactions

**Model:** `SteelInventoryTransaction`
**No status field** — uses `transaction_type` to classify the operation.
**Transaction types (from `normalize_transaction_type()`):** `"inward"`, `"outward"`, `"production_output"`, `"production_issue"`, `"dispatch_out"`, `"adjustment"`, `"manual_entry"`

### State Model

Inventory transactions are **append-only ledger entries** — they do not have states. Each transaction represents a signed quantity change to stock.

### Control Rules

| Rule | Enforcement |
|------|-------------|
| **Append-only** | No update or delete — audit trail is preserved |
| **Signed quantity** | Positive for inbound, negative for outbound |
| **Reference tracking** | `reference_type` + `reference_id` links to source documents (batch, dispatch, reconciliation) |
| **Negative stock prevention** | `projected_balance < -0.001` blocks the transaction |
| **Financial redaction** | `current_rate_per_kg` is redacted for non-financial roles |

### Approval Pattern

**AP-2** (Maker-Checker) recommended: Currently requires MANAGER role to create inventory transactions but has no maker-checker. Given the financial impact, maker-checker should be implemented for all manual inventory adjustments and inventory item creation.

---

## 21. Universal Approval State Machine

### Purpose

The universal approval state machine is the platform-level state engine that **all** approval workflows map to. Each workflow's specific states are a subset or specialization of the universal machine.

### Universal States

```
                                 ┌──────────────────────┐
                           ┌────►│      COMPLETED       │
                           │     └──────────────────────┘
                           │
                     ┌─────┴──────┐              ┌──────────────────┐
                     │  APPROVED  │─────────────►│   SUPERSEDED     │
                     └─────┬──────┘              └──────────────────┘
                           │
    ┌────────┐      ┌──────▼───────┐      ┌──────────────────┐
    │ DRAFT  │─────►│  SUBMITTED   │─────►│  UNDER_REVIEW    │
    └────────┘      └──────────────┘      └──────┬───────────┘
                                                  │
                                   ┌──────────────┼──────────────┐
                                   │              │              │
                              ┌────▼───┐    ┌─────▼─────┐  ┌────▼──────┐
                              │APPROVED │    │ REJECTED  │  │ESCALATED  │
                              └───┬─────┘    └─────┬─────┘  └─────┬─────┘
                                  │               │              │
                                  │         ┌─────▼─────┐        │
                                  │         │CLOSED      │        │
                                  │         └───────────┘        │
                                  │                               │
                             ┌────▼─────┐                  ┌──────▼───────┐
                             │COMPLETED │                  │LEVEL2_REVIEW │
                             └──────────┘                  └──────┬───────┘
                                                                  │
                                                        ┌─────────┼─────────┐
                                                        │         │         │
                                                   ┌────▼──┐ ┌───▼────┐ ┌──▼───────┐
                                                   │APPROVED│ │REJECTED│ │ESCALATED │
                                                   └───┬────┘ └───┬────┘ └────┬─────┘
                                                       │         │           │
                                                  ┌────▼──┐ ┌───▼────┐ ┌─────▼──────┐
                                                  │COMPLTD │ │CLOSED  │ │ ESCALATE   │ (to higher
                                                  └────────┘ └────────┘ │ TO OWNER   │  authority)
                                                                        └────────────┘

    ──── Exception Paths ────

    ┌────────┐      ┌────────────────────┐     ┌──────────────────────┐
    │APPROVED│─────►│ EXCEPTION_REQUESTED│────►│ EXCEPTION_APPROVED  │────► COMPLETED
    └────────┘      └────────────────────┘     └──────────────────────┘
                          │
                          │ (if rejected)
                          ▼
                   ┌──────────────────┐
                   │ EXCEPTION_REJECTED│──► REJECTED
                   └──────────────────┘

    ┌────────┐     ┌───────────────────┐     ┌──────────────────┐
    │APPROVED│────►│ OVERRIDE_REQUESTED│────►│ OVERRIDE_APPROVED│────► COMPLETED
    └────────┘     └───────────────────┘     └──────────────────┘
                          │
                          │ (if rejected)
                          ▼
                   ┌──────────────────┐
                   │ OVERRIDE_REJECTED│──► REJECTED
                   └──────────────────┘
```

### Universal State Definitions

| State | Meaning | Is Terminal | Requires Audit |
|-------|---------|-------------|----------------|
| `DRAFT` | Initial creation, not yet submitted | No | No |
| `SUBMITTED` | Maker has submitted for review | No | Yes |
| `UNDER_REVIEW` | Checker is actively reviewing | No | Yes |
| `APPROVED` | Checker has approved | No† | Yes |
| `REJECTED` | Checker has rejected | Yes | Yes |
| `CLOSED` | Workflow closed without resolution | Yes | Yes |
| `COMPLETED` | Approved action has been executed | Yes | Yes |
| `SUPERSEDED` | A newer approval instance has replaced this one | Yes | Yes |
| `ESCALATED` | Escalated to higher authority | No | Yes |
| `LEVEL2_REVIEW` | Second-level review in progress | No | Yes |
| `EXCEPTION_REQUESTED` | Exception approval has been requested | No | Yes |
| `EXCEPTION_APPROVED` | Exception has been granted | Yes | Yes |
| `EXCEPTION_REJECTED` | Exception has been denied | Yes | Yes |
| `OVERRIDE_REQUESTED` | Governance override has been requested | No | Yes |
| `OVERRIDE_APPROVED` | Override has been granted | Yes | Yes |
| `OVERRIDE_REJECTED` | Override has been denied | Yes | Yes |

† `APPROVED` is not terminal because the approved action may still be executed (→ `COMPLETED`), or a workflow change may need an exception/override.

### Step-Level States (for multi-level workflows)

| State | Meaning |
|-------|---------|
| `PENDING_ASSIGNMENT` | No reviewer assigned yet |
| `PENDING_REVIEW` | Awaiting reviewer action |
| `REVIEW_IN_PROGRESS` | Reviewer has opened but not yet decided |
| `REVIEW_APPROVED` | This step has been approved |
| `REVIEW_REJECTED` | This step has been rejected |
| `REVIEW_SKIPPED` | This step was skipped (threshold-based auto-approval) |
| `REVIEW_ESCALATED` | This step was escalated |
| `AWAITING_CONFIRMATION` | Awaiting maker confirmation of the decision |
| `AWAITING_CONDITIONS` | Awaiting pre/post conditions to be met |
| `EXPIRED` | Step timed out |

### Universal Transition Rules

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | Only a DRAFT can be submitted | Prevents resubmission of already-processed items |
| 2 | Only SUBMITTED items can enter UNDER_REVIEW | Prevents bypass of submission gate |
| 3 | APPROVED must precede COMPLETED | Ensures action is authorized before execution |
| 4 | REJECTED is always terminal | Cannot re-enter workflow from rejection (must create new DRAFT) |
| 5 | ESCALATED must go to a higher authority | Escalation target must be different from current reviewer |
| 6 | EXCEPTION requires one level above standard approval | Exception approver must be more senior than standard checker |
| 7 | OVERRIDE requires the next governance body | Override must be approved by a governance body, not an individual |
| 8 | SUPERSEDED requires a linked replacement | Must reference the superseding approval instance ID |
| 9 | Self-approval is forbidden at all steps | `assert_not_self_approval()` at every transition |
| 10 | Every transition must be audited | `AuditLog` entry required with action, actor, timestamp |
| 11 | Denials must include reason | REJECTED/EXCEPTION_REJECTED/OVERRIDE_REJECTED require a reason field |
| 12 | Escalation must include justification | ESCALATED transition requires an escalation reason |

---

## 22. Transition Permission Matrix

This matrix maps every state transition across all workflows to its required permission.

| Workflow | From States | To States | Permission Key |
|----------|-------------|-----------|----------------|
| **Entry** | *(new)* | submitted | `dpr.entry.create` |
| **Entry** | submitted | approved | `dpr.entry.approve` |
| **Entry** | submitted | rejected | `dpr.entry.reject` |
| **Attendance** | *(new)* | working | `attendance.punch.create` |
| **Attendance** | working | completed | `attendance.punch.create` |
| **Attendance** | *(any review)* | approved | `attendance.review.approve` |
| **Attendance** | *(any review)* | rejected | `attendance.review.reject` |
| **Regularization** | *(new)* | pending | `attendance.regularization.create` |
| **Regularization** | pending | approved | `attendance.review.approve` |
| **Regularization** | pending | rejected | `attendance.review.reject` |
| **OCR Verification** | *(new)* | draft | `ocr.verification.create` |
| **OCR Verification** | draft | pending | `ocr.verification.submit` |
| **OCR Verification** | pending | approved | `ocr.verification.approve` |
| **OCR Verification** | pending | rejected | `ocr.verification.reject` |
| **OCR Verification** | *(any)* | draft (update) | `ocr.verification.update` |
| **Steel Dispatch** | *(new)* | pending/initial | `steel.dispatch.create` |
| **Steel Dispatch** | *(any non-terminal)* | *(any valid)* | `steel.dispatch.update_status` |
| **Steel Dispatch** | *(any)* | cancelled | `steel.dispatch.cancel` |
| **Steel Sales Invoice** | *(new)* | unpaid | `steel.invoice.create` |
| **Steel Invoice** | unpaid/partial | paid/partial | `steel.invoice.mark_paid` |
| **Steel Reconciliation** | *(new)* | pending | `steel.reconciliation.create` |
| **Steel Reconciliation** | pending | approved | `steel.reconciliation.approve` |
| **Steel Reconciliation** | pending | rejected | `steel.reconciliation.reject` |
| **Steel Batch** | *(new)* | recorded | `steel.batch.create` |
| **Steel Customer** | *(new)* | active | `steel.customer.create` |
| **Steel Customer** | active/on_hold | on_hold/blocked/active | `steel.customer.update_status` |
| **Steel Customer** | any | blocked | `steel.customer.block` |
| **Steel Customer** | any | verified | `steel.customer.verify.approve` |
| **Steel Customer** | any | rejected | `steel.customer.verify.reject` |
| **Follow-Up Task** | *(new)* | open | `steel.customer.follow_up.create` |
| **Follow-Up Task** | any | in_progress/done/cancelled | `steel.customer.follow_up.update_status` |
| **Subscription** | *(new)* | trialing | — (auto) |
| **Subscription** | trialing/active | active/expired/cancelled/stale | `billing.subscription.cancel` / auto |
| **Payment Order** | *(new)* | created | `billing.order.create` |
| **Feedback** | *(new)* | open | `feedback.create` |
| **Feedback** | open | triaged | `feedback.triage` |
| **Feedback** | open/triaged | resolved | `feedback.resolve` |
| **Intelligence** | *(new)* | queued | `intelligence.request.create` |

---

## 23. Cross-Cutting Rules & Enforcement

### Maker-Checker Requirements

The following workflows **require** maker-checker but do **not** currently enforce it in the code:

| # | Workflow | Current Enforcement | Gap Description |
|---|----------|-------------------|-----------------|
| G1 | OCR Verification approve/reject | No `assert_not_self_approval` | Verifier could be the same person who created the verification |
| G2 | Steel Dispatch status update | No maker-checker | Any authorized user can change dispatch status without independent review |
| G3 | Steel Invoice payment status | No maker-checker | Auto-computed from payments — but manual override could bypass |
| G4 | Steel Reconciliation auto-approval | `is_admin_or_owner` bypass | Admin/OWNER reconciliations are auto-approved — violates maker-checker entirely |
| G5 | Steel Customer status update (on_hold/blocked) | No maker-checker | Business-critical customer status changes bypass review |
| G6 | Steel Customer verification review | No explicit `assert_not_self_approval` | Reviewer could theoretically be the customer creator |
| G7 | Steel Inventory item/transaction create | No maker-checker | Inventory-impacting operations require only MANAGER role |
| G8 | Steel Inventory reconciliation | No counted-by ≠ approved-by enforcement | Model stores both users but code doesn't prevent same user |

### Transition Validation Rules (Current Code)

| # | Rule | Location | Enforced? |
|---|------|----------|-----------|
| 1 | Entry status must be "submitted" to approve/reject | entries.py: `assert_not_self_approval` + status update | ✅ Yes |
| 2 | Reconciliation must be "pending" to approve/reject | steel.py: `if row.status != "pending"` | ✅ Yes |
| 3 | Rejection reason required for attendance | attendance.py: `if not note:` (reject path) | ✅ Yes |
| 4 | Rejection reason required for OCR verification | ocr.py: `if not rejection_reason` | ✅ Yes |
| 5 | Mismatch cause required for reconciliation variance | steel.py: `_stock_variance_needs_cause` | ✅ Yes |
| 6 | Dispatch status validated against allowed set | steel.py: `_normalize_dispatch_status` | ✅ Yes |
| 7 | Dispatch inventory posting is idempotent | steel.py: `_dispatch_has_posted_inventory` | ✅ Yes |
| 8 | Payment order status validated in idempotency check | billing.py: `REUSABLE_ORDER_STATUSES` check | ✅ Yes |

### Missing Transition Validations (Gaps)

| # | Missing Validation | Impact | Priority |
|---|-------------------|--------|----------|
| V1 | Cancel dispatch does not reverse inventory | Stock discrepancy after cancel | **P0** |
| V2 | No status guard on OCR verification submit — can resubmit already-approved items | Duplicate submissions | **P1** |
| V3 | No status validation on feedback status changes — can reopen closed items | Data inconsistency | **P2** |
| V4 | No status validation on steel customer verification — can approve already-verified items | Multiple approvals | **P1** |
| V5 | No transition guard on steel invoice status (set directly by `_refresh_invoice_payment_statuses`) | No state machine enforcement | **P1** |
| V6 | Production batches have no edit/update controls | Batches are append-only but no code prevents edits | **P2** |
| V7 | No MFA enforcement on any financial-significant transition | MFA requirements not implemented | **P3** |
| V8 | No break-glass emergency access mechanism | No override for urgent operations | **P3** |

### State Transition Audit Requirements (Target State)

Every state transition **must** produce an audit log entry with:

```
{
  "action": "<WORKFLOW>_<TRANSITION>",   // e.g., "STEEL_DISPATCH_STATUS_UPDATED"
  "actor_id": <user_id>,
  "actor_role": "<role>",
  "timestamp": "<ISO 8601 UTC>",
  "before_state": "<from_state>",
  "after_state": "<to_state>",
  "entity_type": "<workflow>",
  "entity_id": <entity_id>,
  "reason": "<optional reason>",
  "ip_address": "<client_ip>",
  "user_agent": "<user_agent>",
  "mfa_verified": true/false,
  "transition_source": "api|system|webhook|cron"
}
```

### Current Audit Coverage by Workflow

| Workflow | Audit Exists? | Fields Covered | Gap |
|----------|--------------|----------------|-----|
| Entry create/approve/reject | ✅ Yes | action, user_id, org_id, factory_id, details, ip, user_agent | No before/after state |
| Attendance punch/review | ✅ Yes | action, user_id, org_id, factory_id, details, ip | No before/after state |
| OCR verification lifecycle | ✅ Yes | action, user_id, org_id, factory_id, details, ip | No before/after state |
| Steel operations | ✅ Yes | action, user_id, org_id, factory_id, details, ip | No before/after state |
| Billing events | ✅ Yes | event_type, org_id, status, duration_ms | External event-driven |
| Feedback management | ❌ No | — | **No audit logging at all** |
| Steel customer verification | ✅ Partial | Only on review decisions | No audit on auto-evaluation |
| Steel customer follow-up | ❌ No | — | **No audit logging** |
| Permission changes | ❌ No | — | **No audit logging** |

---

## Appendix: Workflow State Summary Table

| # | Workflow | Primary Status Field | Default | Total States | Transition Types | Requires Approval | Gap |
|---|----------|---------------------|---------|--------------|------------------|-------------------|-----|
| 1 | Entry | `status` | `submitted` | 3 | 3 | AP-2 | — |
| 2 | Attendance Record | `status` | `working` | 7 | 3 primary + 3 review | AP-2 | — |
| 3 | Attendance Regularization | `status` | `pending` | 3 | 2 | AP-2 | — |
| 4 | OCR Verification | `status` | `draft` | 4 | 5 | AP-2 | No self-approval check |
| 5 | Steel Dispatch | `status` | `dispatched` | 6 | 5+ | AP-2 | No maker-checker |
| 6 | Steel Sales Invoice | `status` | `unpaid` | 3 | 3 | AP-1 | Auto-computed, no gate |
| 7 | Steel Stock Reconciliation | `status` | `pending` | 3 | 3 | AP-2 | Admin auto-approval bypass |
| 8 | Steel Production Batch | `status` | `recorded` | 1 | 1 | AP-0 | — |
| 9 | Steel Customer (primary) | `status` | `active` | 3 | 3 | AP-2 | No maker-checker |
| 10 | Steel Customer (verification) | `verification_status` | `draft` | 7 | 7 | AP-2 | No explicit self-approval check |
| 11 | Steel Follow-Up Task | `status` | `open` | 4 | 4 | AP-0 | — |
| 12 | Subscription | `status` | `trialing` | 5 | 4 | AP-1 | — |
| 13 | Payment Order | `status` | `pending` | 8 | 7 | AP-0 | — |
| 14 | Billing Invoice | `status` | `pending` | 2 | 1 | AP-0 | — |
| 15 | Email Queue | `status` | `pending` | 3 | 3 | AP-0 | — |
| 16 | Intelligence Request | `status` | `queued` | 3 | 2 | AP-0 | — |
| 17 | Feedback | `status` | `open` | 3 | 3 | AP-1 | No re-open |
| 18 | Ops Alert Event | `status` | `queued` | 3 | 3 | AP-0 | — |
| 19 | Webhook Event | `status` | `processed` | 1 | 1 | AP-0 | — |
| 20 | Steel Inventory Transaction | *(none)* | *(ledger entry)* | — | — | AP-2 recommended | No maker-checker |

---

*This document is the single source of truth for workflow states in DPR.ai. Any code changes to states, transitions, or permissions must be reflected here first.*
