# FactoryNerve — Role Permission Matrix

## Roles

| # | Role | Description |
|---|------|-------------|
| 0 | **ATTENDANCE** | Bare minimum access. Mark and view own attendance only. |
| 1 | **OPERATOR** | Shop floor. Production batches, gate entry/exit, stock view. |
| 2 | **SUPERVISOR** | Team lead. Approves operator entries, manages dispatch flow, team attendance. |
| 3 | **ACCOUNTANT** | Finance only. Invoices, payments, customers, financial OCR. |
| 4 | **MANAGER** | Operational authority. Bridges production and finance, overrides within scope. |
| 5 | **ADMIN** | System authority. User management, system config, audit logs. |
| 6 | **OWNER** | Absolute authority. Overrides everything, cross-factory, billing. |

## Legend

| Symbol | Meaning |
|--------|---------|
| `C` | Full access — Create, Edit, Delete |
| `V` | View only |
| `A` | Approve / Sign-off |
| `O` | Override authority |
| `—` | No access |

---

## Attendance & Workforce

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| Mark own attendance | C | C | C | C | C | C | C |
| View own attendance record | C | C | C | C | C | C | C |
| View team attendance | — | — | A | — | C | C | C |
| Edit attendance record | — | — | A | — | C | C | O |
| Approve leave / absence | — | — | A | — | C | C | O |
| Generate attendance report | — | — | V | — | C | C | C |

**Notes:**
- Every role can mark and view their own attendance — this is the base-level action.
- Supervisor sees and approves their team only. Manager sees full workforce.
- Owner can override any locked or disputed attendance record.

---

## Steel Production

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View production batch | — | C | C | — | C | C | C |
| Create production batch | — | C | A | — | C | C | C |
| Edit production batch | — | — | C | — | C | C | O |
| Delete production batch | — | — | — | — | — | C | C |
| Approve batch variance | — | — | A | — | C | C | O |
| View production variance | — | C | C | — | C | C | C |
| View production reports | — | — | C | — | C | C | C |

**Notes:**
- Accountant is excluded from all production batch details — batch data is not a financial record.
- Operator records batches. Supervisor must approve Operator entries.
- Deletion is destructive and audit-logged — Admin and Owner only.
- Owner can override any locked or completed batch.

---

## Steel Inventory

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View stock levels | — | C | C | — | C | C | C |
| Create inventory transaction | — | — | C | — | C | C | C |
| Reconcile / adjust stock | — | — | — | — | C | C | O |
| Delete inventory record | — | — | — | — | — | C | C |
| Override stock figure | — | — | — | — | — | — | O |
| View inventory reports | — | — | C | — | C | C | C |

**Notes:**
- Accountant excluded — inventory is not their domain.
- Manual inventory transactions: Supervisor, Manager, Owner only. All others are auto-posted by production or dispatch.
- Stock figure override is Owner-only and always audit-logged with reason and timestamp.

---

## Steel Sales & Invoicing

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View invoice | — | — | — | C | C | C | C |
| Create sales invoice | — | — | — | C | C | C | C |
| Edit invoice (pre-dispatch) | — | — | — | C | C | C | C |
| Edit invoice (post-dispatch) | — | — | — | — | — | C | O |
| Delete / void invoice | — | — | — | — | — | C | C |
| Check customer credit limit | — | — | — | C | C | C | C |
| Override credit limit | — | — | — | — | C | C | O |
| View outstanding balances | — | — | — | C | C | C | C |
| View financial reports | — | — | — | C | C | C | C |

**Notes:**
- Operational roles (Attendance, Operator, Supervisor) have zero invoice visibility — clean separation of duties.
- Invoices lock after first dispatch is linked. Only Admin can edit with reason; Owner overrides any state.
- Accountant cannot delete invoices — they must raise a credit note instead. Deletion is Admin/Owner only.

---

## Payments

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| Record customer payment | — | — | — | C | C | C | C |
| Allocate payment to invoice | — | — | — | C | C | C | C |
| Edit payment record | — | — | — | C | C | C | O |
| Delete payment record | — | — | — | — | — | C | C |
| Override payment allocation | — | — | — | — | C | C | O |

**Notes:**
- No self-allocation by operational staff.
- Accountant cannot delete financial records — Admin and Owner only.
- Manager can re-allocate payments within scope. Owner forces any re-allocation regardless of invoice state.

---

## Steel Customers

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View customer profile | — | — | — | C | C | C | C |
| Create / edit customer | — | — | — | C | C | C | C |
| Delete customer | — | — | — | — | — | C | C |
| Manage follow-up tasks | — | — | — | C | C | C | C |
| View customer credit limit | — | — | — | C | C | C | C |

**Notes:**
- Credit terms and contact data are financial — operational roles excluded.
- Customers with open invoices cannot be deleted without force unlinking.

---

## Steel Dispatch & Logistics

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View dispatch detail | — | V | C | V | C | C | C |
| Create dispatch | — | — | C | — | C | C | C |
| Update dispatch status | — | — | A | — | C | C | C |
| Approve dispatch status change | — | — | A | — | C | C | O |
| Log truck entry / exit | — | C | C | — | C | C | C |
| Generate gate pass | — | — | C | — | C | C | C |
| Delete dispatch | — | — | — | — | — | C | C |
| Override dispatch quantity | — | — | — | — | C | C | O |

**Notes:**
- Operator sees gate-level view only. Accountant views for invoice reconciliation only.
- Dispatch status lifecycle: Pending → Loaded → Dispatched → Delivered. Supervisor approves each step.
- Dispatch quantity cannot exceed invoice remaining weight without Manager/Owner override.
- Dispatches linked to invoices require unlinking before deletion.

---

## OCR & Document Intelligence

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| Upload document for OCR | — | — | C | C | C | C | C |
| View OCR job list | — | — | C | C | C | C | C |
| Review / correct OCR output | — | — | C | C | C | C | C |
| Approve OCR extraction | — | — | A | A | C | C | C |
| Delete OCR job | — | — | — | — | — | C | C |

**Notes:**
- Domain-split approval: Supervisor approves production document extractions; Accountant approves financial document extractions.
- Operators are excluded from OCR — document intelligence is a Supervisor-and-above function.

---

## Operations Alerting

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View alert notifications | — | — | C | — | C | C | C |
| Acknowledge / dismiss alert | — | — | C | — | C | C | C |
| Configure alert rules | — | — | — | — | — | C | C |
| Manage alert recipients | — | — | — | — | — | C | C |

**Notes:**
- Accountant excluded from operational alerts — alerts are production/logistics events.
- Alert configuration is system-level — Admin and Owner only.

---

## User & Access Management

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View user list | — | — | — | — | — | C | C |
| Create / edit users | — | — | — | — | — | C | C |
| Assign roles (RBAC) | — | — | — | — | — | C | O |
| Delete / deactivate user | — | — | — | — | — | C | C |
| Manage multi-factory access | — | — | — | — | — | — | C |

**Notes:**
- Admin assigns roles within their permission scope — Admin cannot assign the Owner role.
- Owner assigns any role including Admin.
- Multi-factory / cross-tenant access is Owner-only configuration.

---

## Billing & Subscription

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View billing / subscription | — | — | — | — | — | C | C |
| Manage subscription plan | — | — | — | — | — | — | C |
| View usage & billing history | — | — | — | — | — | C | C |

**Notes:**
- Changing subscription plans has financial and operational implications — Owner only.
- Admin can view billing for support/troubleshooting purposes.

---

## System & Audit

| Action | ATTENDANCE | OPERATOR | SUPERVISOR | ACCOUNTANT | MANAGER | ADMIN | OWNER |
|--------|:----------:|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| View audit logs | — | — | — | — | — | C | C |
| View system observability | — | — | — | — | — | C | C |
| Configure system settings | — | — | — | — | — | C | C |
| Override any system action | — | — | — | — | — | — | O |

**Notes:**
- Audit logs capture every create, edit, delete, and override action system-wide.
- Override any system action is the Owner's nuclear option — unconditional, always audit-logged.

---

## Role Summary Card

| Role | Primary Domain | Can Approve | Can Override | System Access |
|------|---------------|-------------|--------------|---------------|
| **ATTENDANCE** | Own attendance only | — | — | — |
| **OPERATOR** | Production floor, gate | — | — | — |
| **SUPERVISOR** | Team production, dispatch, attendance | Team-level | — | — |
| **ACCOUNTANT** | Invoices, payments, customers | Financial OCR | — | — |
| **MANAGER** | All operations + finance bridge | All operational | Dispatch qty, credit limit, payments | — |
| **ADMIN** | System config, users, alerts | — | — | Full (except Owner-only) |
| **OWNER** | Everything | Everything | Everything | Full + cross-factory + billing |

---

*Document: FactoryNerve Role Permission Matrix*
*Roles: ATTENDANCE / OPERATOR / SUPERVISOR / ACCOUNTANT / MANAGER / ADMIN / OWNER*
*Modules: Attendance, Production, Inventory, Sales, Payments, Customers, Dispatch, OCR, Alerting, Users, Billing, System*
